import { VoiceOpCodes } from "../voice/VoiceOpCodes.js";
import { BaseMediaConnection } from "./BaseMediaConnection.js";

export class StreamConnection extends BaseMediaConnection
{
    private _streamKey: string | null = null;
    private _serverId: string | null = null;

    public override setSpeaking(speaking: boolean): void {
        this.sendOpcode(VoiceOpCodes.SPEAKING, {
            delay: 0,
            speaking: speaking ? 2 : 0,
            ssrc: this.ssrc
        });
    }

    public override get serverId(): string | null {
        return this._serverId;
    }

    public set serverId(id: string) {
        this._serverId = id;
    }

    public get streamKey(): string | null {
        return this._streamKey;
    }
    public set streamKey(value: string) {
        this._streamKey = value;
    }
}