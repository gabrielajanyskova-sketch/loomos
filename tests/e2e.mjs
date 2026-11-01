import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts =
  process.env.ARTIFACTS_DIR || path.join(root, ".local", "artifacts");
await fs.mkdir(artifacts, { recursive: true });
const temporary = await fs.mkdtemp(path.join(tmpdir(), "loomos-e2e-"));
const servers = [];
async function start(script, extra = {}) {
  const child = spawn("python3", [script], {
    cwd: root,
    env: { ...process.env, PORT: "0", ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servers.push(child);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server se nespustil.")),
      10000,
    );
    child.stdout.on("data", (chunk) => {
      const found = chunk.toString().match(/127\.0\.0\.1:(\d+)/);
      if (found) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${found[1]}`);
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Server skončil před startem."));
    });
  });
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {}),
  args: ["--no-sandbox"],
});
try {
  const staticUrl = await start("scripts/preview.py");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Prague",
  });
  const page = await context.newPage();
  const issues = [];
  const assetRequests = [];
  page.on("pageerror", (error) => issues.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(msg.text());
  });
  page.on("request", (request) => assetRequests.push(request.url()));
  await page.goto(staticUrl);
  await page.locator(".product-card").nth(5).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page
      .locator(".main-nav")
      .evaluate((el) => getComputedStyle(el).fontSize),
    "17px",
  );
  assert.equal(await page.locator(".product-card").count(), 6);
  await page
    .locator('[data-card-size="okurka-zazvor-mata"]')
    .selectOption("velka");
  assert.match(
    await page
      .locator(".product-card")
      .first()
      .locator("[data-card-price]")
      .textContent(),
    /349/,
  );
  await page.locator(".product-card").first().locator("[data-add]").click();
  await page
    .locator('[data-card-size="okurka-zazvor-mata"]')
    .selectOption("mala");
  await page.locator(".product-card").first().locator("[data-add]").click();
  await page.locator(".hero").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: path.join(artifacts, "homepage-desktop.png") });
  await page
    .locator("#svicky")
    .screenshot({ path: path.join(artifacts, "size-selection-desktop.png") });
  await page.goto(staticUrl + "/kosik");
  await page.locator(".cart-item").nth(1).waitFor();
  assert.match(await page.locator(".summary-total").textContent(), /598/);
  await page.reload();
  await page.locator(".cart-item").nth(1).waitFor();
  assert.equal(await page.locator(".cart-item").count(), 2);
  await page.goto(staticUrl + "/pokladna");
  await page.locator(".checkout-layout").waitFor();
  assert.equal(await page.locator("#checkout-form").count(), 0);
  assert.match(
    await page.locator("#checkout-content").textContent(),
    /Objednávky zatím připravujeme/,
  );
  await page.goto(staticUrl + "/admin/");
  assert.equal(await page.locator("#login-panel").isVisible(), false);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noJs.newPage();
  await plain.goto(staticUrl);
  assert.equal(await plain.locator(".product-card").count(), 6);
  assert.equal(await plain.locator("#otazky summary").count(), 5);
  await noJs.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const m = await mobile.newPage();
  m.on("pageerror", (error) => issues.push(error.message));
  for (const route of [
    "/",
    "/obchod",
    "/produkty/goji-cerveny-pomeranc",
    "/kosik",
    "/pokladna",
  ]) {
    await m.goto(staticUrl + route);
    await m.waitForTimeout(100);
    assert.equal(
      await m.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      route,
    );
  }
  await m.goto(staticUrl);
  await m.locator(".menu-toggle").click();
  assert.equal(
    await m.locator(".menu-toggle").getAttribute("aria-expanded"),
    "true",
  );
  assert.equal(
    await m
      .locator("#navigation a")
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize),
    "19px",
  );
  await m.keyboard.press("Escape");
  await m.locator("[data-card-size]").first().selectOption("velka");
  await m.locator("[data-add]").first().click();
  await m
    .locator("#svicky")
    .screenshot({ path: path.join(artifacts, "size-selection-mobile.png") });
  await m.goto(staticUrl + "/kosik");
  await m.locator(".cart-item").waitFor();
  assert.match(await m.locator(".cart-item .price").textContent(), /349/);
  assert.ok(
    !assetRequests.some(
      (url) =>
        url.includes("candle-editorial.png") ||
        url.endsWith(".ttf") ||
        url.includes("fonts.googleapis.com"),
    ),
  );
  assert.deepEqual(issues, []);
  await context.close();
  await mobile.close();
  // Source API remains independently usable with temporary data and private test credentials.
  const password = randomBytes(32).toString("hex");
  const apiUrl = await start("server.py", {
    LOOMOS_DATA_DIR: temporary,
    LOOMOS_ADMIN_PASSWORD: password,
  });
  const api = await browser.newContext();
  const a = await api.newPage();
  a.on("pageerror", (error) => issues.push(error.message));
  await a.goto(apiUrl + "/admin/");
  await a.locator('[name="password"]').fill(password);
  await a.locator("#login-form button").click();
  await a.locator(".stats").waitFor();
  await a.locator('[data-tab="products"]').click();
  await a.locator('[data-edit="okurka-zazvor-mata"]').click();
  await a.locator('[name="large_price"]').fill("359");
  await a.locator("#product-form button").click();
  await a.locator("#admin-status").filter({ hasText: "uložený" }).waitFor();
  await a.goto(apiUrl + "/");
  await a.locator("[data-card-size]").first().selectOption("velka");
  assert.match(
    await a.locator("[data-card-price]").first().textContent(),
    /359/,
  );
  await a.locator("[data-add]").first().click();
  await a.goto(apiUrl + "/pokladna");
  await a.locator('[name="name"]').fill("Testovací zákaznice");
  await a.locator('[name="email"]').fill("test@example.com");
  await a.locator('[name="phone"]').fill("123456789");
  await a.locator('[name="test_ack"]').check();
  await a.locator("#place-order").click();
  await a.locator(".success-panel").waitFor();
  assert.equal(await a.locator(".cart-count").textContent(), "0");
  await a.goto(apiUrl + "/admin/");
  await a.locator(".stats").waitFor();
  await a.locator('[data-tab="orders"]').click();
  await a.locator("[data-order]").click();
  assert.match(await a.locator("#admin-content .panel").textContent(), /Velká/);
  assert.match(await a.locator("#admin-content .panel").textContent(), /359/);
  assert.deepEqual(issues, []);
  await api.close();
  console.log(
    "PASS: static build, no-JS SEO, strict CSP, desktop/mobile sizes, cart, honest checkout, fonts/images, authenticated admin update and API order.",
  );
} finally {
  await browser.close();
  for (const child of servers) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit").catch(() => {});
      child.kill();
      await exited;
    }
  }
  await fs.rm(temporary, { recursive: true, force: true });
}
