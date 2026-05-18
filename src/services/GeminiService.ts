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

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateContent(params: any): Promise<any> {
    const maxRetries = this.keys.length;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        return await this.client.models.generateContent(params);
      } catch (error: any) {
        const statusCode = error.status || (error.message && error.message.match(/(\d{3})/)?.[1]);
        const isTransient = [429, 500, 503, 504].includes(Number(statusCode)) || 
                          (error.message && (error.message.includes("429") || error.message.includes("503") || error.message.includes("high demand")));

        if (isTransient) {
          console.warn(`[GeminiService] Transient error ${statusCode || ''}. Rotating and retrying... (Attempt ${attempts + 1}/${maxRetries})`);
          attempts++;
          if (attempts >= maxRetries) {
              throw error; // Let the caller handle the final failure
          }
          
          // Wait a bit before rotating to give the service a breath
          await this.sleep(1000);
          this.rotateKey();
        } else {
          // Re-throw other errors immediately
          throw error;
        }
      }
    }
    throw new Error("Failed to generate content after checking all keys.");
  }
}

// Singleton-ish helper or just export the class
// We can initialize it lazily or just export a helper to create it.
