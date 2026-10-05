# Narration: voices, pronunciation, cache and cost

## Providers

| `narration.provider` / `HELP_VOICE` | Use | Notes |
| --- | --- | --- |
| `elevenlabs` | final videos | needs `ELEVENLABS_API_KEY` (or `ELEVEN_LABS_API_KEY`); uses the `with-timestamps` endpoint, so the end of every sentence is known to the millisecond |
| `system` | free drafts: pacing, wording, selectors | macOS `say` (or `espeak-ng` on Linux); `narration.systemVoice` picks the voice (`HELP_VOICE=system node scripts/help/lib/voice.mjs --voices` lists those of the help's language: "Samantha" en-US, "Luciana" pt-BR, "Mónica" es-ES); sentence ends are estimated |
| `off` | dry runs | no audio and no waiting for speech; still records every narration text for `--estimate` |

`HELP_VOICE` overrides the config for one run. Clips of different providers never mix: each clip's name is a hash of the provider, voice, model, seed, settings and text.

## Choosing a voice (ElevenLabs)

1. `node scripts/help/lib/voice.mjs --voices` lists the account's voices with their labels (accent, age, gender, language, use case). Premade voices labeled `informative_educational` or `conversational` suit tutorials; for other languages, add a native voice from the Voice Library to the account first (Brazilian Portuguese tutorials used a soft, middle-aged conversational male voice).
2. Model `eleven_multilingual_v2` with a fixed `seed` (the same text always sounds the same). Optional `narration.settings` (`{ stability, similarity_boost, style, speed }`) are sent as `voice_settings`.
3. `node scripts/help/lib/voice.mjs --sample "Two sentences in the product's language, with a button name."` writes `.help-center/voice-sample.mp3`. The user approves the voice **before** any video is narrated.

One voice for the whole help center. Changing the voice later re-synthesizes every clip.

## What the narrator says

`spoken()` turns a caption into speech: it drops the "Step N" label and the markup, ends titles with a stop, and applies `pronunciation` — pairs `[pattern, words]` in `help.config.mjs` for what is written one way and said another:

```js
pronunciation: [
  [/\+ (Project|Task)\b/g, "$1"],              // "+ Project" → "Project"
  [/the \+ button/g, "the plus button"],
  [/4590 becomes \$45\.90/g, "four, five, nine, zero becomes forty-five dollars and ninety cents"],
  [/\bCSV\b/g, "C S V"],
  [/\bOpenRouter\b/g, "Open Router"],
],
```

Listen to the pilot for: symbols (+, …, →), abbreviations, product and brand names, numbers typed digit by digit, dates, and words the voice stresses wrongly. Fix them here, never in the caption (the caption must keep the exact label on screen).

## Cache and reruns

- Clips live in `.help-center/voice/<hash>.mp3|wav` with a `.json` (text, length, sentence end times, characters, provider). Recording again reuses them; editing one caption synthesizes only that clip.
- While a new clip is synthesized nothing moves on screen; the recorder marks that wait and `encode.mjs` cuts it, so API latency never shows in the video.
- Keep `.help-center/voice/` between runs (it is git-ignored, not disposable). `voice.mjs --clear-drafts` deletes only the `system` clips.

## Cost control

The user pays per character. Before narrating a batch:

1. Record once with `HELP_VOICE=off` (free; validates every selector and writes `.help-center/narration/<video>.json`).
2. `node scripts/help/lib/voice.mjs --estimate` → ElevenLabs characters still to synthesize per video and in total (whatever voice the drafts used).
3. `node scripts/help/lib/voice.mjs --credits` → characters used and left (the key needs the *User → Read* permission; otherwise check the ElevenLabs dashboard).
4. Tell the user the estimate and what is left, then record with narration.

Typical sizes: a 45-second tutorial has 8–12 clips and 300–600 characters. Retries on 429/5xx are automatic (videos record in parallel).

## Troubleshooting

| Message | Fix |
| --- | --- |
| `set ELEVENLABS_API_KEY` | export the key, or use `HELP_VOICE=system` / `off` |
| `choose a voice in help.config.mjs` | set `narration.voice` to an id from `--voices` |
| `ElevenLabs answered 401 … missing the permission` | the key is scoped: it needs *Text to Speech* (and *Voices → Read* for `--voices`) |
| `ElevenLabs answered 402/quota` | out of credits: stop, report the estimate, wait for the user |
| The narrator reads "Step three" | the caption was not passed through `step()`; the label must be in `<span class="step">` (done by `step()`) |
| The screen changes before the sentence ends | the target is named late in a long caption: put the **bold** label in the first sentence, or move the explanation to a `show()` before the step |
