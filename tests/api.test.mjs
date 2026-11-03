/** End-to-end API tests against wrangler pages dev with a temporary local D1 database. */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { client, startShop } from "./helpers/server.mjs";

let shop;
before(async () => {
  shop = await startShop();
});
after(async () => {
  await shop?.stop();
});

const waitFor = async (check, label) => {
  for (let i = 0; i < 100; i++) {
    const found = check();
    if (found) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Timed out waiting for " + label);
};
const mailTo = (to, subject) =>
  waitFor(
    () =>
      shop.mails.find(
        (m) => m.body.to[0] === to && subject.test(m.body.subject),
      ),
    `${subject} to ${to}`,
  );
const order = (extra = {}) => ({
  request_id: randomUUID(),
  name: "Jana <b>Nová</b>",
  email: "jana@example.com",
  phone: "777 123 456",
  shipping: "zasilkovna",
  pickup_point: "Z-BOX Nový Jičín",
  packeta_point_id: "12345",
  payment: "transfer",
  terms: true,
  items: [{ id: "okurka-zazvor-mata", variant: "mala", qty: 2 }],
  ...extra,
});
async function admin() {
  const call = client(shop.url);
  const login = await call("/api/admin/login", {
    password: shop.env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200);
  return call;
}

test("API refuses cross-site writes, non-JSON and anonymous admin access", async () => {
  const call = client(shop.url);
  assert.equal(
    (await call("/api/orders", order(), { origin: "https://evil.example" }))
      .status,
    403,
  );
  const plain = await fetch(shop.url + "/api/orders", {
    method: "POST",
    headers: { Origin: shop.url, "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(plain.status, 415);
  const orders = await call("/api/admin/orders");
  assert.equal(orders.status, 401);
  assert.equal(orders.headers.get("cache-control"), "no-store");
  assert.equal((await call("/api/nic")).status, 404);
  assert.equal((await call("/api/admin/login", { password: "x" })).status, 401);
});

test("guest order: server prices, QR payment, e-mails, idempotency", async () => {
  const call = client(shop.url);
  const data = order({
    items: [{ id: "okurka-zazvor-mata", variant: "velka", qty: 1, price: 1 }],
    total: 1,
  });
  const created = await call("/api/orders", data);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const o = created.body;
  assert.equal(o.pricing.total, 349 + 79);
  assert.equal(o.pricing.memberSavings, 0);
  assert.match(o.number, /^\d{7}$/);
  assert.equal(o.payment.vs, o.number);
  assert.equal(o.payment.iban, "CZ65 0800 0000 1920 0014 5399");
  assert.match(o.payment.spayd, /AM:428\.00\*CC:CZK\*X-VS:/);
  assert.ok(o.test);
  const again = await call("/api/orders", data);
  assert.equal(again.body.number, o.number);
  const qr = await call(`/api/qr?t=${o.token}`);
  assert.equal(qr.status, 200);
  assert.equal(qr.headers.get("content-type"), "image/png");
  assert.deepEqual([...new Uint8Array(qr.body).slice(0, 4)], [137, 80, 78, 71]);
  const view = await call(`/api/orders/view?t=${o.token}`);
  assert.equal(view.body.number, o.number);
  assert.equal(view.body.customer, undefined);
  assert.equal(
    (await call("/api/orders/view?t=" + "0".repeat(32))).status,
    404,
  );
  const mail = await mailTo("jana@example.com", new RegExp(o.number));
  assert.equal(mail.headers.authorization, "Bearer re_test");
  assert.match(mail.body.subject, /ZKUŠEBNÍ/);
  assert.match(mail.body.html, /Jana &lt;b&gt;Nová&lt;\/b&gt;/);
  assert.ok(!mail.body.html.includes("<b>Nová"));
  assert.match(mail.body.html, new RegExp(`/api/qr\\?t=${o.token}`));
  assert.match(mail.body.text, /Variabilní symbol: \d{7}/);
  await mailTo("info@loomos.cz", /Nová objednávka/);
  for (const bad of [
    { terms: false },
    { payment: "card" },
    { payment: "cod" },
    { shipping: "kuryr" },
    { email: "neplatny" },
    { items: [] },
    { items: [{ id: "neexistuje", qty: 1 }] },
    { items: [{ id: "okurka-zazvor-mata", qty: 21 }] },
    { packeta_point_id: "1;2" },
  ])
    assert.equal(
      (await call("/api/orders", order(bad))).status,
      400,
      JSON.stringify(bad),
    );
});

test("accounts: 5 % member pricing, password reset by e-mail, order history", async () => {
  const call = client(shop.url);
  const reg = await call("/api/account/register", {
    email: "Petra@Example.com",
    name: "Petra",
    password: "puvodni-heslo",
    terms: true,
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.customer.email, "petra@example.com");
  await mailTo("petra@example.com", /Vítejte/);
  assert.equal(
    (
      await client(shop.url)("/api/account/register", {
        email: "petra@example.com",
        name: "X",
        password: "jine-heslo-123",
        terms: true,
      })
    ).status,
    409,
  );
  const bought = await call(
    "/api/orders",
    order({ email: "petra@example.com" }),
  );
  assert.equal(bought.body.pricing.memberSavings, 2 * 249 - 2 * 237);
  assert.equal(bought.body.pricing.total, 2 * 237 + 79);
  const mine = await call("/api/account/orders");
  assert.equal(mine.body.length, 1);
  assert.equal(mine.body[0].number, bought.body.number);

  const stranger = client(shop.url);
  const unknown = await stranger("/api/account/forgot", {
    email: "nikdo@example.com",
  });
  const known = await stranger("/api/account/forgot", {
    email: "petra@example.com",
  });
  assert.equal(unknown.body.message, known.body.message);
  const mail = await mailTo("petra@example.com", /Obnovení hesla/);
  const token = mail.body.text.match(/token=([0-9a-f]{64})/)[1];
  assert.ok(!shop.mails.some((m) => m.body.to[0] === "nikdo@example.com"));
  const reset = await stranger("/api/account/reset", {
    token,
    password: "nove-heslo-456",
  });
  assert.equal(reset.status, 200);
  assert.equal(
    (await stranger("/api/account/reset", { token, password: "jeste-jine-1" }))
      .status,
    400,
  );
  assert.equal((await call("/api/account/me")).body.customer, null);
  const fresh = client(shop.url);
  assert.equal(
    (
      await fresh("/api/account/login", {
        email: "petra@example.com",
        password: "puvodni-heslo",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fresh("/api/account/login", {
        email: "PETRA@example.com",
        password: "nove-heslo-456",
      })
    ).status,
    200,
  );
});

test("discount codes, stock limits and admin order handling", async () => {
  const a = await admin();
  assert.equal(
    (
      await a("/api/admin/codes", {
        code: "TEST10",
        type: "percent",
        value: 10,
        max_uses: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await a("/api/admin/codes", {
        code: "špatný",
        type: "percent",
        value: 10,
      })
    ).status,
    400,
  );
  await a("/api/admin/stock", {
    product_id: "svatecni-duch",
    variant_id: "velka",
    quantity: 1,
  });
  const call = client(shop.url);
  assert.equal(
    (await call("/api/codes/check", { code: "test10" })).body.code,
    "TEST10",
  );
  assert.equal((await call("/api/codes/check", { code: "NIC" })).status, 400);
  const tooMany = await call(
    "/api/orders",
    order({ items: [{ id: "svatecni-duch", variant: "velka", qty: 2 }] }),
  );
  assert.equal(tooMany.status, 409);
  const ok = await call(
    "/api/orders",
    order({
      code: "test10",
      items: [{ id: "svatecni-duch", variant: "velka", qty: 1 }],
    }),
  );
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.pricing.codeDiscount, 35);
  const products = (await call("/api/products")).body;
  assert.equal(products.find((p) => p.id === "svatecni-duch").stock.velka, 0);
  assert.equal(
    (
      await call(
        "/api/orders",
        order({ code: "TEST10", items: [{ id: "pomeranc-vanilka", qty: 1 }] }),
      )
    ).status,
    400,
  );

  const number = ok.body.number;
  const paid = await a("/api/admin/order-status", {
    number,
    status: "zaplacena",
  });
  assert.equal(paid.status, 200);
  await mailTo("jana@example.com", /Platba přijata/);
  const packet = await a("/api/admin/packeta-packet", { number, weight: 0.5 });
  assert.equal(packet.status, 201, JSON.stringify(packet.body));
  assert.equal(packet.body.barcode, "Z 987");
  assert.match(
    shop.packets[0],
    /<apiPassword>packeta&lt;&amp;&gt;secret<\/apiPassword>/,
  );
  assert.match(shop.packets[0], /<addressId>12345<\/addressId>/);
  assert.match(shop.packets[0], /<cod>0<\/cod>/);
  assert.equal(
    (await a("/api/admin/packeta-packet", { number, weight: 0.5 })).status,
    409,
  );
  await a("/api/admin/order-status", {
    number,
    status: "zrusena",
    notify: false,
  });
  const stock = (await a("/api/admin/stock")).body;
  assert.equal(
    stock.find(
      (s) => s.product_id === "svatecni-duch" && s.variant_id === "velka",
    ).quantity,
    1,
  );
  assert.equal(
    (await a("/api/admin/order-status", { number, status: "nova" })).status,
    400,
  );
  const orders = (await a("/api/admin/orders")).body;
  assert.ok(!JSON.stringify(orders).includes("secret"));
});

test("admin can block and delete customers; brute force is rate limited", async () => {
  const user = client(shop.url);
  await user("/api/account/register", {
    email: "blok@example.com",
    name: "Blok",
    password: "heslo-blok-1",
    terms: true,
  });
  const a = await admin();
  const list = (await a("/api/admin/customers")).body;
  const id = list.find((c) => c.email === "blok@example.com").id;
  await a("/api/admin/customer", { id, action: "block" });
  assert.equal((await user("/api/account/me")).body.customer, null);
  assert.equal(
    (
      await client(shop.url)("/api/account/login", {
        email: "blok@example.com",
        password: "heslo-blok-1",
      })
    ).status,
    403,
  );
  await a("/api/admin/customer", { id, action: "delete" });
  assert.ok(!(await a("/api/admin/customers")).body.some((c) => c.id === id));
  const attacker = client(shop.url);
  const statuses = [];
  for (let i = 0; i < 12; i++)
    statuses.push(
      (
        await attacker("/api/account/login", {
          email: "petra@example.com",
          password: "spatne-" + i,
        })
      ).status,
    );
  assert.equal(statuses.at(-1), 429);
});

test("Dílnička: jars, saved batch, finished candles go to stock; supplier data stays private", async () => {
  assert.equal((await fetch(shop.url + "/data/oils.json")).status, 404);
  assert.equal((await client(shop.url)("/api/admin/workshop")).status, 401);
  const a = await admin();
  assert.equal(
    (
      await a("/api/admin/workshop/jar", {
        name: "Velká čirá",
        water_g: 300,
        fill_g: 258,
        wicks: 2,
        wick: "dřevěný",
        variant_id: "velka",
      })
    ).status,
    200,
  );
  const ws = (await a("/api/admin/workshop")).body;
  assert.equal(ws.oils.length, 6);
  const jar = ws.jars.find((j) => j.name === "Velká čirá");
  const before = (await a("/api/admin/stock")).body.find(
    (s) => s.product_id === "zazvor-zeleny-caj" && s.variant_id === "velka",
  ).quantity;
  const saved = await a("/api/admin/workshop/batch", {
    name: "Test",
    load_percent: 7,
    loss_percent: 5,
    items: [{ product_id: "zazvor-zeleny-caj", jar_id: jar.id, count: 4 }],
  });
  assert.equal(saved.status, 201);
  const batch = (await a("/api/admin/workshop")).body.batches[0];
  assert.equal(batch.result.totals.candles, 4);
  assert.equal(batch.result.jars[0].wicks, 8);
  const done = await a("/api/admin/workshop/batch-done", { id: batch.id });
  assert.equal(done.status, 200);
  assert.equal(
    (await a("/api/admin/workshop/batch-done", { id: batch.id })).status,
    409,
  );
  const after = (await a("/api/admin/stock")).body.find(
    (s) => s.product_id === "zazvor-zeleny-caj" && s.variant_id === "velka",
  ).quantity;
  assert.equal(after, (before ?? 0) + 4);
  assert.equal(
    (
      await a("/api/admin/workshop/batch", {
        items: [{ product_id: "neexistuje", jar_id: jar.id, count: 1 }],
        load_percent: 8,
        loss_percent: 5,
      })
    ).status,
    400,
  );
});
