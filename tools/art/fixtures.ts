// Test fixtures that imitate ChatGPT output for one character, so the pipeline can be
// proven end-to-end before real art exists:
//   body.png   on an opaque flat background      → exercises flat background removal
//   weapon.png on a baked-in grey checkerboard   → exercises "fake transparency" removal
//   bust.png   properly transparent              → passes straight through
//   arena/market.png
// Usage: tsx tools/art/fixtures.ts [outDir=art/fixtures]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROSTER } from '../../src/data/roster';
import { portraitSvg } from '../../src/ui/portrait';

const INK = '#2a1d14';

const bodySvg = (bg: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${bg}"/>
  <g transform="translate(512 900)" stroke="${INK}" stroke-width="10" stroke-linejoin="round">
    <rect x="-70" y="-120" width="52" height="120" rx="20" fill="#4a3426"/><rect x="10" y="-120" width="52" height="120" rx="20" fill="#4a3426"/>
    <rect x="-120" y="-330" width="230" height="230" rx="70" fill="#f4f1ea"/>
    <path d="M-40 -330 L 0 -280 L 40 -330 Z" fill="#d9452b"/>
    <circle cx="-30" cy="-250" r="9" fill="${INK}" stroke="none"/><circle cx="-30" cy="-190" r="9" fill="${INK}" stroke="none"/>
    <rect x="-150" y="-300" width="50" height="150" rx="25" fill="#f4f1ea"/>
    <circle cx="-125" cy="-140" r="26" fill="#f3c9a0"/>
    <circle cx="0" cy="-470" r="170" fill="#f3c9a0"/>
    <path d="M-170 -480 C -170 -640 170 -640 170 -480 C 120 -560 -120 -560 -170 -480 Z" fill="#3b2a20"/>
    <ellipse cx="50" cy="-450" rx="22" ry="34" fill="${INK}"/><ellipse cx="120" cy="-450" rx="22" ry="34" fill="${INK}"/>
    <path d="M60 -380 Q 95 -350 130 -380" fill="none"/>
    <rect x="-140" y="-700" width="280" height="90" rx="30" fill="#fffdf6"/>
    <circle cx="-90" cy="-740" r="70" fill="#fffdf6"/><circle cx="0" cy="-770" r="80" fill="#fffdf6"/><circle cx="90" cy="-740" r="70" fill="#fffdf6"/>
  </g></svg>`;

const checker = () => {
  let s = '';
  for (let y = 0; y < 1536; y += 32) for (let x = 0; x < 1024; x += 32) s += `<rect x="${x}" y="${y}" width="32" height="32" fill="${(x / 32 + y / 32) % 2 ? '#cccccc' : '#ffffff'}"/>`;
  return s;
};

const weaponSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
  ${checker()}
  <g transform="translate(512 1500)" stroke="${INK}" stroke-width="12" stroke-linejoin="round">
    <rect x="-60" y="-420" width="120" height="420" rx="50" fill="#f4f1ea"/>
    <circle cx="0" cy="-440" r="70" fill="#f3c9a0"/>
    <rect x="-22" y="-640" width="44" height="220" rx="12" fill="#5b3a22"/>
    <path d="M-40 -640 L 170 -640 L 190 -1320 L -40 -1320 Z" fill="#dfe6ee"/>
    <circle cx="110" cy="-1240" r="24" fill="${INK}" stroke="none"/>
  </g></svg>`;

const arenaSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#3d5236"/>
  <rect x="150" y="160" width="724" height="120" fill="#7d6a57" stroke="${INK}" stroke-width="8"/>
  <rect x="150" y="280" width="724" height="600" fill="#c9b28d" stroke="${INK}" stroke-width="8"/>
  <circle cx="512" cy="580" r="150" fill="none" stroke="#a88f6a" stroke-width="12"/>
  <rect x="120" y="270" width="30" height="640" fill="#5a4a3c"/><rect x="874" y="270" width="30" height="640" fill="#5a4a3c"/><rect x="120" y="880" width="784" height="34" fill="#5a4a3c"/>
</svg>`;

export async function makeFixtures(outDir: string, id = 'chef') {
  const dir = join(outDir, id);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(outDir, 'arena'), { recursive: true });
  const chef = ROSTER.find((d) => d.id === id)!;
  await sharp(Buffer.from(bodySvg('#f7efe0'))).png().toFile(join(dir, 'body.png'));
  await sharp(Buffer.from(weaponSvg())).png().toFile(join(dir, 'weapon.png'));
  await sharp(Buffer.from(portraitSvg(chef, 'bust', true).replace('<svg ', '<svg width="816" height="1200" '))).png().toFile(join(dir, 'bust.png'));
  await sharp(Buffer.from(arenaSvg())).png().toFile(join(outDir, 'arena', 'market.png'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await makeFixtures(process.argv[2] ?? 'art/fixtures');
  console.log('fixtures written');
}
