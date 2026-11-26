import { defineConfig, type Plugin } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Dev-only: POST /__rig from /rig.html saves art/rig.json and patches the rig values into
 * public/art/manifest.json (no image reprocessing needed). Never part of the production build.
 */
function rigSaver(): Plugin {
  return {
    name: 'rig-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__rig', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'POST only' }));
          return;
        }
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const rig = JSON.parse(body);
          const rigPath = 'art/rig.json';
          if (existsSync(rigPath)) {
            const saved = JSON.parse(readFileSync(rigPath, 'utf8'));
            if (saved.arenas) rig.arenas = { ...saved.arenas, ...rig.arenas };
          }
          writeFileSync(rigPath, JSON.stringify(rig, null, 2) + '\n');
          const mPath = 'public/art/manifest.json';
          if (existsSync(mPath)) {
            const m = JSON.parse(readFileSync(mPath, 'utf8'));
            for (const [id, r] of Object.entries(rig)) if (id !== 'arenas' && m.characters?.[id]) m.characters[id].rig = r;
            for (const [name, a] of Object.entries((rig.arenas ?? {}) as Record<string, { floor: unknown }>)) if (m.arenas?.[name]) m.arenas[name].floor = a.floor;
            writeFileSync(mPath, JSON.stringify(m, null, 2));
          }
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [rigSaver()],
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
