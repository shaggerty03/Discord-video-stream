import { MediaUdp } from "../client/voice/MediaUdp.js";
import { BaseMediaStream } from "./BaseMediaStream.js";

export class VideoStream extends BaseMediaStream {
    public udp: MediaUdp;

    constructor(udp: MediaUdp, noSleep: boolean = false) {
        super("video", noSleep);
        this.udp = udp;
    }

    protected override async _sendFrame(frame: Buffer, frametime: number): Promise<void> {
        await this.udp.sendVideoFrame(frame, frametime);
    }
}
