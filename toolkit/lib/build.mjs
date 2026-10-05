#!/usr/bin/env node
// Writes the help page: <outDir>/index.html with the pictures in img/ and the
// videos in video/. The page is static and works without a server; its
// colors, type and radii are the project's tokens (help.config.mjs), in light
// and dark. It also checks the content (help-content.mjs) and lists what is
// missing or out of step.
//   node lib/build.mjs                    build and report
//   node lib/build.mjs --publish [dir]    also copy the page to publishDir (or dir)
//   node lib/build.mjs --strict           exit with an error when a check fails
import { existsSync, readdirSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, fromRoot, IMG, OUT, ROOT, strings, VIDEO, words } from "./config.mjs";
import { checkContent, loadContent, videosOf } from "./help-content.mjs";
import { jpegSize, mp4HasSound, mp4Seconds } from "./media.mjs";
import { fill } from "./strings.mjs";

const args = process.argv.slice(2);
const publishAt = args.indexOf("--publish");
const publishTo = publishAt > -1 ? (args[publishAt + 1] && !args[publishAt + 1].startsWith("--") ? args[publishAt + 1] : config.publishDir) : null;
if (publishAt > -1 && !publishTo) throw Error("--publish needs a folder, or publishDir in help.config.mjs.");
const content = await loadContent();
const { GROUPS, TUTORIALS, SCREENS, PHONE, FAQ, GLOSSARY, QUICK } = content;
const t = (key, values = {}) => fill(strings[key], { ...words, ...values });

// ------------------------------------------------------------------ helpers
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// **bold** and [text](url) over escaped text; external links open apart.
const md = (text) => esc(text)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => href.startsWith("#")
    ? `<a href="${href}">${label}</a>`
    : `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`);
const plain = (text) => String(text ?? "").replace(/\*\*|\[|\]\([^)]*\)/g, "");
const duration = (value) => value >= 60 ? t("minutes", { m: Math.floor(value / 60), s: String(Math.round(value % 60)).padStart(2, "0") }) : t("seconds", { s: Math.round(value) });

// Pictures are captured at 2×. On the page each one shows at most at its own
// size and at most SHOT_HEIGHT tall, keeping its proportion, so a narrow crop
// (a menu, a sidebar) does not grow to the column and push the text away.
// A click opens it at full size.
const SHOT_HEIGHT = 580, SCALE = config.stills.scale || 2;
function picture(name, alt, { phone = false } = {}) {
  const file = path.join(IMG, `${name}.jpg`);
  if (!existsSync(file)) return "";
  const [wide, high] = jpegSize(file) || [];
  const scale = high ? Math.min(1, SHOT_HEIGHT / (high / SCALE)) : 1;
  const width = wide && Math.round(wide / SCALE * scale), height = high && Math.round(high / SCALE * scale);
  return `<figure class="shot${phone ? " is-phone" : ""}"><button type="button" class="shot-open" data-zoom="img/${name}.jpg" aria-label="${esc(`${strings.zoomLabel} ${alt}`)}"><img src="img/${name}.jpg" alt="${esc(alt)}" loading="lazy" decoding="async"${width ? ` width="${width}" height="${height}"` : ""}></button><figcaption>${esc(strings.zoomHint)}</figcaption></figure>`;
}

function video({ file, title }, { phone = false } = {}) {
  const mp4 = path.join(VIDEO, `${file}.mp4`);
  if (!existsSync(mp4)) return "";
  const length = mp4Seconds(mp4);
  return `<figure class="video${phone ? " is-phone" : ""}"><video controls playsinline preload="none" poster="video/${file}.jpg" aria-label="${esc(`${strings.video}: ${title}`)}"><source src="video/${file}.mp4" type="video/mp4"></video><figcaption><span class="dot" aria-hidden="true"></span>${esc(strings.video)} · ${esc(title)}${length ? ` · ${esc(duration(length))}` : ""} · ${esc(mp4HasSound(mp4) ? strings.narrated : strings.silent)}</figcaption></figure>`;
}

