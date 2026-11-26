import type { FighterDef } from '../sim/types';

/**
 * Placeholder portraits drawn as SVG until the AI-generated busts exist (M3/M6).
 * 'bust' = tall cutscene portrait, 'icon' = square head crop for cards and the HUD.
 * Same hat language as the in-game puppets so each job reads from its silhouette.
 */
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const INK = '#2a1d14';

function shade(n: number, k: number) {
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return hex((Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b));
}

const HAIR: Record<string, string> = {
  chef: '#3b2a20', firefighter: '#2e221a', electrician: '#1f1a17', nurse: '#6b3e26', courier: '#1b1410', fisher: '#7a5230',
};

function hat(id: string, accent: string) {
  switch (id) {
    case 'chef':
      return `<path d="M128 150 C 90 140 92 70 140 76 C 150 30 230 26 246 64 C 300 52 318 120 278 150 Z" fill="#fffdf6" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
        <rect x="126" y="140" width="156" height="40" rx="10" fill="#f1ece0" stroke="${INK}" stroke-width="8"/>`;
    case 'firefighter':
      return `<path d="M96 178 C 96 86 312 86 312 178 Z" fill="#c9302a" stroke="${INK}" stroke-width="8"/>
        <path d="M70 182 Q 204 150 338 182 L 338 196 Q 204 172 70 196 Z" fill="#9e221d" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
        <path d="M180 104 h48 v46 l-24 14 l-24 -14 z" fill="#f2c230" stroke="${INK}" stroke-width="6"/>`;
    case 'electrician':
      return `<path d="M100 172 C 100 92 308 92 308 172 Z" fill="#f5c518" stroke="${INK}" stroke-width="8"/>
        <rect x="80" y="166" width="248" height="22" rx="10" fill="#e0ad0c" stroke="${INK}" stroke-width="8"/>
        <path d="M212 104 l-26 40 h22 l-12 32 l34 -46 h-22 l14 -26 z" fill="${INK}"/>`;
    case 'nurse':
      return `<path d="M128 150 L 140 96 Q 204 80 268 96 L 280 150 Z" fill="#ffffff" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
        <rect x="192" y="102" width="24" height="36" rx="4" fill="${accent}"/><rect x="186" y="108" width="36" height="24" rx="4" fill="${accent}"/>`;
    case 'courier':
      return `<path d="M104 168 C 104 100 304 100 304 168 Z" fill="#f08a24" stroke="${INK}" stroke-width="8"/>
        <path d="M290 160 Q 350 160 360 184 L 286 184 Z" fill="#d06f12" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
        <rect x="170" y="118" width="68" height="26" rx="6" fill="#fff" stroke="${INK}" stroke-width="5"/>`;
    case 'fisher':
      return `<path d="M120 160 Q 128 92 204 90 Q 280 92 288 160 Z" fill="#e9c46a" stroke="${INK}" stroke-width="8"/>
        <path d="M78 174 Q 204 136 330 174 L 320 194 Q 204 160 88 194 Z" fill="#d9ad45" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
        <circle cx="262" cy="122" r="9" fill="#3f7d5a" stroke="${INK}" stroke-width="4"/>`;
    default:
      // M4 jobs: a simple cap in the accent colour until their art lands
      return `<path d="M108 170 C 108 102 300 102 300 170 Z" fill="${accent}" stroke="${INK}" stroke-width="8"/>
        <rect x="96" y="162" width="216" height="18" rx="9" fill="${accent}" stroke="${INK}" stroke-width="7"/>`;
  }
}

export function portraitSvg(d: FighterDef, mode: 'bust' | 'icon' = 'icon', shout = false): string {
  const skin = hex(d.skin);
  const body = hex(d.color);
  const accent = hex(d.accent);
  const hair = HAIR[d.id] ?? '#3b2a20';
  const blush = '#ff8a8a';
  const mouth = shout
    ? `<path d="M182 296 Q 204 336 226 296 Z" fill="#6a1f1f" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`
    : `<path d="M186 300 Q 204 314 222 300" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  const brows = shout
    ? `<path d="M138 214 l40 12 M270 214 l-40 12" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`
    : `<path d="M140 220 q20 -10 40 0 M228 220 q20 -10 40 0" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  const face = `
    <rect x="178" y="330" width="52" height="50" fill="${shade(d.skin, 0.88)}" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="204" cy="250" rx="112" ry="108" fill="${skin}" stroke="${INK}" stroke-width="9"/>
    <path d="M96 236 C 96 150 312 150 312 236 C 290 196 250 180 204 184 C 158 180 118 196 96 236 Z" fill="${hair}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    ${brows}
    <ellipse cx="160" cy="256" rx="17" ry="24" fill="${INK}"/><ellipse cx="248" cy="256" rx="17" ry="24" fill="${INK}"/>
    <circle cx="166" cy="246" r="6" fill="#fff"/><circle cx="254" cy="246" r="6" fill="#fff"/>
    <ellipse cx="132" cy="292" rx="18" ry="9" fill="${blush}" opacity=".5"/><ellipse cx="276" cy="292" rx="18" ry="9" fill="${blush}" opacity=".5"/>
    ${mouth}
    ${hat(d.id, accent)}`;
  if (mode === 'icon') {
    return `<svg viewBox="70 50 268 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${face}</svg>`;
  }
  return `<svg viewBox="0 0 408 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M30 600 C 30 440 110 380 204 380 C 298 380 378 440 378 600 Z" fill="${body}" stroke="${INK}" stroke-width="10"/>
    <path d="M150 386 L 204 450 L 258 386" fill="${accent}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M70 520 Q 110 470 130 600 M338 520 Q 298 470 278 600" stroke="${shade(d.color, 0.75)}" stroke-width="10" fill="none"/>
    ${face}
  </svg>`;
}
