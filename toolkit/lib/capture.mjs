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
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  if (config.app.readySelector) await page.locator(config.app.readySelector).first().waitFor({ timeout: 15000 }).catch(() => {});
  if (config.app.loadingSelector) await expect(page.locator(config.app.loadingSelector)).toHaveCount(0, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
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

// Draws the marks of a step. Items: { target, n?, label?, side?, badge?, pad? };
// the target is a locator or a CSS selector. `dim` (true, false or an
// opacity) darkens everything else; by default it follows config.marks.dim.
export async function mark(page, items, { dim } = {}) {
  const boxes = [];
  for (const item of items) {
    const locator = locate(page, item.target);
    await locator.waitFor({ state: "visible" });
    const box = await locator.boundingBox();
    if (!box) throw Error(`No position for the mark ${item.n ?? item.label}`);
    boxes.push({ x: box.x, y: box.y, width: box.width, height: box.height, n: item.n, label: item.label, side: item.side, badge: item.badge, pad: item.pad });
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
    const box = typeof crop.x === "number" ? crop : await (crop === "dialog" ? page.locator(config.app.dialogSelector).last() : locate(page, crop)).boundingBox();
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
  await writeFile(path.join(IMG, `${name}.json`), JSON.stringify({ marks: drawn.map((item) => item.n).filter((n) => n != null), labels: drawn.map((item) => item.label).filter(Boolean), phone: isPhone(page) }));
  return file;
}

// The visible row of a form field, found by the text of its label. `scope` is
// a page, a frame or a locator (a dialog). The label is the element whose own
// text is `text` (a label that wraps its field still matches); the row is the
// closest `app.fieldSelector` around it or, without one, the closest element
// that holds both the label and a field.
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
  await locator.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await locator.page().waitForTimeout(350);
}

// Removes the focus ring and the caret after typing into a form.
export async function blur(page) { await page.evaluate(() => document.activeElement?.blur()); }
