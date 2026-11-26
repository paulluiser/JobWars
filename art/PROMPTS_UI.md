# Title screen, menu and loader art: 3 images

Three separate ChatGPT messages, one image each. For **every** message, attach the Chef master
(`art/raw/chef/master.png`) **and two or three other characters' masters** (e.g. Firefighter, Nurse,
Builder) so the style and the character designs match. Save the results (any file names) in your assets
folder like this, then tell Claude, or run `npm run art -- --inbox "<assets folder>"` yourself:

| Image | Put it in a folder called | Used for |
|---|---|---|
| 1. Poster, landscape 16:9 | `Poster` | title screen, main-menu background, link previews (desktop) |
| 2. Poster, portrait 9:16 | `Poster` (same folder) | the same on phones |
| 3. UI emblem sheet | `UI` | menu mode emblems, PvP rank insignia, Story district emblems, loader badge |

The pipeline tells the two posters apart by their shape. No text in any image: the game draws the
"JOB WARS" logo and every label itself, so the art never has garbled lettering.

---

## 1. Landing poster: landscape (16:9)

```
Match the art style of the attached images exactly: original hand-painted 2D game art for a mobile action RPG, chibi characters with big heads and small bodies, clean dark warm-brown outlines (#2a1d14), cel shading with 2–3 tones plus a soft rim light, saturated warm colours, painted texture (not flat vector, not 3D, not pixel art).

Create the key-art poster for an auto-battle game called Job Wars, where real-world jobs fight as RPG heroes. Wide landscape image, 16:9.

Scene: an epic, joyful battle charge in a sunlit stone arena with low brick walls, wooden crates, barrels and leafy vines (like the attached arena style). Two rival crowds of chibi workers rush toward each other from the left and the right and clash in the middle, mid-action, wielding their work tools as weapons. In the centre foreground, the hero trio from the attached images: a Chef swinging a cleaver, a Firefighter with an axe, a Nurse with defibrillator paddles. Around them, many other workers in dynamic poses: a Builder with a sledgehammer, an Electrician with crackling lightning, a Soldier, a Police officer with a riot shield, a Farmer with a scythe, a Scientist throwing a glowing green flask, a Pilot, a Musician with an electric guitar, an Artist with a giant paintbrush splashing colour, a Waiter flinging a silver tray, a Miner with a pickaxe, a Lawyer with a giant gavel, an Athlete kicking a ball, a Doctor, a Programmer with a laptop, a Merchant tossing gold coins.

Action and effects: speed lines, dust clouds, sparks from clashing tools, a few gold coins, a paper airplane, playing-card-like glowing buff cards (purple, blue and green) floating in the air above the fight, light rays from the top. Strong depth: big characters in the foreground, smaller ones behind.

Composition: keep the TOP CENTRE third calmer and less detailed (sky, light rays, soft glow) because the game title will be placed there. Keep the very bottom edge simple too. The fight's focal point is the lower middle.

No text, no letters, no logos, no numbers, no UI, no borders, no watermark.
```

## 2. Landing poster: portrait (9:16)

```
Match the art style of the attached images exactly: original hand-painted 2D game art for a mobile action RPG, chibi characters with big heads and small bodies, clean dark warm-brown outlines (#2a1d14), cel shading with 2–3 tones plus a soft rim light, saturated warm colours, painted texture (not flat vector, not 3D, not pixel art).

Create the phone version of the key-art poster for an auto-battle game called Job Wars, where real-world jobs fight as RPG heroes. Tall portrait image, 9:16.

Scene: a sunlit stone arena with low brick walls, crates, barrels and vines. A tall vertical pile-up of a battle: in the lower half, the hero trio from the attached images charges toward the viewer (a Chef swinging a cleaver, a Firefighter with an axe, a Nurse with defibrillator paddles), with more chibi workers behind and above them leaping in from both sides: a Builder with a sledgehammer, an Electrician with crackling lightning, a Police officer with a riot shield, a Farmer with a scythe, a Scientist throwing a glowing flask, a Musician with an electric guitar, an Artist splashing paint, a Waiter flinging a tray, a Lawyer with a giant gavel, a Merchant tossing gold coins.

Effects: speed lines, dust, sparks, flying coins, glowing buff cards (purple, blue, green) floating upward, light rays from above.

Composition: keep the TOP QUARTER calm (bright sky, light rays, soft glow) for the game title, and keep the bottom 12% simple (ground, dust) for a "tap to start" button. Characters fill the middle.

No text, no letters, no logos, no numbers, no UI, no borders, no watermark.
```

## 3. UI emblem sheet (5 columns × 4 rows)

```
Match the art style of the attached images exactly: original hand-painted 2D game art for a mobile action RPG, clean dark warm-brown outlines (#2a1d14), cel shading with 2–3 tones plus a soft rim light, light from the top-left, saturated warm colours, painted texture (not flat vector, not 3D, not pixel art).

Make ONE sprite sheet of 20 separate game UI emblems arranged in a strict grid of 5 columns × 4 rows. Each emblem sits alone, centred in its own square cell, fills about 75% of the cell, faces the viewer, and never touches another emblem. Transparent background (PNG). No text, no letters, no numbers, no grid lines, no ground shadows. Bold, readable silhouettes like mobile-game menu icons.

Cells are numbered left to right, top to bottom.

Row 1 — game modes and loader:
1. Player vs Player: two crossed work tools (a chef's cleaver and a firefighter's axe) over a round red shield, small sparks
2. Story Mode: an open storybook with a tiny city skyline popping up from its pages
3. CPU Battle: a cute round robot head wearing a little hard hat
4. Tournament: a golden trophy cup with two handles and a star on it
5. Loader badge: a workplace ID badge on a red lanyard clip, blank photo area with a simple worker silhouette

Row 2 — PvP rank insignia (each a badge or medal, increasingly grand and shiny):
6. Intern: a plain paper name tag with a safety pin, beige
7. Associate: a green round pin badge with one small star
8. Specialist: a blue shield badge with two stars
9. Manager: a purple shield badge with three stars and small laurel leaves
10. Director: an orange-and-bronze medal with a ribbon and four stars

Row 3 — top ranks and Story districts:
11. Executive: a red-and-gold crest with wings and five stars
12. CEO: a golden crown resting on a gleaming gold crest with gems
13. Downtown district: a city block of tall buildings with a street lamp
14. Construction Site district: a construction crane lifting a steel beam
15. Hospital Hill district: a hospital building with a big red cross on a small hill

Row 4 — more districts and menu icons:
16. City Hall & Campus district: a domed city hall with a school bell
17. Countryside & Harbor district: a red barn next to a little lighthouse
18. Arts District & Grand Hall district: a grand theatre with red curtains and a spotlight
19. Star: a big shiny golden star with a sparkle
20. Lock: a sturdy brass padlock
```
