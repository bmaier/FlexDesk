import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test("Flow 4: Meetingraum-Anfrage und Genehmigung end-to-end", async ({ page }) => {
  await loginAs(page, "Herr Demir");
  await page.getByRole("link", { name: "Meetingräume" }).click();
  await expect(page.getByRole("heading", { name: "Meetingräume" })).toBeVisible();

  await page.getByRole("combobox").selectOption({ label: "Nürnberg Zentrale" });
  const card = page.locator('[data-room-name="Konferenzraum A"]');
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Anfragen" }).click();

  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText(/Anfrage gesendet/)).toBeVisible();
  await page.getByTestId("modal-backdrop").click({ position: { x: 5, y: 5 } });

  await page.getByRole("button", { name: "Wechseln" }).click();
  await loginAs(page, "Frau Ostermann");
  await page.getByRole("link", { name: "Genehmigungscenter" }).click();
  await expect(page.getByRole("heading", { name: "Genehmigungscenter" })).toBeVisible();
  await expect(page.getByText("Herr Demir")).toBeVisible();

  await page.getByRole("button", { name: "Genehmigen" }).first().click();
});
