// Helpers of the step pictures: open a screen of the demo app and wait until
// it is drawn, draw the marks of a step (marks.js) and save the picture with
// the list of numbers it shows, so build.mjs can check the text against it.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { appPath, config, dimFor, IMG, LIB } from "./config.mjs";

const MARKS = path.join(LIB, "marks.js");
export const isPhone = (page) => page.viewportSize().width < 700;

export async function open(page, route = "/", ms) {
  await page.goto(appPath(route));
  await settle(page, ms);
}

// Network quiet, fonts loaded, the app drawn and its loading state gone.
export async function settle(page, ms = 450) {
  await ready(page, "picture");
  await page.waitForTimeout(ms);
}

// The network goes quiet, or `app.idleTimeout` passes: an app with a
// long-lived request (a websocket, a SharedWorker, server-sent events, long
// polling) never goes quiet, and an unbounded wait would hang every test.
let noisy = false;
export async function quiet(scope) {
  const ms = config.app.idleTimeout;
  if (!ms) return;
  const idle = await scope.waitForLoadState("networkidle", { timeout: ms }).then(() => true, () => false);
  if (idle || noisy) return;
  noisy = true;
  console.warn(`! The network of ${scope.url()} did not go quiet in ${ms} ms; every screen waits that long. A realtime connection keeps it busy: turn it off in support.mjs (references/capture.md, "Apps that never go quiet") or set app.idleTimeout.`);
}

// A screen of the app is drawn: the network quiet, the fonts loaded,
// `app.readySelector` present and `app.loadingSelector` gone. The same wait
// for the pictures and the video stage (`where`); a screen that never gets
// ready fails the test instead of giving a half-drawn picture.
export async function ready(scope, where = "picture") {
  await quiet(scope);
  await scope.evaluate(() => document.fonts.ready);
  const selector = config.app.readySelector;
  if (selector) {
    await scope.locator(selector).first().waitFor({ timeout: 15000 }).catch(() => {
      throw Error(`Screen not ready (${where}): app.readySelector "${selector}" did not appear in 15 s on ${scope.url()}. The page failed to open, or the selector does not match every screen the tutorials open: fix it in help.config.mjs.`);
    });
  }
  if (config.app.loadingSelector) await expect(scope.locator(config.app.loadingSelector)).toHaveCount(0, { timeout: 15000 }).catch(() => {});
}

// Waits until the entrance animations of a locator (a dialog, a menu) end.
export async function still(locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate((node) => Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished))).catch(() => {});
  await locator.page().waitForTimeout(250);
  return locator;
}

// The open dialog, after its entrance.
export async function dialog(page, selector = config.app.dialogSelector) {
  return still(page.locator(selector).last());
}

const locate = (page, target) => (typeof target === "string" ? page.locator(target).first() : target);

// The box of an element as drawn, in its frame, for locator.evaluate(): the
// fallback when boundingBox() has none. An element with `display: contents`
// has no box of its own (the form rows of a CSS grid, like
// Odoo 18's .o_wrap_field): its box is the one around its visible children
// (the label cell and the field cell).
export function rectOf(node) {
  const rects = (element) => {
    if (getComputedStyle(element).display === "contents") return [...element.children].flatMap(rects);
    const r = element.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? [r] : [];
  };
  const all = rects(node);
  if (!all.length) return null;
  const x = Math.min(...all.map((r) => r.left)), y = Math.min(...all.map((r) => r.top));
  return { x, y, width: Math.max(...all.map((r) => r.right)) - x, height: Math.max(...all.map((r) => r.bottom)) - y };
}

// The text of the button, link, menu item, tab or option a mark points at
// (the target or the control around it), for build.mjs to compare with the
// step's bold label; null for fields, rows and icon-only buttons.
function controlText(node) {
  const control = node.closest("button, a[href], summary, [role=button], [role=link], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=tab], [role=option]");
  const text = control?.innerText.replace(/\s+/g, " ").trim();
  return text || null;
}

// Checks that a target shows the label the help names: its visible text or,
// for an icon-only button, its accessible name (aria-label, title). A target
// found by an internal selector (a name= or data- attribute, a class) still
// works after its label changes, so without this check the pictures and the
// videos would show the new label next to the old one in the text, and pass.
// Returns the locator, to wrap a target in place.
export async function named(target, name) {
  await target.waitFor({ state: "visible" });
  const text = (await target.innerText()).replace(/\s+/g, " ").trim();
  const message = `The help says **${name}**, but the screen shows something else: update the text (content.mjs, captions) or the target`;
  if (text) await expect(target, message).toHaveText(name);
  else await expect(target, message).toHaveAccessibleName(name);
  return target;
}

