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
// One admin session for all tests: logging in is rate limited.
let adminSession;
async function admin() {
  if (adminSession) return adminSession;
  const call = client(shop.url);
  const login = await call("/api/admin/login", {
    password: shop.env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200);
  return (adminSession = call);
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
  assert.equal(o.pricing.total, 449 + 109);
  assert.equal(o.pricing.memberSavings, 0);
  assert.match(o.number, /^\d{7}$/);
  assert.equal(o.payment.vs, o.number);
  assert.equal(o.payment.iban, "CZ65 0800 0000 1920 0014 5399");
  assert.match(o.payment.spayd, /AM:558\.00\*CC:CZK\*X-VS:/);
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
  assert.equal(bought.body.pricing.memberSavings, 2 * 349 - 2 * 332);
  assert.equal(bought.body.pricing.total, 2 * 332 + 109);
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
    product_id: "morska-sul-paculi",
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
    order({ items: [{ id: "morska-sul-paculi", variant: "velka", qty: 2 }] }),
  );
  assert.equal(tooMany.status, 409);
  const ok = await call(
    "/api/orders",
    order({
      code: "test10",
      items: [{ id: "morska-sul-paculi", variant: "velka", qty: 1 }],
    }),
  );
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.pricing.codeDiscount, 45);
  const products = (await call("/api/products")).body;
  assert.equal(
    products.find((p) => p.id === "morska-sul-paculi").stock.velka,
    0,
  );
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
      (s) => s.product_id === "morska-sul-paculi" && s.variant_id === "velka",
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
  assert.equal(ws.oils.length, 9);
  assert.deepEqual(
    ws.jars
      .filter((j) => /Oxford|Kimberley/.test(j.name))
      .map((j) => [j.fill_g, j.variant_id]),
    [
      [220, "velka"],
      [180, "mala"],
    ],
  );
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

