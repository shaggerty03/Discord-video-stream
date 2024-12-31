import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, Utils, NewApi } from "../../../src/index.js";
import config from "./config.json" with {type: "json"};

const VIDEO_PATH = "/home/unicorns/Stuff/LumaUpscaling/SpiritedAway/SpiritedAway.mkv";

const streamer = new Streamer(new Client());
let current: ReturnType<typeof NewApi.prepareStream>["command"];

// ready event
streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

// message event
streamer.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (!config.acceptedAuthors.includes(msg.author.id)) return;
    if (!msg.content) return;
    if (msg.content.startsWith(`$play`)) {
        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await streamer.joinVoice(msg.guildId, channel.id);

        if(channel instanceof StageChannel)
        {
            await streamer.client.user.voice.setSuppressed(false);
        }

        const { command, output } = NewApi.prepareStream(VIDEO_PATH, {
            width: config.streamOpts.width,
            height: config.streamOpts.height,
            frameRate: config.streamOpts.fps,
            bitrateVideo: config.streamOpts.bitrateKbps,
            bitrateVideoMax: config.streamOpts.maxBitrateKbps,
            hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
            videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec)
        })

        current = command;
        await NewApi.playStream(output, streamer)
            .catch(() => current?.kill("SIGTERM"));
        return;
    } else if (msg.content.startsWith("$disconnect")) {
        current?.kill("SIGTERM");
        streamer.leaveVoice();
    } else if(msg.content.startsWith("$stop-stream")) {
        current?.kill("SIGTERM");
    } else if (msg.content.startsWith("$pause")) {
        current?.kill("SIGINT");
    } else if (msg.content.startsWith("$resume")) {
        current?.kill("SIGCONT");
    }
});

// login
streamer.client.login(config.token);
