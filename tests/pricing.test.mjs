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
  assert.equal(guest.total, 847 + 79);
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
  assert.equal(percent.total, 806 - 81 + 79);
  assert.equal(percent.savings, 41 + 81);
  const fixed = priceCart({
    lines: [{ key: "a", name: "A", price: 100, qty: 1 }],
    code: { code: "BIG", type: "fixed", value: 500 },
    shipping: "zasilkovna",
  });
  assert.equal(fixed.codeDiscount, 100);
  assert.equal(fixed.total, 79);
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
