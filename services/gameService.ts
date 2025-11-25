import { GoogleGenAI, Type } from "@google/genai";
import { StoryResponse, ChatHistoryItem, GameSettings } from "../types";

const SYSTEM_INSTRUCTION = `
你是一位深谙**中式民俗恐怖 (Chinese Folklore Horror)** 的文字游戏主理人。
风格参考：纸嫁衣、港式僵尸片、中式怪谈。

**核心美学：**
1. **阴冷**：不要大喊大叫，要写“阴风刺骨”，“脊背发凉”。
2. **民俗**：使用纸人、棺材、绣花鞋、红白喜事、灵位、香炉、黑狗血等意象。
3. **模糊**：不要看清楚鬼的样子，要写“眼角的余光看到...”，“镜子里多了一个人影”。

**严禁：**
1. 绝对不要在 JSON 中包含 base64 图片数据。
2. 绝对不要输出 Markdown 代码块标记（如 \`\`\`json）。只输出纯 JSON 字符串。

**规则：**
1. **Flash Reveal (惊吓)**: 如果玩家作死（比如偷看棺材底、吹灭蜡烛、回头），设置 \`flashReveal: true\`。这会触发屏幕闪烁和音效。
2. **GameOver**: 死亡时详细描写死法，但不要过于血腥，要绝望。
3. **Visual Prompt**: 生成英文提示词。描述一个阴暗、高噪点、低清晰度的黑白监控风格场景。

**输出 JSON 格式：**
{
  "narrative": "剧情文本，约100字。尽量精简有力。",
  "choices": ["选项1", "选项2"],
  "visualPrompt": "High grain, black and white, lo-fi, security camera style, low visibility...",
  "isGameOver": boolean,
  "flashReveal": boolean,
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

export class GameService {
  private settings: GameSettings;
  private geminiClient: GoogleGenAI | null = null;

  constructor(settings: GameSettings) {
    this.settings = settings;
    if (this.settings.provider === 'gemini') {
      const key = this.settings.apiKey || process.env.API_KEY;
      if (key) {
        this.geminiClient = new GoogleGenAI({ apiKey: key });
      }
    }
  }

  private async callGemini(contents: any[]): Promise<StoryResponse> {
    if (!this.geminiClient) throw new Error("Gemini Client not initialized");
    
    const response = await this.geminiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 2000, // Prevent runaway huge strings
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            choices: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualPrompt: { type: Type.STRING },
            isGameOver: { type: Type.BOOLEAN },
            flashReveal: { type: Type.BOOLEAN },
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
        model: "gpt-4o",
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

  async startNewGame(): Promise<StoryResponse> {
    const prompt = "游戏开始。背景：中元节深夜，我独自回到了荒废已久的老宅。大门虚掩。请开始第一幕。";
    
    if (this.settings.provider === 'openai') {
      return this.callOpenAI([{ role: 'user', content: prompt }]);
    } else {
      return this.callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
    }
  }

  async continueStory(history: ChatHistoryItem[], choice: string): Promise<StoryResponse> {
    // If fallback "Retry" was selected, treat it as a generic continue command
    const actualChoice = choice.includes("重试") ? "继续" : choice;
    
    let messages: any[] = [];

    if (this.settings.provider === 'openai') {
      messages = history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text }));
      messages.push({ role: 'user', content: `我选择了: ${actualChoice}` });
      return this.callOpenAI(messages);
    } else {
      messages = history.map(h => ({ role: h.role, parts: [{ text: h.text }] }));
      messages.push({ role: 'user', parts: [{ text: `我选择了: ${actualChoice}` }] });
      return this.callGemini(messages);
    }
  }

  async generateImage(prompt: string): Promise<string | null> {
    const aesthetic = "scary, horror, grainy, noisy, black and white, low light, photorealistic, 8k, unreal engine 5, silent hill atmosphere, ";
    const finalPrompt = aesthetic + prompt;
    
    if (this.geminiClient) {
      try {
        const response = await this.geminiClient.models.generateContent({
           model: "gemini-2.5-flash-image",
           contents: { parts: [{ text: finalPrompt }] }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
      } catch (e) {
        console.error("Gemini image generation failed", e);
      }
    }
    
    // Fallback/Option for OpenAI DALL-E
    if (this.settings.provider === 'openai' && this.settings.apiKey) {
        try {
            const resp = await fetch(`${this.settings.baseUrl || "https://api.openai.com/v1"}/images/generations`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.settings.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: "dall-e-3", prompt: finalPrompt, n: 1, size: "1024x1024", response_format: "b64_json" })
            });
            const data = await resp.json();
            if (data.data && data.data[0]) {
                return `data:image/png;base64,${data.data[0].b64_json}`;
            }
        } catch (e) { console.error("OpenAI image failed", e); }
    }

    return null;
  }
}