
import { GoogleGenAI, Type } from "@google/genai";
import { StoryResponse, ChatHistoryItem, GameSettings } from "../types";

const SYSTEM_INSTRUCTION = `
你是一位深谙**中式民俗恐怖 (Chinese Folklore Horror)** 的文字游戏主理人。
风格参考：纸嫁衣、港式僵尸片、中式怪谈。

**核心机制：**
1. **物品与解谜 (Inventory & Puzzles)**:
   - 你需要管理玩家的背包。如果玩家获得了重要道具（如：锈迹斑斑的钥匙、染血的符咒），在 JSON 中返回 \`inventoryUpdates: { add: ["物品名"] }\`。
   - 如果玩家消耗了物品（如：用钥匙开门），返回 \`inventoryUpdates: { remove: ["物品名"] }\`。
   - **谜题**：设置障碍，需要特定物品才能通过。如果玩家没有该物品，提示缺少的线索，不要直接让其通过。

2. **核心美学**：
   - **阴冷**：不要大喊大叫，要写“阴风刺骨”，“脊背发凉”。
   - **民俗**：使用纸人、棺材、绣花鞋、红白喜事、灵位、香炉、黑狗血等意象。
   - **模糊**：不要看清楚鬼的样子，要写“眼角的余光看到...”，“镜子里多了一个人影”。

**严禁：**
1. 绝对不要在 JSON 中包含 base64 图片数据。
2. 绝对不要输出 Markdown 代码块标记（如 \`\`\`json）。只输出纯 JSON 字符串。

**输出 JSON 格式：**
{
  "narrative": "剧情文本，约100字。尽量精简有力。",
  "choices": ["选项1", "选项2"],
  "visualPrompt": "High grain, black and white, lo-fi, security camera style, low visibility...",
  "isGameOver": boolean,
  "flashReveal": boolean,
  "inventoryUpdates": { "add": [], "remove": [] },
  "mood": "eerie" | "tense" | "terrifying"
}
`;

// Helper to safely parse JSON and provide a fallback if it fails
const safeParse = (text: string): StoryResponse => {
  try {
    // Try to find JSON object if embedded in text
    const match = text.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : text;
    const parsed = JSON.parse(jsonStr);
    
    // Ensure critical fields exist
    if (!parsed.choices || !Array.isArray(parsed.choices)) {
      parsed.choices = [];
    }
    if (!parsed.narrative) {
      parsed.narrative = "......";
    }
    return parsed;
  } catch (e) {
    console.error("JSON Parse Error. Raw text snippet:", text.substring(0, 200));
    // Return safe fallback so the game doesn't hang
    return {
      narrative: "（周围的空气突然变得粘稠，文字似乎被某种力量扭曲了...）\n\n似乎有些不对劲。请尝试集中精神（重试）。",
      choices: ["重新凝视黑暗 (重试)"],
      visualPrompt: "static noise, glitch, darkness",
      isGameOver: false,
      flashReveal: false,
      mood: 'tense'
    };
  }
};

const STORAGE_KEY_SETTINGS = "nether_chronicles_settings";
const STORAGE_KEY_IMG_CACHE = "nether_chronicles_img_cache";

export class GameService {
  private settings: GameSettings;
  private geminiClient: GoogleGenAI | null = null;
  
  // Memory Cache for Text (Current Session)
  private preloadCache: Map<string, Promise<StoryResponse>> = new Map();

  constructor(settings: GameSettings) {
    this.settings = settings;
    this.initClient();
  }

  // --- Persistence ---

