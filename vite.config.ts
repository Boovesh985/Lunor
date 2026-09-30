import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Serves the Vercel functions in /api during `npm run dev`, so the whole app
 * (including streaming AI endpoints) runs locally without the Vercel CLI.
 * Each api/<name>.ts exports `default { fetch(request) }` — the same Web
 * standard signature Vercel invokes in production.
 */
function vercelFunctionsDev(): Plugin {
  let server: ViteDevServer;
  return {
    name: 'lunor:vercel-functions-dev',
    configureServer(devServer) {
      server = devServer;
      devServer.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const name = req.url.slice('/api/'.length).split('?')[0]!.replace(/\/$/, '');
        const file = resolve(process.cwd(), 'api', `${name}.ts`);
        if (!/^[a-z-]+$/.test(name) || !existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'not_found', message: `No function at /api/${name}` } }));
          return;
        }
        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod.default?.fetch ?? mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            res.end();
            return;
          }
          const response: Response = await handler(await toWebRequest(req, res));
          await pipeResponse(response, res);
        } catch (error) {
          if (error instanceof Error) server.ssrFixStacktrace(error);
          console.error(error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
          }
          res.end(JSON.stringify({ error: { code: 'server', message: String(error) } }));
        }
      });
    },
  };
}

async function toWebRequest(req: IncomingMessage, res: ServerResponse): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  // The API only speaks JSON, so the body can be passed on as text.
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = Buffer.concat(chunks).toString('utf8');
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
    method: req.method,
    headers,
    body,
    signal: controller.signal,
  });
}

async function pipeResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  res.flushHeaders();
  const reader = response.body.getReader();
  res.on('close', () => void reader.cancel().catch(() => undefined));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.writableEnded) res.write(value);
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
}

export default defineConfig(({ mode }) => {
  // Make .env / .env.local visible to the server code in /api during dev.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (/^(ANTHROPIC|GEMINI|LUNOR)_/.test(key) && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), tailwindcss(), vercelFunctionsDev()],
    server: { port: 5173 },
    // Pre-bundle everything the lazily-loaded stages import, so the dev
    // server never has to re-optimise (and reload the page) mid-stream.
    optimizeDeps: {
      include: [
        '@codemirror/lang-javascript',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/highlight',
        '@radix-ui/react-dialog',
        '@uiw/react-codemirror',
        'canvas-confetti',
        'diff',
        'jszip',
        'lucide-react',
        'mermaid',
        'motion/react',
        'partial-json',
        'react-markdown',
        'remark-gfm',
        'sucrase',
        'zustand',
        'zustand/middleware',
      ],
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1500,
    },
  };
});
