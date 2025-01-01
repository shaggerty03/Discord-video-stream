import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, Utils, NewApi } from "../../../src/index.js";
import { VideoStreamController } from "../../../src/media/VideoStreamController.js";
import config from "./config.json" with {type: "json"};
import ffmpeg from "fluent-ffmpeg";

const VIDEO_PATH = "/home/unicorns/TVShows/S01E01.mkv";

const streamer = new Streamer(new Client());
let videoController: VideoStreamController | null = null;

streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

streamer.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (!config.acceptedAuthors.includes(msg.author.id)) return;
    if (!msg.content) return;

    if (msg.content.startsWith(`$play`)) {
        const channel = msg.author.voice.channel;

        if (!channel) {
            msg.reply("You need to be in a voice channel to play the stream.");
            return;
        }

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await streamer.joinVoice(msg.guildId, channel.id);

        if (channel instanceof StageChannel) {
            await streamer.client.user.voice.setSuppressed(false);
        }

        if (videoController) {
            videoController.stop();
            videoController = null;
        }

        try {
            videoController = await NewApi.playStream(VIDEO_PATH, streamer, {
                width: config.streamOpts.width,
                height: config.streamOpts.height,
                frameRate: config.streamOpts.fps,
                videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec),
                bitrateKbps: config.streamOpts.bitrateKbps,
                h26xPreset: 'ultrafast',
                includeAudio: true,
                rtcpSenderReportEnabled: true,
                forceChacha20Encryption: false,
            });


            videoController.on("statusChange", ({ oldStatus, newStatus }) => {
                console.log(`Stream status changed from ${oldStatus} to ${newStatus}`);
            });

            videoController.on("statsUpdate", (stats) => {
                console.log("Stream stats:", stats);
            });

            videoController.on("stopped", () => {
                console.log("Stream has stopped");
                videoController = null;
            });

            msg.reply("Stream has started.");
        } catch (error) {
            console.error("Error starting stream:", error);
            msg.reply("Error starting the stream.");
        }

        return;
    } else if (msg.content.startsWith("$disconnect")) {
        if (videoController) {
            videoController.stop();
            videoController = null;
        }
        await streamer.leaveVoice();
        msg.reply("Disconnected from the voice channel.");
    } else if (msg.content.startsWith("$stop-stream")) {
        if (videoController) {
            videoController.stop();
            videoController = null;
            msg.reply("Stream has been stopped.");
        } else {
            msg.reply("No stream is currently playing.");
        }
    } else if (msg.content.startsWith("$pause")) {
        if (videoController && videoController.getStatus() === "playing") {
            videoController.pause();
            msg.reply("Stream has been paused.");
        } else {
            msg.reply("No stream is currently playing or already paused.");
        }
    } else if (msg.content.startsWith("$resume")) {
        if (videoController && videoController.getStatus() === "paused") {
            await videoController.resume();
            msg.reply("Stream has been resumed.");
        } else {
            msg.reply("No stream is currently paused.");
        }
    } else if (msg.content.startsWith("$seek ")) {
        const args = msg.content.split(" ");
        if (args.length >= 2) {
            const seekTime = args[1];
            if (videoController) {
                try {
                    await videoController.seekByTime(seekTime);
                    msg.reply(`Stream has been seeked by ${seekTime}.`);
                } catch (error) {
                    msg.reply(error.message);
                }
            } else {
                msg.reply("No stream is currently playing.");
            }
        } else {
            msg.reply("Please specify the time to seek to, e.g., $seek 60, $seek 5m, $seek -30s, $seek 1h");
        }
    }
});

streamer.client.login(config.token);
