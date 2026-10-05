import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { config, OUT, ROOT } from "./lib/config.mjs";

// The help captures (`npm run help`): pictures of each tutorial step on the
// desktop and on the phone, and the tutorial videos, all on the demo data.
// Separate from the test suite and from CI.
const here = path.dirname(fileURLToPath(import.meta.url));
const { stills, video } = config;
const locale = config.locale || (config.language === "en" ? "en-US" : config.language);

export default defineConfig({
  testDir: here,
  testMatch: /(stills|phone|videos)\.spec\.mjs$/,
  fullyParallel: true,
  // 1 when the demo data lives in one shared server and the tests change it.
  workers: Number(process.env.HELP_WORKERS || config.workers || 4),
  timeout: 300000,
  expect: { timeout: 20000 },
  use: {
    browserName: "chromium",         // the videos use the Chrome screencast
    baseURL: config.app.baseURL,
    locale,
    // Native date and number fields follow the browser's own language.
    launchOptions: { args: [`--lang=${locale}`] },
    timezoneId: config.timezone,
    colorScheme: "light",
    serviceWorkers: "block",
    bypassCSP: true,                 // the marks are injected into the page; a strict CSP would block them
    actionTimeout: 20000,
  },
  projects: [
    { name: "stills", testMatch: /stills\.spec\.mjs$/, use: { viewport: stills.desktop, deviceScaleFactor: stills.scale } },
    ...(config.app.phone ? [{ name: "phone", testMatch: /phone\.spec\.mjs$/, use: { viewport: stills.phone, deviceScaleFactor: stills.scale, isMobile: true, hasTouch: true } }] : []),
    { name: "videos", testMatch: /videos\.spec\.mjs$/, use: { viewport: { width: video.width, height: video.height }, deviceScaleFactor: 1 } },
  ],
  // TODO (project): the command that serves the app on config.app.baseURL
  // with the demo data. Reuses a server that is already running.
  webServer: {
    command: "npm run dev -- --port 5173",
    url: config.app.baseURL,
    reuseExistingServer: true,
    cwd: ROOT,
    timeout: 120000,
  },
  outputDir: path.join(OUT, ".results"),
  reporter: "list",
});
