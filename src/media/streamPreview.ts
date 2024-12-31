import axios from 'axios';
import fetch from 'node-fetch';
import sharp from 'sharp';

/**
 * Converts an image URL to base64 format with resizing
 */
async function imageToBase64(imageUrl: string): Promise<string> {
    const res = await fetch(imageUrl);
    const buffer = await res.buffer();
    const base64Image = await sharp(buffer)
        .resize(1000)
        .toBuffer()
        .then(data => data.toString('base64'));

    return `data:image/jpeg;base64,${base64Image}`;
}

/**
 * Sends a preview request to Discord's API to set the stream thumbnail
 */
export async function sendStreamPreview(guildId: string, channelId: string, userId: string, imageUrl: string, token: string): Promise<void> {
    try {
        const streamKey = `guild:${guildId}:${channelId}:${userId}`;
        const base64Image = await imageToBase64(imageUrl);
        const data = { thumbnail: base64Image };
        
        await axios.post(`https://discord.com/api/v9/streams/${streamKey}/preview`, data, {
            headers: {
                'Authorization': token,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
            },
        });
    } catch (error) {
        console.error('Failed to set stream preview:', error);
        throw error;
    }
} 