const badge = (n) => `<span class="badge${typeof n === "string" ? " is-letter" : ""}" aria-hidden="true">${esc(n)}</span>`;
const steps = (list = [], extra = false) => list.length
  ? `<ol class="steps${extra ? " is-extra" : ""}">${list.map((step) => `<li>${badge(step.n)}<p><span class="sr-only">${esc(typeof step.n === "string" ? strings.option : strings.step)} ${esc(step.n)}: </span>${md(step.text)}</p></li>`).join("")}</ol>`
  : "";
const note = (text) => (text ? `<p class="note">${md(text)}</p>` : "");
const toTop = `<p class="to-top"><a href="#top">${esc(strings.toTop)}</a></p>`;

function tutorial(guide) {
  const parts = guide.parts.map((part) => `<section class="part">${part.title ? `<h3>${esc(part.title)}</h3>` : ""}${part.video ? video(part.video) : ""}${(part.blocks || []).map((block) => `<div class="block">${block.image ? picture(block.image, block.alt || "") : ""}${steps(block.steps)}${steps(block.extras, true)}${note(block.note)}</div>`).join("")}${note(part.note)}</section>`).join("");
  const words = [guide.title, guide.summary, guide.keywords, guide.intro, ...(guide.before || []), ...guide.parts.flatMap((part) => [part.title, part.note, ...(part.blocks || []).flatMap((block) => [block.note, ...(block.steps || []).map((s) => s.text), ...(block.extras || []).map((s) => s.text)])]), guide.done, ...(guide.problems || [])].filter(Boolean).map(plain).join(" ");
  return `<article class="guide" id="${esc(guide.id)}" data-search="${esc(words)}" aria-labelledby="${esc(guide.id)}-title">
    <header class="guide-head"><h2 id="${esc(guide.id)}-title">${esc(guide.title)}</h2><p>${md(guide.summary)}</p></header>
    ${guide.intro ? `<p class="intro">${md(guide.intro)}</p>` : ""}
    ${guide.video ? video(guide.video) : ""}
    ${guide.before?.length ? `<section class="before" aria-label="${esc(strings.before)}"><h3>${esc(strings.before)}</h3><ul>${guide.before.map((item) => `<li>${md(item)}</li>`).join("")}</ul></section>` : ""}
    ${parts}
    ${guide.done ? `<p class="done"><span class="dot is-success" aria-hidden="true"></span><span><strong>${esc(strings.done)}</strong> ${md(guide.done)}</span></p>` : ""}
    ${guide.problems?.length ? `<section class="problems"><h3>${esc(strings.problems)}</h3><ul>${guide.problems.map((item) => `<li>${md(item)}</li>`).join("")}</ul></section>` : ""}
    ${toTop}
  </article>`;
}

function screens() {
  if (!SCREENS.length) return "";
  const words = SCREENS.map((screen) => [screen.name, screen.text, ...(screen.parts || [])].map(plain).join(" ")).join(" ");
  return `<article class="guide" id="screens" data-search="${esc(words)}" aria-labelledby="screens-title">
    <header class="guide-head"><h2 id="screens-title">${esc(t("screensTitle"))}</h2><p>${esc(t("screensIntro"))}</p></header>
    ${SCREENS.map((screen) => `<section class="part"><h3>${esc(screen.name)}</h3><div class="block">${screen.image ? picture(screen.image, t("screenAlt", { name: screen.name })) : ""}<p class="intro">${md(screen.text)}</p>${steps((screen.parts || []).map((text, index) => ({ n: index + 1, text })))}</div></section>`).join("")}
    ${toTop}
  </article>`;
}