test("Dílnička: label texts and print settings are stored and validated", async () => {
  const a = await admin();
  assert.equal(
    (
      await a("/api/admin/workshop/label", {
        product_id: "okurka-zazvor-mata",
        contains: "Linalool, Limonene",
      })
    ).status,
    200,
  );
  assert.equal(
    (await a("/api/admin/workshop/label", { product_id: "nic", contains: "x" }))
      .status,
    400,
  );
  const settings = {
    diameter: 50,
    font: 6,
    phone: "+420 777 123 456",
    columns: 3,
    rows: 5,
    margin_top: 10,
    margin_left: 12,
    gap: 4,
  };
  assert.equal(
    (await a("/api/admin/workshop/label-settings", settings)).status,
    200,
  );
  assert.equal(
    (
      await a("/api/admin/workshop/label-settings", {
        ...settings,
        diameter: 500,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a("/api/admin/workshop/label-settings", {
        ...settings,
        clp: true,
      })
    ).status,
    400,
  );
  const ws = (await a("/api/admin/workshop")).body;
  assert.equal(ws.labels["okurka-zazvor-mata"].contains, "Linalool, Limonene");
  assert.equal(ws.labels["okurka-zazvor-mata"].source, "upraveno ručně");
  assert.equal(ws.labels["pomeranc-vanilka"].contains, "Limonene, Linalool");
  assert.equal(ws.labels["zazvor-zeleny-caj"].pictogram, false);
  assert.match(ws.labels["zazvor-zeleny-caj"].contains, /^Citral/);
  assert.match(ws.labels["zazvor-zeleny-caj"].source, /7 % oleje/);
  assert.match(ws.labels["morska-sul-paculi"].source, /Arabian Nights/);
  assert.equal(ws.label.diameter, 50);
  assert.equal(ws.label.phone, "+420 777 123 456");
  assert.equal(ws.label.icons, false);
});

test("order tracking: status timeline, manual tracking number and notes reach the customer", async () => {
  const created = await client(shop.url)(
    "/api/orders",
    order({ email: "sledovani@example.com" }),
  );
  const { number, token } = created.body;
  const a = await admin();
  await a("/api/admin/order-status", { number, status: "zaplacena" });
  const sent = await a("/api/admin/order-status", {
    number,
    status: "odeslana",
    tracking: "Z 123 456 7890",
    note: "Přibalili jsme vzorek <vosku>.",
  });
  assert.equal(sent.status, 200);
  assert.equal(
    (
      await a("/api/admin/order-status", {
        number,
        status: "odeslana",
        tracking: "<script>",
      })
    ).status,
    400,
  );
  const view = (await client(shop.url)(`/api/orders/view?t=${token}`)).body;
  assert.equal(view.status, "odeslana");
  assert.equal(view.tracking.code, "Z 123 456 7890");
  assert.match(view.tracking.url, /tracking\.packeta\.com.*Z1234567890/);
  assert.deepEqual(
    view.history.map((h) => h.status),
    ["nova", "zaplacena", "odeslana"],
  );
  assert.equal(view.history[2].note, "Přibalili jsme vzorek <vosku>.");
  const mail = await mailTo("sledovani@example.com", /na cestě/);
  assert.match(mail.body.html, /Z1234567890/);
  assert.match(mail.body.html, /vzorek &lt;vosku&gt;/);
  assert.match(mail.body.html, new RegExp(`objednavka\\?t=${token}`));
});

test("Dílnička: wax profiles are seeded, editable and stored with a batch", async () => {
  const a = await admin();
  const ws = (await a("/api/admin/workshop")).body;
  const golden = ws.waxes.find((w) => /464/.test(w.name));
  assert.equal(golden.add_oil_at, 70);
  assert.equal(golden.heat_to, 85);
  assert.ok(ws.waxes.some((w) => /C-3/.test(w.name) && w.pour_from === 55));
  const c3 = ws.waxes.find((w) => /C-3/.test(w.name));
  assert.equal(
    (await a("/api/admin/workshop/wax", { ...c3, heat_to: 82, add_oil_at: 75 }))
      .status,
    200,
  );
  assert.equal(
    (await a("/api/admin/workshop/wax", { ...c3, heat_to: 500 })).status,
    400,
  );
  await a("/api/admin/workshop/settings", {
    load_percent: 8,
    loss_percent: 5,
    no_ufi: 1,
    wax_id: c3.id,
  });
  const after = (await a("/api/admin/workshop")).body;
  assert.equal(after.wax_id, c3.id);
  assert.equal(after.waxes.find((w) => w.id === c3.id).add_oil_at, 75);
  const jar = after.jars[0];
  await a("/api/admin/workshop/batch", {
    items: [{ product_id: "pomeranc-vanilka", jar_id: jar.id, count: 2 }],
    load_percent: 8,
    loss_percent: 5,
    wax_id: c3.id,
  });
  const batch = (await a("/api/admin/workshop")).body.batches[0];
  assert.equal(batch.result.wax.name, c3.name);
});

test("Dílnička: wick tests are logged, validated and deletable", async () => {
  const a = await admin();
  const jar = (await a("/api/admin/workshop")).body.jars[0];
  assert.equal(
    (
      await a("/api/admin/workshop/wick-test", {
        jar_id: jar.id,
        wick: "dřevěný 15 mm",
        product_id: "okurka-zazvor-mata",
        hours: "3",
        melt_mm: "77",
        full_pool: true,
        flame: "dobra",
        rating: "5",
      })
    ).status,
    201,
  );
  assert.equal(
    (await a("/api/admin/workshop/wick-test", { wick: "x", flame: "obri" }))
      .status,
    400,
  );
  const tests = (await a("/api/admin/workshop")).body.wick_tests;
  assert.equal(tests[0].wick, "dřevěný 15 mm");
  assert.equal(tests[0].full_pool, true);
  assert.equal(tests[0].melt_mm, 77);
  await a("/api/admin/workshop/wick-test-delete", { id: tests[0].id });
  assert.ok(
    !(await a("/api/admin/workshop")).body.wick_tests.some(
      (t) => t.id === tests[0].id,
    ),
  );
});

test("invoices on payment, customer PDF, withdrawal button flow and order deletion", async () => {
  const call = client(shop.url);
  const a = await admin();
  const make = async () =>
    (
      await call(
        "/api/orders",
        order({ email: "faktura@example.com", shipping: "pickup" }),
      )
    ).body;
  const paid = await make();
  assert.equal((await call(`/api/invoice?t=${paid.token}`)).status, 404);
  await a("/api/admin/order-status", {
    number: paid.number,
    status: "zaplacena",
  });
  const mail = await mailTo("faktura@example.com", /Platba přijata/);
  const attachment = mail.body.attachments[0];
  assert.match(attachment.filename, /^faktura-TEST-\d{4}-\d{4}\.pdf$/);
  assert.equal(
    Buffer.from(attachment.content, "base64").subarray(0, 4).toString(),
    "%PDF",
  );
  const pdf = await call(`/api/invoice?t=${paid.token}`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(
    (await call(`/api/orders/view?t=${paid.token}`)).body.invoice,
    /^TEST-/,
  );
  assert.equal(
    (await call(`/api/admin/invoice?order=${paid.number}`)).status,
    401,
  );
  assert.equal(
    (await a(`/api/admin/invoice?order=${paid.number}`)).status,
    200,
  );

  assert.equal(
    (
      await call("/api/withdrawal", {
        name: "Jana",
        email: "faktura@example.com",
        order_number: paid.number,
      })
    ).status,
    400,
  );
  const w = await call("/api/withdrawal", {
    name: "Jana Nová",
    email: "FAKTURA@example.com",
    order_number: paid.number,
    confirm: true,
  });
  assert.equal(w.status, 201);
  assert.equal(w.body.matched, true);
  const ack = await mailTo("faktura@example.com", /Potvrzení odstoupení/);
  assert.match(ack.body.text, new RegExp(paid.number));
  const unknown = await call("/api/withdrawal", {
    name: "Někdo",
    email: "nikdo@example.com",
    order_number: "9999999",
    confirm: true,
  });
  assert.equal(unknown.body.matched, false);
  const list = (await a("/api/admin/withdrawals")).body;
  assert.ok(list.some((x) => x.order_number === paid.number && x.matched));
  const flagged = (await a("/api/admin/orders")).body.find(
    (o) => o.number === paid.number,
  );
  assert.equal(flagged.withdrawals, 1);
  assert.ok(flagged.withdrawal.at);

  const extra = await make();
  assert.equal(
    (await a("/api/admin/order-delete", { number: extra.number })).status,
    200,
  );
  assert.ok(
    !(await a("/api/admin/orders")).body.some((o) => o.number === extra.number),
  );
  // Test orders with a TEST invoice may be deleted; real invoiced orders are protected (cancel instead).
  assert.equal(
    (await a("/api/admin/order-delete", { number: paid.number })).status,
    200,
  );
});

test("Zásilkovna: Z-BOX and home delivery are priced, validated and shown everywhere", async () => {
  const call = client(shop.url);
  const zbox = await call(
    "/api/orders",
    order({
      shipping: "zbox",
      pickup_point: "Z-BOX Nový Jičín, Masarykovo nám.",
      packeta_point_id: "4321",
    }),
  );
  assert.equal(zbox.status, 201, JSON.stringify(zbox.body));
  assert.equal(zbox.body.pricing.shippingPrice, 109);
  assert.equal(
    (await call("/api/orders", order({ shipping: "zbox", pickup_point: "" })))
      .status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/orders",
        order({
          shipping: "domu",
          street: "Hlavní",
          city: "Praha",
          zip: "11000",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/orders",
        order({
          shipping: "domu",
          street: "Hlavní 5",
          city: "Praha",
          zip: "1100",
        }),
      )
    ).status,
    400,
  );
  const home = await call(
    "/api/orders",
    order({
      email: "domu@example.com",
      shipping: "domu",
      street: "Hlavní 12/3a",
      city: "Nový Jičín",
      zip: "741 01",
      pickup_point: "",
      packeta_point_id: "",
    }),
  );
  assert.equal(home.status, 201, JSON.stringify(home.body));
  assert.equal(home.body.pricing.shippingPrice, 149);
  assert.deepEqual(home.body.address, {
    street: "Hlavní 12/3a",
    city: "Nový Jičín",
    zip: "74101",
  });
  const mail = await mailTo("domu@example.com", new RegExp(home.body.number));
  assert.match(
    mail.body.text,
    /doručení domů: Hlavní 12\/3a, 74101 Nový Jičín/,
  );
  const a = await admin();
  const before = shop.packets.length;
  const packet = await a("/api/admin/packeta-packet", {
    number: home.body.number,
    weight: 0.6,
  });
  assert.equal(packet.status, 201, JSON.stringify(packet.body));
  const xml = shop.packets.slice(before).join("");
  assert.match(xml, /<addressId>106<\/addressId>/);
  assert.match(
    xml,
    /<street>Hlavní<\/street><houseNumber>12\/3a<\/houseNumber><city>Nový Jičín<\/city><zip>74101<\/zip>/,
  );
});

test("Balíkovna: point picked on the Česká pošta map is required and kept for the label", async () => {
  const call = client(shop.url);
  assert.equal(
    (
      await call(
        "/api/orders",
        order({ shipping: "balikovna", packeta_point_id: "" }),
      )
    ).status,
    400,
  );
  const res = await call(
    "/api/orders",
    order({
      email: "balikovna@example.com",
      shipping: "balikovna",
      pickup_point: "",
      packeta_point_id: "",
      balikovna_id: "74101",
      balikovna_zip: "741 01",
      balikovna_name: "Nový Jičín 1",
    }),
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.pricing.shippingPrice, 99);
  assert.deepEqual(res.body.balikovna, {
    id: "74101",
    zip: "74101",
    name: "Nový Jičín 1",
  });
  assert.equal(res.body.pickup_point, "Nový Jičín 1, 741 01");
});

test("Česká pošta home delivery needs an address, not a Balíkovna", async () => {
  const call = client(shop.url);
  const res = await call(
    "/api/orders",
    order({
      email: "posta-domu@example.com",
      shipping: "balikovna_domu",
      pickup_point: "",
      packeta_point_id: "",
      street: "Hlavní 5",
      city: "Praha",
      zip: "110 00",
    }),
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.pricing.shippingPrice, 129);
  assert.equal(res.body.balikovna, null);
  assert.equal(res.body.address.zip, "11000");
});

test("admin adds and edits products; quantity price and dynamic product page work", async () => {
  const a = await admin();
  const sun = {
    id: "lapac-slunce-kocka",
    name: "Lapač slunce — kočička",
    subtitle: "Duhy na zdi.",
    notes: "Kruh Ø 15 cm · kočička",
    description: "Test.",
    category: "lapace-slunce",
    active: true,
    price: 199,
    bulk: { min_qty: 2, price: 175 },
  };
  const created = await a("/api/admin/product", { product: sun, new: true });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(
    (await a("/api/admin/product", { product: sun, new: true })).status,
    409,
  );
  assert.equal(
    (
      await a("/api/admin/product", {
        product: { ...sun, bulk: { min_qty: 2, price: 250 } },
      })
    ).status,
    400,
  );
  const call = client(shop.url);
  const listed = (await call("/api/products")).body;
  assert.ok(listed.some((p) => p.id === sun.id));
  const bought = await call(
    "/api/orders",
    order({
      email: "lapac@example.com",
      items: [{ id: sun.id, qty: 2 }],
    }),
  );
  assert.equal(bought.status, 201, JSON.stringify(bought.body));
  assert.equal(bought.body.pricing.items, 350);
  assert.equal(bought.body.pricing.bulkSavings, 48);
  const page = await fetch(`${shop.url}/produkty/${sun.id}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-product="lapac-slunce-kocka"/);
  assert.equal((await fetch(`${shop.url}/produkty/neexistuje`)).status, 200);

  // Editing a product from the file overrides it; reset brings the original back.
  const all = (await a("/api/admin/products")).body;
  const okurka = all.find((p) => p.id === "okurka-zazvor-mata");
  const edited = await a("/api/admin/product", {
    product: {
      ...okurka,
      variants: okurka.variants.map((v) => ({ ...v, price: v.price + 10 })),
    },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  let shown = (await call("/api/products")).body.find(
    (p) => p.id === "okurka-zazvor-mata",
  );
  assert.equal(shown.variants[0].price, 359);
  await a("/api/admin/product-reset", { id: "okurka-zazvor-mata" });
  await a("/api/admin/product-reset", { id: sun.id });
  shown = (await call("/api/products")).body.find(
    (p) => p.id === "okurka-zazvor-mata",
  );
  assert.equal(shown.variants[0].price, 349);
  assert.ok(!(await call("/api/products")).body.some((p) => p.id === sun.id));
});
