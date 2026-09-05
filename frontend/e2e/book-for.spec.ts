import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test("Im Namen von agieren: Vertretung ohne Berechtigung zeigt Empty State", async ({ page }) => {
  await loginAs(page, "Frau Kessler"); // hat keine Vertretungsberechtigung
  await page.getByRole("link", { name: "Im Namen von agieren" }).click();
  await expect(page.getByText("Keine Vertretungsberechtigung", { exact: true })).toBeVisible();
});

test("Im Namen von agieren: Team-Assistenz agiert für Kolleg:in und kehrt zurück", async ({ page }) => {
  await loginAs(page, "Frau Kaya");
  await page.getByRole("link", { name: "Im Namen von agieren" }).click();
  await page.getByRole("button", { name: /Hans Müller/ }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Schnellbuchung");
  await expect(page.getByText(/Sie agieren gerade im Namen von.*Hans Müller/)).toBeVisible();

  await page.getByRole("button", { name: "Zurück zu mir selbst" }).click();
  await expect(page.getByText(/Sie agieren gerade im Namen von/)).not.toBeVisible();
});