function phone() {
  if (!PHONE) return "";
  const words = [...(PHONE.blocks || []).flatMap((block) => (block.steps || []).map((s) => s.text)), ...(PHONE.install || []), PHONE.keywords].filter(Boolean).map(plain).join(" ");
  return `<article class="guide" id="phone" data-search="${esc(words)}" aria-labelledby="phone-title">
    <header class="guide-head"><h2 id="phone-title">${esc(PHONE.title || t("phoneTitle"))}</h2><p>${md(PHONE.summary || t("phoneIntro"))}</p></header>
    ${PHONE.video ? video(PHONE.video, { phone: true }) : ""}
    ${PHONE.install?.length ? `<section class="part"><h3>${esc(t("installTitle"))}</h3><ol class="steps">${PHONE.install.map((text, index) => `<li>${badge(index + 1)}<p>${md(text)}</p></li>`).join("")}</ol></section>` : ""}
    ${PHONE.blocks?.length ? `<section class="part"><h3>${esc(t("phoneWhere"))}</h3><div class="phone-grid">${PHONE.blocks.map((block) => `<div class="block">${block.image ? picture(block.image, block.alt || "", { phone: true }) : ""}${steps(block.steps)}</div>`).join("")}</div></section>` : ""}
    ${toTop}
  </article>`;
}

function faq() {
  if (!FAQ.length) return "";
  return `<article class="guide" id="faq" aria-labelledby="faq-title">
    <header class="guide-head"><h2 id="faq-title">${esc(t("faqTitle"))}</h2><p>${esc(t("faqIntro"))}</p></header>
    ${FAQ.map((group) => `<section class="part faq-group"><h3>${esc(group.title)}</h3>${group.items.map(([question, answer]) => `<details class="faq" data-search="${esc(plain(`${question} ${answer} ${group.title}`))}"><summary><span>${esc(question)}</span><span class="chevron" aria-hidden="true"></span></summary><p>${md(answer)}</p></details>`).join("")}</section>`).join("")}
    ${toTop}
  </article>`;
}

function glossary() {
  if (!GLOSSARY.length) return "";
  return `<article class="guide" id="glossary" aria-labelledby="glossary-title">
    <header class="guide-head"><h2 id="glossary-title">${esc(t("glossaryTitle"))}</h2><p>${esc(t("glossaryIntro"))}</p></header>
    <dl class="glossary">${GLOSSARY.map(([term, meaning]) => `<div data-search="${esc(plain(`${term} ${meaning}`))}"><dt>${esc(term)}</dt><dd>${md(meaning)}</dd></div>`).join("")}</dl>
    ${toTop}
  </article>`;
}

// ------------------------------------------------------------------- tokens
const tokenCss = (values) => Object.entries(values).map(([key, value]) => `--${key}: ${value};`).join(" ");
const { light, dark, ...shared } = config.tokens;
const TOKENS = `@layer tokens {
  :root { ${tokenCss(shared)} --mark: ${config.marks.color}; --font-body: ${config.brand.font}; --font-heading: ${config.brand.font}; ${tokenCss(light)} color-scheme: light; }
  :root[data-theme="dark"] { ${tokenCss(dark)} color-scheme: dark; }
}`;

// --------------------------------------------------------------- navigation
const nav = GROUPS.map((group) => ({ title: group.title, links: TUTORIALS.filter((guide) => guide.group === group.id).map((guide) => [guide.id, guide.title]) })).filter((group) => group.links.length);
const more = [SCREENS.length && ["screens", t("screensTitle")], PHONE && ["phone", PHONE.title || t("phoneTitle")], FAQ.length && ["faq", t("faqTitle")], GLOSSARY.length && ["glossary", t("glossaryTitle")]].filter(Boolean);
if (more.length) nav.push({ title: strings.helpCenter, links: more });
const navHtml = nav.map((group) => `<p class="nav-caption">${esc(group.title)}</p><ul>${group.links.map(([id, title]) => `<li><a href="#${esc(id)}" data-nav="${esc(id)}">${esc(title)}</a></li>`).join("")}</ul>`).join("");
const videos = videosOf(content).filter((item) => existsSync(path.join(VIDEO, `${item.file}.mp4`)));
const narratedAll = videos.length && videos.every((item) => mp4HasSound(path.join(VIDEO, `${item.file}.mp4`)));
const examples = config.page.searchExamples || [];
const placeholder = `${strings.searchPlaceholder}${examples.length ? ` ${strings.searchExample} ${examples.join(", ")}` : ""}`;

