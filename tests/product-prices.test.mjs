import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { referenceWindow } from "../src/server/product-prices.js";
import { saleMarkup } from "../assets/js/ui.mjs";
import { client, startShop } from "./helpers/server.mjs";

test("30-day reference includes carried price and preserves campaign reference in markup", () => {
  const day = 86400,
    time = 100 * day;
  assert.deepEqual(
    referenceWindow(
      [
        { id: 1, created: 10 * day, price: 180 },
        { id: 2, created: 90 * day, price: 250 },
      ],
      10 * day,
      time,
    ),
    { complete: true, minimum: 180 },
  );
  assert.deepEqual(
    referenceWindow([{ id: 1, created: 95 * day, price: 250 }], 95 * day, time),
    { complete: false, minimum: 250 },
  );
  const markup = saleMarkup({
    regular_price: 399,
    sale_price: 299,
    lowest_30: 349,
  });
  assert.match(markup, /<del/);
  assert.match(markup, /399/);
  assert.match(markup, /349/);
  assert.equal(saleMarkup({ price: null }), "");
});

test("admin prices persist, validate references, isolate sizes, and determine order totals", async () => {
  const shop = await startShop();
  try {
    const admin = client(shop.url),
      guest = client(shop.url);
    const key = { product_id: "okurka-zazvor-mata", variant_id: "mala" };
    assert.equal(
      (
        await guest("/api/admin/prices", {
          ...key,
          regular_price: 1,
          sale_price: null,
          revision: 0,
        })
      ).status,
      401,
    );
    assert.equal(
      (await admin("/api/admin/login", { password: shop.env.ADMIN_PASSWORD }))
        .status,
      200,
    );
    const rows = async () => (await admin("/api/admin/stock")).body;
    const row = async () =>
      (await rows()).find(
        (r) =>
          r.product_id === key.product_id && r.variant_id === key.variant_id,
      );
    const save = async (data) =>
      admin("/api/admin/prices", {
        ...key,
        regular_price: 399,
        sale_price: null,
        revision: (await row()).revision,
        ...data,
      });
    assert.equal((await save({ regular_price: 0 })).status, 400);
    let response = await save({ quantity: 8 });
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal((await row()).regular_price, 399);
    assert.equal((await row()).quantity, 8);
    assert.equal((await save({ sale_price: 299 })).status, 400);
    assert.equal(
      (await save({ sale_price: 299, confirmed_lowest_30: 399 })).status,
      400,
    );
    response = await save({ sale_price: 299, confirmed_lowest_30: 349 });
    assert.equal(response.status, 200, JSON.stringify(response));
    let products = (await guest("/api/products")).body;
    assert.ok(!products.some((p) => p.id === "lapac-slunce-velryba"));
    let candle = products.find((p) => p.id === key.product_id);
    assert.equal(candle.variants[0].price, 299);
    assert.equal(candle.variants[0].lowest_30, 349);
    assert.equal(candle.variants[1].price, 449);
    const large = (await rows()).find(
      (r) => r.product_id === key.product_id && r.variant_id === "velka",
    );
    assert.equal(large.sale_price, null);
    assert.equal(large.lowest_30, null);
    assert.equal((await save({ sale_price: 279 })).status, 200);
    assert.equal((await row()).lowest_30, 349);
    assert.equal((await save({ sale_price: 299 })).status, 400);
    assert.equal((await save({ sale_price: null })).status, 200);
    assert.equal(
      (await save({ sale_price: 269, confirmed_lowest_30: 349 })).status,
      400,
    );
    assert.equal(
      (await save({ sale_price: 269, confirmed_lowest_30: 279 })).status,
      200,
    );
    const stale = await row();
    const concurrent = await Promise.all([
      save({ revision: stale.revision, quantity: 4, sale_price: 259 }),
      save({ revision: stale.revision, quantity: 6, sale_price: 249 }),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const winner = concurrent.findIndex((r) => r.status === 200),
      expectedPrice = winner === 0 ? 259 : 249,
      expectedStock = winner === 0 ? 4 : 6;
    assert.equal((await row()).price, expectedPrice);
    assert.equal((await row()).quantity, expectedStock);
    const order = await guest("/api/orders", {
      request_id: randomUUID(),
      name: "Jana Nová",
      email: "price@example.com",
      phone: "777123456",
      shipping: "pickup",
      payment: "transfer",
      terms: true,
      items: [{ id: key.product_id, variant: "mala", qty: 1, price: 1 }],
      total: 1,
    });
    assert.equal(order.status, 201, JSON.stringify(order));
    assert.equal(order.body.pricing.total, expectedPrice);
    const catcherKey = { product_id: "lapac-slunce-kocicka", variant_id: "" };
    let catcher = (await rows()).find(
      (r) => r.product_id === catcherKey.product_id,
    );
    assert.equal(
      (
        await admin("/api/admin/prices", {
          ...catcherKey,
          revision: catcher.revision,
          regular_price: 199,
          sale_price: null,
          quantity: 3,
        })
      ).status,
      200,
    );
    products = (await guest("/api/products")).body;
    assert.equal(
      products.find((p) => p.id === catcherKey.product_id).price,
      199,
    );
    catcher = (await rows()).find(
      (r) => r.product_id === catcherKey.product_id,
    );
    assert.equal(
      (
        await admin("/api/admin/prices", {
          ...catcherKey,
          revision: catcher.revision,
          regular_price: null,
          sale_price: null,
        })
      ).status,
      200,
    );
    const denied = await guest("/api/orders", {
      request_id: randomUUID(),
      name: "Jana Nová",
      email: "price@example.com",
      phone: "777123456",
      shipping: "pickup",
      payment: "transfer",
      terms: true,
      items: [{ id: catcherKey.product_id, variant: "", qty: 1 }],
    });
    assert.equal(denied.status, 400);
  } finally {
    await shop.stop();
  }
});
