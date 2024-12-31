import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';
import { MediaUdp } from '../client/voice/MediaUdp.js';
import { demux } from './LibavDemuxer.js';
import { VideoStream } from './VideoStream.js';
import { AudioStream } from './AudioStream.js';

export type StreamStatus = 'playing' | 'paused' | 'stopped';

interface FFmpegProgress {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  dropFrames?: number;
  percent?: number;
}

export interface StreamStats {
  framesEncoded: number;
  framesDropped: number;
  currentFps: number;
  currentKbps: number;
  avgKbps: number;
  duration: number;
  timestamp: string;
}

export class VideoStreamController extends EventEmitter {
  private command?: ffmpeg.FfmpegCommand;
  private output?: PassThrough;
  private videoStream?: VideoStream;
  private audioStream?: AudioStream;
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private currentInput?: string;
  private currentIncludeAudio: boolean = true;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private currentPosition: number = 0;
  private _status: StreamStatus = 'stopped';
  
  // Statistics tracking
  private stats: StreamStats = {
    framesEncoded: 0,
    framesDropped: 0,
    currentFps: 0,
    currentKbps: 0,
    avgKbps: 0,
    duration: 0,
    timestamp: "00:00:00"
  };
  private lastStatsUpdate = 0;
  private totalBytesProcessed = 0;
  private lastBytesProcessed = 0;
  private lastFrameCount = 0;
  private lastDroppedFrames = 0;

  constructor(private mediaUdp: MediaUdp) {
    super();
  }

  getStreamStats(): StreamStats {
    return { ...this.stats };
  }

  private updateStats(progress: FFmpegProgress) {
    const now = Date.now();
    const timeDiff = (now - this.lastStatsUpdate) / 1000; // in seconds

    if (timeDiff >= 1) { // Update stats every second
      // Update frames and FPS (directly from FFmpeg)
      this.stats.framesEncoded = progress.frames || 0;
      this.stats.currentFps = progress.currentFps || 0;
      
      // Update bitrates (directly from FFmpeg)
      this.stats.currentKbps = progress.currentKbps || 0;
      
      // Update timestamp and duration
      this.stats.timestamp = progress.timemark;
      
      // Convert timemark (HH:MM:SS.mm) to seconds
      const [timepart, mspart = '0'] = progress.timemark.split('.');
      const [hours, minutes, seconds] = timepart.split(':').map(Number);
      const timeInSeconds = (hours * 3600) + (minutes * 60) + seconds + (Number(mspart) / 100);
      this.stats.duration = timeInSeconds;

      // Calculate average bitrate from total size
      const totalKbits = (progress.targetSize || 0) * 8; // Convert KB to Kb
      this.stats.avgKbps = timeInSeconds > 0 ? 
        Math.round(totalKbits / timeInSeconds) : 
        0;

      // Store values for next update
      this.lastStatsUpdate = now;
      this.lastBytesProcessed = progress.targetSize || 0;
      this.totalBytesProcessed = progress.targetSize || 0;

      // Emit stats update event
      this.emit('statsUpdate', this.getStreamStats());
    }
  }

  private set status(newStatus: StreamStatus) {
    if (this._status !== newStatus) {
      const oldStatus = this._status;
      this._status = newStatus;
      this.emit('statusChange', { oldStatus, newStatus });
      this.emit(newStatus); // Emit individual events for each status
    }
  }

  async start(input: string, includeAudio: boolean = true) {
    if (this.command) {
      throw new Error('Stream already running');
    }

    this.currentInput = input;
    this.currentIncludeAudio = includeAudio;
    this.isPaused = false;
    this.isStopped = false;
    this.startTime = Date.now() / 1000;
    this.currentPosition = 0;
    await this.startStream(input, includeAudio, 0);
    this.status = 'playing';
  }