// ------------------------------------------------------------------- styles
const STYLE = `
@layer reset, tokens, base, components;
@layer reset { *, *::before, *::after { box-sizing: border-box; } body, h1, h2, h3, p, ul, ol, dl, dd, figure { margin: 0; } ul, ol { padding: 0; } img, video { display: block; max-width: 100%; height: auto; } button, input { font: inherit; color: inherit; } }
${TOKENS}
@layer base {
  html { background: var(--background); color: var(--text-primary); font-family: var(--font-body); font-size: 17px; line-height: 1.6; -webkit-font-smoothing: antialiased; scroll-padding-top: 88px; }
  @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
  body { min-height: 100vh; }
  a { color: var(--link); text-underline-offset: 3px; }
  a:focus-visible, button:focus-visible, summary:focus-visible, input:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 6px; }
  strong { font-weight: 600; }
  h1, h2, h3 { font-family: var(--font-heading); font-weight: 600; text-wrap: balance; }
  p, li, dd { text-wrap: pretty; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
}
@layer components {
  .topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 20px; padding: 12px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
  .brand { display: flex; align-items: center; gap: 12px; color: var(--text-primary); text-decoration: none; flex: none; }
  .brand img { height: 32px; width: auto; }
  .brand img.symbol { height: 30px; border-radius: 8px; }
  .brand strong { font-size: 19px; }
  .brand span { font-size: 15px; font-weight: 500; color: var(--text-muted); padding-left: 12px; border-left: 1px solid var(--border); }
  [data-theme="dark"] .logo-light, [data-theme="light"] .logo-dark { display: none; }
  .search { position: relative; flex: 1; max-width: 520px; margin-left: auto; }
  .app-link { font-size: 15px; font-weight: 500; white-space: nowrap; }
  .search input { width: 100%; height: 44px; padding: 0 14px 0 42px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--background); font-size: 16px; }
  .search input::placeholder { color: var(--text-muted); }
  .search svg { position: absolute; left: 14px; top: 50%; translate: 0 -50%; color: var(--text-muted); }
  .layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 48px; max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; }
  .toc { position: sticky; top: 92px; align-self: start; max-height: calc(100vh - 110px); overflow: auto; padding-right: 8px; }
  .nav-caption { margin: 20px 0 6px; font-size: 13px; font-weight: 500; color: var(--text-muted); }
  .nav-caption:first-child { margin-top: 0; }
  .toc ul { list-style: none; }
  .toc a { display: block; padding: 7px 10px; border-radius: 8px; color: var(--text-secondary); text-decoration: none; font-size: 15px; line-height: 1.35; }
  .toc a[aria-current="true"] { background: var(--surface-hover); color: var(--text-primary); font-weight: 500; }
  @media (hover: hover) { .toc a:hover { background: var(--surface-hover); color: var(--text-primary); } }
  .toc-mobile { display: none; }
  main { min-width: 0; max-width: 860px; }
  .hero h1 { font-size: clamp(30px, 4vw, 38px); letter-spacing: -0.025em; line-height: 1.15; }
  .hero > p { margin-top: 12px; color: var(--text-secondary); font-size: 18px; }
  .quick { margin-top: 28px; padding: 8px 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .quick h2 { font-size: 15px; font-weight: 500; color: var(--text-muted); padding: 14px 0 6px; }
  .quick ul { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; }
  .quick a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border-subtle); color: var(--text-primary); text-decoration: none; font-weight: 500; }
  .quick a::after { content: "→"; color: var(--text-muted); }
  @media (hover: hover) { .quick a:hover { color: var(--link); } }
  .how { margin-top: 20px; display: flex; gap: 12px; align-items: flex-start; color: var(--text-secondary); font-size: 16px; }
  .how .badge { margin-top: 2px; }
  .videos { margin-top: 40px; }
  .videos h2, .guide-head h2 { font-size: 26px; letter-spacing: -0.02em; line-height: 1.2; }
  .videos > p { margin-top: 6px; color: var(--text-muted); font-size: 15px; }
  .video-list { list-style: none; margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
  .video-list a { display: block; color: var(--text-primary); text-decoration: none; font-size: 15px; font-weight: 500; line-height: 1.35; }
  .video-list img { aspect-ratio: 16 / 9; width: 100%; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 8px; background: var(--surface-raised); }
  .video-list img.is-phone { object-fit: contain; }
  @media (hover: hover) { .video-list a:hover { color: var(--link); } }
  .guide { margin-top: 56px; padding: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
  .guide[hidden] { display: none; }
  .guide-head p { margin-top: 6px; color: var(--text-secondary); font-size: 18px; }
  .guide h3 { font-size: 20px; letter-spacing: -0.01em; line-height: 1.3; }
  .intro { margin-top: 16px; color: var(--text-secondary); }
  .part { margin-top: 36px; padding-top: 28px; border-top: 1px solid var(--border-subtle); }
  .guide-head + .video, .guide-head + .intro + .video { margin-top: 24px; }
  .part > .video { margin-top: 16px; }
  .block + .block { margin-top: 28px; }
  .part > h3 + .block { margin-top: 16px; }
  .before { margin-top: 24px; padding: 18px 20px; background: var(--surface-raised); border-radius: var(--radius-control); }
  .before h3 { font-size: 16px; }
  .before ul, .problems ul { margin-top: 8px; padding-left: 20px; }
  .before li + li, .problems li + li { margin-top: 6px; }
  .steps { list-style: none; margin-top: 16px; display: grid; gap: 14px; }
  .steps li { display: flex; gap: 14px; align-items: flex-start; }
  .steps.is-extra { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border); }
  .badge { flex: none; display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--mark); color: #fff; font-size: 15px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; box-shadow: 0 0 0 2px var(--surface); }
  .badge.is-letter { background: var(--surface); color: var(--mark); box-shadow: inset 0 0 0 2px var(--mark); }
  .steps p { padding-top: 2px; }
  .note { margin-top: 14px; padding-left: 14px; color: var(--text-secondary); font-size: 16px; position: relative; }
  .note::before { content: ""; position: absolute; left: 0; top: .6em; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
  .done { margin-top: 32px; display: flex; gap: 12px; align-items: baseline; padding: 16px 20px; background: var(--surface-raised); border-radius: var(--radius-control); }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); flex: none; }
  .dot.is-success { background: var(--success); }
  .problems { margin-top: 24px; }
  .problems h3 { font-size: 17px; }
  .to-top { margin-top: 28px; font-size: 15px; }
  .shot { margin-top: 16px; }
  .shot-open { display: inline-block; max-width: 100%; padding: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface-raised); cursor: zoom-in; vertical-align: top; }
  .shot img { max-width: 100%; height: auto; }
  .shot figcaption, .video figcaption { margin-top: 8px; font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
  .video video { width: 100%; border-radius: var(--radius); border: 1px solid var(--border); background: #111214; aspect-ratio: 16 / 9; }
  .video.is-phone video { max-width: 360px; aspect-ratio: 9 / 16; }
  .video .dot { background: var(--mark); }
  .phone-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 28px; margin-top: 16px; }
  .phone-grid .block + .block { margin-top: 0; }
  .faq-group h3 { margin-bottom: 8px; }
  .faq { border-bottom: 1px solid var(--border-subtle); }
  .faq summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; cursor: pointer; font-weight: 500; }
  .faq summary::-webkit-details-marker { display: none; }
  .chevron { flex: none; width: 10px; height: 10px; border-right: 2px solid var(--text-muted); border-bottom: 2px solid var(--text-muted); rotate: 45deg; translate: 0 -3px; transition: rotate .2s; }
  .faq[open] .chevron { rotate: 225deg; translate: 0 3px; }
  .faq p { padding: 0 0 16px; color: var(--text-secondary); }
  .glossary { margin-top: 20px; display: grid; }
  .glossary div { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; padding: 12px 0; border-top: 1px solid var(--border-subtle); }
  .glossary dt { font-weight: 600; }
  .glossary dd { color: var(--text-secondary); }
  .glossary div[hidden], .faq[hidden], .faq-group[hidden] { display: none; }
  .empty { margin-top: 40px; padding: 24px; text-align: center; color: var(--text-secondary); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .page-foot { margin-top: 48px; font-size: 13px; color: var(--text-muted); }
  .page-links { display: flex; flex-wrap: wrap; gap: 0 20px; margin-top: 8px; font-size: 13px; }
  .page-links a { display: inline-flex; align-items: center; min-height: 44px; color: var(--text-muted); }
  .viewer { width: min(1400px, 96vw); max-width: none; max-height: 94vh; padding: 0; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: inherit; box-shadow: var(--shadow-float); }
  .viewer::backdrop { background: var(--backdrop); }
  .viewer img { width: 100%; height: auto; max-height: calc(94vh - 64px); object-fit: contain; background: var(--surface-raised); }
  .viewer-bar { display: flex; justify-content: flex-end; padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .viewer-close { min-height: 40px; padding: 0 16px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface); cursor: pointer; font-size: 15px; font-weight: 500; }
  @media (hover: hover) { .viewer-close:hover { background: var(--surface-hover); } }
  .viewer-close:active { background: var(--surface-hover); }
  @media (max-width: 960px) {
    .layout { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 20px 16px 64px; }
    .toc { display: none; }
    .toc-mobile { display: block; margin-bottom: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
    .toc-mobile summary { list-style: none; display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; font-weight: 500; cursor: pointer; }
    .toc-mobile summary::-webkit-details-marker { display: none; }
    .toc-mobile[open] .chevron { rotate: 225deg; translate: 0 3px; }
    .toc-mobile nav { padding: 0 18px 16px; }
    .toc-mobile ul { list-style: none; }
    .toc-mobile a { display: block; padding: 8px 0; text-decoration: none; }
    main { max-width: none; }
  }
  @media (max-width: 699px) {
    .topbar { flex-wrap: wrap; gap: 12px; padding: 12px 16px; }
    .search { max-width: none; flex-basis: 100%; order: 3; margin-left: 0; }
    .app-link { margin-left: auto; }
    .brand span { font-size: 14px; }
    .guide { padding: 22px 18px; margin-top: 40px; }
    .quick { padding: 4px 18px; }
    .quick ul { grid-template-columns: minmax(0, 1fr); }
    .phone-grid { grid-template-columns: minmax(0, 1fr); }
    .glossary div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .video.is-phone video { max-width: none; }
  }
}`;

