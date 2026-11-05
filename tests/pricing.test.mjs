import test from "node:test";
import assert from "node:assert/strict";
import { priceCart, memberPrice } from "../assets/js/pricing.mjs";
import {
  czechAccountToIban,
  validIban,
  spayd,
  qrSvg,
} from "../assets/js/payment.mjs";

const lines = [
  { key: "a::mala", name: "A", price: 249, qty: 2 },
  { key: "a::velka", name: "A", price: 349, qty: 1 },
];

test("guests pay list prices, members get 5 % off every item", () => {
  const guest = priceCart({ lines, shipping: "zasilkovna" });
  assert.equal(guest.items, 847);
  assert.equal(guest.total, 847 + 109);
  assert.equal(guest.savings, 0);
  const member = priceCart({ lines, member: true, shipping: "pickup" });
  assert.equal(memberPrice(249), 237);
  assert.equal(memberPrice(349), 332);
  assert.deepEqual(
    member.lines.map((l) => [l.unit, l.total]),
    [
      [237, 474],
      [332, 332],
    ],
  );
  assert.equal(member.memberSavings, 847 - 806);
  assert.equal(member.total, 806);
});

test("discount codes apply after the member discount and never to shipping", () => {
  const percent = priceCart({
    lines,
    member: true,
    code: { code: "X10", type: "percent", value: 10 },
    shipping: "zasilkovna",
  });
  assert.equal(percent.codeDiscount, 81);
  assert.equal(percent.total, 806 - 81 + 109);
  assert.equal(percent.savings, 41 + 81);
  const fixed = priceCart({
    lines: [{ key: "a", name: "A", price: 100, qty: 1 }],
    code: { code: "BIG", type: "fixed", value: 500 },
    shipping: "zasilkovna",
  });
  assert.equal(fixed.codeDiscount, 100);
  assert.equal(fixed.total, 109);
  const tooSmall = priceCart({
    lines,
    code: { code: "MIN", type: "percent", value: 10, min_total: 1000 },
  });
  assert.equal(tooSmall.codeDiscount, 0);
  assert.equal(tooSmall.code, null);
  assert.match(tooSmall.codeError, /1000/);
});

test("Czech account numbers convert to valid IBANs and SPAYD payloads", () => {
  assert.equal(
    czechAccountToIban("19-2000145399/0800"),
    "CZ6508000000192000145399",
  );
  assert.ok(validIban("CZ65 0800 0000 1920 0014 5399"));
  assert.ok(!validIban("CZ66 0800 0000 1920 0014 5399"));
  assert.equal(czechAccountToIban("nesmysl"), null);
  assert.equal(
    spayd({
      iban: "CZ6508000000192000145399",
      amount: 591,
      vs: "2600001",
      message: "LOOMOS 2600001",
      recipient: "Gabriela Janýšková",
    }),
    "SPD*1.0*ACC:CZ6508000000192000145399*AM:591.00*CC:CZK*X-VS:2600001*RN:Gabriela Janyskova*MSG:LOOMOS 2600001",
  );
  const svg = qrSvg("SPD*1.0*ACC:CZ6508000000192000145399*AM:1.00*CC:CZK");
  assert.match(svg, /^<svg[^>]+viewBox/);
  assert.ok(!svg.includes("style="));
});

