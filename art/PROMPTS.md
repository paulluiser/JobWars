# ChatGPT prompt pack: M3 pilots (Chef, Firefighter, Fisher + arena)

Style rules: [docs/ART_STYLE.md](../docs/ART_STYLE.md). File names and folders matter: the processing
script looks for exactly these names.

## How to work

1. **One ChatGPT chat per character.** Later prompts say "the character above", so keep each character's images in its own chat.
2. **Chef first.** Its `master.png` becomes the **golden** style reference. When you start the Firefighter and Fisher chats,
   **attach the Chef master** and the prompt tells ChatGPT to match its style.
3. Generate 2–4 versions of each master and keep the best. For the other files, regenerate until the checklist in the style guide passes.
4. Download as PNG and save to `art/raw/<id>/<file>.png`, e.g. `art/raw/chef/body.png`.
5. Run:
   ```bash
   npm run art
   ```
   It cleans every image (removes a flat background if transparency didn't come through, trims, resizes) and
   writes `public/art/`. Then `npm run dev` and open `/rig.html` to line the weapon up with the shoulder.
6. Ask Claude to look at the result in game, or send screenshots for sign-off.

---

## Style block (already included in every prompt below)

> Original hand-painted 2D game art for a mobile action RPG. Chibi proportions, about 2.5 heads tall: big head, big
> expressive eyes with a white highlight, blush marks, small body, oversized tool. Clean dark warm-brown outlines (#2a1d14),
> thicker on the outer silhouette, thinner inside. Cel shading with 2–3 tones plus a soft rim light; light from the top-left.
> Saturated, warm colours. Painted texture, not flat vector, not 3D, not pixel art. Slight top-down 3/4 camera.
> Transparent background (PNG). No ground shadow, no text, no watermark, no frame.

---

## 1. Chef (`art/raw/chef/`), the golden

### 1a. `master.png`: square 1024 × 1024
```
Original hand-painted 2D game art for a mobile action RPG. Chibi proportions, about 2.5 heads tall: big head, big expressive eyes with a white highlight, blush marks, small body, oversized tool. Clean dark warm-brown outlines (#2a1d14), thicker on the outer silhouette, thinner inside. Cel shading with 2–3 tones plus a soft rim light; light from the top-left. Saturated, warm colours. Painted texture, not flat vector, not 3D, not pixel art. Slight top-down 3/4 camera. Transparent background (PNG). No ground shadow, no text, no watermark, no frame.

Character: a cheerful young CHEF fighter. Tall puffy white chef's toque. White double-breasted chef coat (#f4f1ea) with a red neckerchief (#d9452b), dark brown trousers, black shoes. Short dark-brown hair, light skin (#f3c9a0), confident grin.
Holding a huge steel meat cleaver in the front (right) hand, raised up and slightly away from the body so it doesn't overlap the face or torso. The other arm relaxed at the side.
Full body, standing, 3/4 view facing RIGHT, feet apart, whole character centred with empty space around it. Square image.
```

### 1b. `body.png`: square
```
Same character and art style as the image above, same pose, same camera, same size in the frame.
Remove the front arm (the one holding the cleaver) completely, and remove the cleaver. Keep the other arm relaxed at the side. Clean shoulder edge where the front arm was. Nothing else changes.
Transparent background (PNG), no shadow, no text.
```

### 1c. `weapon.png`: portrait 1024 × 1536
```
Same art style as the images above.
Draw ONLY the chef's front arm and the meat cleaver as one isolated object: the arm (white chef-coat sleeve, from the shoulder to the hand) pointing STRAIGHT UP, the hand gripping the cleaver handle, and the cleaver blade continuing straight up above the hand. The shoulder end of the sleeve is at the very bottom centre of the image. Vertical and centred. Same outline weight, shading and colours as the character.
Transparent background (PNG), no body, no shadow, no text.
```

### 1d. `bust.png`: portrait 1024 × 1536
```
Same character (chef, toque, white double-breasted coat, red neckerchief, cleaver), now as a cutscene portrait for a special move: upper body only, taller semi-realistic anime proportions (not chibi), more detailed painted rendering, same colours and costume. Shouting a battle cry ("Order up!"), fierce happy expression, cleaver raised, dynamic angle, slight speed lines allowed only inside the silhouette.
Transparent background (PNG), no text, no frame. Portrait format.
```

### 1e. `icon.png` (optional): square
```
Same chef as the cutscene portrait above, head and shoulders only, neutral friendly expression, facing the viewer at a slight angle, centred, for a character-select card. Transparent background (PNG), no text.
```

---

## 2. Firefighter (`art/raw/firefighter/`)

**Attach the Chef `master.png` to the first message.**

### 2a. `master.png`: square
```
Match the art style of the attached image exactly (same chibi proportions, outline colour and weight, cel shading, rim light, painted texture, camera angle and scale in the frame). It is a different character.
Original hand-painted 2D game art for a mobile action RPG. Chibi proportions, about 2.5 heads tall. Clean dark warm-brown outlines (#2a1d14). Cel shading, light from the top-left. Transparent background (PNG). No ground shadow, no text.

Character: a sturdy, brave FIREFIGHTER tank. Red fire helmet (#c9302a) with a wide back brim and a yellow shield badge on the front. Red-and-tan turnout coat with bright yellow reflective stripes (#f2c230), heavy gloves, boots. Short dark hair, tan skin (#e8b48a), determined smile.
Holding a big fire axe with a red head in the front (right) hand, raised up and slightly away from the body. The other arm relaxed at the side.
Full body, standing, 3/4 view facing RIGHT, feet apart, centred with empty space around it. Square image.
```

### 2b. `body.png`
```
Same character and art style as the image above, same pose, same camera, same size in the frame.
Remove the front arm (the one holding the axe) completely, and remove the axe. Keep the other arm relaxed at the side. Clean shoulder edge where the front arm was. Nothing else changes.
Transparent background (PNG), no shadow, no text.
```

### 2c. `weapon.png`: portrait
```
Same art style as the images above.
Draw ONLY the firefighter's front arm and the fire axe as one isolated object: the arm (turnout-coat sleeve with a yellow reflective stripe, gloved hand) pointing STRAIGHT UP from the shoulder, the hand gripping the axe handle, the handle and red axe head continuing straight up above the hand. The shoulder end of the sleeve is at the very bottom centre of the image. Vertical and centred.
Transparent background (PNG), no body, no shadow, no text.
```

### 2d. `bust.png`: portrait
```
Same character (firefighter, red helmet with yellow badge, turnout coat with yellow stripes, fire axe) as a cutscene portrait for a special move: upper body only, taller semi-realistic anime proportions (not chibi), more detailed painted rendering, same colours and costume. Shouting "Stand back!", axe raised, embers and heat glow around the edges of the silhouette, dynamic angle.
Transparent background (PNG), no text, no frame. Portrait format.
```

### 2e. `icon.png` (optional)
```
Same firefighter as the cutscene portrait above, head and shoulders only, neutral confident expression, facing the viewer at a slight angle, centred, for a character-select card. Transparent background (PNG), no text.
```

---

## 3. Fisher (`art/raw/fisher/`)

**Attach the Chef `master.png` to the first message.**

### 3a. `master.png`: square
```
Match the art style of the attached image exactly (same chibi proportions, outline colour and weight, cel shading, rim light, painted texture, camera angle and scale in the frame). It is a different character.
Original hand-painted 2D game art for a mobile action RPG. Chibi proportions, about 2.5 heads tall. Clean dark warm-brown outlines (#2a1d14). Cel shading, light from the top-left. Transparent background (PNG). No ground shadow, no text.

Character: a relaxed, patient FISHER marksman. Yellow bucket hat (#e9c46a) with a small green fishing lure pinned to it. Green fishing vest with many pockets (#3f7d5a) over a cream shirt, rolled-up trousers, rubber boots. Light-brown hair, sun-tanned skin (#e2b48c), calm half-smile.
Holding a VERY long fishing rod (longer than the character is tall) in the front (right) hand, pointing up and slightly forward, with a reel near the grip, a thin line and a hook dangling from the tip. The other arm relaxed at the side.
Full body, standing, 3/4 view facing RIGHT, feet apart, centred with empty space around it. Square image.
```

### 3b. `body.png`
```
Same character and art style as the image above, same pose, same camera, same size in the frame.
Remove the front arm (the one holding the rod) completely, and remove the rod. Keep the other arm relaxed at the side. Clean shoulder edge where the front arm was. Nothing else changes.
Transparent background (PNG), no shadow, no text.
```

### 3c. `weapon.png`: portrait
```
Same art style as the images above.
Draw ONLY the fisher's front arm and the fishing rod as one isolated object: the arm (cream shirt sleeve, hand) pointing STRAIGHT UP from the shoulder, the hand gripping the rod handle with the reel just below the hand, and the long rod continuing straight up to the top of the image, with the line and hook hanging from the tip. The shoulder end of the sleeve is at the very bottom centre of the image. Vertical and centred.
Transparent background (PNG), no body, no shadow, no text.
```

### 3d. `bust.png`: portrait
```
Same character (fisher, yellow bucket hat with lure, green vest, long rod) as a cutscene portrait for a special move: upper body only, taller semi-realistic anime proportions (not chibi), more detailed painted rendering, same colours and costume. Shouting "It's a monster!", gripping the bending rod with both hands, water splashes around the edges of the silhouette, dynamic angle.
Transparent background (PNG), no text, no frame. Portrait format.
```

### 3e. `icon.png` (optional)
```
Same fisher as the cutscene portrait above, head and shoulders only, neutral calm expression, facing the viewer at a slight angle, centred, for a character-select card. Transparent background (PNG), no text.
```

---

## 4. Arena (`art/raw/arena/market.png`): square

New chat. **Attach the Chef `master.png`** for style.
```
Match the painting style of the attached image (outline colour, cel shading, warm saturated palette, painted texture), but this is an environment, with no characters.
A square stone courtyard arena for a 2D action game, seen from slightly above (top-down 3/4 camera). The back (top) wall shows its brick face; low stone walls run along the left, right and front edges, forming a closed square box. Warm cobblestone floor in two or three tones, a faint circular emblem in the middle, the centre of the floor kept clean and simple. Outside the walls: grass, a few wooden crates and barrels, a hanging banner on the back wall. Soft daylight from the top-left.
The square box fills most of the image and is centred. No characters, no text, no UI. Square image.
```

---

## After generating

```bash
npm run art
```
Then open the dev server's `/rig.html`, pick each character, and drag the sliders until the arm sits on the shoulder and
the swing looks right. Click **Copy rig JSON** and paste it into `art/rig.json`, then run `npm run art` again.
