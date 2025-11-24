export interface GameState {
  history: ChatHistoryItem[];
  currentImage?: string; // Base64 or URL
  imageLoading: boolean;
  isGameOver: boolean;
  gameStarted: boolean;
  loadingText: boolean;
}

export interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

// Structure expected from Gemini JSON response
export interface StoryResponse {
  narrative: string;
  choices: string[];
  visualPrompt: string; // Description for the image generator
  isGameOver: boolean;
  flashReveal: boolean; // Triggers the jump scare/lightning effect
  mood: 'eerie' | 'tense' | 'sad' | 'calm' | 'terrifying';
}

export enum AudioMood {
  None,
  Rain,
  Wind,
  Heartbeat
}