test("Dílnička: wax and fragrance amounts, wicks and supplier warnings", async () => {
  const { calcBatch, fillFromWater } = await import(
    "../assets/js/workshop-calc.mjs"
  );
  assert.equal(fillFromWater(180), 155);
  const r = calcBatch({
    items: [
      { product_id: "a", jar_id: 1, count: 6 },
      { product_id: "a", jar_id: 2, count: 2 },
    ],
    jars: [
      { id: 1, name: "Malá", fill_g: 155, wicks: 1, wick: "dřevěný" },
      { id: 2, name: "Velká", fill_g: 258, wicks: 2, wick: "dřevěný" },
    ],
    oils: [
      {
        product_id: "a",
        name: "A",
        vanillin_percent: 2,
        no_ufi_max_percent: 5,
        flashpoint_c: 60,
      },
    ],
    load_percent: 8,
    loss_percent: 0,
    no_ufi: 0,
  });
  const fill = 155 * 6 + 258 * 2;
  assert.equal(r.totals.candles, 8);
  assert.ok(Math.abs(r.totals.wax + r.totals.oil - fill) <= 1);
  assert.ok(Math.abs(r.totals.oil - (fill / 1.08) * 0.08) <= 1);
  assert.deepEqual(
    r.jars.map((j) => j.wicks),
    [6, 4],
  );
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings.join(" "), /UFI/);
  assert.match(r.warnings.join(" "), /vanilin/);
});

test("Dílnička: 'Bez UFI' caps each scent under the supplier's limit", async () => {
  const { calcBatch, maxLoadWithoutUfi } = await import(
    "../assets/js/workshop-calc.mjs"
  );
  assert.equal(maxLoadWithoutUfi(4.19), 4.1);
  assert.equal(maxLoadWithoutUfi(10), 10.4);
  const oils = [
    {
      product_id: "goji",
      name: "Goji",
      vanillin_percent: 0,
      no_ufi_max_percent: 4.19,
      flashpoint_c: 61,
    },
    {
      product_id: "okurka",
      name: "Okurka",
      vanillin_percent: 0,
      no_ufi_max_percent: 8.76,
      flashpoint_c: 91,
    },
    {
      product_id: "duch",
      name: "Duch",
      vanillin_percent: 0,
      no_ufi_max_percent: 0.51,
      flashpoint_c: 68,
    },
  ];
  const r = calcBatch({
    items: ["goji", "okurka", "duch"].map((product_id) => ({
      product_id,
      jar_id: 1,
      count: 1,
    })),
    jars: [{ id: 1, name: "Malá", fill_g: 180, wicks: 1 }],
    oils,
    load_percent: 8,
    loss_percent: 0,
  });
  for (const s of r.scents) {
    const limit = oils.find(
      (o) => o.product_id === s.product_id,
    ).no_ufi_max_percent;
    assert.ok(s.concentration < limit, s.product_id);
    assert.ok((s.oil / 180) * 100 < limit + 0.3, s.product_id);
  }
  assert.equal(r.scents.find((s) => s.product_id === "okurka").load_percent, 8);
  assert.match(r.warnings.join(" "), /Duch: bez UFI lze dát jen/);
  assert.ok(
    !/potřebovala výstražnou etiketu, kód UFI/.test(r.warnings.join(" ")),
  );
  const off = calcBatch({
    items: [{ product_id: "goji", jar_id: 1, count: 1 }],
    jars: [{ id: 1, name: "Malá", fill_g: 180, wicks: 1 }],
    oils,
    load_percent: 8,
    loss_percent: 0,
    no_ufi: 0,
  });
  assert.match(
    off.warnings.join(" "),
    /potřebovala výstražnou etiketu, kód UFI/,
  );
});

test("round label includes the EN 15494 pictograms unless switched off", async () => {
  const { labelHtml, EN15494_ICONS } = await import("../assets/js/labels.mjs");
  const base = { name: "Test", grams: 180, contains: "Limonene" };
  assert.equal(EN15494_ICONS.length, 5);
  assert.match(labelHtml(base), /nikdy nenechávejte bez dozoru/);
  assert.match(labelHtml(base), /\/assets\/img\/pikto\/odstup-10cm\.png/);
  assert.ok(!labelHtml({ ...base, icons: false }).includes("label-icon"));
  assert.ok(!labelHtml(base).includes("style="));
});

test("CLP label format: 6.6 pt DM Sans gives an x-height of at least 1.2 mm", async () => {
  const { xHeightMm, CLP_FORMAT } = await import("../assets/js/labels.mjs");
  assert.ok(xHeightMm(CLP_FORMAT.minFontPt) >= 1.2);
  assert.ok(xHeightMm(6) < 1.2);
  assert.equal(CLP_FORMAT.lineHeight, 1.2);
});

