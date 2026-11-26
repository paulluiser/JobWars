# Art quick start (2 messages per character)

You only make pictures. Everything else (sorting, cutting, cleanup, rigging, checking) is automatic.

## For each character

1. **New ChatGPT chat.** Attach the Chef picture: `art/raw/chef/master.png`.
2. Open [PROMPTS_BATCH.md](PROMPTS_BATCH.md), find the character, copy **message A**, send it.
   You get one wide picture with 3 pieces: full character | character without the tool arm | the arm + tool standing upright.
3. Same chat: copy **message B**, send it. You get the cutscene portrait.
4. Download both. **Any file names are fine.**
5. Put them in a folder named after the job, e.g. `Electrician`. Folder names are forgiving ("Fisherman", "Cook" and "Delivery Driver" all work).

Do 3 characters at a time: **Electrician, Nurse, Courier** first (they're already playable).

## When a batch is done

Put the job folders inside `art/inbox/` (or keep them in any one folder and tell Claude where), then either tell Claude
"new art is in", or run:

```bash
npm run art
```

That will:
- match each folder to its job and recognise each picture by its shape
- cut the 3-piece sheet into the full character, the body and the arm
- remove backgrounds, trim, resize
- find the shoulder and arm length automatically
- update the game

Reload the game and the characters use their new art.

## Checklist (glance at the sheet before saving)

- 3 pieces, not touching each other
- the middle piece has **no** tool arm
- the right piece stands upright, sleeve at the bottom
- transparent or plain background

If a piece is wrong, tell ChatGPT in the same chat, e.g. "the middle one still holds the wrench, remove that arm".
