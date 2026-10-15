import { blur, center, config, dialog, expect, mark, open, row, shot, test, unmark } from "./support.mjs";

// The pictures of the help center, on the desktop. One test per tutorial of
// content.mjs; one picture per block, named like its `image`; the marks carry
// the numbers of that block's steps (build.mjs checks them). Forms are filled
// with the example values the text mentions.

test("add-item", async ({ page }) => {
  await open(page, "/items");
  const add = page.getByRole("button", { name: "New item" });
  await mark(page, [
    { target: page.getByRole("link", { name: "Items" }), n: 1 },
    { target: add, n: 2, label: "Click + New item", side: "bottom" },
  ]);
  await shot(page, "add-item-1-button");
  await unmark(page);

  await add.click();
  const form = await dialog(page);
  await form.getByLabel("Name").fill("Garden hose");
  await blur(page);
  // A button found by an internal selector (type=, name=, data-, a class)
  // still works after its label changes: `name` checks the label the step
  // names in bold, so a rename fails here instead of slipping into the help.
  const save = form.locator("button[type=submit]");
  await mark(page, [
    { target: row(form, "Name"), n: 3 },
    { target: save, n: 4, name: "Save" },
    { target: form.getByRole("button", { name: "Save and add another" }), n: "A" },
  ]);
  // Small forms are cropped (with every mark) so they stay readable.
  await shot(page, "add-item-2-form", { crop: "dialog" });
  await unmark(page);

  await save.click();
  await expect(page.locator(config.app.dialogSelector)).toHaveCount(0);
  const created = page.getByText("Garden hose").first();
  await center(created);
  await mark(page, [{ target: created, label: "Your new item", side: "right" }]);
  await shot(page, "add-item-3-done");
});
