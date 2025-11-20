import { GoogleGenAI, Content, Part } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to convert File object to Base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const generateImageCaption = async (
  base64: string,
  mimeType: string,
  prompt: string,
  model: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });
    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate caption");
  }
};

export const streamChatResponse = async (
  history: Message[],
  newMessageText: string,
  newMessageImage: string | null, // Base64
  model: string,
  systemInstruction?: string
) => {
  
  // Transform app history to Gemini Content format
  const contents: Content[] = history
    .filter(msg => !msg.isError && !msg.isStreaming) // Filter out UI states
    .map(msg => {
      const parts: Part[] = [];
      if (msg.image) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: msg.image } });
      }
      if (msg.text) {
        parts.push({ text: msg.text });
      }
      return {
        role: msg.role,
        parts: parts
      };
    });

  // Add the current new message
  const currentParts: Part[] = [];
  if (newMessageImage) {
    currentParts.push({ inlineData: { mimeType: 'image/jpeg', data: newMessageImage } });
  }
  if (newMessageText) {
    currentParts.push({ text: newMessageText });
  }
  
  contents.push({
    role: 'user',
    parts: currentParts
  });

  try {
    return await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction
      }
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to send message");
  }
};