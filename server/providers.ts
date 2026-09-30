/**
 * Which AI provider serves a request, and with which key:
 *  1. a visitor's own Anthropic key (sent from Settings) → Claude, not rate-limited
 *  2. LUNOR_MOCK_AI=1 → bundled sample replay (local development)
 *  3. ANTHROPIC_API_KEY → Claude on the server's key
 *  4. GEMINI_API_KEY → Gemini on the server's key (free-tier fallback)
 * Server keys are rate-limited per IP.
 */
import { resolveModel } from './claude.js';
import { resolveGeminiModel } from './gemini.js';

export type ProviderName = 'anthropic' | 'gemini' | 'mock';

export type ProviderChoice =
  | { provider: 'anthropic' | 'gemini'; apiKey: string; serverKey: boolean }
  | { provider: 'mock'; apiKey: ''; serverKey: false };

type Env = Record<string, string | undefined>;

export function chooseProvider(userKey: string, env: Env = process.env): ProviderChoice | null {
  if (userKey) return { provider: 'anthropic', apiKey: userKey, serverKey: false };
  if (env.LUNOR_MOCK_AI === '1') return { provider: 'mock', apiKey: '', serverKey: false };
  const anthropic = env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) return { provider: 'anthropic', apiKey: anthropic, serverKey: true };
  const gemini = env.GEMINI_API_KEY?.trim();
  if (gemini) return { provider: 'gemini', apiKey: gemini, serverKey: true };
  return null;
}

export function modelFor(provider: ProviderName): string {
  if (provider === 'mock') return 'sample replay (mock mode)';
  return provider === 'gemini' ? resolveGeminiModel() : resolveModel();
}
