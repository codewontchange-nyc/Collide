import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "e2e-out";
mkdirSync(OUT, { recursive: true });

async function noOverflow(page: Page) {
  const width = page.viewportSize()?.width ?? 375;
  const widths = await page.evaluate(() => [
    document.scrollingElement?.scrollWidth ?? 0,
    document.querySelector("main")?.scrollWidth ?? 0,
  ]);
  for (const w of widths) expect(w).toBeLessThanOrEqual(width);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await noOverflow(page);
}

async function poolBalance(page: Page): Promise<number> {
  await page.getByRole("link", { name: "Budget" }).click();
  const el = page.getByTestId("pool-balance");
  await expect(el).toBeVisible();
  await page.waitForTimeout(1100); // let the count-up settle
  return Number((await el.innerText()).replace(/[^0-9-]/g, ""));
}

test("tour, tabs, request and match, advance month, pwa", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Colony" })).toBeVisible();
  await shot(page, "00-welcome");

  await page.getByRole("button", { name: /^Tour / }).click();
  await expect(page.getByRole("heading", { name: "Your colony this week" })).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "01-home");

  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page.getByRole("heading", { name: "One budget, well kept" })).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, "02-budget");
  const before = await poolBalance(page);
  expect(before).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Needs" }).click();
  await expect(page.getByRole("heading", { name: "Needs" })).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "03-needs");

  await page.getByRole("button", { name: "Request something" }).click();
  await expect(page.getByRole("heading", { name: "What does the colony need?" })).toBeVisible();
  await page.getByRole("button", { name: "Plumbing", exact: true }).click();
  await page.getByRole("button", { name: "Kitchen faucet drips", exact: true }).click();
  await shot(page, "04-request");
  await page.getByRole("button", { name: "Find someone" }).click();
  await expect(page.getByRole("heading", { name: "A few people who fit" })).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(600);
  const cards = page.locator(".ig-sheet__body .ig-card[aria-pressed]");
  await expect(cards).toHaveCount(3);
  await shot(page, "05-match");
  await page.getByRole("button", { name: /^Book / }).click();
  await expect(page.getByRole("heading", { name: "A few people who fit" })).toBeHidden();
  await expect(page.getByText("Kitchen faucet drips").first()).toBeVisible();

  const after = await poolBalance(page);
  expect(after).toBeLessThan(before);

  await page.getByRole("link", { name: "Colony" }).click();
  await expect(page.getByText("Smart matched")).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "06-colony");

  await page.getByRole("link", { name: "You" }).click();
  await expect(page.getByText("Membership")).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "07-you");

  await page.getByRole("button", { name: "Advance a month" }).first().click();
  await expect(page.getByRole("heading", { name: /^Close / })).toBeVisible();
  await page.getByRole("button", { name: "Close the month", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Welcome to / })).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, "08-advance");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const next = await poolBalance(page);
  expect(next).toBeGreaterThan(after);

  await page.getByRole("link", { name: "You" }).click();
  await page.getByRole("button", { name: /Open provider view/ }).click();
  await expect(page.getByRole("heading", { name: /^Today, / })).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "09-provider");

  // PWA: manifest link present, service worker controlling after reload.
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Today, / })).toBeVisible();
  const controlled = await page.evaluate(() => !!navigator.serviceWorker?.controller);
  expect(controlled).toBe(true);
});

test("onboarding creates a fresh colony", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Start your own colony" }).click();
  await expect(page.getByRole("heading", { name: "Name your colony" })).toBeVisible();
  await page.getByPlaceholder("Dekalb & Bergen").fill("Myrtle & Vanderbilt");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Invite your tribe" })).toBeVisible();
  const first = page.locator(".card").first();
  await first.getByPlaceholder("Street, like Dekalb Ave").fill("Myrtle Ave");
  await first.getByPlaceholder("You, or the first person").fill("Ada");
  await first.getByPlaceholder("Second person").fill("Ben");
  const second = page.locator(".card").nth(1);
  await second.getByPlaceholder("Street, like Dekalb Ave").fill("Vanderbilt Ave");
  await second.getByPlaceholder("You, or the first person").fill("Cleo");
  await second.getByPlaceholder("Second person").fill("Dev");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Bring your current team" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set the budget" })).toBeVisible();
  await expect(page.getByText("$4,000")).toBeVisible();
  await shot(page, "10-start-budget");
  await page.getByRole("button", { name: /^Create / }).click();
  await expect(page.getByRole("heading", { name: "Your colony this week" })).toBeVisible();
  await expect(page.getByText("Myrtle & Vanderbilt")).toBeVisible();
  await shot(page, "11-fresh-home");
});
