import { expect, test } from "@playwright/test";

const PDF = Buffer.from("%PDF-1.7\n% end-to-end test file\n");
const DOCUMENTS = ["Sales invoices", "Purchase invoices", "Bank statement", "TDS challans"];

test("a firm signs up, chases a client, and the client uploads everything", async ({ page, browser }, testInfo) => {
  const unique = `${Date.now()}-${testInfo.project.name}`;
  const clientName = `Coastal Spices ${unique}`;

  await page.goto("/signup");
  await page.getByLabel("Firm name").fill("Kamat & Associates");
  await page.getByLabel("Your name").fill("Asha Kamat");
  await page.getByLabel("Work email").fill(`asha-${unique}@example.com`);
  await page.getByLabel("Password").fill("a-long-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Start chasing in two steps" })).toBeVisible();

  await page.goto("/app/clients/new");
  await page.getByLabel("Client name").fill(clientName);
  await page.getByLabel("Email", { exact: true }).fill(`accounts-${unique}@example.com`);
  await page.getByLabel("Send reminders by").selectOption("email");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("link", { name: clientName })).toBeVisible();

  await page.goto("/app");
  await page.getByRole("button", { name: /^Open requests for / }).click();
  await expect(page.getByRole("link", { name: clientName, exact: true })).toBeVisible();
  await expect(page.getByText("0 of 1")).toBeVisible();
  await expect(page.getByText(/Test mode/)).toBeVisible();

  // The reminder that would have been sent is in the activity log, with the client's link.
  await page.goto("/app/activity");
  await page.getByText(clientName, { exact: true }).click();
  const message = await page.locator("pre").first().innerText();
  expect(message).toContain("- Sales invoices");
  const link = message.match(/\/u\/[\w-]+\.[\w-]+/)?.[0];
  expect(link).toBeTruthy();

  // The client opens the link on their own device, with no account.
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(link!);
  await expect(clientPage.getByRole("heading", { level: 1 })).toContainText(clientName);
  await expect(clientPage.getByText(/4 of 4 still needed/)).toBeVisible();
  for (const [index, name] of DOCUMENTS.entries()) {
    await clientPage.getByLabel(`Upload ${name}`).setInputFiles({ name: `${name}.pdf`, mimeType: "application/pdf", buffer: PDF });
    await expect(clientPage.getByText("Received", { exact: true })).toHaveCount(index + 1);
  }
  await expect(clientPage.getByText(/All done/)).toBeVisible();

  // A file that isn't a document is refused with a plain message.
  await clientPage.getByLabel("Upload Bank statement").setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: PDF });
  await expect(clientPage.getByText("Please send a PDF, a photo, or an Excel or CSV file.")).toBeVisible();
  await clientContext.close();

  // Back at the firm: everything is in, and the files download as a ZIP.
  await page.goto("/app");
  await expect(page.getByText("1 of 1")).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();
  const zipHref = await page.getByRole("link", { name: /as a ZIP$/ }).getAttribute("href");
  const zip = await page.request.get(zipHref!);
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
});

test("private pages and files need a signed-in member", async ({ page, request }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/files/3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0c3a")).status()).toBe(401);
  expect((await request.get("/api/export?client=3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0c3a&period=3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0c3a")).status()).toBe(401);
  expect((await request.post("/api/cron/reminders")).status()).toBe(401);
});

test("a wrong password is refused and a made-up upload link shows as expired", async ({ page }, testInfo) => {
  await page.goto("/login");
  // A fresh address each run, so the sign-in throttle from earlier runs doesn't apply.
  await page.getByLabel("Email").fill(`nobody-${Date.now()}-${testInfo.project.name}@example.com`);
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();

  await page.goto("/u/not-a-real-link");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
});
