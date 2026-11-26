// Contact sheet of every sprite rig at several arm angles, rendered with the same rig maths as
// the game (body anchored at the feet, arm piece rotating around its pivot at the shoulder).
//   npx tsx tools/art/armsheet.ts out.png [angles=-1,0.5,1.9] [ids=a,b,c]
import sharp, { type OverlayOptions } from 'sharp';
import { readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'armsheet.png';
const angles = (process.argv[3] ?? '-1,0.5,1.9').split(',').map(Number);
const m = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
const ids: string[] = process.argv[4] ? process.argv[4].split(',') : Object.keys(m.characters).filter((id) => m.characters[id].body);
const S = 2.2;
const BEHIND = Number(process.env.BEHIND ?? 0.7); // render scale (game px → sheet px)
const CW = 460, CH = 400;

const cells: OverlayOptions[] = [];
for (const [r, id] of ids.entries()) {
  const c = m.characters[id];
  const rig = c.rig;
  const pv = rig.pivot ?? { x: 0.5, y: Number(process.env.PIVOT_Y ?? 1) };
  rig.shoulder = { x: rig.shoulder.x + Number(process.env.DX ?? 0), y: rig.shoulder.y + Number(process.env.DY ?? 0) };
  const bodyMeta = await sharp(`public/art/${c.body}`).metadata();
  const armMeta = await sharp(`public/art/${c.weapon}`).metadata();
  const bh = Math.round(rig.height * S), bw = Math.round((bodyMeta.width! / bodyMeta.height!) * bh);
  const body = await sharp(`public/art/${c.body}`).resize(bw, bh).png().toBuffer();
  const ah = Math.round(rig.weaponLength * S), aw = Math.round((armMeta.width! / armMeta.height!) * ah);
  for (const [k, ang] of angles.entries()) {
    // rotate the arm around its pivot: pad so the pivot is the image centre, then rotate
    const px = pv.x * aw, py = pv.y * ah;
    const R = Math.ceil(Math.hypot(Math.max(px, aw - px), Math.max(py, ah - py)));
    const padded = await sharp(`public/art/${c.weapon}`).resize(aw, ah)
      .extend({ left: Math.round(R - px), right: Math.round(R - (aw - px)), top: Math.round(R - py), bottom: Math.round(R - (ah - py)), background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const rot = await sharp(padded).rotate((ang * 180) / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const rm = await sharp(rot).metadata();
    const feetX = k * CW + CW / 2, feetY = r * CH + CH - 20;
    const sx = feetX + rig.shoulder.x * S, sy = feetY + rig.shoulder.y * S;
    // same layering as the game: raised back (angle < BEHIND) goes behind the body
    const bodyCell = { input: body, left: Math.round(feetX - bw / 2), top: Math.round(feetY - bh) };
    const armCell = { input: rot, left: Math.round(sx - rm.width! / 2), top: Math.round(sy - rm.height! / 2) };
    if (ang < BEHIND) cells.push(armCell, bodyCell);
    else cells.push(bodyCell, armCell);
  }
  cells.push({ input: Buffer.from(`<svg width="300" height="30"><text x="4" y="22" font-size="22" font-family="sans-serif" fill="#fff">${id}</text></svg>`), left: 0, top: r * CH });
}
await sharp({ create: { width: CW * angles.length, height: CH * ids.length, channels: 4, background: '#5a6070' } }).composite(cells).png().toFile(out);
console.log(`wrote ${out}`);
