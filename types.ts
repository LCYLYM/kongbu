
export interface GameState {
  history: ChatHistoryItem[];
  inventory: string[]; // 物品栏
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
  inventoryUpdates?: {
    add?: string[];
    remove?: string[];
  };
  mood: 'eerie' | 'tense' | 'sad' | 'calm' | 'terrifying';
}

export type LLMProvider = 'gemini' | 'openai';

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite-latest' | 'gemini-3-pro-preview';
export type OpenAIModel = 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
export type GameModel = GeminiModel | OpenAIModel | string;

export interface GameSettings {
  provider: LLMProvider;
  model: GameModel;
  imageModel: string; // New field for image generation model
  apiKey?: string;
  baseUrl?: string; // For OpenAI proxies
  useSharedCache: boolean; // Boolean toggle for server-side caching
}