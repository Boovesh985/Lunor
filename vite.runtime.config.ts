import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Builds the preview runtime (react + react-native-web + shims) as a single
 * classic script at public/preview/runtime.js. A classic script (not an ES
 * module) is required because the sandboxed iframe has an opaque origin, and
 * module scripts would need CORS.
 *
 * React is intentionally the *development* build: learners get readable
 * errors and warnings (e.g. missing list keys), and the AI auto-fix gets
 * precise error messages.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    __DEV__: 'true',
  },
  build: {
    outDir: 'public/preview',
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    target: 'es2022',
    lib: {
      entry: 'preview-runtime/index.tsx',
      formats: ['iife'],
      name: 'LunorPreview',
      fileName: () => 'runtime.js',
    },
  },
});
