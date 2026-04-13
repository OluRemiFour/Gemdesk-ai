/**
 * CerebrasService — ultra-fast text inference via Cerebras Cloud API.
 * Uses the OpenAI-compatible endpoint at https://api.cerebras.ai/v1
 * Supports API key rotation (same pattern as GeminiService).
 */

interface CerebrasMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CerebrasResponse {
  id: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class CerebrasService {
  private keys: string[];
  private currentKeyIndex: number = 0;
  private baseUrl = 'https://api.cerebras.ai/v1';
  private model = 'llama-3.3-70b';

  constructor(apiKeys: string[]) {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('No Cerebras API keys provided');
    }
    this.keys = apiKeys;
    // console.log(`[CerebrasService] Initialized with ${apiKeys.length} API key(s)`);
  }

  private get currentKey(): string {
    return this.keys[this.currentKeyIndex];
  }

  private rotateKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
    const partial = this.currentKey.substring(0, 8);
    // console.log(`[CerebrasService] Rotated to key index ${this.currentKeyIndex} (${partial}...)`);
  }

  /**
   * Generate a chat completion via Cerebras.
   * Returns text in the same shape as Gemini for easy integration.
   */
  async generateContent(
    systemPrompt: string,
    messages: CerebrasMessage[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    const maxRetries = this.keys.length;
    let attempts = 0;

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: options.temperature ?? 0.7,
      max_completion_tokens: options.maxTokens ?? 4096,
    };

    while (attempts < maxRetries) {
      try {
        console.log(`[CerebrasService] Sending request (key ${this.currentKeyIndex})...`);
        const start = Date.now();

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.currentKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          // Rate limit or transient error
          const isTransient = [429, 402, 500, 503, 504].includes(response.status);
          
          if (isTransient) {
            console.warn(`[CerebrasService] Key ${this.currentKeyIndex} hit ${response.status}. Rotating...`);
            attempts++;
            if (attempts >= maxRetries) throw new Error('All Cerebras API keys exhausted or service unavailable.');
            await new Promise(r => setTimeout(r, 1000));
            this.rotateKey();
            continue;
          }
          throw new Error(`Cerebras API error ${response.status}: ${errorText}`);
        }

        const data: CerebrasResponse = await response.json();
        const elapsed = Date.now() - start;
        console.log(`[CerebrasService] Response received in ${elapsed}ms`);

        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty response from Cerebras');

        return text;
      } catch (error: any) {
        // If it's a rotation/exhaustion error, it's already handled above
        if (error.message?.includes('exhausted') || error.message?.includes('unavailable')) throw error;
        // For network errors, try next key
        if (attempts < maxRetries - 1 && (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('failed'))) {
          console.warn(`[CerebrasService] Network error, rotating key...`);
          attempts++;
          await new Promise(r => setTimeout(r, 500));
          this.rotateKey();
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate content from Cerebras after all retries.');
  }

  /** Quick check if the service has valid (non-placeholder) keys */
  get isAvailable(): boolean {
    return this.keys.length > 0;
  }
}
