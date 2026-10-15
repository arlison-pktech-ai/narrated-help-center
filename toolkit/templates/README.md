# Help center

Playwright suite that builds the end-user help: tutorials in short steps, pictures with red marks (boxes, arrows and numbers that match the steps) and short narrated videos with captions, on one searchable page. It drives the real app on demo data with a fixed clock; only the caption text leaves the machine, for the narration voice. It is not part of the test suite or CI.

```sh
npm run help                                        # pictures, videos, covers and the page
node scripts/help/lib/build.mjs --publish           # copy the page to publishDir (help.config.mjs)
```

The result is in `.help-center/` (git-ignored). Open `index.html` directly in the browser.

| Folder | Content |
| --- | --- |
| `index.html` | The page: contents, search, tutorials, screens, phone, questions and glossary |
| `img/` | One picture per step block, with its marks (desktop 1440 × 900 and phone 390 × 844, at 2×), and the numbers drawn on each (`.json`) |
| `video/` | The MP4 videos (H.264, narration in AAC mono, captions in the frames), the poster (`.jpg`) and the cover of the video list (`-cover.jpg`) |
| `voice/` | The narration clips, one per caption or card, reused by the next recordings |

## How it works

- [content.mjs](content.mjs) holds every word: short sentences, one action per step, the name of each button in bold. The number of each step is the number drawn on its picture; letters mark optional extras. `build.mjs` checks that every step number appears on its picture.
- [stills.spec.mjs](stills.spec.mjs) and [phone.spec.mjs](phone.spec.mjs) take the pictures; [support.mjs](support.mjs) fixes the clock, sets stored preferences and answers the server routes the tutorials show with fictional data.
- [videos.spec.mjs](videos.spec.mjs) records the videos on a stage (the app in a window or a phone, a smooth pointer, camera zoom, title cards). Each step shows its caption, the narrator reads it, a red box marks the target and the click comes after the sentence that names it.
- `lib/` is the shared toolkit (marks, stage, recorder, narration, encoder, covers, page). Do not edit it here; update it from the skill.

## Narration

`narration` in [help.config.mjs](help.config.mjs) chooses the voice. ElevenLabs needs `ELEVENLABS_API_KEY`; each clip is named after its text and voice, so recording again costs nothing and changing one caption asks only for that clip.

```sh
node scripts/help/lib/voice.mjs --sample "One sentence in the product's language."   # hear the voice
node scripts/help/lib/voice.mjs --credits                                             # characters left
HELP_VOICE=off npx playwright test -c scripts/help/playwright.config.mjs --project=videos && node scripts/help/lib/voice.mjs --estimate
HELP_VOICE=system npm run help                                                        # free draft voice
```

## When the app changes

Run `npm run help` again. A selector that no longer exists fails the tutorial that uses it, and so does a button whose label no longer matches its `name` check; `build.mjs` lists missing pictures, videos, numbers out of step and marked buttons that no longer read their step's bold label. To redo only some videos: `HELP_VIDEOS=02,05 npx playwright test -c scripts/help/playwright.config.mjs --project=videos`, then `node scripts/help/lib/encode.mjs 02 05`, `node scripts/help/lib/covers.mjs` and `node scripts/help/lib/build.mjs`. Only the pictures: `npm run help:stills`.

Videos need an `ffmpeg` with libx264 (`brew install ffmpeg`, `npm i -D ffmpeg-static`, or `FFMPEG=/path`). Raw frames take about 150 MB per minute until `encode.mjs` deletes them (`KEEP_FRAMES=1` keeps them).
