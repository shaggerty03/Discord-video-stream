import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, Utils, NewApi } from "../../src/index.js";
import { VideoStreamController } from "../../src/media/VideoStreamController.js";
import config from "./config.json" with {type: "json"};
import express, { Request, Response } from 'express';

interface Config {
    token: string;
    acceptedAuthors: string[];
    voiceChannelId: string;
    streamOpts: {
        width: number;
        height: number;
        fps: number;
        bitrateKbps: number;
        maxBitrateKbps: number;
        hardware_acceleration: boolean;
        videoCodec: string;
    };
}

const typedConfig = config as Config;

const streamer = new Streamer(new Client());
const app = express();
let videoController: VideoStreamController | null = null;

app.use(express.json());

streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

app.post('/play', async (req, res) => {
    try {
        const { author, filepath, guild_id, voice_channel_id } = req.body;
        
        if (!author) {
            return res.status(400).json({ error: "Author ID is required" });
        }
        if (!filepath) {
            return res.status(400).json({ error: "Filepath is required" });
        }
        if (!guild_id) {
            return res.status(400).json({ error: "Guild ID is required" });
        }
        if (!voice_channel_id) {
            return res.status(400).json({ error: "Voice Channel ID is required" });
        }

        console.log(`Attempting to join voice channel ${guild_id}/${voice_channel_id}`);

        const guild = streamer.client.guilds.cache.get(guild_id);

        if (!guild) {
            return res.status(400).json({ error: 'Cannot find the guild' });
        }

        const clientMember = guild.members.cache.get(streamer.client.user.id);

        if (clientMember && clientMember.voice.channel) {
            if (clientMember.voice.channel.id === voice_channel_id) {
                console.log('Already connected to the desired voice channel, reusing existing connection.');
            } else {
                console.log(`Already connected to a different voice channel (${clientMember.voice.channel.id}).`);
                console.log('Proceeding with the existing voice connection.');
            }
        } else {
            await streamer.joinVoice(guild_id, voice_channel_id);
        }

        const channel = guild?.channels.cache.get(voice_channel_id);

        // If the channel is a Stage Channel, un-suppress the user
        if (channel instanceof StageChannel) {
            await streamer.client.user.voice.setSuppressed(false);
        }

        // Stop any existing stream
        if (videoController) {
            videoController.stop();
            videoController = null;
        }

        try {
            // Start streaming the specified filepath
            videoController = await NewApi.playStream(filepath, streamer, {
                width: typedConfig.streamOpts.width,
                height: typedConfig.streamOpts.height,
                frameRate: typedConfig.streamOpts.fps,
                videoCodec: Utils.normalizeVideoCodec(typedConfig.streamOpts.videoCodec),
                bitrateKbps: typedConfig.streamOpts.bitrateKbps,
                h26xPreset: 'ultrafast',
                includeAudio: true,
                rtcpSenderReportEnabled: true,
                forceChacha20Encryption: false,
            });

            videoController.on("statusChange", ({ oldStatus, newStatus }) => {
                console.log(`Stream status changed from ${oldStatus} to ${newStatus}`);
            });

            videoController.on("stopped", () => {
                console.log("Stream has stopped");
                videoController = null;
            });

            res.json({ message: "Stream has started" });
        } catch (error) {
            console.error("Error starting stream:", error);
            res.status(500).json({ error: "Error starting the stream" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/disconnect', async (req, res) => {
    try {
        if (videoController) {
            videoController.stop();
            videoController = null;
        }
        await streamer.leaveVoice();
        res.json({ message: "Disconnected from the voice channel" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/stop-stream', async (req, res) => {
    try {
        if (videoController) {
            videoController.stop();
            videoController = null;
            res.json({ message: "Stream has been stopped" });
        } else {
            res.status(400).json({ error: "No stream is currently playing" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/pause', async (req, res) => {
    try {
        if (videoController && videoController.getStatus() === "playing") {
            videoController.pause();
            res.json({ message: "Stream has been paused" });
        } else {
            res.status(400).json({ error: "No stream is currently playing or already paused" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/resume', async (req, res) => {
    try {
        if (videoController && videoController.getStatus() === "paused") {
            await videoController.resume();
            res.json({ message: "Stream has been resumed" });
        } else {
            res.status(400).json({ error: "No stream is currently paused" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/seek-forward', async (req, res) => {
    try {
        const seconds = 10; // Default to 10 seconds
        if (videoController && videoController.getStatus() === "playing") {
            try {
                await videoController.seek(seconds);
                res.json({ message: `Seeked forward ${seconds} seconds` });
            } catch (error) {
                console.error('Error seeking:', error);
                res.status(500).json({ error: "Failed to seek forward" });
            }
        } else {
            res.status(400).json({ error: "No stream is currently playing" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/seek-backward', async (req, res) => {
    try {
        const seconds = -10; // Default to 10 seconds
        if (videoController && videoController.getStatus() === "playing") {
            try {
                await videoController.seek(seconds);
                res.json({ message: `Seeked backward ${Math.abs(seconds)} seconds` });
            } catch (error) {
                console.error('Error seeking:', error);
                res.status(500).json({ error: "Failed to seek backward" });
            }
        } else {
            res.status(400).json({ error: "No stream is currently playing" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/seek-to', async (req, res) => {
    try {
        const { time } = req.body;
        
        if (!time || typeof time !== 'string') {
            return res.status(400).json({ error: "Time must be provided in format: 10s, 5m, 1h" });
        }

        if (videoController && videoController.getStatus() === "playing") {
            try {
                await videoController.seekByTime(time);
                res.json({ message: `Seeked to ${time}` });
            } catch (error) {
                console.error('Error seeking:', error);
                res.status(400).json({ error: "Failed to seek. Use format: 10s, 5m, 1h" });
            }
        } else {
            res.status(400).json({ error: "No stream is currently playing" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/volume', async (req, res) => {
    try {
        if (!videoController) {
            return res.status(400).json({ error: "No stream is currently playing" });
        }

        const { volume } = req.body;
        
        if (volume !== undefined) {
            if (typeof volume !== 'number' || volume < 0 || volume > 300) {
                return res.status(400).json({ error: "Volume must be a number between 0 and 300" });
            }

            try {
                const volumeValue = volume / 100;
                await videoController.setVolume(volumeValue);
                res.json({ message: `Volume set to ${volume}%` });
            } catch (error) {
                console.error('Error setting volume:', error);
                res.status(500).json({ error: "Failed to set volume" });
            }
        } else {
            const currentVolume = await videoController.getVolume();
            const volumePercent = Math.round(currentVolume * 100);
            res.json({ message: `Current volume is ${volumePercent}%` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

streamer.client.login(typedConfig.token);
