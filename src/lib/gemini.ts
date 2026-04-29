import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Subtitle {
  text: string;
  start: number;
  end: number;
}

export async function generateSubtitles(base64Audio: string): Promise<Subtitle[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Audio,
            mimeType: "audio/wav",
          },
        },
        "Please transcribe this audio accurately. Break the transcription into very short phrases (1-4 words) suitable for short-form video subtitles like karaoke. Return ONLY a JSON array of objects, where each object has 'text' (string), 'start' (number, start time in seconds), and 'end' (number, end time in seconds). Be as precise as possible with the timing to match the exact moment the words are spoken.",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The transcribed phrase (1-4 words).",
              },
              start: {
                type: Type.NUMBER,
                description: "Start time of the phrase in seconds.",
              },
              end: {
                type: Type.NUMBER,
                description: "End time of the phrase in seconds.",
              },
            },
            required: ["text", "start", "end"],
          },
        },
        systemInstruction: "You are a professional video captioner capable of perfectly timed dynamic subtitles.",
      },
    });

    const jsonStr = response.text?.trim() || "[]";
    const subtitles: Subtitle[] = JSON.parse(jsonStr);
    return subtitles;
  } catch (error) {
    console.error("Failed to generate subtitles:", error);
    throw new Error("Failed to generate subtitles. Please check if the audio is clear and try again.");
  }
}

export async function generateThumbnailHook(base64Image: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        },
        "Analyze this video frame and generate an eye-catching, hooking text for a YouTube Shorts thumbnail. The text must be incredibly engaging, clickbaity (but relevant), and extremely short (1 to 4 words max). Do not include any quotes, just the text.",
      ],
      config: {
        systemInstruction: "You are an expert YouTube strategist and thumbnail designer.",
        temperature: 0.9,
      },
    });

    return response.text?.trim().replace(/["']/g, '') || "WATCH NOW!";
  } catch (error) {
    console.error("Failed to generate thumbnail hook:", error);
    return "MIND BLOWN!";
  }
}
