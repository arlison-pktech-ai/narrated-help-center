import { blur, dialog, mark, open, shot, test, unmark } from "./support.mjs";

// The pictures of the phone section (PHONE in content.mjs), 390 × 844.

test("phone", async ({ page }) => {
  await open(page, "/#today");
  const bar = page.locator(".bottom-nav");
  await mark(page, [
    { target: bar.getByRole("link", { name: "Today" }), n: 1 },
    { target: bar.getByRole("link", { name: "Projects" }), n: 2 },
    { target: bar.getByRole("button", { name: "New task" }), n: 3 },
    { target: bar.getByRole("link", { name: "Settings" }), n: 4 },
  ]);
  await shot(page, "phone-1-bar");
  await unmark(page);

  await bar.getByRole("button", { name: "New task" }).click();
  const form = await dialog(page);
  await form.getByLabel("Title").fill("Pay the electricity bill");
  await blur(page);
  await mark(page, [{ target: form.getByRole("button", { name: "Save" }), n: 1, label: "Save", side: "top" }]);
  await shot(page, "phone-2-form");
});
