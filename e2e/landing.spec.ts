import { expect, test } from "@playwright/test";

test("health check responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("landing page shows the pitch, pricing and FAQ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stop chasing clients for documents.");
  await expect(page.getByRole("heading", { name: "Simple monthly pricing" })).toBeVisible();
  await expect(page.getByText("₹999", { exact: true })).toBeVisible();
  await expect(page.getByText("₹2,999", { exact: true })).toBeVisible();

  const faq = page.getByText("Do my clients need to install anything?");
  await faq.click();
  await expect(page.getByText(/opens in their phone's browser/)).toBeVisible();
});

test("page has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