test("quantity price applies from the minimum count, before the member discount", () => {
  const bulk = { min_qty: 2, price: 175 };
  const one = priceCart({
    lines: [{ key: "l", name: "L", price: 199, qty: 1, bulk }],
  });
  assert.equal(one.items, 199);
  assert.equal(one.bulkSavings, 0);
  const two = priceCart({
    lines: [{ key: "l", name: "L", price: 199, qty: 2, bulk }],
  });
  assert.equal(two.items, 350);
  assert.equal(two.bulkSavings, 48);
  const member = priceCart({
    lines: [{ key: "l", name: "L", price: 199, qty: 3, bulk }],
    member: true,
  });
  assert.equal(member.items, 3 * memberPrice(175));
});

test("quantity price counts different motifs of one group together", () => {
  const bulk = { min_qty: 2, price: 175 };
  const sun = (key, qty) => ({
    key,
    name: key,
    price: 199,
    qty,
    bulk,
    group: "lapace-slunce",
  });
  const mixed = priceCart({ lines: [sun("kocicka", 1), sun("konik", 1)] });
  assert.equal(mixed.items, 350);
  assert.equal(mixed.lines[0].bulkCount, 2);
  const alone = priceCart({ lines: [sun("kocicka", 1)] });
  assert.equal(alone.items, 199);
  // A candle in the cart does not count towards the sun catcher quantity price.
  const withCandle = priceCart({
    lines: [sun("kocicka", 1), { key: "c", name: "C", price: 349, qty: 1 }],
  });
  assert.equal(withCandle.items, 199 + 349);
});

test("shipping is free from 1 200 Kč of goods after discounts", () => {
  const line = (price, qty) => ({ key: "x", name: "X", price, qty });
  const below = priceCart({ lines: [line(349, 3)], shipping: "zasilkovna" });
  assert.equal(below.freeShipping, false);
  assert.equal(below.missingForFreeShipping, 1200 - 1047);
  assert.equal(below.shippingPrice, 109);
  const above = priceCart({ lines: [line(449, 3)], shipping: "domu" });
  assert.equal(above.freeShipping, true);
  assert.equal(above.shippingPrice, 0);
  assert.equal(above.total, 1347);
  // A discount that drops the goods under the limit brings the shipping price back.
  const discounted = priceCart({
    lines: [line(449, 3)],
    shipping: "domu",
    code: { code: "X", type: "fixed", value: 200 },
  });
  assert.equal(discounted.freeShipping, false);
  assert.equal(discounted.shippingPrice, 149);
});

test("front labels: 12 big (6 × 7 cm) and 16 small (5 × 6 cm) fit on A4, centred", async () => {
  const { FRONT_SIZES, frontLayout, frontLabelHtml } = await import(
    "../assets/js/labels.mjs"
  );
  const big = frontLayout(FRONT_SIZES.big);
  const small = frontLayout(FRONT_SIZES.small);
  assert.deepEqual([big.columns, big.rows], [3, 4]);
  assert.deepEqual([small.columns, small.rows], [4, 4]);
  for (const [layout, size] of [
    [big, FRONT_SIZES.big],
    [small, FRONT_SIZES.small],
  ]) {
    assert.ok(layout.margin_left >= 5 && layout.margin_top >= 5);
    assert.ok(layout.margin_left * 2 + layout.columns * size.width <= 210);
    assert.ok(layout.margin_top * 2 + layout.rows * size.height <= 297);
  }
  const html = frontLabelHtml({
    size: "small",
    name: "Moře & cedr",
    notes: "Cedr · santal",
    grams: 180,
    hours: 50,
  });
  assert.match(html, /front-small/);
  assert.match(html, /Moře &amp; cedr/);
  assert.match(html, /180 g · hoří ±50 h/);
});
