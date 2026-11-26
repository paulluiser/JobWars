// Writes art/PROMPTS_BATCH.md: two copy-paste ChatGPT messages per remaining job.
//   npm run art:prompts
import { writeFileSync } from 'node:fs';
import { JOBS } from './jobs';

const STYLE = `Match the art style of the attached image exactly (same chibi proportions, outline colour and weight, cel shading, rim light, painted texture and camera angle). It is a different character. Original hand-painted 2D game art for a mobile action RPG. Chibi proportions, about 2.5 heads tall: big head, big expressive eyes with a white highlight, blush marks, small body, oversized tool. Clean dark warm-brown outlines (#2a1d14). Cel shading, light from the top-left. Transparent background (PNG). No shadows, no text, no labels.`;

const sheet = (j: (typeof JOBS)[number]) => `${STYLE}

Character (${j.name.toUpperCase()}): ${j.costume}. Tool: ${j.tool}.

Draw THREE separate pieces side by side, with plenty of empty space between them so they don't touch:
1. LEFT: the full ${j.name.toLowerCase()}, standing, 3/4 view facing right, holding the tool raised in the front hand, the other arm relaxed.
2. MIDDLE: the exact same character in the exact same pose and size, but WITHOUT the front arm and WITHOUT the tool.
3. RIGHT: only the front arm holding the tool, as one isolated piece, standing upright: the shoulder end of the sleeve at the bottom, the arm pointing straight up, the tool continuing straight up above the hand.

All three pieces the same size and style. Wide image.`;

const bust = (j: (typeof JOBS)[number]) => `Same character as above (${j.name.toLowerCase()}), now as a cutscene portrait for a special move: upper body only, taller semi-realistic anime proportions (not chibi), more detailed painted rendering, same costume and colours. Shouting "${j.quote}", holding the tool, dynamic angle. Transparent background (PNG), no text, no frame. Portrait format (taller than wide).`;

const todo = JOBS.filter((j) => j.batch > 0);
const md = `# Prompt batch: every remaining job

**Two messages per job.** Quick start: [art/QUICK_START.md](QUICK_START.md).

For each job:
1. New ChatGPT chat. **Attach the Chef master** (\`art/raw/chef/master.png\`) and paste message **A**.
2. Same chat: paste message **B**.
3. Save both images, any names, into a folder named after the job (e.g. \`Battlesim Assets/Electrician/\`).

If the sheet's 3 pieces touch each other, or the middle one still holds the tool, regenerate or tell ChatGPT what to fix.

| Batch | Jobs |
|---|---|
${[...new Set(todo.map((j) => j.batch))].map((b) => `| ${b}${b === 1 ? ' (playable now)' : ' (skills in M4)'} | ${todo.filter((j) => j.batch === b).map((j) => j.name).join(', ')} |`).join('\n')}

---
${todo.map((j) => `
## ${j.name}${j.batch === 1 ? ' · batch 1' : ''}

**A. Sprite sheet** (attach the Chef master)
\`\`\`
${sheet(j)}
\`\`\`

**B. Cutscene portrait**
\`\`\`
${bust(j)}
\`\`\`
`).join('')}`;

writeFileSync('art/PROMPTS_BATCH.md', md);
console.log(`art/PROMPTS_BATCH.md: ${todo.length} jobs, ${todo.length * 2} messages`);
