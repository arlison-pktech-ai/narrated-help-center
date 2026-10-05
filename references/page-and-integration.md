# The help page, publishing and in-app help

## Contents

1. Page anatomy
2. Making it look like the product
3. Publishing
4. Entry points in the app
5. An assistant that answers "how do I…?"
6. Keeping the app and the help in step

## 1. Page anatomy

`node scripts/help/lib/build.mjs` writes `.help-center/index.html` (plus `assets/`, `img/`, `video/`):

- **Top bar** (sticky): the logo (light/dark variants), "Help center", the search field ("What do you want to do? E.g.: task, project, theme"), and a link back to the app.
- **Contents** (sticky sidebar; a collapsible "Help contents" on narrow screens): the groups and their tutorials, then Screens, Phone, FAQ, Glossary. The section being read is highlighted.
- **Hero**: "How to use {product}", one sentence, the legend "The **red numbers** on the pictures are the numbers of the steps", and "What do you want to do?" with the quick tasks.
- **Prefer to watch?**: every video as a cover card linking to its tutorial.
- **Tutorials** (one card each): title, summary, intro, video ("Video · title · 43 seconds · narrated, with captions"), "Before you start", parts with pictures (click to enlarge, focus returns on close) and numbered steps (red badges; letters outlined for extras), notes, "**Done!** …", "Something went wrong? Tips", "Back to top".
- **Screens**, **Use on your phone** (install steps, phone pictures in two columns, the phone video), **FAQ** (expandable questions), **Glossary**.
- **Search**: every word must appear, accents and case ignored; filters tutorials, questions and words; hides empty groups; an empty state suggests words.
- Footer: "The pictures and videos use example data…", optional links (privacy, terms).

The page is static, works from `file://`, keeps its scripts and styles in files (`assets/help.js`, `assets/help.css`: a strict Content-Security-Policy still runs and styles it), and reserves each picture's size (no layout shift). Pictures are captured at 2× and shown at 1× at most 580 px tall.

## 2. Making it look like the product

In `help.config.mjs`:

