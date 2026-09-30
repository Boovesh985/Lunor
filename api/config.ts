import { resolveModel } from '../server/claude.ts';
import { chooseProvider, modelFor } from '../server/providers.ts';

/** Tells the UI whether live AI is available on this deployment, and on which model (never exposes a key). */
export default {
  fetch(): Response {
    const choice = chooseProvider('');
    return Response.json(
      {
        aiAvailable: choice !== null,
        mock: choice?.provider === 'mock',
        provider: choice?.provider ?? null,
        model: choice ? modelFor(choice.provider) : '',
        // Model used when a visitor brings their own Anthropic key.
        userKeyModel: resolveModel(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  },
};
