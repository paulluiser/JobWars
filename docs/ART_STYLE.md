# Job Wars: art style guide (v1, M3 pilot)

Every image is checked against this page before it goes in the game. Prompts to generate them are in
[art/PROMPTS.md](../art/PROMPTS.md).

> **Originality rule.** Zenonia 4 sets the *quality bar* (painted chibi sprites, rich colour, big readable
> silhouettes, anime cutscene busts). We don't copy its characters, UI or look, and we never feed its
> screenshots to the generator. The only images used as style references are **our own approved "golden" images**.

## 1. The look in one paragraph

Hand-painted 2D chibi heroes for a mobile action RPG. Big heads, big expressive eyes, small bodies,
**oversized job tools**. Clean dark warm-brown outlines, cel shading with 2–3 tones plus a soft rim light,
light from the top-left. Saturated, warm colours. Painted texture: not flat vector, not 3D, not pixel art.
Slight top-down 3/4 view, facing right.

## 2. In-game sprites (chibi)

| Rule | Value |
|---|---|
| Proportions | about **2.5 heads tall**; head ≈ 40% of total height |
| Facing | **3/4 view, facing right** (the game mirrors it for left) |
| Camera | slight top-down 3/4 (we see a little of the top of the head and hat) |
| Outline | dark warm brown `#2a1d14`; ~3 px outer silhouette at 1024 px, ~1.5 px inner lines |
| Shading | 2–3 cel tones + a soft rim light on the right/back edge; light from top-left |
| Eyes | large, dark, one white highlight each; blush marks on cheeks |
| Tool | oversized (as long as the body or longer); reads instantly from the silhouette |
| Hat | every job's #1 silhouette cue: toque, fire helmet, bucket hat… |
| Colours | each character owns **1 main + 1 accent** (table below); everything else neutral |
| Background | **transparent**. No ground shadow (the game draws its own), no text, no frame |

### Silhouette test
Fill the sprite solid black. You should still be able to tell which job it is. If you can't, the hat or tool is too small.

## 3. Cutscene busts (special moves)

Taller, semi-realistic anime proportions (about 6–7 heads tall if full-body), upper body only, more detailed rendering
than the chibi. The contrast is what makes the special feel big. Same costume, colours and hat. **Shouting a battle cry**,
dynamic angle, transparent background, portrait format (2:3).

## 4. Arena

Square stone courtyard seen from slightly above (same 3/4 camera). Back wall at the top shows its brick face;
low walls on left, right and front. Warm cobblestone floor, **centre kept clean** (fighters must read on it), a faint
circular emblem in the middle. Props (crates, barrels, banners) stay **outside** the walls. No characters, no UI.

## 5. Pilot palettes

| Job | Main | Accent | Skin | Key features |
|---|---|---|---|---|
| Chef | white `#f4f1ea` | red `#d9452b` | `#f3c9a0` | tall puffy toque, double-breasted coat, red neckerchief, big steel cleaver |
| Firefighter | red `#d63b2a` | yellow `#f2c230` | `#e8b48a` | red helmet with wide back brim and yellow badge, turnout coat with yellow reflective stripes, red-headed fire axe |
| Fisher | green `#3f7d5a` | yellow `#e9c46a` | `#e2b48c` | yellow bucket hat with a lure pinned on it, green many-pocket vest, rubber boots, very long rod with line and hook |

(Remaining jobs: colours in `src/data/roster.ts`.)

## 6. Files the game needs per character

Drop them in `art/raw/<id>/` (e.g. `art/raw/chef/`) with exactly these names, then run `npm run art`.

| File | What | Notes |
|---|---|---|
| `master.png` | full chibi with tool, standing, facing right | **reference only**, not used in game; becomes the golden for the next characters |
| `body.png` | same chibi **without the front arm and tool** | the back arm stays, relaxed at the side; feet at the bottom |
| `weapon.png` | the **front arm + hand + tool as one piece**, drawn **vertical**: shoulder at the bottom, arm and tool pointing straight up | the game rotates it around the shoulder to swing |
| `bust.png` | cutscene bust, shouting | portrait 2:3 |
| `icon.png` | *(optional)* head-and-shoulders, neutral, square | if missing, the script crops one from the bust |

Arena: `art/raw/arena/market.png` (square).

Why two pieces instead of one image: the game animates swings by rotating the arm-and-tool piece around the shoulder,
and squashes/hops the body. Two clean pieces from one master keep the character identical in every pose.

## 7. QA checklist (before sign-off)

- [ ] Transparent background (or a flat colour the script can remove), nothing cropped at the edges
- [ ] Facing right, 3/4 view, same camera as the golden
- [ ] Outline colour/weight and shading match the golden side by side
- [ ] Palette matches the table; main colour reads first
- [ ] Silhouette test passes
- [ ] `body.png` has no floating hand or tool left over; `weapon.png` has the shoulder at the bottom edge
- [ ] Bust has the same costume details and colours as the chibi
- [ ] In game (`npm run dev`, then `/rig.html` to align): the weapon attaches at the shoulder and the swing looks right