// Scripts and styles go in files: a Content-Security-Policy that only allows
// the site's own files still runs and styles the page. The theme runs before the first paint and
// follows the app's own preference when themeKey is set.
const THEME = `(function () {
  var preference = "system", theme = "light";
  try { preference = ${config.page.themeKey ? `localStorage.getItem(${JSON.stringify(config.page.themeKey)}) || ` : ""}"system"; } catch (e) {}
  try { theme = preference === "light" || preference === "dark" ? preference : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch (e) {}
  document.documentElement.dataset.theme = theme;
})();
`;
const SCRIPT = `(() => {
  // Search: every word must appear, without accents or case.
  const norm = (text) => text.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  const input = document.getElementById("search"), empty = document.getElementById("empty");
  const guides = [...document.querySelectorAll("article.guide")], intro = document.querySelectorAll("[data-intro]");
  input.addEventListener("input", () => {
    const words = norm(input.value.trim()).split(/\\s+/).filter(Boolean);
    const match = (node) => words.every((word) => norm(node.dataset.search || node.textContent).includes(word));
    let shown = 0;
    for (const guide of guides) {
      let visible;
      if (guide.hasAttribute("data-search")) visible = !words.length || match(guide);
      else {
        let any = false;
        for (const item of guide.querySelectorAll("[data-search]")) { const ok = !words.length || match(item); item.hidden = !ok; if (ok) any = true; if (ok && words.length && item.tagName === "DETAILS") item.open = true; }
        guide.querySelectorAll(".faq-group").forEach((group) => { group.hidden = !!words.length && !group.querySelector(".faq:not([hidden])"); });
        visible = any;
      }
      guide.hidden = !visible;
      if (visible) shown++;
    }
    intro.forEach((node) => { node.hidden = words.length > 0; });
    empty.hidden = shown > 0;
    document.querySelectorAll("[data-nav]").forEach((link) => { const target = document.getElementById(link.dataset.nav); link.parentElement.hidden = !!target?.hidden; });
    document.querySelectorAll(".nav-caption").forEach((caption) => { caption.hidden = !caption.nextElementSibling.querySelector("li:not([hidden])"); });
  });
  // The chapter being read is marked in the index.
  const links = new Map([...document.querySelectorAll(".toc [data-nav]")].map((link) => [link.dataset.nav, link]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      links.forEach((link) => link.removeAttribute("aria-current"));
      links.get(entry.target.id)?.setAttribute("aria-current", "true");
    }
  }, { rootMargin: "-20% 0px -70% 0px" });
  guides.forEach((guide) => observer.observe(guide));
  // Pictures open larger; the focus returns to the picture when closing.
  const viewer = document.getElementById("viewer"), big = viewer.querySelector("img");
  let opener = null;
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-zoom]");
    if (button) { opener = button; big.src = button.dataset.zoom; big.alt = button.querySelector("img").alt; viewer.showModal(); return; }
    if (event.target === viewer || event.target.closest("[data-close]")) viewer.close();
  });
  viewer.addEventListener("close", () => { big.removeAttribute("src"); opener?.focus(); });
  document.querySelectorAll(".toc-mobile a").forEach((link) => link.addEventListener("click", () => { link.closest("details").open = false; }));
})();
`;

