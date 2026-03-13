/**
 * Discovers all Gemini API keys defined in the environment.
 * Looks for VITE_GEMINI_API_KEY and VITE_GEMINI_API_KEY* (e.g. VITE_GEMINI_API_KEY1, VITE_GEMINI_API_KEY2, etc.)
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  
  // Check for the primary key (which might be comma-separated)
  const primaryKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (primaryKey) {
    const splitKeys = primaryKey.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    keys.push(...splitKeys);
  }

  // Check for indexed keys (VITE_GEMINI_API_KEY1, VITE_GEMINI_API_KEY2, ...)
  // We'll check up to 10 keys as a reasonable limit
  for (let i = 1; i <= 10; i++) {
    const envKey = `VITE_GEMINI_API_KEY${i}`;
    const key = import.meta.env[envKey];
    if (key && typeof key === 'string' && key.trim().length > 0) {
      if (!keys.includes(key.trim())) {
        keys.push(key.trim());
      }
    }
  }

  // console.log(`[Config] Discovered ${keys.length} Gemini API keys`);
  return keys;
}

/**
 * Discovers all Cerebras API keys defined in the environment.
 * Looks for VITE_CEREBRAS_API_KEY and VITE_CEREBRAS_API_KEY* (e.g. VITE_CEREBRAS_API_KEY1, etc.)
 */
export function getCerebrasApiKeys(): string[] {
  const keys: string[] = [];

  const primaryKey = import.meta.env.VITE_CEREBRAS_API_KEY;
  if (primaryKey && typeof primaryKey === 'string') {
    const splitKeys = primaryKey.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0 && k !== 'csk-your-key-here');
    keys.push(...splitKeys);
  }

  for (let i = 1; i <= 10; i++) {
    const envKey = `VITE_CEREBRAS_API_KEY${i}`;
    const key = import.meta.env[envKey];
    if (key && typeof key === 'string' && key.trim().length > 0 && key.trim() !== 'csk-your-key-here') {
      if (!keys.includes(key.trim())) {
        keys.push(key.trim());
      }
    }
  }

  return keys;
}
