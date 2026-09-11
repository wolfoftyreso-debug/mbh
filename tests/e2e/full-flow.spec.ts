import { test, expect, type Page, type Browser } from "@playwright/test";

const PASSWORD = "humanauth-demo";
const TITLE = `E2E rewrite ${Date.now()}`;

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/sign-in");
  // Wait for hydration so the dev login form is handled by React, not a native submit.
  // A cold dev server compiles the page on first request; allow generous time for hydration.
  await page.locator('form[data-ready="true"]').waitFor({ timeout: 180_000 });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
  // The test asserts English copy; pin the account locale regardless of earlier choices.
  await page.goto("/api/locale?l=en&next=/dashboard");
  await page.waitForURL(/\/dashboard/);
  return page;
}

test("customer commissions, professional delivers and signs, customer approves and publishes the record", async ({ browser }) => {
  const customer = await signIn(browser, "customer@example.com");
  await expect(customer.getByRole("heading", { name: /Hello, Erik/ })).toBeVisible();

  // 1. Create an assignment through the wizard
  await customer.goto("/assignments/new");
  await customer.getByRole("button", { name: /Rewrite, edit or write from material/ }).click();
  await customer.getByLabel("Title").fill(TITLE);
  await customer.getByLabel(/Describe the assignment/).fill("Please rewrite our DSG servicing notes into professional Swedish.");
  await customer.getByLabel(/Source text/).fill("byt olja i dsg lådan var 6000 mil annars går mekatroniken sönder");
  await customer.getByRole("button", { name: "Continue" }).click();
  await expect(customer.getByText("Recommended competence")).toBeVisible();
  await customer.getByRole("button", { name: "Continue" }).click();
  await customer.getByRole("button", { name: "Publish assignment" }).click();
  await customer.waitForURL(/\/assignments\/[A-Z0-9]{20}$/);
  const assignmentUrl = customer.url();
  await expect(customer.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(customer.getByText("Open for offers").first()).toBeVisible();

  // 2. Invite Eva from the suggested professionals
  const evaCard = customer.locator("article", { hasText: "Eva Svensson" }).first();
  await expect(evaCard).toBeVisible();
  await evaCard.getByRole("button", { name: "Invite" }).click();
  await expect(evaCard.getByText("Invited")).toBeVisible();

  // 3. Eva makes an offer
  const eva = await signIn(browser, "eva@example.com");
  await eva.goto(assignmentUrl);
  await expect(eva.getByText("You were invited")).toBeVisible();
  await eva.getByLabel(/Total price/).fill("4500");
  await eva.getByLabel("Message").fill("Happy to take this on.");
  await eva.getByRole("button", { name: "Send offer" }).click();
  await expect(eva.getByText("Your offer was sent.")).toBeVisible();

  // 4. Customer accepts and pays (manual provider)
  await customer.reload();
  await customer.getByRole("button", { name: "Accept" }).click();
  await expect(customer.getByText("Accepted", { exact: true }).first()).toBeVisible();
  await customer.getByRole("button", { name: /^Pay / }).click();
  await customer.getByRole("button", { name: /Confirm payment received/ }).click();
  await expect(customer.getByText("In progress").first()).toBeVisible();

  // 5. Eva delivers a version
  await eva.reload();
  await expect(eva.getByText("In progress").first()).toBeVisible();
  await eva.getByRole("button", { name: "New version" }).click();
  await eva.getByPlaceholder(/Label/).fill("Professional rewrite");
  await eva.getByPlaceholder(/Paste or write the full text/).fill("Byt olja i DSG-lådan var 6 000 mil, annars riskerar mekatroniken att skadas.");
  await eva.getByRole("button", { name: "Deliver version" }).click();
  await expect(eva.getByText("Delivered", { exact: true }).first()).toBeVisible();
  await expect(eva.getByText(/V2/).first()).toBeVisible();

  // 6. Customer requests final sign-off
  await customer.reload();
  await customer.getByRole("button", { name: /request final sign-off/ }).click();
  await expect(customer.getByText("Final review").first()).toBeVisible();

  // 7. Eva signs in the ceremony
  await eva.reload();
  await eva.getByRole("link", { name: "Final human sign-off" }).click();
  await eva.waitForURL(/\/sign\//);
  await expect(eva.getByRole("heading", { name: "Final human sign-off" })).toBeVisible();
  await eva.getByRole("checkbox").check();
  await eva.getByLabel(/Type/).fill("SIGN");
  await eva.getByRole("button", { name: "Sign this version" }).click();
  await expect(eva.getByText("Signed", { exact: true }).first()).toBeVisible();
  await eva.waitForURL(/\/assignments\/[A-Z0-9]{20}/, { timeout: 30_000 });

  // 8. Customer approves; assignment completes (payment captured) and can be rated
  await customer.reload();
  await customer.getByRole("button", { name: "Approve signed version" }).click();
  await expect(customer.getByText("Completed", { exact: true }).first()).toBeVisible();
  await expect(customer.getByText("Rate the work")).toBeVisible();
  await customer.getByRole("button", { name: "Submit review" }).click();
  await expect(customer.getByText(/your verified review was recorded/)).toBeVisible();

  // 9. Customer publishes the record
  await customer.getByRole("button", { name: "Publication settings" }).click();
  await customer.getByLabel("Visibility").selectOption("PUBLIC");
  await customer.getByLabel(/Show the work title/).check();
  await customer.getByLabel(/Show the content fingerprint/).check();
  await customer.getByRole("button", { name: "Save record settings" }).click();
  await expect(customer.getByText("Saved.")).toBeVisible();
  const recordLink = customer.getByRole("link", { name: "view public page" });
  await expect(recordLink).toBeVisible();
  const recordHref = await recordLink.getAttribute("href");
  expect(recordHref).toMatch(/^\/record\/HA-/);

  // 10. Anonymous visitor sees the public record and the embed
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(recordHref!);
  await expect(anon.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(anon.getByText("Written by")).toBeVisible();
  await expect(anon.getByText("Eva Svensson")).toBeVisible();
  await expect(anon.getByText("VALID")).toBeVisible();
  const embed = await anon.request.get(`/embed/${recordHref!.split("/").pop()}?format=json`);
  expect(embed.ok()).toBeTruthy();
  expect((await embed.json()).professionalName).toBe("Eva Svensson");

  // Anonymous cannot open the workspace
  await anon.goto(assignmentUrl);
  await anon.waitForURL(/\/sign-in/);
});