// ------------------------------------------------------------------ assets
const assets = path.join(OUT, "assets");
await mkdir(assets, { recursive: true });
const brandFile = async (file, name) => {
  if (!file || !existsSync(fromRoot(file))) return null;
  const target = `${name}${path.extname(file)}`;
  await copyFile(fromRoot(file), path.join(assets, target));
  return `assets/${target}`;
};
const logoLight = await brandFile(config.brand.logoLight, "logo-light");
const logoDark = await brandFile(config.brand.logoDark, "logo-dark") || logoLight;
const symbol = await brandFile(config.brand.symbol, "symbol");
await writeFile(path.join(assets, "theme.js"), THEME);
await writeFile(path.join(assets, "help.js"), SCRIPT);
await writeFile(path.join(assets, "help.css"), STYLE.trim());

// A wide logo; or the square symbol with the name; or the name alone.
const logo = logoLight
  ? `<img class="logo-light" src="${logoLight}" alt=""><img class="logo-dark" src="${logoDark}" alt="">`
  : symbol ? `<img class="symbol" src="${symbol}" alt=""><strong>${esc(config.product)}</strong>` : `<strong>${esc(config.product)}</strong>`;
const appLink = config.page.appLink?.href ? `<a class="app-link" href="${esc(config.page.appLink.href)}">${esc(config.page.appLink.label || t("openApp"))}</a>` : "";
const footerLinks = (config.page.links || []).length ? `<nav class="page-links" aria-label="${esc(strings.documents)}">${config.page.links.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join("")}</nav>` : "";

