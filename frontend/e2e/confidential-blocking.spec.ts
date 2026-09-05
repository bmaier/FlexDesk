import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test("Vertrauliche Raumblockierung: Absenden ohne Pflichtfelder ist blockiert", async ({ page }) => {
  await loginAs(page, "Herr Brandt");
  await page.getByRole("link", { name: "Vertrauliche Raumblockierung" }).click();
  await expect(page.getByText("VS-NFD | NUR FÜR DEN DIENSTGEBRAUCH")).toBeVisible();

  const holdButton = page.getByRole("button", { name: "Halten zum Blockieren" });
  await expect(holdButton).toBeDisabled();
});

test("Vertrauliche Raumblockierung: barrierefreie Doppelbestätigung ohne Long-Press", async ({ page }) => {
  await loginAs(page, "Herr Brandt");
  await page.getByRole("link", { name: "Vertrauliche Raumblockierung" }).click();

  await page.getByPlaceholder(/Detaillierte Begründung/).fill("Testfall Playwright — VS-NFD Vorbereitung");
  await page.getByLabel(/Ich bestätige die Notwendigkeit/).check();

  await page.getByRole("button", { name: "Alternative ohne Halten (Tastatur)" }).click();
  await page.getByRole("button", { name: "Ja, jetzt blockieren" }).click();

  await expect(page.getByText("Abgeschlossen. Der Vorgang wurde protokolliert.")).toBeVisible();
});
