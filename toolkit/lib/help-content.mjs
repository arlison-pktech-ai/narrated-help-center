// The project's help text (content.mjs) and the checks that keep it honest:
// ids and links that resolve, step numbers in order, every step number
// drawn on the picture it sits next to, and the button each number points at
// showing the label the step names in bold.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config, CONTENT, IMG, VIDEO } from "./config.mjs";

export const SECTIONS = ["top", "videos", "screens", "phone", "faq", "glossary"];

export async function loadContent(file = CONTENT) {
  if (!existsSync(file)) throw Error(`Help content not found: ${file}`);
  const mod = await import(pathToFileURL(file).href);
  return {
    GROUPS: mod.GROUPS || [], TUTORIALS: mod.TUTORIALS || [], SCREENS: mod.SCREENS || [], PHONE: mod.PHONE || null,
    FAQ: mod.FAQ || [], GLOSSARY: mod.GLOSSARY || [], QUICK: mod.QUICK || config.page.quick || [],
  };
}

// Every video of the help, in page order: [{ id, file, title, icon, phone }].
export function videosOf({ TUTORIALS, PHONE }) {
  const list = TUTORIALS.flatMap((guide) => [guide.video && { id: guide.id, ...guide.video }, ...guide.parts.map((part) => part.video && { id: guide.id, ...part.video })]).filter(Boolean);
  if (PHONE?.video) list.push({ id: "phone", phone: true, ...PHONE.video });
  return list;
}

const blocksOf = (guide) => guide.parts.flatMap((part) => part.blocks || []);
const textsOf = (content) => [
  ...content.TUTORIALS.flatMap((guide) => [guide.summary, guide.intro, guide.done, ...(guide.before || []), ...(guide.problems || []),
    ...guide.parts.flatMap((part) => [part.note, ...(part.blocks || []).flatMap((block) => [block.note, ...(block.steps || []).map((s) => s.text), ...(block.extras || []).map((s) => s.text)])])]),
  ...content.SCREENS.flatMap((screen) => [screen.text, ...(screen.parts || [])]),
  ...(content.PHONE ? [...(content.PHONE.install || []), ...(content.PHONE.blocks || []).flatMap((block) => (block.steps || []).map((s) => s.text))] : []),
  ...content.FAQ.flatMap((group) => group.items.flat()),
  ...content.GLOSSARY.map(([, meaning]) => meaning),
].filter(Boolean);

