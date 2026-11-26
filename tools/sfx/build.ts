// Cut, level and encode the recorded sound effects for the web.
//   npm run sfx -- --src "/path/to/oculus-audio-pack"   (the unzipped OGG bundle: has ogg/ and LICENSE)
// Writes public/sfx/<key>.mp3, public/sfx/manifest.json and the pack's licence + attribution.
// Every clip: optional cut → leading silence trimmed → loudness-levelled → short fade-out → mono MP3.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLES } from './samples';

const src = process.argv.find((a) => a.startsWith('--src='))?.slice(6) ?? process.argv[process.argv.indexOf('--src') + 1];
if (!src || !existsSync(join(src, 'ogg'))) {
  console.error('Point --src at the unzipped Oculus Audio Pack (the folder with ogg/, LICENSE and ATTRIBUTION.md).');
  process.exit(1);
}
const OUT = 'public/sfx';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let bytes = 0;
const missing: string[] = [];
for (const [key, c] of Object.entries(SAMPLES)) {
  const input = join(src, 'ogg', c.file);
  if (!existsSync(input)) {
    missing.push(`${key} (${c.file})`);
    continue;
  }
  const filters = [
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.01',
    c.dur ? `afade=t=out:st=${Math.max(0, c.dur - 0.06)}:d=0.06` : 'areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse',
    'loudnorm=I=-17:TP=-1.5:LRA=11',
    c.gain ? `volume=${c.gain}` : '',
  ].filter(Boolean).join(',');
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (c.start) args.push('-ss', String(c.start));
  if (c.dur) args.push('-t', String(c.dur + 0.15));
  args.push('-i', input, '-af', filters, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '80k', join(OUT, `${key}.mp3`));
  execFileSync('ffmpeg', args);
  bytes += statSync(join(OUT, `${key}.mp3`)).size;
}
copyFileSync(join(src, 'LICENSE'), join(OUT, 'LICENSE.txt'));
copyFileSync(join(src, 'ATTRIBUTION.md'), join(OUT, 'ATTRIBUTION.md'));
const keys = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
  source: '"Oculus Audio Pack 01" by Oculus VR, LLC (https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/), licensed under CC BY 4.0. Cut, levelled and converted to MP3 for this game.',
  keys,
}, null, 2) + '\n');
console.log(`${keys.length} sounds, ${(bytes / 1024 / 1024).toFixed(2)} MB → ${OUT}${missing.length ? `\nmissing: ${missing.join(', ')}` : ''}`);
