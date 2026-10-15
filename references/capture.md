# Capture: demo data, fixtures and step pictures

## Contents

1. Demo data and determinism
2. `support.mjs`: the shared fixture (and apps that never go quiet)
3. Picture helpers
4. Writing a stills spec
5. Marking and cropping
6. Troubleshooting

## 1. Demo data and determinism

Pictures and videos must show a believable, lived-in account that belongs to nobody, and must come out the same on every run. Choose the least invasive source, in this order:

| The app has… | Use |
| --- | --- |
| A demo or fixture mode (`?demo=1`, a sample workspace, a "try it" mode) | `app.query` in `help.config.mjs`; the mode should reset its data on every load |
| A seed script / test database (Rails `db:seed`, Django fixtures, Prisma seed, Supabase local) | a `webServer.command` that resets the database and starts the app, e.g. `npm run db:reset:demo && npm run dev -- --port 5173`; sign in as the demo user |
| A backend you cannot run locally | Playwright route mocks in `support.mjs` that answer the API with fixture JSON (`page.context().route("**/api/tasks**", r => r.fulfill({ json: TASKS }))`) |
| Only production | stop and ask: never capture a real account; propose adding a demo mode |

Rules for the data:

- Fictional but plausible: people's first names, invented banks and brands ("Banco Aurora", "Lumen Gold"), realistic amounts with cents, a few late and future items, a history of a few months for charts.
- Dates relative to `now` (the fixed clock): "today", "in 2 days", "last month". Set `now` with its UTC offset and `timezone` to the users' zone.
- Enough rows to look real (5–12 per list), never so many that pictures get busy.
- The same example values in text, pictures and videos (the text says "Example: Garden"; the spec types "Garden").
- Fake keys and credentials only (`sk-example-0000…`), and only through mocked routes.

Determinism checklist: fixed clock (`page.clock.setFixedTime(config.now)` in the fixture — dates and "today" are frozen, timers still run), locale, browser language (`--lang`, for native date fields) and time zone in `playwright.config.mjs`, `serviceWorkers: "block"`, `colorScheme: "light"`, the light theme in `app.storage` when the app stores it, animations disabled in pictures (done by `shot()`), and a fresh browser context per test (Playwright default). Disable onboarding tours, cookie banners and "what's new" popups via `app.storage` or `hideSelectors`.

**Data in one shared server.** When the tests talk to a single server whose data they change (an in-memory store, a local database), parallel tests see each other's records ("6 clients" instead of 5). Set `workers: 1` in `help.config.mjs` (or `HELP_WORKERS=1`) and reset the data at the start of every test — a reset endpoint, a seed command, or a transaction rollback — in the fixture. Or give every test records with names of its own and never picture totals.

## 2. `support.mjs`: the shared fixture

Both the stills and the videos import `test` from `support.mjs`. Put there everything the app needs to open in demo mode:

```js
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(config.now));
    await page.addInitScript((values) => { for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v); }, config.app.storage);
    // Integrations the tutorials show, with fictional answers and state that changes during the tutorial:
    const bank = { connected: false };
    await page.context().route("**/api/bank**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") { bank.connected = true; return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ json: bank.connected ? { accounts: [{ name: "Banco Horizonte", balance: 4523.10 }] } : { accounts: [] } });
    });
    await use(page);
  },
});
```

