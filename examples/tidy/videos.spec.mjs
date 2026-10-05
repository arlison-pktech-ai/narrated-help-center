import { config, test } from "./support.mjs";
import { openGuide } from "./lib/director.mjs";

// Tidy's tutorial videos: one task per video, step by step, with the number
// and the instruction of each step as a caption, a red box around what to
// click and a narrator reading every caption. HELP_VIDEOS=01,02 records only those.
test.describe.configure({ mode: "parallel" });
const selected = (process.env.HELP_VIDEOS || "").split(",").filter(Boolean);
const video = (name, body) => {
  if (selected.length && !selected.some((prefix) => name.startsWith(prefix))) return;
  test(name, async ({ page }) => body(page, name));
};

video("01-add-task", async (page, name) => {
  const g = await openGuide(page, { route: "/#today" });
  await g.record(name);
  await g.title("How to add a task", "Write down something you need to do, with a date.");
  await g.step(1, "Click **New task**, at the top of the menu.", ".sidebar [data-action=new-task]", { after: 900 });
  const form = g.app.locator(config.app.dialogSelector).last();
  await g.zoom(form, 1.3);
  await g.step(2, "Write the **title**. Example: Pay the electricity bill.", form.getByLabel("Title"), { act: () => g.type("Pay the electricity bill", 55) });
  await g.step(3, "Choose the **project**.", form.getByLabel("Project"), { click: false, act: (select) => select.selectOption({ label: "Home" }) });
  await g.step(4, "Choose the **due date**.", form.getByLabel("Due date"), { click: false, act: (input) => input.fill("2026-03-12") });
  await g.step(5, "Choose the **priority**. Here: High.", form.getByRole("button", { name: "High" }), { after: 600 });
  g.poster();
  await g.step(6, "Turn on **Remind me** to get a notice that morning.", form.getByLabel("Remind me"), { after: 600 });
  await g.step(7, "Click **Save**.", form.getByRole("button", { name: "Save" }), { after: 300 });
  await g.reset();
  await g.hold(600);
  const created = g.app.locator(".task").filter({ hasText: "Pay the electricity bill" });
  await g.show("Done! The task is in **Coming up**, on its day.", [{ target: created, label: "Your new task", side: "bottom" }], { hold: 3000 });
  await g.end("Task added!", "Add the next one the same way.");
  await g.stop();
});

video("02-add-project", async (page, name) => {
  const g = await openGuide(page, { route: "/#today" });
  await g.record(name);
  await g.title("How to create a project", "Group tasks by what they are for.");
  await g.step(1, "In the menu, click **Projects**.", g.app.locator(".sidebar").getByRole("link", { name: "Projects" }), { after: 900 });
  await g.step(2, "Click **+ Project**.", g.app.getByRole("button", { name: "+ Project" }), { after: 900 });
  const form = g.app.locator(config.app.dialogSelector).last();
  await g.zoom(form, 1.4);
  await g.step(3, "Write the **name**. Example: Garden.", form.getByLabel("Name"), { act: () => g.type("Garden") });
  g.poster();
  await g.step(4, "Choose a **color**.", form.getByRole("button", { name: "Color 4" }), { after: 600 });
  await g.step(5, "Click **Save**.", form.getByRole("button", { name: "Save" }), { after: 300 });
  await g.reset();
  await g.hold(600);
  await g.show("Done! The new project is in the list.", [{ target: g.app.locator(".project").filter({ hasText: "Garden" }), label: "Your new project", side: "bottom" }], { hold: 2800 });
  await g.end("Project created!", "Choose it when you add a task.");
  await g.stop();
});

test.describe("phone", () => {
  test.use({ viewport: { width: config.video.phone.width, height: config.video.phone.height }, hasTouch: true, isMobile: true });
  video("09-phone-add-task", async (page, name) => {
    const g = await openGuide(page, { route: "/#today", device: "phone" });
    await g.record(name);
    await g.title("On the phone: add a task", "One tap on the + button.");
    await g.step(1, "Tap the **+** button.", g.app.locator(".bottom-nav").getByRole("button", { name: "New task" }), { after: 1000 });
    const form = g.app.locator(config.app.dialogSelector).last();
    await g.step(2, "Write the **title**.", form.getByLabel("Title"), { act: async () => { await g.type("Pay the electricity bill", 50); await g.app.evaluate(() => document.activeElement?.blur()); } });
    g.poster();
    await g.step(3, "Tap **Save**.", form.getByRole("button", { name: "Save" }), { after: 1400 });
    await g.end("Done!", "Add Tidy to your home screen to open it with one tap.");
    await g.stop();
  });
});
