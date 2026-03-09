import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private keys: string[];
  private currentKeyIndex: number = 0;
  private client: GoogleGenAI;

  constructor(apiKeys: string[]) {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error("No API keys provided");
    }
    this.keys = apiKeys;
    this.client = new GoogleGenAI({ apiKey: this.keys[0] });
  }

  private rotateKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
    const partialKey = this.keys[this.currentKeyIndex].substring(0, 8);
    console.log(`[GeminiService] Rotated to API key index: ${this.currentKeyIndex} (${partialKey}...)`);
    this.client = new GoogleGenAI({ apiKey: this.keys[this.currentKeyIndex] });
  }

  async generateContent(params: any): Promise<any> {
    const maxRetries = this.keys.length;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        return await this.client.models.generateContent(params);
      } catch (error: any) {
        // Check for 429 (Resource Exhausted)
        if (error.status === 429 || (error.message && error.message.includes("429")) || error.code === 429) {
          console.warn(`API Key ${this.currentKeyIndex} exhausted. Rotating...`);
          attempts++;
          if (attempts >= maxRetries) {
              throw new Error("All API keys exhausted.");
          }
          this.rotateKey();
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }
    throw new Error("Failed to generate content after checking all keys.");
  }
}

// Singleton-ish helper or just export the class
// We can initialize it lazily or just export a helper to create it.
