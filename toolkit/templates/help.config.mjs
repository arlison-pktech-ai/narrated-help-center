// Settings of the help center (scripts/help). Paths are relative to the
// project root. Everything not set here uses the defaults of lib/config.mjs.
export default {
  product: "Acme",                  // TODO: the product name as users see it
  language: "en",                   // "en", "pt-BR" or "es"… (strings of the page, the stage and the search)
  // The app's clock in every picture and video, with its UTC offset. Pick a
  // weekday inside the demo data's range, so "today", due dates and charts look alive.
  now: "2026-03-10T14:00:00Z",
  timezone: "America/New_York",     // the browser's time zone (and the dates people see)
  article: "o",                     // Portuguese only: "o" (o Avvi), "a" (a Clientela) or "" (no article)
  workers: 4,                       // 1 when the demo data lives in one shared server and the tests change it
  outDir: ".help-center",           // generated files (git-ignored)
  publishDir: "public/help",        // TODO: the static folder served with the app (build --publish)

  app: {
    baseURL: "http://127.0.0.1:5173",  // TODO: where playwright.config.mjs serves the app
    query: "demo=1",                // TODO: demo/fixture mode appended to every path ("" if the data comes from a seed)
    readySelector: "main",          // present when a screen is drawn
    loadingSelector: null,          // e.g. "[aria-busy=true], .skeleton": must be gone before a picture
    dialogSelector: "dialog[open]", // e.g. "[role=dialog]" for Radix/shadcn, ".modal.show" for Bootstrap
    fieldSelector: null,            // a form row (label + input), e.g. ".field"; row() falls back to the label's parent
    hideSelectors: [],              // toasts, cookie banners, dev overlays: hidden in pictures
    storage: {},                    // localStorage set before the app starts, e.g. { "onboarding-done": "1" }
    phone: true,                    // the app works on phones: phone pictures and a phone video
    phoneTopSelector: null,         // the phone video paints the status bar with this element's color
    phoneBottomSelector: null,
  },

  marks: {
    color: "#e5322d",               // the annotation red
    dim: false,                     // true: darken everything but the boxes (or { pictures: true, videos: false })
  },

  narration: {
    provider: "elevenlabs",         // "elevenlabs" (final), "system" (free draft voice) or "off"; HELP_VOICE overrides
    voice: null,                    // TODO: ElevenLabs voice id (node scripts/help/lib/voice.mjs --voices)
    model: "eleven_multilingual_v2",
    seed: 7,
    systemVoice: null,              // macOS `say -v` voice for drafts, e.g. "Samantha", "Luciana" (pt-BR)
  },
  // How things written on screen are said aloud: [pattern, words].
  pronunciation: [
    // [/\+ New\b/g, "New"],
    // [/\bCSV\b/g, "C S V"],
  ],

  brand: {
    logoLight: null,                // TODO: logo for light backgrounds (svg/png)
    logoDark: null,                 // logo for dark backgrounds
    symbol: null,                   // square mark: window title bar and favicon
    coverBackground: "#202329",     // video covers: background, text and accent
    coverInk: "#f2f3f5",
    coverAccent: "#e5322d",         // TODO: the brand accent
  },

  // The help page's colors, from the product's design tokens.
  tokens: {
    light: { /* background, surface, "surface-raised", "surface-hover", border, "border-subtle", "text-primary", "text-secondary", "text-muted", link, success */ },
    dark: {},
    radius: "12px",
    "radius-control": "8px",
  },

  page: {
    themeKey: null,                 // localStorage key of the app's theme ("light" | "dark" | "system")
    quick: [],                      // [tutorial id, "Short task label"] for "What do you want to do?"
    searchExamples: [],             // 3 words people would type: "invoice", "project"…
    appLink: { href: "../", label: null },
    links: [],                      // [href, label] at the foot: privacy, terms…
    footer: null,
  },
};
