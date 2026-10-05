# Video: the stage, the director and the encoder

## Contents

1. How a video is made
2. The Guide API
3. Choreography rules and timings
4. Patterns for common steps
5. Phone videos
6. Encoding, posters, covers
7. Troubleshooting

## 1. How a video is made

1. `openGuide(page, { route, device, theme, storage })` opens the **stage** (`lib/stage/stage.html`) on the app's own origin — Playwright serves it at `/__help-stage/` — and loads the app in an iframe inside a desktop window (title bar with the product's symbol and name) or a phone (status bar, island, home indicator). The app is unchanged: same origin, cookies, storage and route mocks. Pages that forbid framing get `X-Frame-Options`/`frame-ancestors` removed only in this browser (`app.allowFraming`).
2. `g.record(name)` starts the Chrome screencast: every painted frame is saved with its time, plus a timeline of captions, narration clips, cuts and the poster moment.
3. The spec performs the tutorial with the Guide: captions, a smoothed cursor with click ripples, a camera that zooms on dialogs, red boxes drawn in app coordinates (they follow the camera), title cards.
4. The narrator (`lib/voice.mjs`) reads every caption and card. A step waits until the sentence with the **bold** label has been heard, then the box leaves and the click happens; a new caption waits for the previous narration to end.
5. `lib/encode.mjs` turns the frames into an H.264 MP4 at a constant frame rate, cuts the seconds spent waiting for new narration clips, places each clip where its caption appears, normalizes loudness (-16 LUFS) and extracts the poster frame.

Desktop videos are 1920 × 1080 with the app at 1440 × 900; phone videos are 1080 × 1920 with the app at 390 × 763. Captions are part of the frames (no subtitle track to lose).

## 2. The Guide API

| Call | Does |
| --- | --- |
| `openGuide(page, { route = "/", device = "desktop" \| "phone", theme = "light", storage = {} })` | opens the stage and the app; returns `g` |
| `g.app` | the app's frame: build locators with `g.app.getByRole(...)`, `g.app.locator(...)` |
| `g.record(name)` / `g.stop()` | start and finish the recording (`name` = the `video.file` of the content) |
| `g.title(title, subtitle)` | opening card with the logo; read aloud |
| `g.step(n, text, target, { click = true, act, label, side, badge, dim, hold = 1400, after = 800 })` | caption "Step n" + text, pointer to the target, red box with badge `n`, wait for the bold sentence, click and/or `act(locator)` |
| `g.show(text, targets, { hold = 2600, move = true, dim })` | caption + boxes/labels without clicking; `targets`: a locator, a selector or `[{ target, label, side, n }]` |
| `g.say(text)` / `g.say(null)` | a caption alone (e.g. "Wait for the answer…") / hide the caption |
| `g.card(title, subtitle, ms = 3600)` | a full-stage card mid-video, for what happens outside the app |
| `g.zoom(target = dialogSelector, level = 1.25)` | camera closer on a dialog, a form or a panel, never so close that it does not fit above the caption |
| `g.focus(target, zoom = 1.3, ms = 900)` / `g.reset(ms = 800)` | camera on any element / back to the whole window |
| `g.scroll(to, ms = 1100, scroller?)` | smooth scroll to a number, a selector or `"heading:Title text"` |
| `g.type(text, delay = 70)` | types into the focused field, visibly |
| `g.keys(["⌘", "K"], "Meta+k")` | shows key chips and presses the shortcut |
| `g.poster()` | marks the frame used as the video's poster image |
| `g.hold(ms)` | waits (to let the screen settle or to read) |
| `g.end(title = "Done!", subtitle)` | closing card; read aloud |

Before every `step()` and `show()` the camera moves just enough for the target to be seen whole above the caption (a button at the foot of a side panel, for example), so no manual panning is needed.

Captions accept `**bold**` (or `<b>`). Bold is drawn in the marks' red and tells `step()` which sentence names the target. `dim` follows `marks.dim` (videos darken at 14 % by default, appearing with the box and fading out before the click); pass `dim: true/false` to force it on one step.

## 3. Choreography rules and timings

