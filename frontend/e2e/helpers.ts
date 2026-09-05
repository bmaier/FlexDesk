import { Page, expect } from "@playwright/test";

export async function loginAs(page: Page, displayName: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(displayName) }).click();
  await expect(page).toHaveURL(/\/schnellbuchung/);
}
