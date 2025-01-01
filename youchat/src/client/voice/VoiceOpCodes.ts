export enum VoiceOpCodes {
    IDENTIFY = 0,
    SELECT_PROTOCOL = 1,
    READY = 2,
    HEARTBEAT = 3,
    SELECT_PROTOCOL_ACK = 4,
    SPEAKING = 5,
    HEARTBEAT_ACK = 6,
    RESUME = 7,
    HELLO = 8,
    RESUMED = 9,
    VIDEO = 12,
    CLIENT_DISCONNECT = 13,
    SESSION_UPDATE = 14,
    MEDIA_SINK_WANTS = 15,
    VOICE_BACKEND_VERSION = 16,
    CHANNEL_OPTIONS_UPDATE = 17,
    FLAGS = 18,
    SPEED_TEST = 19,
    PLATFORM = 20
}