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
  private currentVolume: number = 1.0;

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
  private lastDroppedFrames = 0;

  constructor(private mediaUdp: MediaUdp) {
    super();
  }

  getStreamStats(): StreamStats {
    return { ...this.stats };
  }

  private updateStats(progress: FFmpegProgress) {
    const now = Date.now();
    const timeDiff = (now - this.lastStatsUpdate) / 1000;

    if (timeDiff >= 1) {
      this.stats.framesEncoded = progress.frames || 0;
      this.stats.currentFps = progress.currentFps || 0;
      this.stats.currentKbps = progress.currentKbps || 0;

      const [timepart, mspart = '0'] = progress.timemark.split('.');
      const [hours, minutes, seconds] = timepart.split(':').map(Number);
      const progressTimeInSeconds = (hours * 3600) + (minutes * 60) + seconds + (Number(mspart) / 100);
      const totalTimeInSeconds = progressTimeInSeconds + this.currentPosition;

      const totalHours = Math.floor(totalTimeInSeconds / 3600);
      let remainingSeconds = totalTimeInSeconds % 3600;
      const totalMinutes = Math.floor(remainingSeconds / 60);
      remainingSeconds = remainingSeconds % 60;
      const formattedTimestamp = `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}:${Math.floor(remainingSeconds).toString().padStart(2, '0')}.${mspart}`;

      this.stats.timestamp = formattedTimestamp;
      this.stats.duration = totalTimeInSeconds;

      const totalKbits = (progress.targetSize || 0) * 8;
      this.stats.avgKbps = this.stats.duration > 0 ?
        Math.round(totalKbits / this.stats.duration) :
        0;

      this.lastStatsUpdate = now;

      this.emit('statsUpdate', this.getStreamStats());
    }
  }

  private set status(newStatus: StreamStatus) {
    if (this._status !== newStatus) {
      const oldStatus = this._status;
      this._status = newStatus;
      this.emit('statusChange', { oldStatus, newStatus });
      this.emit(newStatus);
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
    await this.startStream(input, includeAudio, 0);
    this.status = 'playing';
  }

  async seek(seconds: number) {
    if (this.isStopped) {
      return;
    }

    const currentPos = this.getCurrentPosition();
    const newPosition = currentPos + seconds;

    // Store current state
    const wasPaused = this.isPaused;
    
    // Stop current stream
    if (this.command) {
      this.command.kill('SIGKILL');
      this.cleanupStreams();
    }

    // Start new stream at seek position
    await this.startStream(this.currentInput!, this.currentIncludeAudio, newPosition);
    this.startTime = (Date.now() / 1000) - newPosition;
    this.currentPosition = newPosition;

    // Restore pause state if needed
    if (wasPaused) {
      this.pause();
    }

    // Emit seek event
    this.emit('seek', { position: newPosition });
  }

  getCurrentTimestamp(): string {
    if (this.isStopped) return "00:00:00";
    let seconds = this.isPaused ? this.pausedAt : (Date.now() / 1000) - this.startTime;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private parseStderr(line: string) {
    const dropMatch = line.match(/drop=(\d+)/);
    if (dropMatch) {
      this.lastDroppedFrames = parseInt(dropMatch[1]);
      this.stats.framesDropped = this.lastDroppedFrames;
    }
  }

  private async startStream(input: string, includeAudio: boolean, seekTime: number = 0) {
    this.output = new PassThrough();

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
    this.lastDroppedFrames = 0;

    this.command = ffmpeg(input)
      .addInputOption('-re')
      .addInputOption('-hwaccel', 'auto')
      .addInputOption('-analyzeduration', '20000000')
      .addInputOption('-probesize', '100000000')
      .addOption('-stats')
      .addOption('-loglevel', 'debug')
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
        if (!this.isPaused) {
          console.log('Stream ended');
          this.isStopped = true;
          this.cleanup();
        }
      })
      .on('error', (err, stdout, stderr) => {
        if (!this.isPaused && !this.isStopped &&
          !err.message.includes('Output stream closed') &&
          !err.message.includes('Reached end of stream')) {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          this.cleanup();
          throw err;
        }
      });

    if (seekTime > 0) {
      this.command.seekInput(seekTime);
      this.currentPosition = seekTime;
    }

    const streamOpts = this.mediaUdp.mediaConnection.streamOptions;
    const filterComplex = `[0:a:0]aformat=channel_layouts=stereo,aresample=48000[fmt];[fmt]volume=${this.currentVolume}[vol];[vol]asetpts=PTS-STARTPTS[audio_out];[0:v:0]setpts=PTS-STARTPTS,scale=${streamOpts.width}:${streamOpts.height}[video_out]`

    this.command
      .output(this.output)
      .outputFormat('matroska')
      .addOption('-filter_complex', filterComplex)
      .videoCodec('libx264')
      .outputOptions([
        '-map', '[video_out]',
        '-map', '[audio_out]',
        '-r', `${streamOpts.fps}`,
        '-b:v', `${streamOpts.bitrateKbps}k`,
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

    if (includeAudio) {
      this.command
        .audioCodec('libopus')
        .audioBitrate('128k');
    } else {
      this.command.noAudio();
    }

    try {
      // Start FFmpeg
      this.command.run();

      // Wait for FFmpeg to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { video, audio } = await demux(this.output);

      if (!video) {
        throw new Error('No video stream found in input');
      }

      this.videoStream = new VideoStream(this.mediaUdp);
      video.stream.pipe(this.videoStream);

      if (includeAudio && audio) {
        this.audioStream = new AudioStream(this.mediaUdp);
        audio.stream.pipe(this.audioStream);

        this.videoStream.syncStream = this.audioStream;
        this.audioStream.syncStream = this.videoStream;
      }

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

    this.pausedAt = this.getCurrentPosition();
    this.currentPosition = this.pausedAt;

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

    await this.startStream(this.currentInput, this.currentIncludeAudio, this.currentPosition);
    this.startTime = (Date.now() / 1000) - this.currentPosition;
    this.isPaused = false;
    this.status = 'playing';
  }

  stop() {
    if (!this.command && !this.isPaused) {
      return;
    }

    console.log('Stopping stream...');

    this.isStopped = true;

    try {
      this.cleanupStreams();

      if (this.command) {
        this.command.kill('SIGKILL');
      }
    } catch (error) {
      console.error('Error during stop:', error);
    } finally {
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

  private parseSeekTime(seekTime: string): number {
    const match = seekTime.match(/^(-?\d+)(s|m|h|hr)?$/i);
    if (!match)
      throw new Error('Invalid seek time format. Use: number + optional unit (s/m/h/hr). Example: 10s, -5m, 1h');
    const [, amount, unit = 's'] = match;
    const value = parseInt(amount, 10);
    switch (unit.toLowerCase()) {
      case 'h':
      case 'hr':
        return value * 3600;
      case 'm':
        return value * 60;
      case 's':
      default:
        return value;
    }
  }

  async seekByTime(timeStr: string) {
    const seconds = this.parseSeekTime(timeStr);
    await this.seek(seconds);
  }

  public async setVolume(value: number): Promise<void> {
    this.currentVolume = value;
    if (this.command) {
      await this.seek(0); // Restart stream to apply new volume
    }
  }

  public async getVolume(): Promise<number> {
    return this.currentVolume;
  }
}