  async seek(seconds: number) {
    if (this.isStopped) {
      return;
    }

    // Store whether we were paused
    const wasPaused = this.isPaused;
    
    // Calculate new position
    this.currentPosition = seconds;
    
    // Stop current playback
    if (this.command) {
      this.command.kill('SIGKILL');
      this.cleanupStreams();
    }

    // Start new stream from seek position
    await this.startStream(this.currentInput!, this.currentIncludeAudio, this.currentPosition);
    
    // Update timing
    this.startTime = (Date.now() / 1000) - this.currentPosition;
    
    // If we were paused, pause again
    if (wasPaused) {
      this.pause();
    }
  }

  getCurrentTimestamp(): string {
    if (this.isStopped) {
      return "00:00:00";
    }

    let seconds = this.isPaused ? 
      this.pausedAt : 
      (Date.now() / 1000) - this.startTime;

    // Format timestamp as HH:MM:SS
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private parseStderr(line: string) {
    // Parse frame stats from lines like:
    // frame=  129 fps= 30 q=26.0 size=     633kB time=00:00:04.89 bitrate=1060.4kbits/s dup=26 drop=0
    const dropMatch = line.match(/drop=(\d+)/);
    if (dropMatch) {
      this.lastDroppedFrames = parseInt(dropMatch[1]);
      this.stats.framesDropped = this.lastDroppedFrames;
    }
  }

  private async startStream(input: string, includeAudio: boolean, seekTime: number = 0) {
    this.output = new PassThrough();

    // Reset statistics
    this.stats = {
      framesEncoded: 0,
      framesDropped: 0,
      currentFps: 0,
      currentKbps: 0,
      avgKbps: 0,
      duration: 0,
      timestamp: "00:00:00"
    };
    this.lastStatsUpdate = Date.now();
    this.totalBytesProcessed = 0;
    this.lastBytesProcessed = 0;
    this.lastFrameCount = 0;
    this.lastDroppedFrames = 0;

    // Create FFmpeg command with more robust configuration
    this.command = ffmpeg(input)
      .addInputOption('-re')
      .addInputOption('-hwaccel', 'auto')
      .addInputOption('-analyzeduration', '20000000')
      .addInputOption('-probesize', '100000000')
      .addOption('-stats')
      .addOption('-loglevel', 'info')
      .on('start', (commandLine) => {
        console.log('FFmpeg started with command:', commandLine);
      })
      .on('progress', (progress) => {
        this.updateStats(progress);
      })
      .on('stderr', (stderrLine) => {
        this.parseStderr(stderrLine);
      })
      .on('end', () => {
        // Handle normal end of stream or stop
        if (!this.isPaused) {
          console.log('Stream ended');
          this.isStopped = true;
          this.cleanup();
        }
      })
      .on('error', (err, stdout, stderr) => {
        // Only log and throw errors if they're not from a normal stop/pause operation
        if (!this.isPaused && !this.isStopped && 
            !err.message.includes('Output stream closed') && 
            !err.message.includes('Reached end of stream')) {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          this.cleanup();
          throw err;
        }
      });

    // Seek if needed
    if (seekTime > 0) {
      this.command.seekInput(seekTime);
      this.currentPosition = seekTime;
    }

    // Configure output with more explicit options
    this.command
      .output(this.output)
      .outputFormat('matroska')
      .outputOptions([
        '-map', '0:v:0',  // Select first video stream
        '-map', '0:a:0?'  // Select first audio stream (if exists)
      ]);

    // Configure video
    const streamOpts = this.mediaUdp.mediaConnection.streamOptions;
    this.command
      .size(`${streamOpts.width}x${streamOpts.height}`)
      .fpsOutput(streamOpts.fps)
      .videoBitrate(`${streamOpts.bitrateKbps}k`)
      .videoCodec('libx264')
      .outputOptions([
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-maxrate', `${streamOpts.bitrateKbps}k`,
        '-bufsize', `${streamOpts.bitrateKbps * 2}k`,
        `-g`, `${streamOpts.fps}`,
        `-x264-params`, `keyint=${streamOpts.fps}:min-keyint=${streamOpts.fps}:scenecut=0`,
        '-thread_queue_size', '4096'
      ]);

    // Configure audio if needed
    if (includeAudio) {
      this.command
        .audioChannels(2)
        .audioFrequency(48000)
        .audioCodec('libopus')
        .audioBitrate('128k');
    } else {
      this.command.noAudio();
    }

    try {
      // Start the stream
      this.command.run();

      // Set up demuxing
      const { video, audio } = await demux(this.output);
      
      if (!video) {
        throw new Error('No video stream found in input');
      }

      // Set up video stream
      this.videoStream = new VideoStream(this.mediaUdp);
      video.stream.pipe(this.videoStream);

      // Set up audio stream if needed
      if (includeAudio && audio) {
        this.audioStream = new AudioStream(this.mediaUdp);
        audio.stream.pipe(this.audioStream);
      }

      // Set speaking and video status
      this.mediaUdp.mediaConnection.setSpeaking(includeAudio && !this.isPaused);
      this.mediaUdp.mediaConnection.setVideoStatus(true);
    } catch (error) {
      console.error('Error starting stream:', error);
      this.cleanup();
      throw error;
    }
  }

  pause() {
    if (!this.command || this.isStopped || this.isPaused) {
      return;
    }

    // Calculate time elapsed since start
    this.pausedAt = (Date.now() / 1000) - this.startTime;
    
    // Stop the current stream but keep state as paused
    this.isPaused = true;
    this.command.kill('SIGINT');
    this.cleanupStreams();
    
    this.mediaUdp.mediaConnection.setSpeaking(false);
    this.status = 'paused';
  }

  async resume() {
    if (!this.currentInput || this.isStopped || !this.isPaused) {
      return;
    }

    // Start a new stream from the paused position
    await this.startStream(this.currentInput, this.currentIncludeAudio, this.pausedAt);
    
    // Update the start time to account for the pause duration
    this.startTime = (Date.now() / 1000) - this.pausedAt;
    this.isPaused = false;
    this.status = 'playing';
  }

  stop() {
    if (!this.command && !this.isPaused) {
      return;
    }

    console.log('Stopping stream...');
    
    // Set stopped state before killing the process
    this.isStopped = true;

    try {
      // Cleanup streams first
      this.cleanupStreams();
      
      // Then kill FFmpeg if it's still running
      if (this.command) {
        this.command.kill('SIGKILL');  // Use SIGKILL instead of SIGINT for immediate stop
      }
    } catch (error) {
      console.error('Error during stop:', error);
    } finally {
      // Always perform final cleanup
      this.cleanup();
      this.status = 'stopped';
      console.log('Stream stopped');
    }
  }

  private cleanupStreams() {
    try {
      if (this.videoStream) {
        this.videoStream.end();
        this.videoStream = undefined;
      }
      if (this.audioStream) {
        this.audioStream.end();
        this.audioStream = undefined;
      }
      if (this.output) {
        this.output.end();
        this.output = undefined;
      }
      this.command = undefined;
    } catch (error) {
      console.error('Error cleaning up streams:', error);
    }
  }

  private cleanup() {
    try {
      this.cleanupStreams();
      this.mediaUdp.mediaConnection.setSpeaking(false);
      this.mediaUdp.mediaConnection.setVideoStatus(false);
      
      this.currentInput = undefined;
      this.isPaused = false;
      this.isStopped = false;
      this.startTime = 0;
      this.pausedAt = 0;
      this.status = 'stopped';
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  isPlaying(): boolean {
    return (!!this.command || this.isPaused) && !this.isStopped;
  }

  getStatus(): StreamStatus {
    return this._status;
  }

  getCurrentPosition(): number {
    if (this.isStopped) {
      return 0;
    }
    return this.isPaused ? 
      this.pausedAt : 
      (Date.now() / 1000) - this.startTime;
  }
} 