const html = `<!doctype html>
<html lang="${esc(strings.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(strings.helpCenter)} · ${esc(config.product)}</title>
<meta name="description" content="${esc(t("pageIntro"))}">
${symbol ? `<link rel="icon" href="${symbol}">` : ""}
<script src="assets/theme.js"></script>
<link rel="stylesheet" href="assets/help.css">
</head>
<body>
<header class="topbar" id="top">
  <a class="brand" href="#top" aria-label="${esc(`${config.product} · ${strings.helpCenter}`)}">${logo}<span>${esc(strings.helpCenter)}</span></a>
  <label class="search"><span class="sr-only">${esc(strings.searchLabel)}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="search" type="search" placeholder="${esc(placeholder)}" autocomplete="off"></label>
  ${appLink}
</header>
<div class="layout">
  <aside class="toc" aria-label="${esc(strings.toc)}"><nav>${navHtml}</nav></aside>
  <main>
    <details class="toc-mobile"><summary>${esc(strings.tocMobile)}<span class="chevron" aria-hidden="true"></span></summary><nav aria-label="${esc(strings.toc)}">${navHtml}</nav></details>
    <section class="hero" data-intro>
      <h1>${esc(t("pageTitle"))}</h1>
      <p>${esc(t("pageIntro"))}</p>
      <p class="how">${badge(1)}<span>${strings.legend}</span></p>
      ${QUICK.length ? `<nav class="quick" aria-label="${esc(strings.quickLabel)}"><h2>${esc(strings.quickTitle)}</h2><ul>${QUICK.map(([id, title]) => `<li><a href="#${esc(id)}">${esc(title)}</a></li>`).join("")}</ul></nav>` : ""}
    </section>
    ${videos.length ? `<section class="videos" data-intro aria-labelledby="videos-title" id="videos"><h2 id="videos-title">${esc(strings.videosTitle)}</h2><p>${esc(narratedAll ? strings.videosNarrated : strings.videosSilent)}</p><ul class="video-list">${videos.map((item) => {
      // The cover of covers.mjs; without it, the poster frame of the video.
      const cover = existsSync(path.join(VIDEO, `${item.file}-cover.jpg`));
      return `<li><a href="#${esc(item.id)}"><img src="video/${item.file}${cover ? "-cover" : ""}.jpg" alt="" loading="lazy" width="1280" height="720"${!cover && item.phone ? ' class="is-phone"' : ""}>${esc(item.title)}</a></li>`;
    }).join("")}</ul></section>` : ""}
    ${GROUPS.map((group) => TUTORIALS.filter((guide) => guide.group === group.id).map(tutorial).join("")).join("")}
    ${screens()}
    ${phone()}
    ${faq()}
    ${glossary()}
    <p class="empty" id="empty" hidden>${esc(strings.empty)}${examples.length ? ` ${examples.map((word) => `<strong>${esc(word)}</strong>`).join(", ")}` : ""}</p>
    <p class="page-foot">${esc(config.page.footer || strings.footer)}</p>
    ${footerLinks}
  </main>
</div>
<dialog class="viewer" id="viewer" aria-label="${esc(strings.viewerLabel)}"><div class="viewer-bar"><button type="button" class="viewer-close" data-close>${esc(strings.close)}</button></div><img alt=""></dialog>
<script src="assets/help.js"></script>
</body>
</html>
`;
await writeFile(path.join(OUT, "index.html"), html.replace(/^[ \t]+$/gm, ""));

