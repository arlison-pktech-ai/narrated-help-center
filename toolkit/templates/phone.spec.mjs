import { blur, dialog, mark, open, shot, test, unmark } from "./support.mjs";

// The pictures of the phone section (PHONE in content.mjs), 390 × 844.

test("phone", async ({ page }) => {
  await open(page, "/items");
  await mark(page, [
    { target: page.getByRole("navigation").getByRole("link", { name: "Items" }), n: 1 },
    { target: page.getByRole("button", { name: "New item" }), n: 2, label: "Add", side: "top" },
  ]);
  await shot(page, "phone-1-bar");
  await unmark(page);

  await page.getByRole("button", { name: "New item" }).click();
  const form = await dialog(page);
  await form.getByLabel("Name").fill("Garden hose");
  await blur(page);
  await mark(page, [{ target: form.getByRole("button", { name: "Save", exact: true }), n: 1, label: "Save", side: "top" }]);
  await shot(page, "phone-2-form");
});
