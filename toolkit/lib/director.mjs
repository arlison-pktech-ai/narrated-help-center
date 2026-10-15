// The tutorial videos: the stage (recorder.mjs) shows the real app in a
// window or a phone, with a smoothed pointer and title cards. On top of it
// each step shows its number and instruction as a caption and a red box
// around what to click, drawn by marks.js in app coordinates, so it follows
// the camera. A narrator reads every caption and card (voice.mjs) and sets
// the pace: the box stays until the sentence with the button or field (the
// part in bold) is heard, the click comes after it, and a new caption waits
// for the narrator to finish the previous one.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { named } from "./capture.mjs";
import { config, dimFor, FRAMES, LIB, strings } from "./config.mjs";
import { openStage } from "./recorder.mjs";
import { NARRATION, SCRIPTS, sentences, speak, spoken } from "./voice.mjs";

const MARKS = path.join(LIB, "marks.js");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Captions accept **bold** (like the help text) or <b>bold</b>.
const html = (text) => String(text ?? "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
// The label a caption names: its last bold part.
const boldOf = (text) => [...html(text).matchAll(/<b>(.+?)<\/b>/g)].map((match) => match[1]).at(-1);

export async function openGuide(page, options = {}) {
  const stage = await openStage(page, options);
  await page.addScriptTag({ path: MARKS });
  return new Guide(stage);
}

export class Guide {
  constructor(stage) {
    this.s = stage;
    this.page = stage.page;
    this.app = stage.app;
    this.phone = stage.device === "phone";
    this.until = 0;
    this.started = 0;
    this.texts = [];
  }

  async record(name) {
    this.name = name;
    await this.s.record(name, FRAMES, { quality: config.video.frameQuality });
  }
  async stop() {
    await this.quiet(0);
    await this.s.stop();
    await mkdir(SCRIPTS, { recursive: true });
    await writeFile(path.join(SCRIPTS, `${this.name}.json`), JSON.stringify(this.texts, null, 1));
  }

  // The opening card: the task as a title and one line about it.
  async title(title, subtitle) {
    const clip = await this.clip(spoken(title, subtitle));
    await this.showCard(title, subtitle);
    await wait(500);
    this.play(clip);
    await wait(Math.max(2300, this.left() + 700));
    await this.showCard(null);
    await wait(520);
    this.s.mark("intro-end");
  }
  // The closing card, after the result was shown in the app.
  async end(title = strings.done, subtitle = "") {
    await this.say(null);
    await this.unmark();
    const clip = await this.clip(spoken(title, subtitle));
    this.s.mark("outro-start");
    await this.showCard(title, subtitle);
    await wait(400);
    this.play(clip);
    await wait(Math.max(2200, this.left() + 900));
  }
  // A card in the middle of the video, for what happens outside the app
  // (another site, an email, the bank's app). Never fake their screens.
  async card(title, subtitle, ms = 3600) {
    await this.say(null);
    const clip = await this.clip(spoken(title, subtitle));
    await this.showCard(title, subtitle);
    await wait(400);
    this.play(clip);
    await wait(Math.max(ms - 400, this.left() + 700));
    await this.showCard(null);
    await wait(600);
  }
  showCard(title, subtitle) { return this.page.evaluate(([title, subtitle]) => window.stage.card(title, subtitle), [title, subtitle]); }

  // Shows a caption (and reads it) after the narrator finished the last one.
  async say(text) {
    await this.quiet();
    const caption = text ? html(text) : null;
    const clip = await this.clip(caption && spoken(caption));
    await this.page.evaluate((caption) => window.stage.caption(caption), caption);
    this.s.caption(caption);
    this.play(clip);
    return clip;
  }

  // The clip of a sentence. Asking the voice for a new one takes a moment
  // with nothing happening on the screen; encode.mjs cuts that wait out.
  async clip(text) {
    if (!text) return null;
    this.texts.push(text);
    if (!NARRATION) return null;
    const from = Date.now() / 1000;
    const clip = await speak(text);
    if (!clip.cached) this.s.mark("cut", { from, to: Date.now() / 1000 });
    return clip;
  }
  // The clip starts now: encode.mjs puts it at this point of the soundtrack.
  play(clip) {
    if (!clip) return;
    this.s.mark("voice", { file: clip.file, seconds: clip.seconds });
    this.started = Date.now();
    this.until = this.started + clip.seconds * 1000;
  }
  // Milliseconds until the narrator finishes, or finishes the sentence
  // `index` of the clip.
  left(clip, index) {
    const end = clip?.ends && index < clip.ends.length - 1 ? this.started + clip.ends[index] * 1000 : this.until || 0;
    return Math.max(0, end - Date.now());
  }
  // Waits for the narrator to finish, with a short pause after it.
  async quiet(pause = 300) {
    const rest = (this.until || 0) + pause - Date.now();
    if (rest > 0) await wait(rest);
  }
  // The frame used for the poster of the video: the most telling moment.
  poster() { this.s.poster(); }
  hold(ms) { return wait(ms); }
  locate(target) { return this.s.locate(target); }

  // `dim` (true, false or an opacity) darkens the rest of the app; by default
  // it follows config.marks.dim for videos. An item's `name` checks the label
  // its target shows (named()).
  async mark(items, { dim } = {}) {
    const boxes = [];
    for (const item of items) {
      const locator = this.locate(item.target);
      if (item.name) await named(locator, item.name);
      const box = await this.s.box(locator);
      boxes.push({ ...box, n: item.n, label: item.label, side: item.side, badge: item.badge, pad: item.pad });
    }
    await this.page.evaluate(({ boxes, dim, color }) => {
      const overlay = document.getElementById("overlay");
      // The app's text, so badges and labels do not cover it.
      const obstacles = window.helpMarks.textRects(document.querySelector("iframe").contentDocument);
      const marks = window.helpMarks.draw(overlay, boxes, { width: window.stage.app.width, height: window.stage.app.height, dim, color, obstacles });
      // Under the pointer, above the app.
      overlay.insertBefore(marks, overlay.firstChild);
    }, { boxes, dim: dimFor("videos", dim), color: config.marks.color });
  }
  async unmark() { await this.page.evaluate(() => window.helpMarks.clear(document.getElementById("overlay"), { fade: true })); }

  // One step: the caption, the pointer going to the target, the red box, a
  // pause to read and hear it, and the click (or `act`, for typing and
  // choosing). The action comes after the sentence that names it (the one in
  // bold); the rest of the caption is heard while the screen answers.
  // `name: true` checks, before the caption, that the target shows the bold
  // label of the caption (the last one, when there are several); a string
  // checks that label instead.
  async step(n, text, target, { label, side, badge, dim, click = true, act, hold = 1400, after = 800, name } = {}) {
    const locator = this.locate(target);
    await locator.waitFor({ state: "visible" });
    if (name) {
      const expected = name === true ? boldOf(text) : name;
      if (!expected) throw Error(`Step ${n}: name: true needs a **bold** label in the caption.`);
      await named(locator, expected);
    }
    const caption = html(text);
    const clip = await this.say(`<span class="step">${strings.step} ${n}</span>${caption}`);
    await this.s.reveal(locator);
    await this.s.move(locator, 850);
    await this.mark([{ target: locator, n, label, side, badge }], { dim });
    const naming = Math.max(0, sentences(caption).findIndex((sentence) => sentence.includes("<b>")));
    await wait(Math.max(hold, this.left(clip, naming) + 150));
    // The box leaves before the click: the click may close what it marks.
    await this.unmark();
    if (click) await this.s.click(locator, 300);
    if (act) await act(locator);
    await wait(after);
  }

  // Highlights without clicking, for "look here" moments. Targets: a locator,
  // a selector, or { target, label, side, n } items.
  async show(text, targets, { hold = 2600, move = true, dim } = {}) {
    await this.say(text);
    const list = (Array.isArray(targets) ? targets : [targets]).map((item) => (item?.target ? item : { target: item }));
    await this.s.reveal(this.locate(list[0].target));
    if (move) await this.s.move(this.locate(list[0].target), 850);
    await this.mark(list, { dim });
    await wait(Math.max(hold, this.left() + 300));
    await this.unmark();
  }

  async type(text, delay = 70) { await this.s.type(text, delay); }
  async keys(labels, press) { await this.s.keys(labels, press); }
  async scroll(to, ms = 1100, scroller) { await this.s.scroll(to, ms, scroller); }
  async focus(target, zoom = 1.3, ms = 900, options) { await this.s.focus(this.locate(target), zoom, ms, options); }
  async reset(ms = 800) { await this.s.reset(ms); }
  // Closer on an open dialog or panel, a little above the middle so the
  // caption at the bottom does not cover its buttons; never so close that it
  // does not fit (a full-height side panel stays whole).
  async zoom(target = config.app.dialogSelector, level = 1.25) {
    const locator = typeof target === "string" ? this.app.locator(target).last() : target;
    await locator.waitFor({ state: "visible" });
    await this.s.focusBox(locator, level, 900, { dy: 0.6 });
  }
}
