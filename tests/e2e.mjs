/** Browser walk-through of the built site on Cloudflare Pages Functions (wrangler pages dev). */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startShop } from "./helpers/server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts =
  process.env.ARTIFACTS_DIR || path.join(root, ".local", "artifacts");
await fs.mkdir(artifacts, { recursive: true });
const shop = await startShop();
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {}),
  args: ["--no-sandbox"],
});
const issues = [];
const watch = (page) => {
  page.on("pageerror", (error) => issues.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(msg.text());
  });
};
try {
  const base = shop.url;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Prague",
  });
  const page = await context.newPage();
  watch(page);
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(base);
  await page.locator(".product-card").nth(3).waitFor();
  assert.equal(await page.locator(".product-card").count(), 7);
  // Wait until the catalog script has loaded (stock and member price are filled in).
  await page.locator(".product-card [data-add][data-label]").first().waitFor();
  assert.equal(await page.locator(".product-card .member-price").count(), 0);
  assert.match(await page.locator(".member-info").textContent(), /5 %/);
  await page
    .locator('[data-card-size="okurka-zazvor-mata"]')
    .selectOption("velka");
  const okurka = page.locator(".product-card", {
    has: page.locator('[data-card-size="okurka-zazvor-mata"]'),
  });
  await okurka.locator("[data-card-price]", { hasText: "449" }).waitFor();
  await okurka.locator("[data-add]").click();
  await page.screenshot({ path: path.join(artifacts, "home-desktop.png") });

  await page.goto(base + "/kosik");
  await page.locator(".cart-item").waitFor();
  assert.match(await page.locator(".summary-total").textContent(), /449/);
  assert.match(await page.locator(".member-hint").textContent(), /22/);
  // Below free shipping the cart suggests up to three products to add.
  assert.equal(await page.locator(".upsell-item").count(), 3);

  // Register from checkout and come back with the 5 % discount.
  await page.goto(base + "/ucet?navrat=pokladna");
  await page.fill("#register-form [name=name]", "Testovací Zákaznice");
  await page.fill("#register-form [name=email]", "e2e@example.com");
  await page.fill("#register-form [name=password]", "e2e-heslo-123");
  await page.check("#register-form [name=terms]");
  await page.click("#register-form button");
  await page.waitForURL(/pokladna/);
  await page.locator("#checkout-form").waitFor();
  assert.equal(await page.inputValue("[name=email]"), "e2e@example.com");
  assert.match(await page.locator(".summary-total").textContent(), /427/);
  await page.fill("[name=phone]", "777123456");
  await page.check("[name=terms]");
  assert.ok(await page.locator("[name=payment][value=card]").isDisabled());
  await page.click("#place-order");
  await page.locator(".success-panel .qr svg").waitFor();
  assert.match(
    await page.locator(".payment-details").textContent(),
    /CZ65 0800 0000 1920 0014 5399/,
  );
  await page.screenshot({
    path: path.join(artifacts, "order-success.png"),
    fullPage: true,
  });
  assert.equal(await page.locator(".cart-count").first().textContent(), "0");
  await page.goto(base + "/ucet");
  await page.locator(".order-list li").waitFor();

  // Legal pages and SEO without JavaScript.
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noJs.newPage();
  await plain.goto(base);
  assert.equal(await plain.locator(".product-card").count(), 7);
  assert.match(await plain.locator(".footer-legal").textContent(), /19616295/);
  await plain.goto(base + "/obchodni-podminky");
  assert.match(await plain.locator("h1").textContent(), /Obchodní/);
  await noJs.close();

  // Admin: mark paid, stock and codes.
  const adminPage = await context.newPage();
  watch(adminPage);
  await adminPage.goto(base + "/admin/");
  await adminPage.fill("#login-form [name=password]", shop.env.ADMIN_PASSWORD);
  await adminPage.click("#login-form button");
  await adminPage.locator(".stats").waitFor();
  await adminPage.click('[data-tab="orders"]');
  await adminPage.locator("[data-order]").first().click();
  await adminPage.selectOption("#status-form select", "zaplacena");
  await adminPage.click("#status-form button");
  await adminPage
    .locator("#admin-status")
    .filter({ hasText: "uložený" })
    .waitFor();
  await adminPage.click('[data-tab="stock"]');
  await adminPage.fill(".stock-input >> nth=0", "0");
  await adminPage.click("[data-save-stock] >> nth=0");
  await adminPage
    .locator("#admin-status")
    .filter({ hasText: "Sklad" })
    .waitFor();
  await adminPage.screenshot({
    path: path.join(artifacts, "admin-stock.png"),
    fullPage: true,
  });
  await page.goto(base + "/obchod");
  await page.locator(".product-card").first().waitFor();
  await page.waitForFunction(
    () => document.querySelector("[data-add]")?.disabled === true,
  );

  // Mobile layout never scrolls sideways.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const m = await mobile.newPage();
  watch(m);
  for (const route of [
    "/",
    "/obchod",
    "/produkty/zazvor-zeleny-caj",
    "/kosik",
    "/pokladna",
    "/ucet",
    "/obchodni-podminky",
    "/ochrana-osobnich-udaju",
  ]) {
    await m.goto(base + route);
    await m.waitForTimeout(150);
    assert.equal(
      await m.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      route,
    );
  }
  assert.ok(
    !requests.some(
      (url) =>
        url.includes("candle-editorial.png") ||
        url.endsWith(".ttf") ||
        url.includes("fonts.googleapis.com"),
    ),
  );
  assert.deepEqual(issues, []);
  console.log(
    "PASS: catalog, member pricing, registration, checkout with QR, legal pages, admin status/stock, mobile layout.",
  );
} finally {
  await browser.close();
  await shop.stop();
}
