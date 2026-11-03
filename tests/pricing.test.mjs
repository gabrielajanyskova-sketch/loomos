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
