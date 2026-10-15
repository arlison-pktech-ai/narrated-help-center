import { config, test } from "./support.mjs";
import { openGuide } from "./lib/director.mjs";

// The tutorial videos: one task per video, step by step, with the number and
// the instruction of each step as a caption, a red box around what to click
// and a narrator reading every caption. HELP_VIDEOS=01,03 records only those.
test.describe.configure({ mode: "parallel" });
const selected = (process.env.HELP_VIDEOS || "").split(",").filter(Boolean);
const video = (name, body) => {
  if (selected.length && !selected.some((prefix) => name.startsWith(prefix))) return;
  test(name, async ({ page }) => body(page, name));
};

video("01-add-item", async (page, name) => {
  const g = await openGuide(page, { route: "/items" });
  await g.record(name);
  await g.title("How to add an item", "Write down something new in a few seconds.");
  await g.step(1, "Click **+ New item**.", g.app.getByRole("button", { name: "New item" }), { after: 1000 });
  const form = g.app.locator(config.app.dialogSelector).last();
  await g.zoom();
  await g.step(2, "Write the **name**. Example: Garden hose.", form.getByLabel("Name"), { act: () => g.type("Garden hose") });
  g.poster();
  // name: true checks that the button reads the caption's bold label.
  await g.step(3, "Click **Save**.", form.locator("button[type=submit]"), { after: 300, name: true });
  await g.reset();
  await g.hold(600);
  await g.show("Done! The new item is at the top of the list.", [{ target: g.app.getByText("Garden hose").first(), label: "Your new item", side: "right" }], { hold: 3000 });
  await g.end("Item added!", "Add the next one the same way.");
  await g.stop();
});

test.describe("phone", () => {
  test.use({ viewport: { width: config.video.phone.width, height: config.video.phone.height }, hasTouch: true, isMobile: true });
  video("09-phone-add-item", async (page, name) => {
    const g = await openGuide(page, { route: "/items", device: "phone" });
    await g.record(name);
    await g.title("On the phone: add an item", "One tap on the + button.");
    await g.step(1, "Tap **+**.", g.app.getByRole("button", { name: "New item" }), { after: 1000 });
    const form = g.app.locator(config.app.dialogSelector).last();
    await g.step(2, "Write the **name**.", form.getByLabel("Name"), { act: async () => { await g.type("Garden hose"); await g.app.evaluate(() => document.activeElement?.blur()); } });
    g.poster();
    await g.step(3, "Tap **Save**.", form.getByRole("button", { name: "Save", exact: true }), { after: 1400 });
    await g.end("Done!", "Install the app on your phone to open it with one tap.");
    await g.stop();
  });
});
