import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCart, validateCatalog, isCandle } from "../assets/js/catalog.mjs";
import {
  builtinPhotos,
  productCard,
  renderProductDetail,
  esc,
} from "../assets/js/ui.mjs";
import { metadata } from "../scripts/seo.mjs";

const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url)),
);
test("seven scents on sale (more in Dílnička only) and separate size prices are validated", () => {
  const candles = validateCatalog(products).filter(
    (p) => p.category !== "lapace-slunce",
  );
  assert.equal(candles.length, 9);
  assert.equal(candles.filter((p) => p.active).length, 7);
  for (const p of candles) {
    assert.deepEqual(
      p.variants.map((v) => v.id),
      ["mala", "velka"],
    );
    assert.deepEqual(
      p.variants.map((v) => v.price),
      [349, 449],
    );
  }
  assert.throws(() =>
    validateCatalog([{ ...products[0], id: '" onmouseover="alert(1)' }]),
  );
  assert.throws(() =>
    validateCatalog([
      { ...products[0], variants: [{ id: "mala", name: "Malá", price: -1 }] },
    ]),
  );
});
test("cart rejects injected IDs and unknown variants; duplicate quantities are capped", () => {
  const cart = readCart(
    JSON.stringify([
      { id: products[0].id, variant: "mala", qty: 15 },
      { id: products[0].id, variant: "mala", qty: 15 },
      { id: products[0].id, variant: "velka", qty: 1 },
      { id: products[0].id, variant: "tampered", qty: 1 },
      { id: "<script>", qty: 1 },
      { id: products[0].id, qty: true },
    ]),
  );
  assert.deepEqual(cart, [
    { id: products[0].id, variant: "mala", qty: 20 },
    { id: products[0].id, variant: "velka", qty: 1 },
  ]);
});
test("home card and detail expose both sizes with escaped product text", () => {
  const p = { ...products[0], name: "<img src=x onerror=alert(1)>" };
  const card = productCard(p, 0);
  assert.match(card, /data-card-size/);
  assert.match(card, /value="velka"/);
  assert.match(card, /&lt;img/);
  assert.ok(!card.includes("<img src=x"));
  assert.match(renderProductDetail(p), /id="size-choice"/);
  assert.equal(esc("<>&\"'"), "&lt;&gt;&amp;&quot;&#39;");
});
test("SEO uses final canonical without fictional offers and keeps preview noindex", () => {
  const meta = metadata({
    page: "product",
    product: products[0],
    siteUrl: "https://loomos.cz",
    indexable: false,
    file: `produkty/${products[0].id}.html`,
    products,
  });
  assert.equal(meta.canonical, `https://loomos.cz/produkty/${products[0].id}`);
  assert.equal(meta.robots, "noindex,follow");
  const graph = JSON.parse(meta.json)["@graph"];
  const p = graph.find((x) => x["@type"] === "Product");
  assert.ok(p);
  assert.equal(p.offers, undefined);
  assert.equal(p.aggregateRating, undefined);
});
test("JSON-LD cannot break out of its non-executable script", () => {
  const meta = metadata({
    page: "product",
    product: {
      ...products[0],
      description: "</script><script>alert(1)</script>",
    },
    siteUrl: "https://loomos.cz",
    indexable: true,
    file: "produkty/test.html",
    products,
  });
  assert.ok(!meta.json.includes("</script>"));
  assert.equal(
    JSON.parse(meta.json)["@graph"].find((x) => x["@type"] === "Product")
      .description,
    "</script><script>alert(1)</script>",
  );
});

test("eighteen sun catchers (own motifs only) (199 Kč, 175 Kč from 2 pieces) render without wax claims; unpriced ones cannot be bought", () => {
  const catchers = validateCatalog(products).filter(
    (p) => p.category === "lapace-slunce",
  );
  assert.equal(catchers.length, 18);
  // Licensed characters must never be offered (copyright and trademarks).
  assert.ok(
    !catchers.some((p) =>
      /rubble|chase|marshall|skye|zuma|peppa|bing|stitch|mario|pikachu/i.test(
        p.id + p.name,
      ),
    ),
  );
  for (const p of catchers) {
    // Every motif belongs to at least one theme of the filter on /lapace-slunce.
    assert.ok(p.themes?.length, `${p.id} has no theme`);
    assert.equal(p.price, 199);
    assert.deepEqual(p.bulk, { min_qty: 2, price: 175 });
    const html = productCard(p, 0) + renderProductDetail(p);
    // The size is shown only when it is filled in (each motif has its own).
    if (p.size) assert.ok(html.includes(`Velikost ${p.size}`));
    else assert.doesNotMatch(html, /Velikost/);
    assert.match(html, /175/);
    const unpriced = { ...p, price: null, bulk: undefined };
    const pending = productCard(unpriced, 0) + renderProductDetail(unpriced);
    assert.match(pending, /disabled/);
    assert.match(pending, /Cenu připravuji/);
    assert.doesNotMatch(
      html,
      /0 Kč|Sójový vosk|Dřevěný knot|member-price|Vonné tóny|candle-/i,
    );
    const meta = metadata({
      page: "product",
      product: p,
      siteUrl: "https://loomos.cz",
      indexable: false,
      file: `produkty/${p.id}.html`,
      products,
    });
    const schema = JSON.parse(meta.json)["@graph"].find(
      (x) => x["@type"] === "Product",
    );
    assert.equal(schema.category, "Lapače slunce");
    assert.equal(schema.offers, undefined);
    assert.equal(schema.material, undefined);
    assert.equal(schema.image, undefined);
  }
  assert.deepEqual(
    readCart('[{"id":"lapac-slunce-sova","variant":"","qty":1}]'),
    [{ id: "lapac-slunce-sova", variant: "", qty: 1 }],
  );
});

test("nullable candle variant prices disable only that size, zero remains invalid", () => {
  const p = {
    ...products[0],
    price: null,
    variants: products[0].variants.map((v, i) => ({
      ...v,
      price: i === 0 ? null : v.price,
    })),
  };
  assert.equal(validateCatalog([p])[0].variants[0].price, null);
  assert.throws(() =>
    validateCatalog([{ ...p, variants: [{ ...p.variants[0], price: 0 }] }]),
  );
});

test("admin sees the real photos that ship with the website (never illustrations)", () => {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  assert.deepEqual(builtinPhotos(byId["lapac-slunce-vanocni-stromecek"]), [
    "/assets/img/lapac-slunce-vanocni-stromecek-960.webp",
    "/assets/img/lapac-slunce-vanocni-stromecek-2-960.webp",
  ]);
  // Window pictures are illustrations: only the real photo in packaging is offered.
  assert.deepEqual(builtinPhotos(byId["lapac-slunce-sova"]), [
    "/assets/img/lapac-slunce-sova-960.webp",
  ]);
  assert.deepEqual(builtinPhotos(byId["morska-sul-paculi"]), []);
  for (const p of products)
    for (const src of builtinPhotos(p))
      assert.ok(readFileSync(new URL(".." + src, import.meta.url)).length);
});
