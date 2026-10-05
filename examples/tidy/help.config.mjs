// Settings of Tidy's help center. Paths are relative to the project root.
export default {
  product: "Tidy",
  language: "en",
  now: "2026-03-10T14:00:00Z",
  timezone: "America/New_York",
  outDir: ".help-center",
  publishDir: "public/help",

  app: {
    baseURL: "http://127.0.0.1:5190",
    query: "demo=1",
    readySelector: "main .page-head",
    dialogSelector: "dialog[open]",
    fieldSelector: ".field",
    hideSelectors: ["#toast"],
    storage: { "tidy-theme": "light" },
    phone: true,
    phoneTopSelector: ".topbar",
    phoneBottomSelector: ".bottom-nav",
  },
  marks: { dim: false },   // true darkens everything but the boxes

  narration: {
    provider: "elevenlabs",
    voice: "XrExE9yKIg1WjnnlVkGX",   // Matilda: clear, professional (English)
    model: "eleven_multilingual_v2",
    seed: 7,
    systemVoice: "Samantha",
  },
  pronunciation: [
    [/\+ New task/g, "New task"],
    [/\+ Project/g, "Project"],
  ],

  brand: {
    logoLight: "public/logo-light.svg",
    logoDark: "public/logo-dark.svg",
    symbol: "public/logo-mark.svg",
    coverBackground: "#1d2026",
    coverInk: "#f2f3f5",
    coverAccent: "#6d8bff",
  },

  tokens: {
    light: { background: "#f6f7f9", surface: "#ffffff", "surface-raised": "#f1f3f6", "surface-hover": "#eef0f4", border: "#e2e5ea", "border-subtle": "#eceef1", "text-primary": "#1d2026", "text-secondary": "#4b5260", "text-muted": "#6b7280", link: "#3b5bdb", success: "#2f9e44" },
    dark: { background: "#111214", surface: "#191b1e", "surface-raised": "#202327", "surface-hover": "#24272c", border: "#2c3036", "border-subtle": "#24272c", "text-primary": "#f2f3f5", "text-secondary": "#c3c7ce", "text-muted": "#9aa0a9", link: "#6d8bff", success: "#51cf66" },
    radius: "12px",
    "radius-control": "8px",
  },

  page: {
    themeKey: "tidy-theme",
    searchExamples: ["task", "project", "theme"],
    appLink: { href: "../", label: "Open Tidy" },
  },
};
