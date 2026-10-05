import { blur, center, config, dialog, expect, mark, open, row, shot, test, unmark } from "./support.mjs";

// The pictures of Tidy's help, on the desktop. One test per tutorial of
// content.mjs; one picture per block; the marks carry the block's numbers.

test("add-task", async ({ page }) => {
  await open(page, "/#today");
  const add = page.locator(".sidebar [data-action=new-task]");
  await mark(page, [{ target: add, n: 1, label: "Click + New task", side: "right" }]);
  await shot(page, "add-task-1-button");
  await unmark(page);

  await add.click();
  const form = await dialog(page);
  await form.getByLabel("Title").fill("Pay the electricity bill");
  await form.getByLabel("Project").selectOption({ label: "Home" });
  await form.getByLabel("Due date").fill("2026-03-12");
  await form.getByRole("button", { name: "High" }).click();
  await form.getByLabel("Remind me").check();
  await blur(page);
  await mark(page, [
    { target: row(form, "Title"), n: 2 },
    { target: row(form, "Project"), n: 3 },
    { target: row(form, "Due date"), n: 4 },
    { target: row(form, "Priority"), n: 5 },
    { target: row(form, "Remind me"), n: 6 },
    { target: row(form, "Notes"), n: "A" },
    { target: form.getByRole("button", { name: "Save" }), n: 7 },
  ]);
  await shot(page, "add-task-2-form", { crop: "dialog" });
  await unmark(page);

  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(config.app.dialogSelector)).toHaveCount(0);
  const created = page.locator(".task").filter({ hasText: "Pay the electricity bill" });
  await center(created);
  await mark(page, [{ target: created, label: "Your new task", side: "bottom" }]);
  await shot(page, "add-task-3-done");
});

test("edit-task", async ({ page }) => {
  await open(page, "/#today");
  const task = page.locator(".task").filter({ hasText: "Send the weekly report" });
  const dots = task.getByRole("button", { name: /More actions/ });
  await mark(page, [{ target: dots, n: 1, label: "Click the three dots", side: "bottom" }]);
  await shot(page, "edit-task-1-row");
  await unmark(page);

  await dots.click();
  const menu = page.getByRole("menu");
  await mark(page, [
    { target: menu.getByRole("menuitem", { name: "Edit" }), n: 2 },
    { target: menu.getByRole("menuitem", { name: "Duplicate" }), n: "A" },
    { target: menu.getByRole("menuitem", { name: "Delete" }), n: "B" },
  ]);
  await shot(page, "edit-task-2-menu", { crop: menu, margin: 60 });
  await unmark(page);

  await menu.getByRole("menuitem", { name: "Edit" }).click();
  const form = await dialog(page);
  await mark(page, [
    { target: form.getByRole("button", { name: "Save" }), n: 3 },
    { target: form.getByRole("button", { name: "Delete" }), n: 4 },
  ]);
  await shot(page, "edit-task-3-form", { crop: "dialog" });
  await unmark(page);
  await form.getByRole("button", { name: "Cancel" }).click();

  const box = page.locator(".task").filter({ hasText: "Renew passport" }).getByRole("checkbox");
  await mark(page, [{ target: box, n: 1, label: "Click the box", side: "right" }]);
  await shot(page, "edit-task-4-done", { crop: page.locator(".panel").first() });
});

test("add-project", async ({ page }) => {
  await open(page, "/#projects");
  const add = page.getByRole("button", { name: "+ Project" });
  await mark(page, [
    { target: page.locator(".sidebar").getByRole("link", { name: "Projects" }), n: 1 },
    { target: add, n: 2, label: "Click + Project", side: "bottom" },
  ]);
  await shot(page, "project-1-button");
  await unmark(page);

  await add.click();
  const form = await dialog(page);
  await form.getByLabel("Name").fill("Garden");
  await form.getByRole("button", { name: "Color 4" }).click();
  await blur(page);
  await mark(page, [
    { target: row(form, "Name"), n: 3 },
    { target: row(form, "Color"), n: 4 },
    { target: form.getByRole("button", { name: "Save" }), n: 5 },
  ]);
  await shot(page, "project-2-form", { crop: "dialog" });
});

test("settings", async ({ page }) => {
  await open(page, "/#settings");
  await mark(page, [
    { target: page.locator(".sidebar").getByRole("link", { name: "Settings" }), n: 1 },
    { target: page.getByRole("group", { name: "Theme" }), n: 2 },
    { target: page.getByRole("switch", { name: "Reminders" }), n: 3 },
    { target: page.getByRole("button", { name: "Export" }), n: 4 },
  ]);
  await shot(page, "settings-1");
});

test("screens", async ({ page }) => {
  await open(page, "/#today");
  const panels = page.locator("main .panel");
  await mark(page, [
    { target: panels.nth(0), n: 1 },
    { target: panels.nth(1), n: 2 },
    { target: page.getByRole("searchbox", { name: "Search tasks" }), n: 3 },
  ]);
  await shot(page, "screen-today");
});
