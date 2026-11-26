# Card art prompt: every gacha card icon and card effect in one image

One message, one image (90 pictures: 82 card icons + 8 effects).
**Attach the Chef master** (`art/raw/chef/master.png`) so the style matches, then paste the prompt below. Save the
result (any file name) in a folder called **Cards** inside your assets folder and tell Claude. The pipeline cuts the
sheet into 90 pieces by grid position; until then the game shows each card's emoji.

If a cell comes out wrong, reply in the same chat naming its number, e.g. "redo #33, the parachute should be gold".
If ChatGPT crowds the sheet, ask it to "make the image larger, keep the 10 × 9 grid and the numbering order".

```
Match the art style of the attached image exactly: original hand-painted 2D game art for a mobile action RPG, clean dark warm-brown outlines (#2a1d14), cel shading with 2–3 tones plus a soft rim light, light from the top-left, saturated warm colours, painted texture (not flat vector, not 3D, not pixel art).

Make ONE large sprite sheet of 90 separate game icons arranged in a strict grid of 10 columns × 9 rows. Each icon sits alone, centred in its own square cell, fills about 70% of the cell, faces the viewer, and never touches or overlaps another icon. Transparent background (PNG). No text, no letters, no numbers, no card frames, no borders, no grid lines, no ground shadows. Every icon must be bold and readable at small size (like a mobile game buff icon): one clear object, strong silhouette. Wide, high-resolution image.

Cells are numbered left to right, top to bottom. Icons 1–15 are common buffs, 16–30 rare, 31–45 epic, 46–52 class perks, 53–82 job perks: make epic ones a little more magical and glowing than common ones. Cells 83–90 are effect sprites (glows and bursts, no hard outline needed on the glow itself).

Row 1:
1. a thick stack of green cash bills tied with a gold band, a tiny clock on top
2. a sturdy yellow construction hard hat with a bright shine
3. a red heart set inside a white medical shield
4. a steaming coffee mug whose steam forms a little lightning bolt
5. a pair of red running sneakers with speed lines
6. a telescopic metal extension pole with a grabber claw
7. a red-and-white bullseye target with a dart dead centre
8. a single white feather floating, with a soft breeze swirl
9. a blue protective shield with a yellow-black safety stripe
10. a glowing eye with a crosshair for a pupil

Row 2:
11. a big wooden bento lunch box packed with rice and fried food
12. a blue textbook with a glowing lightbulb above it
13. a white first-aid kit with a red cross
14. a padded brown work jacket wrapped in a faint blue shield glow
15. an orange megaphone with curved sound waves
16. a purple bat flying in front of a crescent moon, a red droplet below
17. a green work vest covered in cactus spikes
18. a speedometer with its needle in the red and a yellow lightning bolt
19. a syringe full of glowing red liquid
20. a small erupting volcano with an angry face

Row 3:
21. a red boxing glove punching, four small impact stars around it
22. a black fountain pen dripping glowing green poison
23. a coffee cup with flames rising instead of steam
24. a silver service desk bell with a curved yellow return arrow
25. a spiral gust of fresh wind carrying a green leaf
26. a round yellow-and-black radiation hazard badge
27. a blue swirling vortex arrow spinning fast
28. a heavy steel axe with a gleaming edge
29. a grey stone brick wall with a steel emblem in the middle
30. a wooden bow with an arrow tipped by a gold coin

Row 4:
31. two silver stopwatches overlapping, glowing purple
32. theatre comedy and tragedy masks under a spotlight
33. a golden parachute carrying a shiny briefcase
34. heavy iron chain links crackling with blue lightning
35. a towering stone statue head, ancient and huge
36. a roaring red horned helmet with steam puffs
37. a cannon made of clear glass firing a fireball
38. a glowing teal hexagonal energy shield
39. a brown briefcase overflowing with papers, sparkling
40. a silver mirror-shiny vest bouncing a beam of light

Row 5:
41. a blazing orange meteor with a fiery trail
42. a curling blue ocean wave
43. an angry red face with a throbbing vein and clenched teeth
44. a metal lightning rod on a rooftop being struck by lightning
45. a fiery orange phoenix rising from flames
46. a stone castle tower with a big shield on its front
47. two crossed fists with a red droplet
48. a curved dagger trailing dark shadow
49. a glowing purple crystal ball on a small stand
50. a fierce eagle's head with a gleaming eye

Row 6:
51. a white medic helmet with a red cross and a small heart
52. a pink brain with swirling sparkles
53. an old recipe scroll with a red wax seal and a chef's whisk
54. a red fire extinguisher in front of a fireproof jacket
55. an electric plug sparking blue lightning
56. a white nurse's cap under a crescent moon
57. a cardboard delivery box with white wings
58. a huge fish hanging from a fishing hook
59. a big full orange moon above a pumpkin
60. a riveted steel I-beam with a shine

Row 7:
61. a cluster of glowing gems in rock with a pickaxe
62. a welding torch with a white-hot blue flame
63. a pressure-washer nozzle blasting a jet of water
64. an open red toolbox with a glowing wrench
65. a rolled blueprint with a set square and pencil
66. a jet engine with a blue afterburner flame
67. a rising green arrow over a stack of gold coins
68. a silver serving cloche with sparkles
69. a spray bottle puffing soap bubbles
70. a spool of thread with a needle and a measuring tape

Row 8:
71. a barber's straight razor beside a small barber pole
72. a medical clipboard with a stethoscope
73. a bubbling flask with cracked glass and a green glow
74. a sheet of paper with a big red check mark and a gold star sticker
75. a computer chip glowing hot orange
76. a long receipt with a green return arrow and coins
77. a pair of golden scales of justice
78. a gold police badge on a clear riot shield
79. a military medal on a ribbon with stars
80. an artist's paint palette inside a golden picture frame

Row 9:
81. an electric guitar with sparkles and a few thrown roses
82. a gold medal on a ribbon next to a stopwatch
83. EFFECT: a radial burst of white-gold light rays and sparkles (no object in the middle)
84. EFFECT: a swirling purple energy aura ring, seen slightly from above (an ellipse)
85. EFFECT: a translucent teal hexagon-pattern bubble shield (a sphere)
86. EFFECT: a big phoenix made of flames with wings spread wide
87. EFFECT: an open golden parachute floating, no cargo
88. EFFECT: a horizontal arc of crackling blue chain lightning
89. EFFECT: a single bright vertical lightning bolt striking down
90. EFFECT: a flaming red stopwatch
```

