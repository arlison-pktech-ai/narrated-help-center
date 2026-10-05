// Records the stage (stage/stage.html) through the Chrome screencast: every
// painted frame is saved with its time, and a timeline keeps the captions,
// the narration clips, the cuts and the poster moment for encode.mjs. The
// stage is served by Playwright on the app's own origin, so the app runs in
// its iframe like on any page: same cookies, same storage, nothing changed.
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { appPath, config, fromRoot, LIB } from "./config.mjs";

const STAGE = path.join(LIB, "stage");
const PREFIX = "/__help-stage/";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };

async function serveStage(page, setup, brand) {
  const origin = new URL(config.app.baseURL).origin;
  await page.route(`${origin}${PREFIX}**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(PREFIX.length);
    if (name === "config.js") return route.fulfill({ contentType: TYPES[".js"], body: `window.HELP_STAGE=${JSON.stringify(setup)};` });
    const file = name.startsWith("brand/") ? brand[name.slice("brand/".length)] : path.join(STAGE, path.basename(name));
    if (!file) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", body: await readFile(file) });
  });
}

// The stage shows the app in an iframe: pages that forbid framing
// (X-Frame-Options, CSP frame-ancestors) are allowed here, only while recording.
async function allowFraming(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.resourceType() !== "document" || request.frame() === page.mainFrame()) return route.fallback();
    const response = await route.fetch({ maxRedirects: 0 }).catch(() => null);
    if (!response) return route.fallback();
    const headers = { ...response.headers() };
    delete headers["x-frame-options"];
    if (headers["content-security-policy"]) headers["content-security-policy"] = headers["content-security-policy"].split(";").filter((part) => !/^\s*frame-ancestors\b/i.test(part)).join(";");
    return route.fulfill({ response, headers });
  });
}

export async function openStage(page, { device = "desktop", theme = config.video.theme, route = "/", storage = {} } = {}) {
  const phone = device === "phone";
  const brand = {};
  const asset = (key, file) => {
    if (!file) return null;
    const name = `${key}${path.extname(file)}`;
    brand[name] = fromRoot(file);
    return `${PREFIX}brand/${name}`;
  };
  const setup = {
    device, theme, title: config.product, color: config.marks.color, font: config.brand.font,
    app: phone ? config.video.phone.app : config.video.app,
    symbol: asset("symbol", config.brand.symbol), logoLight: asset("logo-light", config.brand.logoLight), logoDark: asset("logo-dark", config.brand.logoDark),
  };
  await serveStage(page, setup, brand);
  if (config.app.allowFraming) await allowFraming(page);
  if (Object.keys(storage).length) await page.addInitScript((values) => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, storage);
  await page.goto(`${PREFIX}stage.html`);
  await page.evaluate((src) => window.stage.load(src), appPath(route));
  const app = page.frames().find((frame) => frame.parentFrame() === page.mainFrame());
  if (!app) throw Error("The app did not open inside the stage. Check config.app.baseURL and the framing headers.");
  await app.waitForLoadState("networkidle").catch(() => {});
  await app.evaluate(() => document.fonts.ready);
  if (config.app.readySelector) await app.locator(config.app.readySelector).first().waitFor({ timeout: 15000 });
  if (config.app.loadingSelector) await expect(app.locator(config.app.loadingSelector)).toHaveCount(0, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.evaluate(([top, bottom]) => window.stage.paintPhone(top, bottom), [config.app.phoneTopSelector, config.app.phoneBottomSelector]);
  return new Recorder(page, app, device, theme);
}

export class Recorder {
  constructor(page, app, device, theme) {
    this.page = page;
    this.app = app;
    this.device = device;
    this.theme = theme;
    this.timeline = [];
    this.frames = [];
    this.writes = [];
  }

  // ------------------------------------------------------------- recording
  async record(name, root, { quality = 82 } = {}) {
    this.name = name;
    this.dir = path.join(root, name);
    await rm(this.dir, { recursive: true, force: true });
    await mkdir(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (event) => {
      this.cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
      const file = path.join(this.dir, `${String(this.frames.length).padStart(6, "0")}.jpg`);
      this.frames.push({ file: path.basename(file), t: event.metadata.timestamp });
      this.writes.push(writeFile(file, Buffer.from(event.data, "base64")));
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality, everyNthFrame: 1 });
    // A still stage paints nothing; a one-pixel change gives the first frame.
    await this.page.evaluate(() => { document.body.style.outline = "0 solid transparent"; requestAnimationFrame(() => { document.body.style.outline = ""; }); });
    this.mark("start");
  }

  async stop() {
    this.mark("end");
    await wait(250);
    await this.cdp.send("Page.stopScreencast");
    await Promise.all(this.writes);
    await writeFile(path.join(this.dir, "timeline.json"), JSON.stringify({ name: this.name, device: this.device, theme: this.theme, frames: this.frames, timeline: this.timeline }, null, 1));
    return this.dir;
  }

  mark(type, value = null) { this.timeline.push({ t: Date.now() / 1000, type, value }); }
  caption(text) { this.mark("caption", text); }
  poster() { this.mark("poster"); }
  hold(ms) { return wait(ms); }

  // ----------------------------------------------------------- the pointer
  locate(target) { return typeof target === "string" ? this.app.locator(target).first() : target; }

  async box(target) {
    const locator = this.locate(target);
    await locator.waitFor({ state: "visible" });
    return locator.evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  }

  async point(target, { dx = 0.5, dy = 0.5 } = {}) {
    const r = await this.box(target);
    return { x: r.x + r.width * dx, y: r.y + r.height * dy };
  }

  async move(target, ms = 700, options) {
    const p = typeof target?.x === "number" && typeof target?.y === "number" ? target : await this.point(target, options);
    await this.page.evaluate(([x, y, ms]) => window.stage.moveTo(x, y, ms), [p.x, p.y, ms]);
    const real = await this.page.evaluate(([x, y]) => window.stage.toPage(x, y), [p.x, p.y]);
    await this.page.mouse.move(real.x, real.y, { steps: 4 });
    return p;
  }

  async click(target, ms = 700, options) {
    const p = await this.move(target, ms, options);
    await wait(90);
    const real = await this.page.evaluate(([x, y]) => window.stage.toPage(x, y), [p.x, p.y]);
    await this.page.evaluate(() => window.stage.press());
    if (this.device === "phone") await this.page.touchscreen.tap(real.x, real.y);
    else await this.page.mouse.click(real.x, real.y);
    await wait(160);
    return p;
  }

  // Drags from one app point to another (a slider thumb, a card on a board).
  async drag(from, to, ms = 900) {
    await this.move(from, 650);
    const start = await this.page.evaluate(([x, y]) => window.stage.toPage(x, y), [from.x, from.y]);
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    const steps = Math.max(8, Math.round(ms / 24));
    await Promise.all([
      this.page.evaluate(([x, y, ms]) => window.stage.moveTo(x, y, ms), [to.x, to.y, ms]),
      (async () => {
        for (let i = 1; i <= steps; i++) {
          const k = i / steps, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          const point = await this.page.evaluate(([x, y]) => window.stage.toPage(x, y), [from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e]);
          await this.page.mouse.move(point.x, point.y);
          await wait(ms / steps);
        }
      })(),
    ]);
    await this.page.mouse.up();
  }

  async type(text, delay = 70) { await this.page.keyboard.type(text, { delay }); }

  // Shows key chips (["⌘", "K"]) and, optionally, presses the shortcut in the app.
  async keys(labels, press) {
    if (press) await this.page.evaluate(() => { const frame = document.querySelector("iframe"); if (!frame.contains(document.activeElement) && document.activeElement !== frame) frame.contentWindow.focus(); });
    await this.page.evaluate((labels) => window.stage.keys(labels), labels);
    await wait(260);
    if (press) await this.page.keyboard.press(press);
  }

  // Smooth scroll of the app's page (or of a scroller inside it) to a number,
  // a CSS selector or "heading:<text>" (the section of a title).
  async scroll(to, ms = 1100, scroller = null) {
    if (this.device === "phone") await this.page.evaluate(() => window.stage.showPointer(true));
    const drag = this.device === "phone" ? this.page.evaluate(([ms]) => {
      const start = window.stage.cursor();
      return window.stage.moveTo(start.x, Math.max(120, start.y - 260), ms);
    }, [ms]) : Promise.resolve();
    await Promise.all([drag, this.app.evaluate(([to, ms, selector]) => new Promise((resolve) => {
      const node = selector ? document.querySelector(selector) : document.scrollingElement;
      const find = (to) => to.startsWith("heading:")
        ? [...document.querySelectorAll("h1, h2, h3, h4")].find((title) => title.textContent.trim().startsWith(to.slice(8)))
        : document.querySelector(to);
      const from = node.scrollTop, target = typeof to === "number" ? to : (() => {
        const element = find(to);
        return element ? from + element.getBoundingClientRect().top - (selector ? node.getBoundingClientRect().top : 0) - 90 : from;
      })();
      const end = Math.max(0, Math.min(target, node.scrollHeight - node.clientHeight));
      const start = performance.now(), ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        node.scrollTop = from + (end - from) * ease(t);
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    }), [to, ms, scroller])]);
    if (this.device === "phone") await this.page.evaluate(() => window.stage.showPointer(false));
  }

  // --------------------------------------------------------------- the camera
  async focus(target, zoom = 1.6, ms = 1000, options) {
    const p = typeof target?.x === "number" ? target : await this.point(target, options);
    await this.page.evaluate(([x, y, zoom, ms]) => window.stage.focus(x, y, zoom, ms), [p.x, p.y, zoom, ms]);
  }

  // Moves the camera, if needed, so the element is seen whole above the caption.
  async reveal(target, ms = 600) {
    const box = await this.box(target);
    await this.page.evaluate(([box, ms]) => window.stage.reveal(box, ms), [box, ms]);
  }

  // Closer on an element, as close as `zoom` allows while it still fits.
  async focusBox(target, zoom = 1.25, ms = 900, { dy = 0.5 } = {}) {
    const box = await this.box(target);
    await this.page.evaluate(([box, zoom, ms, dy]) => window.stage.focusBox(box, zoom, ms, dy), [box, zoom, ms, dy]);
  }

  async reset(ms = 1000) { await this.page.evaluate((ms) => window.stage.reset(ms), ms); }
}
