// Configuration of the help toolkit: the project's help.config.mjs (next to
// this lib/ folder, or HELP_CONFIG) merged over the defaults below. Paths in
// the config are relative to the project root (the nearest package.json).
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { articles, STRINGS } from "./strings.mjs";

export const LIB = path.dirname(fileURLToPath(import.meta.url));
export const HELP_DIR = path.dirname(LIB);
const CONFIG_FILE = process.env.HELP_CONFIG ? path.resolve(process.env.HELP_CONFIG) : path.join(HELP_DIR, "help.config.mjs");

const DEFAULTS = {
  product: "the app",
  language: "en",
  // The app's clock in every picture and video: a fixed moment, so dates and
  // "today" never change between runs.
  now: "2026-01-15T15:00:00Z",
  timezone: "UTC",
  outDir: ".help-center",
  publishDir: null,
  workers: 4,
  contentModule: null,
  app: {
    baseURL: "http://127.0.0.1:3000",
    // Appended to every path the specs open: demo or fixture mode.
    query: "",
    readySelector: "body",
    loadingSelector: null,
    dialogSelector: "dialog[open]",
    fieldSelector: null,
    hideSelectors: [],
    // localStorage values set before the app starts (theme, dismissed tours…).
    storage: {},
    phone: true,
    // Phone video: the elements whose colors continue behind the status bar and
    // the home indicator.
    phoneTopSelector: null,
    phoneBottomSelector: null,
    // Remove X-Frame-Options and frame-ancestors from the app's pages while
    // recording videos (the stage shows the app in an iframe).
    allowFraming: true,
  },
  stills: { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 }, scale: 2, quality: 86 },
  video: {
    width: 1920, height: 1080, app: { width: 1440, height: 900 },
    phone: { width: 1080, height: 1920, app: { width: 390, height: 763 } },
    fps: 30, crf: 26, frameQuality: 82, theme: "light",
  },
  marks: {
    color: "#e5322d",
    // Darken everything but the marked areas: false, true, or per medium
    // ({ pictures: true, videos: false }). HELP_DIM overrides it for one run.
    dim: false,
    dimOpacity: { pictures: 0.28, videos: 0.14 },
  },
  narration: { provider: "elevenlabs", voice: null, model: "eleven_multilingual_v2", seed: 7, systemVoice: null, systemRate: null },
  // [pattern, spoken] pairs: how something written is said aloud.
  pronunciation: [],
  brand: {
    logoLight: null, logoDark: null, symbol: null,
    coverBackground: "#202329", coverInk: "#f2f3f5", coverAccent: "#e5322d",
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
  },
  tokens: {
    light: {
      background: "#f6f7f9", surface: "#ffffff", "surface-raised": "#f1f3f6", "surface-hover": "#eceef2",
      border: "#e2e5ea", "border-subtle": "#eceef1", "text-primary": "#202329", "text-secondary": "#4b5260", "text-muted": "#6b7280",
      link: "#2459c8", success: "#1f8a4c", backdrop: "rgba(15, 18, 24, .55)",
      shadow: "0 1px 2px rgba(16, 24, 40, .05)", "shadow-float": "0 24px 60px rgba(16, 24, 40, .22)",
    },
    dark: {
      background: "#111214", surface: "#191b1e", "surface-raised": "#202327", "surface-hover": "#24272c",
      border: "#2c3036", "border-subtle": "#24272c", "text-primary": "#f2f3f5", "text-secondary": "#c3c7ce", "text-muted": "#9aa0a9",
      link: "#7ea2ff", success: "#3fb86f", backdrop: "rgba(0, 0, 0, .65)",
      shadow: "none", "shadow-float": "0 24px 60px rgba(0, 0, 0, .5)",
    },
    radius: "12px", "radius-control": "8px",
  },
  page: {
    // The help page reads and writes the same theme preference as the app.
    themeKey: null,
    quick: [],
    searchExamples: [],
    appLink: { href: "../", label: null },
    links: [],
    footer: null,
  },
  strings: {},
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value) && !(value instanceof RegExp);
export function merge(base, extra) {
  if (!isObject(extra)) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) out[key] = isObject(value) && isObject(base?.[key]) ? merge(base[key], value) : value;
  return out;
}

function findRoot(start) {
  for (let dir = start; dir !== path.dirname(dir); dir = path.dirname(dir)) if (existsSync(path.join(dir, "package.json"))) return dir;
  return start;
}

if (!existsSync(CONFIG_FILE)) throw Error(`Help toolkit: ${CONFIG_FILE} not found. Copy templates/help.config.mjs next to lib/.`);
const project = (await import(pathToFileURL(CONFIG_FILE).href)).default;
export const config = merge(DEFAULTS, project);
export const ROOT = config.root ? path.resolve(HELP_DIR, config.root) : findRoot(HELP_DIR);
export const OUT = path.resolve(ROOT, config.outDir);
export const fromRoot = (file) => (file ? path.resolve(ROOT, file) : null);
export const CONTENT = config.contentModule ? fromRoot(config.contentModule) : path.join(HELP_DIR, "content.mjs");
const language = STRINGS[config.language] ? config.language : STRINGS[config.language.split("-")[0]] ? config.language.split("-")[0] : "en";
export const strings = merge(STRINGS[language], config.strings);
// Values for the {placeholders} of the strings: the product and, in
// Portuguese, its article (config.article: "o", "a" or "").
export const words = { product: config.product, ...articles(config.article ?? "o") };
export const IMG = path.join(OUT, "img");
export const VIDEO = path.join(OUT, "video");
export const FRAMES = path.join(OUT, ".frames");
export const VOICE = path.join(OUT, "voice");

// The path of a screen with the demo query: "/projects" → "/projects?demo=1".
export function appPath(route = "/") {
  const url = new URL(route, config.app.baseURL);
  for (const [key, value] of new URLSearchParams(config.app.query || "")) if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

// How dark the rest of the screen gets around the marks (0: not at all), for
// "pictures" or "videos". `choice` is a call's own `dim` (true, false or an opacity).
export function dimFor(medium, choice) {
  if (typeof choice === "number") return choice;
  const env = process.env.HELP_DIM;
  const setting = choice ?? (env === undefined ? config.marks.dim
    : ["1", "true", "both", "on"].includes(env) ? true : ["pictures", "videos"].includes(env) ? { [env]: true } : false);
  const on = setting && typeof setting === "object" ? !!setting[medium] : !!setting;
  if (!on) return 0;
  const opacity = config.marks.dimOpacity;
  return typeof opacity === "number" ? opacity : opacity?.[medium] ?? (medium === "videos" ? 0.14 : 0.28);
}
