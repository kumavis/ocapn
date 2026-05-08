import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  resolve: {
    alias: {
      '@endo/ocapn': resolve(here, 'vendor/@endo/ocapn/index.js'),
    },
  },
  optimizeDeps: {
    // Pre-bundle the vendored ocapn so its many small files don't trigger
    // a refresh storm during dev.
    include: [
      '@endo/eventual-send',
      '@endo/marshal',
      '@endo/promise-kit',
      '@endo/pass-style',
      '@endo/harden',
      '@endo/nat',
    ],
  },
  worker: {
    format: 'es',
  },
  server: {
    fs: {
      allow: [resolve(here, '..')],
    },
  },
});
