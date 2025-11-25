export interface GameState {
  history: ChatHistoryItem[];
  currentImage?: string; 
  imageLoading: boolean;
  isGameOver: boolean;
  gameStarted: boolean;
  loadingText: boolean;
  error?: string | null;
}

export interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

export interface StoryResponse {
  narrative: string;
  choices: string[];
  visualPrompt: string; 
  isGameOver: boolean;
  flashReveal: boolean; 
  mood: 'eerie' | 'tense' | 'sad' | 'calm' | 'terrifying';
}

export type LLMProvider = 'gemini' | 'openai';

export interface GameSettings {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string; // For OpenAI proxies
}