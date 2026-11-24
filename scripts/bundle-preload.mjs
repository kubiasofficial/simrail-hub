// Sandboxovaný preload nesmí načítat lokální moduly přes require → zabalíme ho do jednoho souboru.
import { build } from 'esbuild';
import { resolve } from 'node:path';
await build({
  absWorkingDir: process.cwd(), tsconfig: resolve('tsconfig.json'), entryPoints: [resolve('src/preload/index.ts')],
  outfile: 'dist-electron/preload/index.js',
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  external: ['electron'], allowOverwrite: true, logLevel: 'warning'
});