  public static loadSettingsFromStorage(): GameSettings | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load settings", e);
    }
    return null;
  }

  public saveSettingsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Failed to save settings", e);
    }
  }

  // Helper for Image Cache (localStorage)
  private getCachedImage(prompt: string): string | null {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY_IMG_CACHE) || "{}");
      // Simple hash-like key from prompt to avoid massive keys
      const key = btoa(prompt.substring(0, 50) + prompt.length).substring(0, 20);
      return cache[key] || null;
    } catch (e) { return null; }
  }

  private saveCachedImage(prompt: string, base64: string) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY_IMG_CACHE) || "{}");
      const key = btoa(prompt.substring(0, 50) + prompt.length).substring(0, 20);
      
      // Limit cache size: if too big, clear half
      const keys = Object.keys(cache);
      if (keys.length > 20) {
         delete cache[keys[0]]; // Remove oldest (rough LRU)
      }
      
      cache[key] = base64;
      localStorage.setItem(STORAGE_KEY_IMG_CACHE, JSON.stringify(cache));
    } catch (e) { 
      // Likely quota exceeded, clear cache and try again once
      try {
        localStorage.removeItem(STORAGE_KEY_IMG_CACHE); 
      } catch(err) {}
    }
  }

  public updateSettings(newSettings: GameSettings) {
    const modelChanged = this.settings.model !== newSettings.model || this.settings.provider !== newSettings.provider;
    this.settings = newSettings;
    this.initClient();
    if (modelChanged) {
      this.clearCache();
    }
    this.saveSettingsToStorage();
  }

  private initClient() {
    if (this.settings.provider === 'gemini') {
      const key = this.settings.apiKey || process.env.API_KEY;
      if (key) {
        const options: any = { apiKey: key };
        if (this.settings.baseUrl) {
          options.baseUrl = this.settings.baseUrl;
        }
        this.geminiClient = new GoogleGenAI(options);
      }
    } else {
      this.geminiClient = null;
    }
  }

  private clearCache() {
    this.preloadCache.clear();
    console.log("[GameService] Cache cleared due to settings change.");
  }

  private getCacheKey(history: ChatHistoryItem[], choice: string, inventory: string[]): string {
    // Include inventory in cache key because having an item might change the outcome
    const lastMsg = history.length > 0 ? history[history.length - 1].text.slice(-20) : 'START';
    const invHash = inventory.sort().join(',');
    return `${history.length}:${lastMsg}:${choice}:${invHash}`;
  }

  // --- Core Logic ---

  /**
   * Main entry point to get next story segment.
   * Checks cache first, then API.
   */
  async continueStory(history: ChatHistoryItem[], choice: string, inventory: string[]): Promise<StoryResponse> {
    const cacheKey = this.getCacheKey(history, choice, inventory);

    if (this.preloadCache.has(cacheKey)) {
      console.log(`[GameService] Cache HIT for choice: "${choice}"`);
      return this.preloadCache.get(cacheKey)!;
    }

    console.log(`[GameService] Cache MISS for choice: "${choice}". Fetching...`);
    
    // Create the promise and store it immediately in cache (Request Deduping)
    const promise = this.fetchStory(history, choice, inventory);
    this.preloadCache.set(cacheKey, promise);

    try {
      return await promise;
    } catch (e) {
      // If failed, remove from cache so user can retry
      this.preloadCache.delete(cacheKey);
      throw e;
    }
  }

  /**
   * Triggers background loading for all provided choices.
   * Call this when the UI is idle (e.g., after text finished typing).
   */
  preloadChoices(history: ChatHistoryItem[], choices: string[], inventory: string[]) {
    console.log(`[GameService] Preloading ${choices.length} choices with inventory: [${inventory.join(', ')}]`);
    choices.forEach(async (choice) => {
        try {
            // 1. Preload Text
            const response = await this.continueStory(history, choice, inventory);
            
            // 2. Preload Image (Chain the request)
            if (response.visualPrompt) {
               console.log(`[GameService] Preloading image for choice "${choice}"`);
               // This will hit the cache or generate and save to cache
               // We don't await this because we don't want to block the thread, just kick it off
               this.generateImage(response.visualPrompt).catch(err => {
                   console.warn("Background image gen failed", err);
               });
            }
        } catch (err) {
            console.warn(`[GameService] Preload failed for choice "${choice}"`, err);
        }
    });
  }

  private async fetchStory(history: ChatHistoryItem[], choice: string, inventory: string[]): Promise<StoryResponse> {
     const actualChoice = choice.includes("重试") ? "继续" : choice;
     
     let messages: any[] = [];
     
     // Inject Inventory context into the User Prompt
     const inventoryContext = inventory.length > 0 
       ? ` (当前背包物品: ${inventory.join(', ')})` 
       : " (当前背包为空)";
       
     const prompt = `我选择了: ${actualChoice}。${inventoryContext}`;

     if (this.settings.provider === 'openai') {
       messages = history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text }));
       messages.push({ role: 'user', content: prompt });
       return this.callOpenAI(messages);
     } else {
       // Gemini Format
       messages = history.map(h => ({ role: h.role, parts: [{ text: h.text }] }));
       messages.push({ role: 'user', parts: [{ text: prompt }] });
       return this.callGemini(messages);
     }
  }

  async startNewGame(): Promise<StoryResponse> {
    this.clearCache(); // New game, new cache
    const prompt = "游戏开始。背景：中元节深夜，我独自回到了荒废已久的老宅。大门虚掩。请开始第一幕。";
    
    if (this.settings.provider === 'openai') {
      return this.callOpenAI([{ role: 'user', content: prompt }]);
    } else {
      return this.callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
    }
  }

  // --- API Providers ---

  private async callGemini(contents: any[]): Promise<StoryResponse> {
    if (!this.geminiClient) throw new Error("Gemini Client not initialized");
    
    const response = await this.geminiClient.models.generateContent({
      model: this.settings.model || "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 2000,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            choices: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualPrompt: { type: Type.STRING },
            isGameOver: { type: Type.BOOLEAN },
            flashReveal: { type: Type.BOOLEAN },
            inventoryUpdates: {
                type: Type.OBJECT,
                properties: {
                    add: { type: Type.ARRAY, items: { type: Type.STRING } },
                    remove: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            },
            mood: { type: Type.STRING }
          }
        }
      }
    });

    return safeParse(response.text || "{}");
  }

  private async callOpenAI(messages: any[]): Promise<StoryResponse> {
    const key = this.settings.apiKey;
    const baseUrl = this.settings.baseUrl || "https://api.openai.com/v1";
    
    if (!key) throw new Error("OpenAI API Key required");

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: this.settings.model || "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          ...messages
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices[0].message.content;
    
    return safeParse(content);
  }

  async generateImage(prompt: string): Promise<string | null> {
    // 1. Check LocalStorage Cache
    const cached = this.getCachedImage(prompt);
    if (cached) {
        console.log("[GameService] Image Cache HIT");
        return cached;
    }

    const aesthetic = "scary, horror, grainy, noisy, black and white, lo-fi, security camera style, low visibility, dark atmosphere, ";
    const finalPrompt = aesthetic + prompt;
    let imageUrl: string | null = null;
    
    // 2. Generate
    if (this.geminiClient && this.settings.provider === 'gemini') {
      try {
        const response = await this.geminiClient.models.generateContent({
           model: this.settings.imageModel || "gemini-2.5-flash-image",
           contents: { parts: [{ text: finalPrompt }] }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            }
        }
      } catch (e) {
        console.error("Gemini image generation failed", e);
      }
    } else if (this.settings.provider === 'openai' && this.settings.apiKey) {
        try {
            // Support Custom Base URL for OpenAI Images
            const baseUrl = this.settings.baseUrl || "https://api.openai.com/v1";
            
            // NOTE: Use CHAT completions endpoint for image generation (as per user's proxy/provider requirements)
            // instead of standard /images/generations.
            const resp = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.settings.apiKey}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    model: this.settings.imageModel || "gpt-4o-image", // Default to a chat-image capable model
                    messages: [{ role: "user", content: finalPrompt }],
                    stream: false
                })
            });

            const data = await resp.json();
            
            if (data.choices && data.choices.length > 0) {
                const content = data.choices[0].message.content;
                // Try to extract URL from markdown like ![img](url) or just raw URL
                const linkMatch = content.match(/!\[.*?\]\((.*?)\)/) || content.match(/(https?:\/\/[^\s]+)/);
                if (linkMatch) {
                    imageUrl = linkMatch[1];
                } else {
                    // Fallback: if short enough, assume it's the raw string (url or base64)
                    if (content.length < 5000) imageUrl = content.trim(); 
                }
            } else {
                console.error("OpenAI image response error", data);
            }
        } catch (e) { 
            console.error("OpenAI image failed", e); 
        }
    }

    // 3. Save to Cache if successful
    if (imageUrl) {
        this.saveCachedImage(prompt, imageUrl);
    }

    return imageUrl;
  }
}
