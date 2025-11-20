export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 string
  isStreaming?: boolean;
  isError?: boolean;
  timestamp: number;
}

export enum BotModel {
  FLASH = 'gemini-2.5-flash',
  PRO = 'gemini-3-pro-preview',
  LITE = 'gemini-flash-lite-latest',
}

export interface ChatConfig {
  model: BotModel;
  systemInstruction: string;
}