- **One task per video, 30–90 seconds.** File names `NN-slug` (`01-add-task`), numbered in the order of the page.
- **Shape:** `title()` ("How to …" + one line about why) → steps → show the result in the app with a label (`show("Done! …", [{ target, label: "Your new task" }])`) → `end("Task added!", "a next-step hint")`.
- **Captions are heard:** one short sentence with the label in bold, optionally a second short sentence with the reason. Video steps may merge or split the page's steps; they are numbered on their own, 1…n.
- **Never click directly** with Playwright inside a video: `step()` (or `show()` + `step()`) keeps sound and image in sync. For selects, dates and fills use `{ click: false, act: (el) => el.selectOption(...) }`.
- **Zoom on what is being filled** right after it opens: a centered dialog (`g.zoom(form, 1.15–1.4)`), or the form inside a full-height side panel (`g.zoom(panel.locator("form"), 1.4)`) — zooming on the whole panel would leave it small, since a tall target is never zoomed beyond what fits. The camera follows to targets outside the zoomed area (the panel's Save button) by itself. `g.reset()` after it closes.
- **`poster()`** at the most telling moment: the form filled, the result visible.
- **Pauses:** `after: 900–1200` after steps that open menus or dialogs, `after: 300` before `reset()` when a dialog closes, `hold: 2600–3400` on `show()` explanations. Typing 55–90 ms per character; amounts and codes 120–160 ms.
- **Outside the app:** `g.card("In the bank's window", "Sign in and authorize. Then come back to Tidy.")`, then change the mocked state and reload the data the way the app would.

## 4. Patterns for common steps

```js
// Open a dialog, zoom, fill and save.
await g.step(1, "Click **+ Project**.", g.app.getByRole("button", { name: "+ Project" }), { after: 900 });
const form = g.app.locator(config.app.dialogSelector).last();
await g.zoom(form, 1.4);
await g.step(2, "Write the **name**. Example: Garden.", form.getByLabel("Name"), { act: () => g.type("Garden") });
await g.step(3, "Choose the **project**.", form.getByLabel("Project"), { click: false, act: (s) => s.selectOption({ label: "Home" }) });
await g.step(4, "Choose the **due date**.", form.getByLabel("Due date"), { click: false, act: (d) => d.fill("2026-03-12") });
await g.step(5, "Turn on **Remind me**.", form.getByLabel("Remind me"), { after: 600 });   // a click toggles it
await g.step(6, "Click **Save**.", form.getByRole("button", { name: "Save" }), { after: 300 });
await g.reset();

// A row menu.
const task = g.app.locator(".task").filter({ hasText: "Send the weekly report" });
await g.step(1, "Click the **three dots** of the task.", task.getByRole("button", { name: /More actions/ }), { after: 700 });
await g.step(2, "Click **Edit**.", g.app.getByRole("menuitem", { name: "Edit" }), { after: 900 });

// Explain an area without clicking, then scroll to the next one.
await g.show("**Coming up** lists the next days.", g.app.locator(".panel").nth(1), { hold: 3000 });
await g.scroll("heading:Reports", 1300);

// The result, then the end card.
await g.show("Done! The project is in the list.", [{ target: g.app.getByText("Garden"), label: "Your new project", side: "bottom" }], { hold: 2800 });
await g.end("Project created!", "Choose it when you add a task.");
```

A custom picker (dropdown with options): `step(n, "Click **Category**.", trigger, { after: 900 })`, then `step(n + 1, "Choose **Restaurants**.", option, { after: 900 })`. Hidden native selects behind a custom UI: `act: () => select.selectOption("value", { force: true })`.

## 5. Phone videos

```js
test.describe("phone", () => {
  test.use({ viewport: { width: config.video.phone.width, height: config.video.phone.height }, hasTouch: true, isMobile: true });
  video("09-phone-add-task", async (page, name) => {
    const g = await openGuide(page, { route: "/", device: "phone" });
    // …"Tap **+**." — taps use the touchscreen; the touch mark appears only while pressing.
  });
});
```

- Write "Tap" instead of "Click". After typing, blur the field (`g.app.evaluate(() => document.activeElement?.blur())`) so the keyboard-less form shows its buttons.
- `app.phoneTopSelector`/`phoneBottomSelector` paint the status bar and the home indicator with the app's header and bottom bar colors.
- The stage locks its zoom (a mobile browser would zoom into inputs under 16 px).

## 6. Encoding, posters, covers

- `node scripts/help/lib/encode.mjs [prefixes…]`: `fps` 30, `crf` 26, `-tune stillimage`, `+faststart`; AAC mono 64 kb/s at -16 LUFS. Raw frames are deleted after encoding (`KEEP_FRAMES=1` keeps them). Needs an ffmpeg with libx264: `FFMPEG`, the PATH, `ffmpeg-static`, or Python's `imageio-ffmpeg`.
- Output per video: `video/<name>.mp4` and `video/<name>.jpg` (the poster: the `poster()` frame + 0.6 s, or 40 % of the video).
- `node scripts/help/lib/covers.mjs`: one cover per video (`-cover.jpg`, 1280 × 720) for the "Prefer to watch?" list: brand background, logo, the title in large type, the length, and the subject's icon (`video.icon`: inline SVG or an `.svg` path; reuse the app's icon set) in an accent circle.
- To check a video without watching it all: extract frames (`ffmpeg -ss 12 -i video.mp4 -frames:v 1 frame.jpg`) and look for the caption, the box and the zoom; `-af silencedetect=noise=-40dB:d=0.4` lists where speech falls.

## 7. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "The app did not open inside the stage" | Wrong `app.baseURL`, or the app redirects the iframe to another origin (SSO). Sign in before (storageState) or point `route` to a page that does not redirect. |
| The app shows "open in a new window" or breaks in the iframe | Frame-busting code (`top !== self`): add a demo flag that skips it, or record that screen with a `card()`. |
| Clicks land in the wrong place | The camera is still moving: `g.zoom()`/`g.reset()` finish before the next call; avoid scrolling inside the app while zoomed. |
| A badge covers a label in a video | The same automatic layout as the pictures runs on the app's text; force a side with `step(…, { badge: "left" })`. |
| Long silences while typing | Type less (shorter examples), raise the delay only for amounts, or split the step. |
| A caption waits too long | It is too long to read aloud: shorten it; put explanations in `show()` with their own caption. |
| The video is cut too early | Call `g.end()` (it waits for the narration) before `g.stop()`. |
| Different results between runs | Something is not frozen: the clock, random ids shown on screen, remote images. Mock them. |
