
import { GoogleGenAI, Type } from "@google/genai";
import { StoryResponse, ChatHistoryItem, GameSettings } from "../types";
import { CacheService } from "./cacheService";

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
  "visualPrompt": "Chinese folklore horror, faded and desaturated, soft low contrast, washed-out dark reds and grays, paper talismans, ancestral shrine, subtle grain, vintage film, not pure black, misty eerie atmosphere",
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

export class GameService {
  private settings: GameSettings;
  private geminiClient: GoogleGenAI | null = null;
  private cacheService: CacheService;
  
  // In-memory Promise Deduping (prevents double-fetching the exact same request in the same session)
  private pendingRequests: Map<string, Promise<StoryResponse>> = new Map();
  private pendingImages: Map<string, Promise<string | null>> = new Map();

  constructor(settings: GameSettings) {
    this.settings = settings;
    // Default to true if undefined in legacy settings
    const cacheEnabled = settings.useSharedCache !== false; 
    this.cacheService = new CacheService(cacheEnabled);
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

  public updateSettings(newSettings: GameSettings) {
    this.settings = newSettings;
    this.cacheService.setEnabled(newSettings.useSharedCache);
    this.initClient();
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

  // --- Core Logic ---

  /**
   * Main entry point to get next story segment.
   * Checks cache first, then API.
   */
  async continueStory(history: ChatHistoryItem[], choice: string, inventory: string[]): Promise<StoryResponse> {
    // 1. Calculate Cache Key (Hash of State)
    const cacheKey = await this.cacheService.generateKey(history, choice, inventory);

    // 2. Check Pending Requests (In-memory dedupe)
    if (this.pendingRequests.has(cacheKey)) {
        return this.pendingRequests.get(cacheKey)!;
    }

    // 3. Define the async fetch operation
    const fetchOperation = async (): Promise<StoryResponse> => {
        try {
            // A. Check Permanent Cache (L1 LocalStorage & L2 Server)
            const cachedResponse = await this.cacheService.getStory(cacheKey);
            if (cachedResponse) {
                return cachedResponse;
            }

            // B. Cache Miss -> Call API
            console.log(`[GameService] Cache MISS. Fetching from LLM...`);
            const response = await this.fetchStory(history, choice, inventory);
            
            // C. Save to Cache (Only if successful)
            // We do this in background (don't await) to speed up UI
            this.cacheService.setStory(cacheKey, response);
            
            return response;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    };

    // 4. Store promise and execute
    const promise = fetchOperation();
    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * Triggers background loading for all provided choices.
   */
  preloadChoices(history: ChatHistoryItem[], choices: string[], inventory: string[]) {
    console.log(`[GameService] Preloading ${choices.length} choices...`);
    choices.forEach(async (choice) => {
        try {
            // 1. Preload Text
            const response = await this.continueStory(history, choice, inventory);
            
            // 2. Preload Image (Chain the request)
            if (response.visualPrompt) {
               this.generateImage(response.visualPrompt).catch(err => {
                   console.warn("Background image gen failed", err);
               });
            }
        } catch (err) {
            // Silent fail for preloads
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
    // We treat "START_GAME" as a special choice
    const emptyInventory: string[] = [];
    return this.continueStory([], "START_GAME", emptyInventory);
  }

  // --- API Providers ---

  private async callGemini(contents: any[]): Promise<StoryResponse> {
    if (!this.geminiClient) throw new Error("Gemini Client not initialized");
    
    // For "START_GAME", we need to inject the system prompt as the first user message if history is empty? 
    // Actually the logic in continueStory passes history. 
    // If it's START_GAME, history is empty.
    
    // Check if it's start
    const isStart = contents.length === 1 && contents[0].parts[0].text === "START_GAME";
    const promptText = isStart 
        ? "游戏开始。背景：中元节深夜，我独自回到了荒废已久的老宅。大门虚掩。请开始第一幕。"
        : contents[contents.length-1].parts[0].text;

    // Replace the simple "START_GAME" text with actual prompt if it's the start
    if (isStart) {
        contents[0].parts[0].text = promptText;
    }

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

    // Handle Start Game
    if (messages.length === 1 && messages[0].content.includes("START_GAME")) {
        messages[0].content = "游戏开始。背景：中元节深夜，我独自回到了荒废已久的老宅。大门虚掩。请开始第一幕。";
    }

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
    const aesthetic = "Chinese folklore horror, faded, desaturated, soft low contrast, washed-out dark reds and grays, subtle film grain, paper talismans, ancestral shrine details, not pure black, muted dark grays and browns, misty eerie atmosphere, lo-fi, security camera style, ";
    const finalPrompt = aesthetic + prompt;
    
    // 1. Calculate Key
    const cacheKey = await this.cacheService.generateImageKey(finalPrompt);

    // 2. Check Pending
    if (this.pendingImages.has(cacheKey)) {
        return this.pendingImages.get(cacheKey)!;
    }

    const fetchOp = async (): Promise<string | null> => {
        try {
             // A. Check L1/L2 Cache
             const cached = await this.cacheService.getImage(cacheKey);
             if (cached) {
                 return cached;
             }
             
             // B. Generate
             console.log(`[GameService] Generating Image for key: ${cacheKey.substring(0,8)}...`);
             let imageUrl: string | null = null;
             
             if (this.geminiClient && this.settings.provider === 'gemini') {
                 // Gemini
                 const response = await this.geminiClient.models.generateContent({
                     model: this.settings.imageModel || "gemini-2.5-flash-image",
                     contents: { parts: [{ text: finalPrompt }] }
                 });
                 for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData) {
                        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                    }
                 }
             } else if (this.settings.provider === 'openai' && this.settings.apiKey) {
                 // OpenAI Chat Image
                 const baseUrl = this.settings.baseUrl || "https://api.openai.com/v1";
                 const resp = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${this.settings.apiKey}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ 
                        model: this.settings.imageModel || "gpt-4o-image",
                        messages: [{ role: "user", content: finalPrompt }],
                        stream: false
                    })
                 });
                 const data = await resp.json();
                 if (data.choices?.length > 0) {
                     const content = data.choices[0].message.content;
                     const linkMatch = content.match(/!\[.*?\]\((.*?)\)/) || content.match(/(https?:\/\/[^\s]+)/);
                     if (linkMatch) imageUrl = linkMatch[1];
                     else if (content.length < 5000) imageUrl = content.trim(); 
                 }
             }

             // C. Save Cache
             if (imageUrl) {
                 this.cacheService.setImage(cacheKey, imageUrl);
             }
             return imageUrl;

        } catch (e) {
            console.error("Image Gen Failed", e);
            return null;
        } finally {
            this.pendingImages.delete(cacheKey);
        }
    };

    const promise = fetchOp();
    this.pendingImages.set(cacheKey, promise);
    return promise;
  }
}