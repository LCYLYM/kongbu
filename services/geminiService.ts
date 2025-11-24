import { GoogleGenAI, Type } from "@google/genai";
import { StoryResponse, ChatHistoryItem } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
你是一位深谙**中式民俗恐怖 (Chinese Folklore Horror)** 的游戏叙事者。
你的任务是营造一种湿冷、压抑、透不过气的恐怖氛围，而不是简单的血腥。

**核心禁忌与美学：**
1.  **民俗符号**：*必须*包含中国特色元素。如：纸人点睛、红白撞煞、倒头饭、封棺钉、子母凶、阴缘、绣花鞋、老式戏台、发霉的遗照、八卦镜裂纹、滴水的红蜡烛。
2.  **环境描写**：环境要是“活”的。墙壁在渗血，影子在拉长，水龙头流出的是铁锈味的水。避免直接说“很可怕”，要说“你感觉到脖子后面有湿热的呼吸”。
3.  **心理压迫**：强调“违和感”。比如亲人的脸变得陌生，熟悉的房间多了一扇门。
4.  **叙事风格**：冷漠、宿命论。文字简练，带有寒意。
5.  **不突脸**：不要单纯的Jump Scare，要的是细思极恐。

**Flash Reveal (惊吓机制) 规则：**
如果玩家选择了危险的、鲁莽的、或者显然带有陷阱的选项（例如“回头看”、“打开那口棺材”、“吹灭蜡烛”），请将返回 JSON 中的 \`flashReveal\` 设为 \`true\`。这会触发网页背景瞬间高亮，模拟突然看清了黑暗中的东西（如一张脸、一只手）。

**图片提示词 (Visual Prompt) 强制要求：**
- 风格：**Lo-fi, Black and White, High ISO, Grainy, Blurry** (类似监控画面或老照片)。
- 内容：必须与当前剧情紧密相关，充满中式恐怖意象。
- 范例：*grainy b&w photo, pov of a dark hallway in an abandoned chinese apartment, blurry figure in red cheongsam standing at the end, flickering light, disturbing atmosphere.*

**输出 JSON 结构：**
{
  "narrative": "剧情文本。竖排版更佳，建议短句。100字左右。",
  "choices": ["选项A（符纸）", "选项B（符纸）"],
  "visualPrompt": "英文图片提示词。",
  "isGameOver": boolean,
  "flashReveal": boolean, // 关键：是否触发瞬间惊吓高亮
  "mood": "eerie"
}
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: { type: Type.STRING },
    choices: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    visualPrompt: { type: Type.STRING },
    isGameOver: { type: Type.BOOLEAN },
    flashReveal: { type: Type.BOOLEAN },
    mood: { type: Type.STRING }
  },
  required: ["narrative", "choices", "visualPrompt", "isGameOver", "flashReveal", "mood"]
};

export const startNewGame = async (): Promise<StoryResponse> => {
  const model = "gemini-2.5-flash"; 
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: "游戏开始。背景：我收到一封没有寄信人的家书，回到了荒废十年的祖宅。今晚是中元节。大门没锁，院子里挂满了白灯笼。我推开了正厅的门。",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as StoryResponse;

  } catch (error) {
    console.error("Failed to start game:", error);
    throw error;
  }
};

export const continueStory = async (history: ChatHistoryItem[], choice: string): Promise<StoryResponse> => {
  const model = "gemini-2.5-flash"; 

  const contents = history.map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: `我选择了：${choice}。请继续。` }]
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as StoryResponse;

  } catch (error) {
    console.error("Failed to continue story:", error);
    throw error;
  }
};

export const generateSceneImage = async (prompt: string): Promise<string | null> => {
  const model = "gemini-2.5-flash-image";
  
  // Enforce specific visual style
  const aestheticPrompt = `(nightmare fuel, grainy vintage photography, low quality CCTV footage), black and white, monochromatic, ${prompt}, chinese horror, sinister, blurry, uncanny valley`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: aestheticPrompt }]
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to generate image:", error);
    return null; 
  }
};