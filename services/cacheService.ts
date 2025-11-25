
import { StoryResponse, ChatHistoryItem } from '../types';

const L1_CACHE_KEY_TEXT = 'nether_chronicles_l1_text';
const L1_CACHE_KEY_IMG = 'nether_chronicles_l1_img';
const MAX_LOCAL_ITEMS = 50; // Keep local storage light

export class CacheService {
  private isEnabled: boolean;

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  // Generate a consistent SHA-256 hash for the current game state
  public async generateKey(history: ChatHistoryItem[], choice: string, inventory: string[]): Promise<string> {
    // Inventory order doesn't matter for gameplay logic usually, but matters for hash consistency. Sort it.
    const sortedInventory = [...inventory].sort();
    
    // We only care about the actual text content for the hash
    const cleanHistory = history.map(h => ({ role: h.role, text: h.text }));
    
    const payload = JSON.stringify({
      h: cleanHistory,
      c: choice,
      i: sortedInventory
    });

    return this.sha256(payload);
  }

  public async generateImageKey(prompt: string): Promise<string> {
    return this.sha256(prompt);
  }

  // --- GET ---

  public async getStory(key: string): Promise<StoryResponse | null> {
    // 1. Try L1 (Local)
    const local = this.getFromLocalStorage(L1_CACHE_KEY_TEXT, key);
    if (local) {
      console.log(`[CacheService] L1 Hit (Text): ${key.substring(0, 8)}...`);
      return local as StoryResponse;
    }

    // 2. Try L2 (Shared Server)
    if (this.isEnabled) {
      try {
        const remote = await this.fetchFromServer(key);
        if (remote) {
          console.log(`[CacheService] L2 Hit (Text): ${key.substring(0, 8)}...`);
          // Update L1 with L2 data for faster next access
          this.saveToLocalStorage(L1_CACHE_KEY_TEXT, key, remote);
          return remote as StoryResponse;
        }
      } catch (e) {
        // Silent fail is expected if server.js isn't running
        // console.debug("[CacheService] Server cache unreachable");
      }
    }

    return null;
  }

  public async getImage(key: string): Promise<string | null> {
    // 1. Try L1
    const local = this.getFromLocalStorage(L1_CACHE_KEY_IMG, key);
    if (local && typeof local === 'string') {
      console.log(`[CacheService] L1 Hit (Image): ${key.substring(0, 8)}...`);
      return local;
    }

    // 2. Try L2
    if (this.isEnabled) {
      try {
        const remote = await this.fetchFromServer(key);
        // Assuming server returns { data: "base64..." } or just the string value wrapped
        if (remote && remote.data) {
           console.log(`[CacheService] L2 Hit (Image): ${key.substring(0, 8)}...`);
           this.saveToLocalStorage(L1_CACHE_KEY_IMG, key, remote.data);
           return remote.data;
        }
      } catch (e) {
        // Silent fail
      }
    }
    return null;
  }

  // --- SET ---

  public async setStory(key: string, data: StoryResponse) {
    // 1. Save L1
    this.saveToLocalStorage(L1_CACHE_KEY_TEXT, key, data);

    // 2. Save L2
    if (this.isEnabled) {
      this.postToServer(key, data).catch(() => {});
    }
  }

  public async setImage(key: string, base64Data: string) {
    // 1. Save L1
    this.saveToLocalStorage(L1_CACHE_KEY_IMG, key, base64Data);

    // 2. Save L2
    if (this.isEnabled) {
      this.postToServer(key, { data: base64Data }).catch(() => {});
    }
  }

  // --- Helpers ---

  private getFromLocalStorage(storeKey: string, itemKey: string): any | null {
    try {
      const store = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return store[itemKey] || null;
    } catch (e) { return null; }
  }

  private saveToLocalStorage(storeKey: string, itemKey: string, data: any) {
    try {
      const store = JSON.parse(localStorage.getItem(storeKey) || "{}");
      const keys = Object.keys(store);
      
      // LRU-ish: Delete random old keys if full
      if (keys.length >= MAX_LOCAL_ITEMS) {
        delete store[keys[0]];
      }
      
      store[itemKey] = data;
      localStorage.setItem(storeKey, JSON.stringify(store));
    } catch (e) {
      // Quota exceeded? Clear all.
      console.warn("[CacheService] LocalStorage Quota Exceeded. Clearing cache.");
      localStorage.removeItem(storeKey);
    }
  }

  private async fetchFromServer(key: string): Promise<any | null> {
    // Protocol: GET /api/cache?key=...
    // Uses relative path, assuming server.js serves this app
    const res = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  }

  private async postToServer(key: string, data: any) {
    // Protocol: POST /api/cache body { key, data }
    await fetch(`/api/cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data })
    });
  }

  private async sha256(message: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}