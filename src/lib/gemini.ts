import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateMarketingCopy(songTitle: string, artistName: string, description: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a Christian music marketing campaign for the song "${songTitle}" by "${artistName}". 
    Description: ${description}. 
    Provide:
    1. A catchy social media post.
    2. A short press release snippet.
    3. 3 hashtags.
    4. A submission pitch for a Christian TV network.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          socialPost: { type: Type.STRING },
          pressRelease: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          pitch: { type: Type.STRING }
        },
        required: ["socialPost", "pressRelease", "hashtags", "pitch"]
      }
    }
  });

  return JSON.parse(response.text);
}
