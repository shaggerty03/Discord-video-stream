import axios from 'axios';

async function imageToBase64(imageUrl: string): Promise<string> {
    const res = await fetch(imageUrl);
    const buf = await res.arrayBuffer();
    const tobase64 = `data:${ res.headers.get('Content-Type') || 'image/png' };base64,${Buffer.from(buf).toString('base64')}`;
    return tobase64;
}

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