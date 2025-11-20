export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 string
  isStreaming?: boolean;
  isError?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export enum BotModel {
  FLASH = 'gemini-2.5-flash',
  PRO = 'gemini-3-pro-preview',
  LITE = 'gemini-flash-lite-latest',
  FLASH_THINKING = 'gemini-2.5-flash-thinking', // Experimental identifier for UI logic
}

export interface ChatConfig {
  model: string;
  systemInstruction: string;
}