// Labels compared loosely: case, accents' composition, symbols and spacing
// aside ("+ New item" names a button that reads "New item").
const loose = (text) => String(text).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const manifest = (image) => {
  const file = path.join(IMG, `${image}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
};

// Problems of the content: { level: "error" | "warning", where, message }.
export function checkContent(content, { files = true } = {}) {
  const problems = [];
  const add = (level, where, message) => problems.push({ level, where, message });
  const ids = new Set(), groups = new Set(content.GROUPS.map((group) => group.id));
  for (const guide of content.TUTORIALS) {
    const where = `tutorial "${guide.id}"`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(guide.id || "")) add("error", where, "the id must use lowercase letters, digits and hyphens");
    if (ids.has(guide.id)) add("error", where, "the id is repeated");
    if (SECTIONS.includes(guide.id)) add("error", where, `the id is reserved for a section of the page (${SECTIONS.join(", ")})`);
    ids.add(guide.id);
    if (!groups.has(guide.group)) add("error", where, `the group "${guide.group}" is not in GROUPS`);
    if (!guide.title || !guide.summary) add("error", where, "needs a title and a summary");
    if (!guide.parts?.length) add("error", where, "needs at least one part");
    for (const [index, part] of (guide.parts || []).entries()) {
      const numbers = (part.blocks || []).flatMap((block) => (block.steps || []).map((step) => step.n));
      if (numbers.some((n) => !Number.isInteger(n))) add("error", `${where}, part ${index + 1}`, "step numbers are integers; use letters only in extras");
      for (let i = 1; i < numbers.length; i++) if (numbers[i] !== numbers[i - 1] + 1) add("warning", `${where}, part ${index + 1}`, `steps go ${numbers[i - 1]} → ${numbers[i]}; number them in order`);
      for (const block of part.blocks || []) {
        if (block.extras?.some((extra) => !/^[A-Z]$/.test(String(extra.n)))) add("error", `${where}, part ${index + 1}`, "extras use capital letters: A, B, C");
        if (block.image && !block.alt) add("warning", `${where}, image ${block.image}`, "needs alt text that says what the picture shows");
        for (const step of [...(block.steps || []), ...(block.extras || [])]) {
          if (String(step.text || "").length > 240) add("warning", `${where}, step ${step.n}`, "is long; keep one action per step");
        }
      }
    }
  }
  const videos = videosOf(content), seen = new Set();
  for (const video of videos) {
    if (!/^[\w-]+$/.test(video.file || "")) add("error", `video "${video.file}"`, "the file name uses letters, digits, - and _ only");
    if (seen.has(video.file)) add("error", `video "${video.file}"`, "is used twice");
    seen.add(video.file);
  }
  for (const [id] of content.QUICK) if (!ids.has(id) && !SECTIONS.includes(id)) add("error", `QUICK "${id}"`, "points to no tutorial");
  for (const text of textsOf(content)) {
    for (const [, target] of String(text).matchAll(/\]\(#([\w-]+)\)/g)) if (!ids.has(target) && !SECTIONS.includes(target)) add("error", `link #${target}`, `in "${String(text).slice(0, 60)}…" points to nothing`);
  }
  if (!files) return problems;

  // The pictures and videos the text cites, and the numbers drawn on them.
  const pictures = [
    ...content.TUTORIALS.flatMap((guide) => blocksOf(guide).filter((block) => block.image).map((block) => ({ where: `tutorial "${guide.id}"`, guide, block }))),
    ...(content.PHONE?.blocks || []).filter((block) => block.image).map((block) => ({ where: "phone", block })),
  ];
  for (const { where, guide, block } of pictures) {
    if (!existsSync(path.join(IMG, `${block.image}.jpg`))) { add("error", where, `missing picture img/${block.image}.jpg`); continue; }
    const shot = manifest(block.image), drawn = shot?.marks;
    if (!drawn) continue;
    const said = [...(block.steps || []), ...(block.extras || [])].map((step) => String(step.n));
    const shown = drawn.map(String);
    const absent = said.filter((n) => !shown.includes(n));
    if (absent.length) add("error", `${where}, img/${block.image}.jpg`, `the text has step ${absent.join(", ")} but the picture does not show ${absent.length > 1 ? "these numbers" : "this number"}`);
    // A button found by an internal selector keeps working after its label
    // changes: the step must still name, in bold, what the button reads.
    for (const step of [...(block.steps || []), ...(block.extras || [])]) {
      const reads = shot.named?.[String(step.n)];
      const bold = [...String(step.text || "").matchAll(/\*\*(.+?)\*\*/g)].map((match) => match[1]);
      if (reads && bold.length && !bold.some((label) => loose(reads).includes(loose(label)))) {
        add("warning", `${where}, step ${step.n}`, `names ${bold.map((label) => `**${label}**`).join(", ")}, but the button it marks on img/${block.image}.jpg reads "${reads}"`);
      }
    }
    if (guide) {
      const all = blocksOf(guide).flatMap((other) => [...(other.steps || []), ...(other.extras || [])]).map((step) => String(step.n));
      const orphan = shown.filter((n) => !all.includes(n));
      if (orphan.length) add("warning", `${where}, img/${block.image}.jpg`, `the picture shows ${orphan.join(", ")}, which no step of the tutorial explains`);
    }
  }
  for (const screen of content.SCREENS) if (screen.image && !existsSync(path.join(IMG, `${screen.image}.jpg`))) add("error", `screen "${screen.name}"`, `missing picture img/${screen.image}.jpg`);
  for (const video of videos) if (!existsSync(path.join(VIDEO, `${video.file}.mp4`))) add("warning", `video "${video.file}"`, "not recorded yet");
  return problems;
}