// Draws the marks of a step. Items: { target, n?, label?, side?, badge?, pad?, name? };
// the target is a locator or a CSS selector; `name` checks that the target
// shows that label (named()). `dim` (true, false or an opacity) darkens
// everything else; by default it follows config.marks.dim.
export async function mark(page, items, { dim } = {}) {
  const boxes = [];
  for (const item of items) {
    const locator = locate(page, item.target);
    await locator.waitFor({ state: "visible" });
    if (item.name) await named(locator, item.name);
    // Page coordinates (right inside iframes too); an element with
    // display: contents has none, so the box around its children.
    const box = await locator.boundingBox() ?? await locator.evaluate(rectOf);
    if (!box) throw Error(`No position for the mark ${item.n ?? item.label}`);
    const text = item.n != null ? await locator.evaluate(controlText) : null;
    boxes.push({ x: box.x, y: box.y, width: box.width, height: box.height, n: item.n, label: item.label, side: item.side, badge: item.badge, pad: item.pad, text });
  }
  if (!await page.evaluate(() => !!window.helpMarks)) await page.addScriptTag({ path: MARKS });
  await page.evaluate(({ boxes, dim, color }) => { window.helpMarks.page(boxes, { dim, color }); }, { boxes, dim: dimFor("pictures", dim), color: config.marks.color });
  await page.waitForTimeout(80);
}

export async function unmark(page) { await page.evaluate(() => window.helpMarks?.clearPage()); }

// The picture of a step: <outDir>/img/<name>.jpg, and <name>.json with the
// numbers drawn on it. `crop` keeps a region (a locator, a selector, a
// rectangle or "dialog") plus every mark, so small forms stay readable.
export async function shot(page, name, { crop, margin = 28 } = {}) {
  await mkdir(IMG, { recursive: true });
  let clip;
  if (crop) {
    const region = typeof crop.x === "number" ? null : crop === "dialog" ? page.locator(config.app.dialogSelector).last() : locate(page, crop);
    const box = region ? await region.boundingBox() ?? await region.evaluate(rectOf) : crop;
    const marks = await page.evaluate(() => window.helpMarks?.rects() || []);
    const all = [box, ...marks].filter((r) => r && r.width > 0);
    const view = page.viewportSize();
    const x = Math.max(0, Math.min(...all.map((r) => r.x)) - margin), y = Math.max(0, Math.min(...all.map((r) => r.y)) - margin);
    const right = Math.min(view.width, Math.max(...all.map((r) => r.x + r.width)) + margin), bottom = Math.min(view.height, Math.max(...all.map((r) => r.y + r.height)) + margin);
    clip = { x, y, width: right - x, height: bottom - y };
  }
  // Passing notices, cookie banners and dev overlays would cover the marks.
  const hidden = config.app.hideSelectors?.length
    ? await page.addStyleTag({ content: `${config.app.hideSelectors.join(", ")} { visibility: hidden !important; }` })
    : null;
  const file = path.join(IMG, `${name}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: config.stills.quality, animations: "disabled", caret: "hide", ...(clip ? { clip } : {}) });
  await hidden?.evaluate((node) => node.remove());
  const drawn = await page.evaluate(() => window.helpMarks?.current() || []);
  // `named`: the text of the button each number points at, for build.mjs.
  const texts = Object.fromEntries(drawn.filter((item) => item.n != null && item.text).map((item) => [item.n, item.text]));
  await writeFile(path.join(IMG, `${name}.json`), JSON.stringify({ marks: drawn.map((item) => item.n).filter((n) => n != null), labels: drawn.map((item) => item.label).filter(Boolean), named: texts, phone: isPhone(page) }));
  return file;
}

// The visible row of a form field, found by the text of its label. `scope` is
// a page, a frame or a locator (a dialog). The label is the element whose own
// text is `text` (a label that wraps its field still matches); the row is the
// closest `app.fieldSelector` around it or, without one, the closest element
// that holds both the label and a field. A row with `display: contents` (no
// box of its own) is marked around its visible label and field cells.
const xpathText = (text) => (text.includes('"') ? `concat("${text.split('"').join('", \'"\', "')}")` : `"${text}"`);
export function row(scope, text, selector = config.app.fieldSelector) {
  const own = `.//*[text()[normalize-space(.)=${xpathText(text)}]]`;
  if (selector) {
    // The inner locator of `has` is relative to each row, so it starts at the page.
    const root = typeof scope.page === "function" ? scope.page() : scope;
    return scope.locator(`${selector}:visible`).filter({ has: root.locator(`xpath=${own}`) }).first();
  }
  return scope.locator(`xpath=${own}`).first().locator("xpath=ancestor-or-self::*[.//input or .//select or .//textarea or .//*[@role='switch' or @role='radiogroup' or @role='combobox' or @contenteditable='true']][1]");
}

// Brings a part of the page to the middle of the screen before a picture.
export async function center(locator) {
  await locator.waitFor({ state: "visible" });
  // An element with display: contents does not scroll; its first child does.
  await locator.evaluate((node) => (getComputedStyle(node).display === "contents" && node.firstElementChild || node).scrollIntoView({ block: "center" }));
  await locator.page().waitForTimeout(350);
}

// Removes the focus ring and the caret after typing into a form.
export async function blur(page) { await page.evaluate(() => document.activeElement?.blur()); }
