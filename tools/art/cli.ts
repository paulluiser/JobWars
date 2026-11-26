// `npm run art`: inbox (any names, sprite sheets) → art/raw → public/art.
//   npm run art -- --inbox "/path/to/folder"   also ingest from another folder
import { processArt } from './process';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const { JOBS } = await import('./jobs');
const { ingest } = await import('./ingest');
const raw = arg('raw', 'art/raw');
// 1. inbox (any file names, sprite sheets) → art/raw
for (const inbox of ['art/inbox', ...(process.argv.includes('--inbox') ? [arg('inbox', '')] : [])]) {
  const ing = await ingest(inbox.replace(/^~/, process.env.HOME ?? '~'), raw);
  for (const l of ing.lines) console.log(`→ ${l}`);
  for (const w of ing.warnings) console.log(`⚠ ${w}`);
}
// 2. art/raw → public/art
const report = await processArt({ raw, out: arg('out', 'public/art'), rigPath: arg('rig', 'art/rig.json'), knownIds: JOBS.map((d) => d.id) });
for (const f of report.files) {
  const bg = f.bgRemoved ? `  (removed ${(f.bgRemoved * 100).toFixed(0)}% background)` : '';
  console.log(`✓ ${f.out}  ${f.size[0]}×${f.size[1]}${bg}`);
  for (const w of f.warnings) console.log(`  ⚠ ${w}`);
}
for (const w of report.warnings) console.log(`⚠ ${w}`);
if (!report.files.length) console.log('No images found. Put ChatGPT PNGs in art/raw/<id>/ (see art/PROMPTS.md).');