## Which card each cell is

| # | Card | Rarity |
|---|---|---|
| 1 | Overtime Pay | common |
| 2 | Hard Hat | common |
| 3 | Health Plan | common |
| 4 | Coffee Break | common |
| 5 | Running Shoes | common |
| 6 | Extension Pole | common |
| 7 | Steady Hands | common |
| 8 | Light Feet | common |
| 9 | Safety Gear | common |
| 10 | Sharp Eye | common |
| 11 | Heavy Lunch | common |
| 12 | Fast Learner | common |
| 13 | First Aid Kit | common |
| 14 | Thick Skin | common |
| 15 | Pep Talk | common |
| 16 | Night Shift | rare |
| 17 | Spiky Uniform | rare |
| 18 | Overclock | rare |
| 19 | Adrenaline | rare |
| 20 | Hot Temper | rare |
| 21 | Combo Breaker | rare |
| 22 | Poison Pen | rare |
| 23 | Hot Coffee | rare |
| 24 | Counter Clerk | rare |
| 25 | Second Wind | rare |
| 26 | Hazard Pay | rare |
| 27 | Momentum | rare |
| 28 | Executioner | rare |
| 29 | Iron Will | rare |
| 30 | Bounty Hunter | rare |
| 31 | Double Shift | epic |
| 32 | Encore | epic |
| 33 | Golden Parachute | epic |
| 34 | Chain Reaction | epic |
| 35 | Giant Mode | epic |
| 36 | Berserker | epic |
| 37 | Glass Cannon | epic |
| 38 | Aegis Protocol | epic |
| 39 | Workaholic | epic |
| 40 | Reflective Vest | epic |
| 41 | Critical Mass | epic |
| 42 | Flow State | epic |
| 43 | Grudge | epic |
| 44 | Lightning Rod | epic |
| 45 | Phoenix | epic |
| 46 | Bulwark | rare · Tank only |
| 47 | Brawler's Blood | rare · Fighter only |
| 48 | Backstab | rare · Assassin only |
| 49 | Mana Surge | rare · Mage only |
| 50 | Eagle Eye | rare · Marksman only |
| 51 | Field Medic | rare · Support only |
| 52 | Mind Games | rare · Controller only |
| 53 | Secret Recipe | epic · chef only |
| 54 | Fireproof Suit | epic · firefighter only |
| 55 | High Voltage | epic · electrician only |
| 56 | Night Nurse | epic · nurse only |
| 57 | Express Lane | epic · courier only |
| 58 | Big Catch | epic · fisher only |
| 59 | Harvest Moon | epic · farmer only |
| 60 | Reinforced Steel | epic · builder only |
| 61 | Mother Lode | epic · miner only |
| 62 | Hot Seam | epic · welder only |
| 63 | Pressure Washer | epic · plumber only |
| 64 | Upgrade Kit | epic · mechanic only |
| 65 | Load Bearing | epic · engineer only |
| 66 | Afterburner | epic · pilot only |
| 67 | Compound Interest | epic · merchant only |
| 68 | Fine Service | epic · waiter only |
| 69 | Sanitizer | epic · cleaner only |
| 70 | Perfect Fit | epic · tailor only |
| 71 | Fresh Fade | epic · barber only |
| 72 | Second Opinion | epic · doctor only |
| 73 | Unstable Formula | epic · scientist only |
| 74 | Extra Credit | epic · teacher only |
| 75 | Overclocked CPU | epic · programmer only |
| 76 | Tax Return | epic · accountant only |
| 77 | Objection Sustained | epic · lawyer only |
| 78 | Riot Gear | epic · police only |
| 79 | Battle Hardened | epic · soldier only |
| 80 | Masterpiece | epic · artist only |
| 81 | Standing Ovation | epic · musician only |
| 82 | Second Half | epic · athlete only |
| 83 | fx-pick | effect |
| 84 | fx-epic | effect |
| 85 | fx-shield | effect |
| 86 | fx-phoenix | effect |
| 87 | fx-parachute | effect |
| 88 | fx-chain | effect |
| 89 | fx-rod | effect |
| 90 | fx-overtime | effect |

Rarity frames are drawn by the game (common #8fbf7a, rare #4c8dff, epic #a35cff), so the icons have no frames.
