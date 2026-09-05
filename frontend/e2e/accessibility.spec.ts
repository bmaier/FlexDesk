import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test("Skip-Link ist der erste Tab-Stopp (WCAG 2.4.1)", async ({ page }) => {
  await loginAs(page, "Ali Yilmaz");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Zum Hauptinhalt springen" })).toBeFocused();
});

test("Fokus-Ring ist auf Formularelementen sichtbar", async ({ page }) => {
  await loginAs(page, "Ali Yilmaz");
  const search = page.getByPlaceholder("Suche nach Desk, Team oder Raum...");
  await search.focus();
  await expect(search).toBeFocused();
});
