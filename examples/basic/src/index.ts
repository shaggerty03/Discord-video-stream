import { Client } from "discord.js-selfbot-v13";
import { VideoStreamController } from "../../../src/media/VideoStreamController.js";
import { MediaUdp } from "../../../src/client/voice/MediaUdp.js";
import { Streamer } from "../../../src/client/Streamer.js";
import { getInputMetadata, inputHasAudio } from "../../../src/media/streamLivestreamVideo.js";
import config from "./config.json" with { type: "json" };

const VIDEO_PATH = "/home/unicorns/Stuff/LumaUpscaling/SpiritedAway/SpiritedAway.mkv";
const streamer = new Streamer(new Client());
let streamController: VideoStreamController | undefined;

// ready event
streamer.client.on("ready", () => {
  console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

// message event
streamer.client.on("messageCreate", async (msg: any) => {
  if (msg.author.bot) return;

  if (!config.acceptedAuthors.includes(msg.author.id)) return;

  if (!msg.content) return;

  if (msg.content === "$play") {
    if (!msg.member?.voice?.channel) {
      msg.channel.send("You need to be in a voice channel first!");
      return;
    }

    const channel = msg.member.voice.channel;
    console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
    await streamer.joinVoice(msg.guildId, channel.id);

    const streamUdpConn = await streamer.createStream();
    await playVideo(VIDEO_PATH, streamUdpConn);
  } 
  else if (msg.content === "$pause") {
    if (streamController?.getStatus() === 'playing') {
      streamController.pause();
      msg.channel.send("Video paused");
    } else {
      msg.channel.send("No video is playing");
    }
  }
  else if (msg.content === "$resume") {
    if (streamController?.getStatus() === 'paused') {
      streamController.resume();
      msg.channel.send("Video resumed");
    } else {
      msg.channel.send("Video is not paused");
    }
  }
  else if (msg.content === "$stop") {
    if (streamController?.getStatus() !== 'stopped') {
      streamController.stop();
      streamController = undefined;
      streamer.leaveVoice();
      msg.channel.send("Video stopped and disconnected");
    } else {
      msg.channel.send("No video is playing");
    }
  }
  else if (msg.content === "$status") {
    const status = streamController?.getStatus() ?? 'stopped';
    msg.channel.send(`Current status: ${status}`);
  }
  else if (msg.content === "$timestamp") {
    if (streamController?.getStatus() !== 'stopped') {
      const timestamp = streamController.getCurrentTimestamp();
      msg.channel.send(`Current position: ${timestamp}`);
    } else {
      msg.channel.send("No video is playing");
    }
  }
  else if (msg.content.startsWith("$seek ")) {
    if (streamController?.getStatus() !== 'stopped') {
      const seconds = parseInt(msg.content.split(" ")[1]);
      if (isNaN(seconds) || seconds < 0) {
        msg.channel.send("Please provide a valid number of seconds");
        return;
      }
      await streamController.seek(seconds);
      const timestamp = streamController.getCurrentTimestamp();
      msg.channel.send(`Seeked to ${timestamp}`);
    } else {
      msg.channel.send("No video is playing");
    }
  }
  else if (msg.content === "$disconnect") {
    if (streamController) {
      streamController.stop();
      streamController = undefined;
    }
    streamer.leaveVoice();
    msg.channel.send("Disconnected from voice channel");
  }
});

// login
streamer.client.login(config.token);

async function playVideo(video: string, udpConn: MediaUdp) {
  let includeAudio = true;

  try {
    const metadata = await getInputMetadata(video);
    includeAudio = inputHasAudio(metadata);
  } catch(e) {
    console.log(e);
    return;
  }

  console.log("Started playing video");

  try {
    if (streamController) {
      streamController.stop();
    }
    
    streamController = new VideoStreamController(udpConn);
    await streamController.start(video, includeAudio);
  } catch (e) {
    console.log(e);
    streamController = undefined;
  }
}
