import { test as base, expect } from "@playwright/test";
import { config } from "./lib/config.mjs";

export { blur, center, dialog, isPhone, mark, open, row, settle, shot, still, unmark } from "./lib/capture.mjs";
export { config, expect };

// Shared by the pictures and the videos: the demo data on a fixed day, the
// stored preferences of config.app.storage and answers for the server routes
// the tutorials show, so every step can be shown without a real account.
// Nothing here changes the app; nothing leaves the machine.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(config.now));
    await page.addInitScript((values) => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, config.app.storage);
    // TODO (project): answer the integrations and paid services the tutorials
    // show with fictional data and fake keys. For example:
    // await page.context().route("**/api/billing/**", (route) => route.fulfill({ json: { plan: "Pro", seats: 3 } }));
    // TODO (project): sign in as the demo user when the app needs it (or use
    // `storageState` in playwright.config.mjs).
    await use(page);
  },
});
