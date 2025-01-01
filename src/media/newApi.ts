import { isFiniteNonZero } from "../utils.js";
import type { SupportedVideoCodec } from "../utils.js";
import type { MediaUdp, Streamer } from "../client/index.js";
import { VideoStreamController } from "./VideoStreamController.js";

export type PlayStreamOptions = {
    type: "go-live" | "camera",
    width: number,
    height: number,
    frameRate: number,
    rtcpSenderReportEnabled?: boolean,
    forceChacha20Encryption?: boolean,
    includeAudio?: boolean,
    videoCodec: SupportedVideoCodec,
    bitrateKbps: number,
    h26xPreset: "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium" | "slow" | "slower" | "veryslow",
}

export async function playStream(
    input: string,
    streamer: Streamer,
    options: Partial<PlayStreamOptions> = {}
) {
    if (!streamer.voiceConnection)
        throw new Error("Bot is not connected to a voice channel");
    const defaultOptions: Partial<PlayStreamOptions> = {
        type: "go-live",
        rtcpSenderReportEnabled: true,
        forceChacha20Encryption: false,
        includeAudio: true,
    };
    const mergedOptions = { ...defaultOptions, ...options } as PlayStreamOptions;

    const requiredFields = {
        width: "Width",
        height: "Height",
        frameRate: "Frame rate",
        bitrateKbps: "Bitrate",
        videoCodec: "Video codec",
        h26xPreset: "H26x preset"
    } as const;

    Object.entries(requiredFields).forEach(([field, label]) => {
        const value = mergedOptions[field as keyof typeof requiredFields];
        if (["width", "height", "frameRate", "bitrateKbps"].includes(field)) {
            if (!isFiniteNonZero(value as number)) {
                throw new Error(`${label} must be specified, and be a positive number`);
            }
        } else if (!value) {
            throw new Error(`${label} must be specified`);
        }
    });

    let udp: MediaUdp;
    let stopStream: () => void;
    if (mergedOptions.type === "go-live") {
        udp = await streamer.createStream();
        stopStream = () => streamer.stopStream();
    } else {
        udp = streamer.voiceConnection.udp;
        streamer.signalVideo(true);
        stopStream = () => streamer.signalVideo(false);
    }

    const streamOptions = {
        width: mergedOptions.width,
        height: mergedOptions.height,
        fps: mergedOptions.frameRate,
        videoCodec: mergedOptions.videoCodec!,
        rtcpSenderReportEnabled: mergedOptions.rtcpSenderReportEnabled!,
        forceChacha20Encryption: mergedOptions.forceChacha20Encryption!,
        bitrateKbps: mergedOptions.bitrateKbps!,
        h26xPreset: mergedOptions.h26xPreset!,
    };

    udp.mediaConnection.streamOptions = streamOptions;
    await udp.mediaConnection.setProtocols();
    udp.updatePacketizer();
    udp.mediaConnection.setSpeaking(true);
    udp.mediaConnection.setVideoStatus(true);

    const videoStreamController = new VideoStreamController(udp);

    await videoStreamController.start(input, mergedOptions.includeAudio!);

    videoStreamController.on('stopped', () => {
        stopStream();
        udp.mediaConnection.setSpeaking(false);
        udp.mediaConnection.setVideoStatus(false);
    });

    return videoStreamController;
}