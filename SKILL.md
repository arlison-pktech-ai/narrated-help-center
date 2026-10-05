---
name: narrated-help-center
description: Use when a product with a web interface needs end-user help material — step-by-step tutorials, a help center or user guide, screenshots that show exactly where to click, narrated how-to or onboarding videos with captions, an FAQ or glossary, in-app help or assistant answers about how to use the product — or when that material must be regenerated after the UI changed. Also for requests like "create tutorials", "help page", "user manual", "how-to videos", "tutoriais", "central de ajuda", "passo a passo com imagens", "vídeos narrados".
---

# Narrated Help Center

## Overview

Builds end-user help the way a meticulous product team would make it by hand, but generated from code:

- **Step pictures** of the real app: a red box around what to click, a red numbered badge that *is* the step number in the text, and a short label with a curved arrow on the main action.
- **Narrated videos**, one task each: a title card, the app in a window (or a phone) with a smooth cursor and camera zoom, captions like "**Step 3** Click **Save**." with the button name in red, a red box on the target, and a narrator who reads every caption. The click happens right after the sentence that names the button; the next caption waits for the narrator.
- **One static help page** in the product's own look (light and dark): search, contents, quick tasks, a video list with covers, tutorials (picture + numbered steps), "Before you start", "Done!", "Something went wrong?", FAQ and glossary.

Everything comes from one text module (`content.mjs`) and Playwright specs that drive the **real app on demo data with a fixed clock**. When the UI changes, one command regenerates it all, and a check fails if a step number in the text is not drawn on its picture.

**Core principle: the text, the pictures and the videos tell the same steps, with the same numbers and the exact words the user sees on screen.**

Not for native mobile apps, CLIs or developer API docs: the content model and the page still apply there, but the capture needs another driver.

## The bar

The result is right when all of this holds (open `assets/look/*.jpg` once to see it; `picture-form-dimmed.jpg` is the optional darkened look):

- Every step is one action, names the exact on-screen label in **bold**, and its number appears as a red badge on the picture beside it. Optional alternatives use letters (A, B) on the picture and in the text.
- Pictures are crisp (captured at 2×), show realistic fictional data, no toasts, focus rings, cookie banners or dev overlays. The first picture of a tutorial shows the whole screen; the next ones crop to the dialog or panel that matters.
- Each tutorial ends with the visible result ("The task appears in **Coming up**") and short fixes for what usually goes wrong.
- Videos are 30–90 s, one task, captions at most ~14 words, the narrator never says "step three", nothing happens on screen before it is said, and the result is shown in the app before the end card.
- The page works offline from `index.html`, follows the system theme, searches without accents or case, and opens pictures larger on click.
- No real person's data and no secret appears anywhere; only caption text leaves the machine (for the voice).

## Workflow

Media in batches costs time and money. **Stop for the user's OK at the two checkpoints** (voice sample, pilot tutorial) before producing the rest.

