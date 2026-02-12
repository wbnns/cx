import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/cx': 'src/bin/cx.ts',
    'daemon/index': 'src/daemon/index.ts',
    'daemon/watcher-harness': 'src/daemon/watcher-harness.ts',
  },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
