# Discord self-bot video
Fork: [Discord-video-experiment](https://github.com/mrjvs/Discord-video-experiment)

> [!CAUTION]
> Using any kind of automation programs on your account can result in your account getting permanently banned by Discord. Use at your own risk

This project implements the custom Discord UDP protocol for sending media. Since Discord is likely change their custom protocol, this library is subject to break at any point. An effort will be made to keep this library up to date with the latest Discord protocol, but it is not guranteed.

For better stability it is recommended to use WebRTC protocol instead since Discord is forced to adhere to spec, which means that the non-signaling portion of the code is guaranteed to work.

## Features
 - Playing video & audio in a voice channel (`Go Live`, or webcam video)

## Implementation
What I implemented and what I did not.

#### Video codecs
 - [X] VP8
 - [ ] VP9
 - [X] H.264
 - [X] H.265
 - [ ] AV1

#### Packet types
 - [X] RTP (sending of realtime data)
 - [ ] RTX (retransmission)

#### Connection types
 - [X] Regular Voice Connection
 - [X] Go live

 ### Encryption
 - [X] Transport Encryption
 - [ ] https://github.com/dank074/Discord-video-stream/issues/102

#### Extras
 - [X] Figure out rtp header extensions (discord specific) (discord seems to use one-byte RTP header extension https://www.rfc-editor.org/rfc/rfc8285.html#section-4.2)

Extensions supported by Discord (taken from the webrtc sdp exchange)
```
"a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level"
"a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
"a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"
"a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid"
"a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay"
"a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type"
"a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing"
"a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space"
"a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id"
"a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id"
"a=extmap:13 urn:3gpp:video-orientation"
"a=extmap:14 urn:ietf:params:rtp-hdrext:toffset"
```
## Requirements
Ffmpeg is required for the usage of this package. If you are on linux you can easily install ffmpeg from your distribution's package manager.

If you are on Windows, you can download it from the official ffmpeg website: https://ffmpeg.org/download.html

## Usage
Install the package, alongside its peer-dependency discord.js-selfbot-v13:
```
npm install @dank074/discord-video-stream@latest
npm install discord.js-selfbot-v13@latest
```

Create a new Streamer, and pass it a selfbot Client
```typescript
import { Client } from "discord.js-selfbot-v13";
import { Streamer } from '@dank074/discord-video-stream';

const streamer = new Streamer(new Client());
await streamer.client.login('TOKEN HERE');

```

Make client join a voice channel and create a stream:
```typescript
await streamer.joinVoice("GUILD ID HERE", "CHANNEL ID HERE");

const udp = await streamer.createStream({
    // stream options here
});
```

Start sending media over the udp connection:
```typescript
udp.mediaConnection.setSpeaking(true);
udp.mediaConnection.setVideoStatus(true);
try {
    const cancellableCommand = await streamLivestreamVideo("DIRECT VIDEO URL OR READABLE STREAM HERE", udp);

    const result = await cancellableCommand;
    console.log("Finished playing video " + res);
} catch (e) {
    if (command.isCanceled) {
            // Handle the cancelation here
            console.log('Ffmpeg command was cancelled');
        } else {
            console.log(e);
        }
} finally {
    udp.mediaConnection.setSpeaking(false);
    udp.mediaConnection.setVideoStatus(false);
}
```

## Stream options available
```typescript
/**
 * Video output width
 */
width?: number;
/**
 * Video output height
 */
height?: number;
/**
 * Video output frames per second
 */
fps?: number;
/**
 * Video output bitrate in kbps
 */
bitrateKbps?: number;
maxBitrateKbps?: number;
/**
 * Enables hardware accelerated video decoding. Enabling this option might result in an exception
 * being thrown by Ffmpeg process if your system does not support hardware acceleration
 */
hardwareAcceleratedDecoding?: boolean;
/**
 * Output video codec. **Only** supports H264, H265, and VP8 currently
 */
videoCodec?: SupportedVideoCodec;
/**
 * Enables sending RTCP sender reports. Helps the receiver synchronize the audio/video frames, except in some weird
 * cases which is why you can disable it
 */
rtcpSenderReportEnabled?: boolean;
/**
 * Encoding preset for H264 or H265. The faster it is, the lower the quality
 */
h26xPreset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
/**
 * Adds ffmpeg params to minimize latency and start outputting video as fast as possible.
 * Might create lag in video output in some rare cases
 */
minimizeLatency?: boolean;
/**
 * ChaCha20-Poly1305 Encryption is faster than AES-256-GCM, except when using AES-NI
 */
forceChacha20Encryption?: boolean;
```
## Running example
`examples/basic/src/config.json`:
```json
"token": "SELF TOKEN HERE",
"acceptedAuthors": ["USER_ID_HERE"],
```

1. Configure your `config.json` with your accepted authors ids, and your self token
2. Generate js files with ```npm run build```
3. Start program with: ```npm run start```
4. Join a voice channel
5. Start streaming with commands: 

for go-live
```
$play-live <Direct video link>
```
or for cam
```
$play-cam <Direct video link>
```

for example:
```
$play-live http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
```

## FAQS
- Can I stream on existing voice connection (CAM) and in a go-live connection simultaneously?

Yes, just send the media packets over both udp connections. The voice gateway expects you to signal when a user turns on their camera, so make sure you signal using `client.signalVideo(guildId, channelId, true)` before you start sending cam media packets.

- Does this library work with bot tokens?

No, Discord blocks video from bots which is why this library uses a selfbot library as peer dependency. You must use a user token