// ------------------------------------------------------------------- report
const problems = checkContent(content);
const steps_ = TUTORIALS.reduce((sum, guide) => sum + guide.parts.reduce((total, part) => total + (part.blocks || []).reduce((n, block) => n + (block.steps || []).length, 0), 0), 0);
console.log(`Help page: ${path.relative(ROOT, path.join(OUT, "index.html"))} · ${TUTORIALS.length} tutorials · ${steps_} steps · ${videos.length} videos · ${FAQ.reduce((sum, group) => sum + group.items.length, 0)} questions`);
for (const problem of problems) console.log(`${problem.level === "error" ? "✗" : "!"} ${problem.where}: ${problem.message}`);
if (!problems.length) console.log("✓ Content, pictures and videos are in step.");

const failed = args.includes("--strict") && problems.some((problem) => problem.level === "error");
if (publishTo && failed) console.log("Not published: fix the ✗ problems first (the published help stays as it was).");
if (publishTo && !failed) {
  const target = fromRoot(publishTo);
  for (const dir of ["assets", "img", "video"]) await mkdir(path.join(target, dir), { recursive: true });
  await copyFile(path.join(OUT, "index.html"), path.join(target, "index.html"));
  const copy = async (dir, keep) => {
    if (!existsSync(path.join(OUT, dir))) return;
    for (const file of readdirSync(path.join(OUT, dir))) if (keep.test(file)) await copyFile(path.join(OUT, dir, file), path.join(target, dir, file));
  };
  await copy("assets", /./);
  await copy("img", /\.jpg$/);
  await copy("video", /\.(mp4|jpg)$/);
  console.log(`Published to ${path.relative(ROOT, target) || target}`);
}
if (failed) process.exit(1);
