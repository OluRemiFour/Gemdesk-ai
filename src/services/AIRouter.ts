/**
 * AIRouter — Intelligent routing between Cerebras (fast text) and Gemini (vision/multimodal).
 * 
 * Routing logic:
 *  - If request contains images/audio (inlineData) → Gemini
 *  - If text-only → Cerebras (if available), fallback to Gemini
 *  - If Cerebras fails → automatic fallback to Gemini
 */

import { CerebrasService } from './CerebrasService';
import { GeminiService } from './GeminiService';

export class AIRouter {
  private gemini: GeminiService;
  private cerebras: CerebrasService | null;

  constructor(geminiKeys: string[], cerebrasKeys: string[]) {
    this.gemini = new GeminiService(geminiKeys);

    if (cerebrasKeys.length > 0) {
      this.cerebras = new CerebrasService(cerebrasKeys);
      console.log('[AIRouter] Initialized with Cerebras (fast) + Gemini (vision) hybrid mode');
    } else {
      this.cerebras = null;
      console.log('[AIRouter] No Cerebras keys found — using Gemini only');
    }
  }

  /**
   * Generate content using the best available provider.
   * Returns the same shape as Gemini's generateContent for compatibility.
   * 
   * @param params - Same params as GeminiService.generateContent()
   */
  async generateContent(params: any): Promise<any> {
    const hasMedia = this.containsMedia(params);
    const lastPrompt = this.getLastPrompt(params).toLowerCase();
    
    // Keywords that suggest vision/UI interaction is needed
    const visionKeywords = ['click', 'find', 'locate', 'see', 'screenshot', 'whatsapp', 'whatsapp-chat', 'whatsapp-call', 'call', 'dropdown', 'button'];
    const needsVision = hasMedia || visionKeywords.some(kw => lastPrompt.includes(kw));

    // Vision/audio/UI tasks → always Gemini for better instruction following on screenshots
    if (needsVision) {
      console.log(`[AIRouter] ${hasMedia ? '🖼️ Media' : '🔍 Vision keyword'} detected → routing to Gemini (smart)`);
      return this.gemini.generateContent(params);
    }

    // Text-only → try Cerebras first for speed, fallback to Gemini
    if (this.cerebras) {
      try {
        console.log('[AIRouter] ⚡ Text-only → routing to Cerebras (fast)');
        const { systemPrompt, messages } = this.extractForCerebras(params);
        const responseText = await this.cerebras.generateContent(systemPrompt, messages);

        // Wrap in Gemini-compatible response shape
        return {
          candidates: [{
            content: {
              parts: [{ text: responseText }],
              role: 'model',
            },
          }],
          _provider: 'cerebras',
        };
      } catch (error: any) {
        console.warn(`[AIRouter] Cerebras failed: ${error.message} → falling back to Gemini`);
        return this.gemini.generateContent(params);
      }
    }

    // No Cerebras → Gemini
    console.log('[AIRouter] 💎 Text-only → Gemini (no Cerebras available)');
    return this.gemini.generateContent(params);
  }

  /**
   * Check if the request contains any binary data (images, audio).
   */
  private containsMedia(params: any): boolean {
    const contents = params.contents || [];
    for (const content of contents) {
      const parts = content.parts || [];
      for (const part of parts) {
        if (part.inlineData) return true;
      }
    }
    return false;
  }

  /**
   * Convert Gemini-format params into Cerebras-compatible messages.
   */
  private extractForCerebras(params: any): {
    systemPrompt: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  } {
    // Extract system prompt
    let systemPrompt = '';
    const sysInstruction = params.config?.systemInstruction;
    if (sysInstruction) {
      const parts = sysInstruction.parts || [];
      systemPrompt = parts.map((p: any) => p.text || '').join('\n');
    }

    // Convert contents to chat messages
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    const contents = params.contents || [];

    for (const content of contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const textParts = (content.parts || [])
        .filter((p: any) => p.text)
        .map((p: any) => p.text);

      if (textParts.length > 0) {
        messages.push({ role, content: textParts.join('\n') });
      }
    }

    return { systemPrompt, messages };
  }

  /** Expose whether Cerebras is available */
  get hasCerebras(): boolean {
    return this.cerebras !== null && this.cerebras.isAvailable;
  }

  /**
   * Helper to get the last user prompt text for keyword detection.
   */
  private getLastPrompt(params: any): string {
    const contents = params.contents || [];
    if (contents.length === 0) return '';
    
    const lastContent = contents[contents.length - 1];
    const parts = lastContent.parts || [];
    return parts.map((p: any) => p.text || '').join(' ');
  }
}
