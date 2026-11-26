// Writes art/PROMPTS_CARDS.md: ONE ChatGPT prompt for every gacha card icon + the card effects,
// numbered in the exact grid order the pipeline slices (tools/art/cardnames.ts).
//   npx tsx tools/art/cardprompt.ts
import { writeFileSync } from 'node:fs';
import { ALL_CARDS, CARD_BY_ID, RARITY_COLOR } from '../../src/data/cards';
import { CARD_ART_NAMES } from './cardnames';

const ICON: Record<string, string> = {
  'overtime-pay': 'a thick stack of green cash bills tied with a gold band, a tiny clock on top',
  'hard-hat': 'a sturdy yellow construction hard hat with a bright shine',
  'health-plan': 'a red heart set inside a white medical shield',
  'coffee-break': 'a steaming coffee mug whose steam forms a little lightning bolt',
  'running-shoes': 'a pair of red running sneakers with speed lines',
  'long-reach': 'a telescopic metal extension pole with a grabber claw',
  'steady-hands': 'a red-and-white bullseye target with a dart dead centre',
  'light-feet': 'a single white feather floating, with a soft breeze swirl',
  'safety-gear': 'a blue protective shield with a yellow-black safety stripe',
  'sharp-eye': 'a glowing eye with a crosshair for a pupil',
  'heavy-lunch': 'a big wooden bento lunch box packed with rice and fried food',
  'fast-learner': 'a blue textbook with a glowing lightbulb above it',
  'first-aid': 'a white first-aid kit with a red cross',
  'thick-skin': 'a padded brown work jacket wrapped in a faint blue shield glow',
  'pep-talk': 'an orange megaphone with curved sound waves',
  'night-shift': 'a purple bat flying in front of a crescent moon, a red droplet below',
  'spiky-uniform': 'a green work vest covered in cactus spikes',
  'overclock': 'a speedometer with its needle in the red and a yellow lightning bolt',
  'adrenaline': 'a syringe full of glowing red liquid',
  'hot-temper': 'a small erupting volcano with an angry face',
  'combo-breaker': 'a red boxing glove punching, four small impact stars around it',
  'poison-pen': 'a black fountain pen dripping glowing green poison',
  'hot-coffee': 'a coffee cup with flames rising instead of steam',
  'counter-clerk': 'a silver service desk bell with a curved yellow return arrow',
  'second-wind': 'a spiral gust of fresh wind carrying a green leaf',
  'hazard-pay': 'a round yellow-and-black radiation hazard badge',
  'momentum': 'a blue swirling vortex arrow spinning fast',
  'executioner': 'a heavy steel axe with a gleaming edge',
  'iron-will': 'a grey stone brick wall with a steel emblem in the middle',
  'bounty-hunter': 'a wooden bow with an arrow tipped by a gold coin',
  'double-shift': 'two silver stopwatches overlapping, glowing purple',
  'encore': 'theatre comedy and tragedy masks under a spotlight',
  'golden-parachute': 'a golden parachute carrying a shiny briefcase',
  'chain-reaction': 'heavy iron chain links crackling with blue lightning',
  'giant-mode': 'a towering stone statue head, ancient and huge',
  'berserker': 'a roaring red horned helmet with steam puffs',
  'glass-cannon': 'a cannon made of clear glass firing a fireball',
  'aegis': 'a glowing teal hexagonal energy shield',
  'workaholic': 'a brown briefcase overflowing with papers, sparkling',
  'reflective-vest': 'a silver mirror-shiny vest bouncing a beam of light',
  'critical-mass': 'a blazing orange meteor with a fiery trail',
  'flow-state': 'a curling blue ocean wave',
  'grudge': 'an angry red face with a throbbing vein and clenched teeth',
  'lightning-rod': 'a metal lightning rod on a rooftop being struck by lightning',
  'phoenix': 'a fiery orange phoenix rising from flames',
  'bulwark': 'a stone castle tower with a big shield on its front',
  'brawlers-blood': 'two crossed fists with a red droplet',
  'backstab': 'a curved dagger trailing dark shadow',
  'mana-surge': 'a glowing purple crystal ball on a small stand',
  'eagle-eye': "a fierce eagle's head with a gleaming eye",
  'field-medic': 'a white medic helmet with a red cross and a small heart',
  'mind-games': 'a pink brain with swirling sparkles',
  'secret-recipe': "an old recipe scroll with a red wax seal and a chef's whisk",
  'fireproof-suit': 'a red fire extinguisher in front of a fireproof jacket',
  'high-voltage': 'an electric plug sparking blue lightning',
  'night-nurse': "a white nurse's cap under a crescent moon",
  'express-lane': 'a cardboard delivery box with white wings',
  'big-catch': 'a huge fish hanging from a fishing hook',
  'harvest-moon': 'a big full orange moon above a pumpkin',
  'reinforced-steel': 'a riveted steel I-beam with a shine',
  'mother-lode': 'a cluster of glowing gems in rock with a pickaxe',
  'hot-seam': 'a welding torch with a white-hot blue flame',
  'pressure-washer': 'a pressure-washer nozzle blasting a jet of water',
  'upgrade-kit': 'an open red toolbox with a glowing wrench',
  'load-bearing': 'a rolled blueprint with a set square and pencil',
  'afterburner': 'a jet engine with a blue afterburner flame',
  'compound-interest': 'a rising green arrow over a stack of gold coins',
  'fine-service': 'a silver serving cloche with sparkles',
  'sanitizer': 'a spray bottle puffing soap bubbles',
  'perfect-fit': 'a spool of thread with a needle and a measuring tape',
  'fresh-fade': "a barber's straight razor beside a small barber pole",
  'second-opinion': 'a medical clipboard with a stethoscope',
  'unstable-formula': 'a bubbling flask with cracked glass and a green glow',
  'extra-credit': 'a sheet of paper with a big red check mark and a gold star sticker',
  'overclocked-cpu': 'a computer chip glowing hot orange',
  'tax-return': 'a long receipt with a green return arrow and coins',
  'objection-sustained': 'a pair of golden scales of justice',
  'riot-gear': 'a gold police badge on a clear riot shield',
  'battle-hardened': 'a military medal on a ribbon with stars',
  'masterpiece': "an artist's paint palette inside a golden picture frame",
  'standing-ovation': 'an electric guitar with sparkles and a few thrown roses',
  'second-half': 'a gold medal on a ribbon next to a stopwatch',
  'fx-pick': 'EFFECT: a radial burst of white-gold light rays and sparkles (no object in the middle)',
  'fx-epic': 'EFFECT: a swirling purple energy aura ring, seen slightly from above (an ellipse)',
  'fx-shield': 'EFFECT: a translucent teal hexagon-pattern bubble shield (a sphere)',
  'fx-phoenix': 'EFFECT: a big phoenix made of flames with wings spread wide',
  'fx-parachute': 'EFFECT: an open golden parachute floating, no cargo',
  'fx-chain': 'EFFECT: a horizontal arc of crackling blue chain lightning',
  'fx-rod': 'EFFECT: a single bright vertical lightning bolt striking down',
  'fx-overtime': 'EFFECT: a flaming red stopwatch',
};

