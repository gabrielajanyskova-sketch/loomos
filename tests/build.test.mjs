import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
execFileSync(process.execPath, ["scripts/build.mjs"], {
  cwd: root,
  env: { ...process.env, SITE_INDEXABLE: "0", SITE_URL: "https://loomos.cz" },
});
const read = (file) =>
  readFileSync(new URL("../dist/" + file, import.meta.url), "utf8");
test("public build includes searchable HTML and exactly four selectable cards", () => {
  const home = read("index.html");
  assert.equal((home.match(/class="product-card"/g) || []).length, 4);
  assert.equal((home.match(/data-card-size=/g) || []).length, 4);
  assert.match(home, /Okurka, zázvor a máta/);
  assert.match(home, /FAQPage/);
  assert.match(home, /imagesrcset=/);
  assert.match(home, /favicon-48\.png/);
  assert.ok(!home.includes("candle-editorial.png"));
  assert.match(home, /name="robots" content="noindex,follow"/);
  const detail = read("produkty/okurka-zazvor-mata.html");
  assert.match(detail, /<h1>Okurka, zázvor a máta<\/h1>/);
  assert.match(detail, /BreadcrumbList/);
  assert.match(detail, /"@type":"Product"/);
});
test("deployment output never contains source, database, tests, secrets or old images", () => {
  for (const path of [
    "server.py",
    "tests",
    "scripts",
    "package.json",
    "node_modules",
    ".local",
    ".env",
    "assets/img/candle-editorial.png",
    "assets/fonts/dm-sans.ttf",
  ])
    assert.equal(
      existsSync(new URL("../dist/" + path, import.meta.url)),
      false,
      path,
    );
  assert.ok(
    !readdirSync(new URL("../dist/produkty", import.meta.url)).includes(
      "_sablona.html",
    ),
  );
  assert.match(read("_headers"), /frame-ancestors 'none'/);
  // Only checkout allows inline styles (the Packeta widget sets style attributes); never inline scripts.
  const headers = read("_headers");
  assert.ok(!headers.split("/pokladna*")[0].includes("unsafe-inline"));
  assert.ok(!/script-src[^;]*unsafe-inline/.test(headers));
  assert.match(read("_headers"), /X-Robots-Tag: noindex/);
});
test("sitemap points only to real indexable content routes on the future domain", () => {
  const xml = read("sitemap.xml");
  assert.equal((xml.match(/<loc>/g) || []).length, 11);
  assert.match(xml, /https:\/\/loomos.cz\/lapace-slunce</);
  assert.ok(!xml.includes("ucet") && !xml.includes("objednavka"));
  assert.ok(!xml.includes("kosik"));
  assert.ok(!xml.includes("pages.dev"));
  assert.match(xml, /https:\/\/loomos.cz\/produkty\/zazvor-zeleny-caj/);
  const manifest = JSON.parse(read("site.webmanifest"));
  assert.equal(manifest.icons.length, 2);
  assert.equal(manifest.name, "LOOMOS");
});