- `tokens.light` / `tokens.dark`: `background`, `surface`, `surface-raised`, `surface-hover`, `border`, `border-subtle`, `text-primary`, `text-secondary`, `text-muted`, `link`, `success`, `backdrop`, `shadow`, `shadow-float`; and `radius`, `radius-control`. Copy them from the app's CSS variables, Tailwind theme or design tokens — do not invent a palette.
- `brand`: `logoLight`, `logoDark`, `symbol` (favicon and the video window's title bar), `font`, and the covers' `coverBackground`, `coverInk`, `coverAccent` (the brand accent). With only a square `symbol`, the page header, the video cards and the covers show it beside the product name.
- `marks.color`: the annotation red `#e5322d` by default. Keep a strong red unless the brand's accent is itself red/orange and the user asks otherwise; the marks must stand out from any UI.
- `page.themeKey`: the localStorage key where the app stores "light" | "dark" | "system", so the help opens in the same theme. Without it, the page follows the system.
- `page.quick` (or `QUICK` in the content), `page.searchExamples` (three words people would type), `page.appLink`, `page.links`, `page.footer`.
- `language` picks the page's words (`en`, `pt`/`pt-BR`, `es` built in); `strings` overrides any of them, and a new language is a copy of the `en` block of `lib/strings.mjs` into `strings`. In Portuguese, `article` gives the product's article: `"o"` (o Avvi), `"a"` (a Clientela) or `""`.

## 3. Publishing

`node scripts/help/lib/build.mjs --publish [dir]` copies the page, assets, pictures (`.jpg`) and videos (`.mp4`, posters, covers) to `publishDir` — usually the static folder served with the app (`public/help`, `static/help`, `app/assets/help`). Then:

- Link to `help/index.html#<tutorial-id>` (with `index.html`: some static hosts do not serve a folder's index).
- The folder is large (pictures and videos, roughly 2–4 MB per narrated minute). Keep it out of the app's JS bundle; serve it as static files with long caching; `+faststart` MP4s start playing before they finish downloading.
- Removed tutorials leave old files in the published folder: delete it before publishing when tutorials were removed.
- The server must send the right types (`video/mp4`, `image/jpeg`, `text/css`) and answer HTTP Range requests: Safari will not play an MP4 without them. Static hosts (Vercel, Netlify, S3, nginx) do; a hand-written dev server often does not.
- With `--strict`, a failed check publishes nothing: the published help stays as it was.
- Decide with the user whether the published folder is committed (simple static hosting) or produced by CI (needs ffmpeg, Chromium and, for new clips, the narration key — usually not worth it: commit the output).

## 4. Entry points in the app

Help must be one tap away from where the doubt happens:

1. **A Help button in the header** that opens a small menu with the tutorials of the current screen (most likely first), "Frequently asked questions", "All tutorials" and, if there is an assistant, "Ask the assistant". On phones the menu is a bottom sheet. Links open the help in a new tab.
2. **A "Help center" row** in the settings or "More" page.
3. **Empty states and errors** that link to the tutorial that solves them ("No projects yet — [Create a project](help/index.html#add-project)").

The index the app needs is small; keep it apart from the full content so the main bundle stays light:

```js
// src/help-index.js — kept equal to content.mjs by a unit test.
export const HELP_BASE = "help/";
export const HELP_TOPICS = [
  ["add-task", "Add a task", "01-add-task"],
  ["edit-task", "Change or delete a task", null],
].map(([id, title, video]) => ({ id, title, video }));
// The tutorials that answer "how do I…" on each screen, most likely first.
const PAGE_HELP = { today: ["add-task", "edit-task"], projects: ["add-project"], settings: ["settings"] };
export const helpUrl = (section = "") => `${HELP_BASE}index.html${section ? `#${section}` : ""}`;
export const helpTopicsFor = (screen) => (PAGE_HELP[screen] || PAGE_HELP.today).map((id) => HELP_TOPICS.find((topic) => topic.id === id));
```

Load the menu code lazily on the first click. Give the button an accessible name ("Help"), `aria-expanded`, Escape to close and focus return.

## 5. An assistant that answers "how do I…?"

If the product has an AI assistant, give it a `help` tool backed by `lib/search.mjs` (pure JavaScript, no imports — usable in the browser or on the server):

```js
import * as content from "../scripts/help/content.mjs";
import { createHelpSearch } from "../scripts/help/lib/search.mjs";
const help = createHelpSearch(content, { baseUrl: "help/", language: "en" });
// tool: { name: "help", parameters: { query?: string, topic?: enum(help.topics ids) } }
const answer = help.search({ query: "how do I delete a task?" });
// → { found, url, tutorials: [{ id, title, url, video: { title, url }, sections: [{ title, steps: ["1. Click **…**", …] }], done, tips }], questions, words }
```

- Tell the model to answer with the numbered steps in the product's words, link the tutorial and its video, and to say so when `found` is false instead of inventing steps.
- Render video players only for known help videos: `help.videosIn(answerText)` returns the videos of the help that the answer links to; ignore any other video URL the model writes.
- The tool reads no user data.

## 6. Keeping the app and the help in step

A unit test in the app's suite (node:test shown; adapt to Vitest/Jest):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { HELP_TOPICS, helpTopicsFor } from "../src/help-index.js";
import { createHelpSearch } from "../scripts/help/lib/search.mjs";
import { checkContent, loadContent } from "../scripts/help/lib/help-content.mjs";   // reads scripts/help/help.config.mjs

const content = await loadContent();

test("the in-app index follows the help", () => {
  const pages = content.TUTORIALS.map((guide) => [guide.id, guide.title, guide.video?.file ?? null]);
  assert.deepEqual(HELP_TOPICS.map((topic) => [topic.id, topic.title, topic.video]).sort(), pages.sort());
  assert.ok(helpTopicsFor("projects").every(Boolean));
});

test("questions find their tutorial", () => {
  const help = createHelpSearch(content, { baseUrl: "help/" });
  assert.equal(help.search({ query: "how do I delete a task?" }).tutorials[0].id, "edit-task");
  assert.equal(help.search({ query: "weather tomorrow" }).found, false);
});

test("the help text has no broken links or numbering", () => {
  assert.deepEqual(checkContent(content, { files: false }).filter((problem) => problem.level === "error"), []);
});
```

When a screen changes: run `npm run help`. A selector that no longer exists fails the tutorial that uses it; update the text and the spec together, rebuild, and only the changed narration clips are synthesized.