const missing = CARD_ART_NAMES.filter((n) => !ICON[n]);
if (missing.length) throw new Error(`no icon description for: ${missing.join(', ')}`);

const rowsTxt: string[] = [];
for (let r = 0; r < 9; r++) {
  const cells = CARD_ART_NAMES.slice(r * 10, r * 10 + 10).map((n, i) => `${r * 10 + i + 1}. ${ICON[n]}`);
  rowsTxt.push(`Row ${r + 1}:\n${cells.join('\n')}`);
}
const table = CARD_ART_NAMES.map((n, i) => {
  const c = CARD_BY_ID.get(n);
  return `| ${i + 1} | ${c ? c.name : n} | ${c ? `${c.rarity}${c.job ? ` · ${c.job} only` : c.role ? ` · ${c.role} only` : ''}` : 'effect'} |`;
}).join('\n');

const md = `# Card art prompt: every gacha card icon and card effect in one image

One message, one image (${CARD_ART_NAMES.length} pictures: ${ALL_CARDS.length} card icons + ${CARD_ART_NAMES.length - ALL_CARDS.length} effects).
**Attach the Chef master** (\`art/raw/chef/master.png\`) so the style matches, then paste the prompt below. Save the
result (any file name) in a folder called **Cards** inside your assets folder and tell Claude. The pipeline cuts the
sheet into ${CARD_ART_NAMES.length} pieces by grid position; until then the game shows each card's emoji.

If a cell comes out wrong, reply in the same chat naming its number, e.g. "redo #33, the parachute should be gold".
If ChatGPT crowds the sheet, ask it to "make the image larger, keep the 10 × 9 grid and the numbering order".

\`\`\`
Match the art style of the attached image exactly: original hand-painted 2D game art for a mobile action RPG, clean dark warm-brown outlines (#2a1d14), cel shading with 2–3 tones plus a soft rim light, light from the top-left, saturated warm colours, painted texture (not flat vector, not 3D, not pixel art).

Make ONE large sprite sheet of ${CARD_ART_NAMES.length} separate game icons arranged in a strict grid of 10 columns × 9 rows. Each icon sits alone, centred in its own square cell, fills about 70% of the cell, faces the viewer, and never touches or overlaps another icon. Transparent background (PNG). No text, no letters, no numbers, no card frames, no borders, no grid lines, no ground shadows. Every icon must be bold and readable at small size (like a mobile game buff icon): one clear object, strong silhouette. Wide, high-resolution image.

Cells are numbered left to right, top to bottom. Icons 1–15 are common buffs, 16–30 rare, 31–45 epic, 46–52 class perks, 53–82 job perks: make epic ones a little more magical and glowing than common ones. Cells 83–90 are effect sprites (glows and bursts, no hard outline needed on the glow itself).

${rowsTxt.join('\n\n')}
\`\`\`

## Which card each cell is

| # | Card | Rarity |
|---|---|---|
${table}

Rarity frames are drawn by the game (common ${RARITY_COLOR.common}, rare ${RARITY_COLOR.rare}, epic ${RARITY_COLOR.epic}), so the icons have no frames.
`;
writeFileSync('art/PROMPTS_CARDS.md', md);
console.log(`wrote art/PROMPTS_CARDS.md (${CARD_ART_NAMES.length} cells)`);