1. **Check the fit and gather facts.** Read the app first; ask the user only what the repo cannot tell you:
   - how the app starts locally and on which URL; how to sign in as a demo user;
   - where demo data comes from — an existing demo/fixture mode, a seed script, or Playwright route mocks (never a real account);
   - the audience and the language of the help (default: non-technical users, the app's UI language);
   - logos, design tokens (colors, radii, font), the localStorage key of the theme;
   - whether the app is used on phones; whether an `ELEVENLABS_API_KEY` exists and how much narration may cost.
2. **Install the toolkit:** `node <this skill>/scripts/scaffold.mjs --dir scripts/help` from the project root. It copies `lib/` (shared code, do not edit) and the templates (config, content, fixtures, specs, README), adds npm scripts and git-ignores `.help-center/`. Then `npm i -D @playwright/test ffmpeg-static` (skip what exists) and `npx playwright install chromium`.
3. **Make the app deterministic.** Fill `help.config.mjs` (product, language — and `article` in Portuguese —, `now` with its UTC offset, `app.baseURL`, `app.query` for demo mode, selectors, brand, tokens) and the `webServer` of `playwright.config.mjs`. In `support.mjs`, sign in as the demo user and answer every external service the tutorials touch with fictional data (`page.context().route`). If the demo data lives in one shared server that the tests change, set `workers: 1` and reset the data at the start of each test. Data must look real and lived-in: plausible names, amounts, dates around `now`. See `references/capture.md`.
4. **Plan the tutorials** — one per task a user performs, verb first ("Add a task", "Pay the card bill"), grouped by journey (First steps → Day to day → Settings). Add SCREENS (what each screen is for), PHONE (if used on phones), FAQ and GLOSSARY. Show the list to the user before writing everything.
5. **Write `content.mjs`** following the rules below and `references/content.md`.
6. **Capture the pictures** in `stills.spec.mjs` (and `phone.spec.mjs`): one test per tutorial, one picture per block, marks with the block's numbers. Run `npm run help:stills` and *look at every picture*.
7. **Checkpoint 1 — the voice.** Pick a voice for the language (`node scripts/help/lib/voice.mjs --voices`; the computer's free voices with `HELP_VOICE=system`), set `narration.voice` (or `systemVoice`), then `--sample "<two sentences in the product's language>"` and let the user listen.
8. **Checkpoint 2 — one pilot tutorial.** Write one video in `videos.spec.mjs`, record it (`HELP_VIDEOS=01 npx playwright test -c scripts/help/playwright.config.mjs --project=videos`), encode, build, and hand the user the page section and the MP4. Let them choose the look of the marks: boxes only (default) or boxes with the rest of the screen darkened (`marks.dim` in the config; `HELP_DIM=1` regenerates the pictures and videos that way for comparison, at no narration cost). Report characters used. Iterate on their feedback.
9. **Produce the rest.** Write the other videos; record them once with `HELP_VOICE=off` to validate selectors for free, run `voice.mjs --estimate`, tell the user the cost, then `npm run help:videos`. Drafts can use `HELP_VOICE=system` (the computer's voice, free).
10. **Review and publish.** `node scripts/help/lib/build.mjs --strict` must print no ✗. Open `.help-center/index.html` in light and dark, at 390 and 1440 px; play every video. Publish with `build.mjs --publish` into the app's static folder; wire the in-app entry points (`references/page-and-integration.md`). Keep `scripts/help/README.md` (from the template) in the project.
11. **Report:** what was produced (counts, paths), screenshots of the page, the narration characters spent, how to regenerate, anything skipped — and the product problems found while documenting (a delete without confirmation, a setting that does nothing, a label people will not understand). The help never promises what the product does not do.

## Writing the steps

- One action per step. Where first, then what: "In the menu, click **Projects**." / "In **Due date**, choose the day it must be done."
- **Bold** = the exact label on screen (button, field, menu item, tab). Never "click the button" or "the save option".
- Short sentences, everyday words, second person, present tense. Explain a toggle by its effect ("**Paid** on means the money already left").
- Give an example value for every typed field ("Example: Garden") and type that same value in the pictures and videos.
- Numbers run 1, 2, 3… across the pictures of a part; a new part may restart at 1. Letters (A, B) for optional extras shown on the same picture.
- `before`: what to have at hand. `done`: what the user now sees. `problems`: "**Symptom?** Fix." — two to four.
- `keywords`: the other words people type for this task (synonyms, the old name of the feature, common misspellings).

## Marking a picture

`mark(page, [{ target, n }, …])` lays the marks out by itself: boxes shrink between close neighbors so they never overlap and stay on screen; each badge goes where it covers no text, no field and no other mark (the corner of a lone button, the left of stacked form rows and menu items, above tabs side by side); a label goes to the side with room that covers the least. What is left to decide:

| Need | How |
| --- | --- |
| The main action of the picture | `{ target, n, label: "Click + New task" }` — one label (two at most); `side` only to force a side |
| "Look here", no step | `{ target, label: "Your new task" }` (no `n`) |
| A small target on a big screen | `shot(page, name, { crop: locator })` — the crop always keeps every mark |
| Focus on the marks (optional look) | `marks.dim: true` darkens everything but the boxes (28 % in pictures, 14 % in videos), or `{ pictures: true, videos: false }`; one call: `{ dim: true }` |
| A picture that still looks wrong | per item `badge: "corner" \| "left" \| "right" \| "top" \| "bottom"` and `pad: number \| { x, y }` |

Mark exactly the numbers of the block's steps — `build.mjs` fails on a step number missing from its picture and warns on a drawn number no step explains. Look at every picture before moving on.

## Directing a video

```js
const g = await openGuide(page, { route: "/#today" });          // device: "phone" for the phone stage
await g.record(name);
await g.title("How to add a task", "Write down something you need to do, with a date.");
await g.step(1, "Click **New task**, at the top of the menu.", ".sidebar [data-action=new-task]");
const form = g.app.locator(config.app.dialogSelector).last();
await g.zoom(form, 1.3);                                         // closer on what is being filled; the camera follows to targets outside it
await g.step(2, "Write the **title**. Example: Pay the bill.", form.getByLabel("Title"), { act: () => g.type("Pay the bill") });
await g.step(3, "Choose the **project**.", form.getByLabel("Project"), { click: false, act: (s) => s.selectOption({ label: "Home" }) });
g.poster();                                                      // the cover frame: the form filled in
await g.step(4, "Click **Save**.", form.getByRole("button", { name: "Save" }), { after: 300 });
await g.reset();
await g.show("Done! The task is in **Coming up**.", [{ target: g.app.getByText("Pay the bill"), label: "Your new task" }]);
await g.end("Task added!", "Add the next one the same way.");
await g.stop();
```

- `step()` waits for the sentence that contains the **bold** label before clicking; never click with Playwright directly in a video.
- `show()` explains without clicking; `card(title, subtitle)` covers what happens outside the app (an email, a bank's site, an OAuth window) — never fake another company's screens.
- Captions are spoken: write them to be heard. Add `pronunciation` pairs for symbols and abbreviations (`[/\+ New/g, "New"]`).
- Full API, timings and phone videos: `references/video.md`. Voices, cache and costs: `references/narration.md`.

## Quick reference

| Task | Command |
| --- | --- |
| Everything | `npm run help` |
| Pictures only | `npm run help:stills` |
| Some videos | `HELP_VIDEOS=01,03 npx playwright test -c scripts/help/playwright.config.mjs --project=videos` then `node scripts/help/lib/encode.mjs 01 03` |
| Free dry run / draft voice | `HELP_VOICE=off …` / `HELP_VOICE=system …` |
| Try the darkened look | `HELP_DIM=1 npm run help:stills` (or `HELP_DIM=pictures`, `HELP_DIM=videos`) |
| Cost before a batch | `node scripts/help/lib/voice.mjs --estimate` (after a `HELP_VOICE=off` run) |
| Covers, page, checks | `node scripts/help/lib/covers.mjs` · `node scripts/help/lib/build.mjs [--strict] [--publish [dir]]` |
| Update the toolkit | `node <this skill>/scripts/scaffold.mjs --dir scripts/help --update` |

## Common mistakes

| Mistake | Instead |
| --- | --- |
| Screenshots taken by hand or from a real account | Specs on demo data: regenerable and private |
| Text numbers that drift from the pictures | Mark the block's numbers; run `build.mjs --strict` |
| "Click the button", several actions in one step | The exact label in bold, one action per step |
| Marking every control on a busy screen | Only the steps of that block; crop to the region |
| Dates that change every run ("3 days late") | `now` fixed in the config, demo data relative to it |
| Narrating all videos before the voice is approved | Sample → pilot → estimate → batch |
| Video clicks before the narrator names the target | Use `step()`/`show()`; keep captions short |
| Recreating a third-party screen, or guessing its labels | `card()` for anything outside the product; link to that service's own help |
| Editing `scripts/help/lib/` in the project | Change the skill's toolkit, then `scaffold.mjs --update` |

## References

- `references/content.md` — content schema, writing guide with examples, planning tutorials, FAQ and glossary.
- `references/capture.md` — demo data and determinism, fixtures and mocks, picture helpers, marking and cropping, troubleshooting.
- `references/video.md` — the stage, the Guide API, choreography and timings, phone videos, encoding.
- `references/narration.md` — providers, choosing a voice, pronunciation, cache, estimates and credits.
- `references/page-and-integration.md` — the page anatomy and config, publishing, in-app help menu, assistant tool, sync test.
- `examples/tidy/` — a complete, working setup for a small task manager (config, content, specs).
