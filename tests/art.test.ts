import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeFixtures } from '../tools/art/fixtures';
import { processArt } from '../tools/art/process';
import { ingest } from '../tools/art/ingest';
import { jobIdFor } from '../tools/art/jobs';
import { mkdirSync } from 'node:fs';

async function alphaAt(path: string, fx: number, fy: number) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const x = Math.min(info.width - 1, Math.round(fx * (info.width - 1)));
  const y = Math.min(info.height - 1, Math.round(fy * (info.height - 1)));
  return data[(y * info.width + x) * 4 + 3];
}

describe('art pipeline', () => {
  it('cleans ChatGPT-style images into game assets and writes a manifest', async () => {
    const root = mkdtempSync(join(tmpdir(), 'jobwars-art-'));
    const raw = join(root, 'raw');
    const out = join(root, 'out');
    await makeFixtures(raw);
    const report = await processArt({ raw, out, knownIds: ['chef'] });

    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(manifest.characters.chef.body).toBe('chef/body.webp');
    expect(manifest.characters.chef.weapon).toBe('chef/weapon.webp');
    expect(manifest.characters.chef.bust).toBe('chef/bust.webp');
    expect(manifest.characters.chef.icon).toBe('chef/icon.webp'); // cropped from the bust
    expect(manifest.characters.chef.rig.height).toBeGreaterThan(0);
    expect(manifest.arenas.market.src).toBe('arena/market.webp');
    for (const f of ['body', 'weapon', 'bust', 'icon']) expect(existsSync(join(out, 'chef', `${f}.webp`))).toBe(true);

    // flat background (body) and fake checkerboard (weapon) were removed: corners are transparent
    for (const f of ['body', 'weapon']) {
      expect(await alphaAt(join(out, 'chef', `${f}.webp`), 0, 0), `${f} top-left`).toBeLessThan(20);
      expect(await alphaAt(join(out, 'chef', `${f}.webp`), 1, 0), `${f} top-right`).toBeLessThan(20);
    }
    // the character itself survived (centre of the body is opaque)
    expect(await alphaAt(join(out, 'chef', 'body.webp'), 0.5, 0.6)).toBeGreaterThan(200);
    // trimmed and sized
    const body = await sharp(join(out, 'chef', 'body.webp')).metadata();
    expect(body.height).toBe(512);
    const weapon = await sharp(join(out, 'chef', 'weapon.webp')).metadata();
    expect(weapon.height).toBe(768);
    expect(weapon.width!).toBeLessThan(weapon.height!);
    expect(report.files.find((f) => f.out.endsWith('weapon.webp'))!.bgRemoved).toBeGreaterThan(0.3);
  }, 30000);

  it('matches loose folder names to jobs', () => {
    expect(jobIdFor('Fisherman')).toBe('fisher');
    expect(jobIdFor('fire fighter')).toBe('firefighter');
    expect(jobIdFor('Cook')).toBe('chef');
    expect(jobIdFor('Delivery Driver')).toBe('courier');
    expect(jobIdFor('Banana')).toBe(null);
  });

  it('cuts a 3-piece sprite sheet with any file name and auto-rigs it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'jobwars-sheet-'));
    await makeFixtures(join(root, 'fix'));
    await processArt({ raw: join(root, 'fix'), out: join(root, 'clean') }); // transparent pieces to build a sheet from
    const body = join(root, 'clean', 'chef', 'body.webp');
    const weapon = join(root, 'clean', 'chef', 'weapon.webp');
    // fake "master": the body (512 tall) with the arm + cleaver attached at its shoulder, on a wider canvas
    const bodyMeta = await sharp(body).metadata();
    const arm = await sharp(weapon).resize({ height: 360 }).png().toBuffer();
    const master = await sharp({ create: { width: bodyMeta.width! + 220, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: body, left: 0, top: 388 }, { input: arm, left: Math.round(bodyMeta.width! * 0.55), top: 388 + 200 - 360 + 40 }]).png().toBuffer();
    const bodyBuf = await sharp(body).png().toBuffer();
    const armTall = await sharp(weapon).resize({ height: 800 }).png().toBuffer();
    // sheet on a flat background: master | body | arm, unnamed, wide
    const sheet = await sharp({ create: { width: 2600, height: 1100, channels: 4, background: { r: 240, g: 236, b: 226, alpha: 1 } } })
      .composite([{ input: master, left: 20, top: 40 }, { input: bodyBuf, left: 1080, top: 40 }, { input: armTall, left: 2000, top: 50 }]).png().toBuffer();
    const inbox = join(root, 'inbox', 'Cook');
    mkdirSync(inbox, { recursive: true });
    await sharp(sheet).png().toFile(join(inbox, 'ChatGPT Image Nov 26.png'));
    const raw = join(root, 'raw');
    const rep = await ingest(join(root, 'inbox'), raw);
    expect(rep.warnings).toEqual([]);
    for (const f of ['master', 'body', 'weapon']) expect(existsSync(join(raw, 'chef', `${f}.png`)), f).toBe(true);
    const w = await sharp(join(raw, 'chef', 'weapon.png')).metadata();
    expect(w.height!).toBeGreaterThan(w.width! * 2); // the arm piece was picked as the weapon
    const out = join(root, 'out');
    const report = await processArt({ raw, out });
    expect(report.warnings.join(' ')).toMatch(/auto-rigged/);
    const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(m.characters.chef.rig.weaponLength).toBeGreaterThan(40);
  }, 60000);
});
