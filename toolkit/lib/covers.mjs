#!/usr/bin/env node
// One cover for every tutorial video, for the "Prefer to watch?" list of the
// help page: the brand background, the logo, the title in large type, the
// subject's icon in an accent circle and the length of the video. Each video
// keeps its own first frame as the player poster.
// Output: <outDir>/video/<name>-cover.jpg (1280 × 720).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { config, fromRoot, strings, VIDEO, words } from "./config.mjs";
import { loadContent, videosOf } from "./help-content.mjs";
import { mp4Seconds } from "./media.mjs";
import { fill } from "./strings.mjs";

const PLAY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dark = (color) => {
  const hex = String(color).replace("#", "");
  const [r, g, b] = (hex.length === 3 ? hex.split("").map((c) => c + c) : hex.match(/../g) || ["ff", "ff", "ff"]).map((part) => parseInt(part, 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};
// The icon of a video: inline SVG markup or an .svg file of the project.
const iconOf = (icon) => !icon ? PLAY : /^\s*<svg/i.test(icon) ? icon : existsSync(fromRoot(icon)) ? readFileSync(fromRoot(icon), "utf8") : PLAY;
const inline = (file) => {
  const data = readFileSync(fromRoot(file));
  const type = file.endsWith(".svg") ? "image/svg+xml" : file.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${type};base64,${data.toString("base64")}`;
};
// A wide logo; or the square symbol with the name; or the name alone.
const logoOf = () => {
  const file = dark(config.brand.coverBackground) ? config.brand.logoDark || config.brand.logoLight : config.brand.logoLight || config.brand.logoDark;
  if (file && existsSync(fromRoot(file))) return `<img src="${inline(file)}" alt="">`;
  const symbol = config.brand.symbol && existsSync(fromRoot(config.brand.symbol)) ? `<img class="symbol" src="${inline(config.brand.symbol)}" alt="">` : "";
  return `${symbol}<strong class="name">${esc(config.product)}</strong>`;
};

const page = ({ title, icon, length }) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 720px; overflow: hidden; background: ${config.brand.coverBackground}; color: ${config.brand.coverInk}; font-family: ${config.brand.font}; -webkit-font-smoothing: antialiased; }
  .cover { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 250px; align-items: center; gap: 56px; height: 100%; padding: 60px 80px 70px; }
  .logo { display: flex; align-items: center; gap: 16px; }
  .logo img { display: block; height: 56px; width: auto; max-width: 420px; object-fit: contain; object-position: left; }
  .logo img.symbol { height: 52px; border-radius: 12px; }
  .logo .name { font-size: 40px; font-weight: 650; letter-spacing: -0.02em; }
  .copy { display: grid; align-content: space-between; height: 100%; }
  h1 { font-size: ${title.length > 42 ? 80 : 98}px; font-weight: 600; line-height: 1.02; letter-spacing: -0.04em; text-wrap: balance; }
  .meta { display: flex; align-items: center; gap: 16px; font-size: 44px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .play { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: ${config.brand.coverAccent}; color: ${config.brand.coverBackground}; }
  .play svg { width: 30px; height: 30px; margin-left: 4px; fill: currentColor; }
  .mark { display: grid; place-items: center; width: 250px; height: 250px; border-radius: 50%; background: ${config.brand.coverAccent}; color: ${config.brand.coverBackground}; }
  .mark svg { width: 130px; height: 130px; }
  .edge { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: ${config.brand.coverAccent}; }
</style></head><body><div class="cover">
  <div class="copy"><div class="logo">${logoOf()}</div><h1>${esc(title)}</h1>
    <p class="meta"><span class="play">${PLAY}</span>${length ? esc(fill(strings.coverSeconds, { ...words, s: Math.round(length) })) : esc(strings.video)}</p></div>
  <div class="mark">${iconOf(icon)}</div>
</div><div class="edge"></div></body></html>`;

const videos = videosOf(await loadContent());
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  let made = 0;
  for (const video of videos) {
    const file = path.join(VIDEO, `${video.file}.mp4`);
    if (!existsSync(file)) continue;
    await tab.setContent(page({ title: video.title, icon: video.icon, length: mp4Seconds(file) }));
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: path.join(VIDEO, `${video.file}-cover.jpg`), type: "jpeg", quality: 88 });
    made++;
  }
  console.log(`Covers: ${made} of ${videos.length} videos`);
} finally {
  await browser.close();
}