Sign-in, when the app requires it — pick one, all keep cookies in the browser context (the video stage's iframe uses them too):

```js
// 1. Through the app's API, in the fixture (fast; the cookie lands in the context):
await page.request.post("/api/login", { data: { email: "demo@example.com", password: "demo-password" } });
// 2. A session cookie the dev server accepts:
await page.context().addCookies([{ name: "sid", value: "demo", url: config.app.baseURL }]);
// 3. A Playwright setup project that signs in through the form once and saves `storageState`.
```

Reset shared data in the same place: `await page.request.post("/api/reset")` (or the project's seed command in `webServer.command`). Context routes and init scripts also apply inside the video stage's iframe.

A tutorial that shows an external window (OAuth, a bank, an email): mock the API before and after it, and in videos use `g.card("In the bank's window", "Sign in and authorize. Then come back.")` instead of showing the other company's screen.

**Apps that never go quiet.** Every screen waits for the network to go quiet, at most `app.idleTimeout` (3000 ms; `0` skips the wait). An app with a long-lived request — a realtime bus, live notifications, chat presence — never goes quiet, so each `settle()` and each video stage pays the full wait, and the run prints once: "The network of … did not go quiet in 3000 ms". The screens still come out right (the ready and loading selectors decide that); turn the realtime part off in `support.mjs` to get the speed back. It only feeds live updates the tutorials do not show:

| The app keeps open | Turn it off in the fixture |
| --- | --- |
| A `SharedWorker` (Odoo 17/18's bus: its script request never ends for Playwright; the app falls back to a plain Worker) | `await page.context().addInitScript(() => { delete window.SharedWorker; });` |
| Server-sent events (`EventSource`) | `addInitScript(() => { delete window.EventSource; })` when the app checks for it, or abort the stream: `context.route("**/events**", (r) => r.abort())` |
| Long polling (Odoo ≤ 16 `/longpolling/poll`, Socket.IO's polling fallback) | abort that route, e.g. `context.route("**/longpolling/**", (r) => r.abort())` |
| A websocket to a third-party service (Pusher, Ably, Firebase) | already blocked when the fixture aborts other origins; otherwise `context.routeWebSocket(/pusher|ably/, (ws) => ws.close())` |

Confirm the fix: the warning is gone and `npm run help:stills` takes seconds per tutorial again (the Odoo lab: 24 s instead of 1.2 min). Raise `idleTimeout` only for an app whose first load is slow; lower it (or set `0`) when the ready selector alone is reliable.

## 3. Picture helpers

Imported from `support.mjs` (they live in `lib/capture.mjs`):

| Helper | Does |
| --- | --- |
| `open(page, route, ms?)` | goes to `route` with `app.query` appended, then `settle()` |
| `settle(page, ms = 450)` | network quiet (at most `app.idleTimeout`), fonts loaded, `readySelector` visible, `loadingSelector` gone, a short pause; a screen without `readySelector` after 15 s fails the test ("Screen not ready (picture)…"), the same wait and message as the video stage |
| `dialog(page, selector?)` | the open dialog after its entrance animation (`app.dialogSelector`) |
| `still(locator)` | waits until a menu/popover/sheet finished animating |
| `mark(page, items, { dim })` | draws boxes, badges and labels laid out automatically; items `{ target, n?, label?, side?, badge?, pad?, name? }`, target a locator or CSS selector; `name` checks the label the target shows (see `named`); `dim` (true, false or an opacity) overrides `marks.dim` |
| `named(locator, "Save")` | fails unless the target's visible text is exactly that label (an icon-only button: its accessible name, from `aria-label` or `title`); returns the locator. For buttons the text names but no mark points at (extras, Done, Problems) |
| `unmark(page)` | removes the marks (do it before clicking) |
| `shot(page, name, { crop, margin })` | saves `img/<name>.jpg` (and the numbers drawn, for the check); `crop`: `"dialog"`, a locator, a selector or `{ x, y, width, height }` |
| `row(scope, "Label")` | the form row of the label with that exact text — its `app.fieldSelector` ancestor, or the closest element holding the label and a field (works when the label wraps its field, unlike `getByText`/`getByLabel` with `exact`). A row with `display: contents` (the label and field cells of a CSS grid, like Odoo 18's `.o_wrap_field`) is marked, cropped and scrolled by the box around its visible cells |
| `center(locator)` | scrolls a part of the page to the middle |
| `blur(page)` | removes focus ring and caret after typing |

## 4. Writing a stills spec

One `test()` per tutorial, the pictures in the order of the text, named `<tutorial>-<n>-<what>` to match `content.mjs`:

```js
test("add-task", async ({ page }) => {
  await open(page, "/#today");
  const add = page.locator(".sidebar [data-action=new-task]");
  await mark(page, [{ target: add, n: 1, label: "Click + New task", side: "right" }]);
  await shot(page, "add-task-1-button");                 // first picture: the whole screen, for orientation
  await unmark(page);

  await add.click();
  const form = await dialog(page);
  await form.getByLabel("Title").fill("Pay the electricity bill");   // the example of the text
  await form.getByLabel("Project").selectOption({ label: "Home" });
  await blur(page);
  await mark(page, [
    { target: row(form, "Title"), n: 2 },
    { target: row(form, "Project"), n: 3 },
    { target: form.getByRole("button", { name: "Save" }), n: 4 },
  ]);
  await shot(page, "add-task-2-form", { crop: "dialog" });            // later pictures: crop to what matters
  await unmark(page);

  await form.getByRole("button", { name: "Save" }).click();
  const created = page.locator(".task").filter({ hasText: "Pay the electricity bill" });
  await center(created);
  await mark(page, [{ target: created, label: "Your new task", side: "bottom" }]);   // the result, no number
  await shot(page, "add-task-3-done");
});
```

Selectors: prefer what the user sees — `getByRole(…, { name })`, `getByLabel`, `getByText` — so a renamed button fails loudly and the text gets updated too. Fall back to stable attributes (`data-testid`, `data-action`, `name=`) for icon buttons and repeated elements — and then give the mark a `name` (`{ target: page.locator("button[name=action_confirm]"), n: 10, name: "Confirm" }`): an internal selector keeps finding the button after its label changes ("Confirm" → "Close the sale"), and without the check the picture shows the new label next to the old one in the text while every test passes. `build.mjs` also warns when the text a marked button showed differs from the bold label of its step. When an action changes data (save, delete), later tests still start fresh (each test has its own context; the demo mode resets).

Phone pictures (`phone.spec.mjs`) run at 390 × 844 with touch; the layout keeps the boxes of a bottom bar on screen and their badges off the labels.

## 5. Marking and cropping

- One block, one picture, exactly the block's numbers. Extras (A, B) on the same picture.
- One label with an arrow for the main action of the picture (two at most). Labels are imperative and short: "Click + New task", "Choose the type", "Your new task".
- **The layout is automatic.** Each box grows 7 px around its element, less when another marked element is close (half the gap), so stacked rows, menu items and tabs never get overlapping boxes, and boxes stay inside the screen. Each badge takes the first free place among the corner, the left, above, the right and below — free meaning it covers no visible text, no field, no icon, no button without text (the X beside a save button) and no other mark — in the order that suits its neighbors (stacked rows: left first; items side by side: above first). It avoids sliding onto its own target: a target at the edge of the screen (an apps-grid icon in the corner) gets its badge beside it when there is room. On a crowded bar with no free place (a top menu), the badge takes the least covered one; choose it with `badge` if you prefer another. A label goes to `side` when given and it fits, otherwise to the side with room that covers the least.
- Override only what still looks wrong after looking at the picture: `badge` (`"corner"`, `"left"`, `"right"`, `"top"`, `"bottom"`) and `pad` (`7`, `-2`, `{ x: 7, y: 4 }`) per item.
- First picture of a tutorial: the whole screen. Next ones: `crop: "dialog"` or a locator (a panel, a menu with `margin: 60`). The crop always includes every mark and keeps 28 px of margin.
- Before every `shot()`, the screen must be still: dialogs finished opening (`dialog()`), menus open (`still()`), toasts hidden (`hideSelectors`), focus removed (`blur()`).

**Darkening the rest (optional look).** `marks.dim` in `help.config.mjs` darkens everything but the boxes, so the eye goes straight to them: `false` (default, boxes only), `true` (pictures and videos), or `{ pictures: true, videos: false }`. `marks.dimOpacity` sets how dark (`{ pictures: 0.28, videos: 0.14 }`: lighter in motion). A single call can force it with `{ dim: true }`, `{ dim: false }` or an opacity — useful for one busy screen. `HELP_DIM=1` (or `pictures`, `videos`, `0`) overrides the config for one run, to show the user both looks. Labels, arrows and badges stay bright above the darkened area; a crop keeps its size.

## 6. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Boxes missing, only badges visible | Should not happen: marks draw in a shadow root, in the top layer. If something still hides them, check for a `transform` or `filter` on `<html>`/`<body>`. |
| Marks missing on an app with a Content-Security-Policy | `bypassCSP: true` in `playwright.config.mjs` (the template sets it): the marks are injected into the page. |
| A date field shows the wrong format (03/10 vs 10/03) | Native date fields follow the browser's language: `launchOptions.args: ["--lang=pt-BR"]` (the template derives it from `language`). |
| `row()` finds nothing | The label text is not exactly the given text (a trailing `*`, a nested span): pass the visible text, or mark the field with `getByLabel(…)` / a CSS selector. |
| Every test hangs until the 5-minute timeout, or each screen takes 3 s more | A realtime connection keeps the network busy: see "Apps that never go quiet" (section 2). |
| "Screen not ready (picture)" or "(video stage)" | `app.readySelector` did not appear in 15 s: the page did not open (a redirect, a sign-in page, a server error), or the selector does not exist on every screen the tutorials open — use one that every screen has. |
| `named()` / `name` fails: "The help says **X**, but the screen shows something else" | The label changed in the app: update the step text, the captions and the arrow labels, then the `name`. If the button only has an icon, its accessible name (`aria-label`/`title`) is compared. |
| `build.mjs` warns "names **X**, but the button it marks … reads "Y"" | Same cause, found from the last pictures; the bold label must be the text on the button. |
| Marks under a dialog | The dialog is not modal (no top layer). Marks still draw in the top layer; if the app's dialog is a portal with a huge `z-index`, it stays below the popover anyway. |
| `locator.waitFor: Timeout` in `mark()` | The target is hidden or not rendered yet: open the menu first, scroll with `center()`, or fix the selector. |
| Picture shows a toast or cookie banner | Add its selector to `app.hideSelectors`, or dismiss it through `app.storage`. |
| Dates differ between runs | Demo data built from the server's clock: make the seed use the same fixed date, or freeze it in the API mocks. |
| Fonts differ from the app | Wait for `document.fonts.ready` (done in `settle()`); install the app's web fonts locally if it loads them from a CDN that is blocked. |
| A crop is huge | A mark is far from the region (a label placed on the other side): choose `side`, or mark fewer things. |
