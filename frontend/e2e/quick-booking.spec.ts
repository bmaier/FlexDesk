import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test("UJ-1: Ali Yilmaz bucht seinen Stammtisch in wenigen Klicks", async ({ page }) => {
  await loginAs(page, "Ali Yilmaz");
  await expect(page.getByRole("heading", { name: "Schnellbuchung" })).toBeVisible();

  const heroButton = page.getByRole("button", { name: /Gewohnten Platz buchen|Heute bereits belegt/ });
  await expect(heroButton.first()).toBeVisible();
});

test("Rollen-Sichtbarkeit: Mitarbeiter ohne Sonderrolle sieht keinen Verwaltungsbereich", async ({ page }) => {
  await loginAs(page, "Ali Yilmaz");
  await expect(page.getByRole("link", { name: "Facility-Management" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Genehmigungscenter" })).toHaveCount(0);
});

test("Rollen-Sichtbarkeit: FM-Rolle sieht Verwaltungsbereich", async ({ page }) => {
  await loginAs(page, "Dr. Maria Schmidt");
  await expect(page.getByRole("link", { name: "Facility-Management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genehmigungscenter" })).toBeVisible();
});
