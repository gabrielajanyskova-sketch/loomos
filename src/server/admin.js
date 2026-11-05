import {
  assertSameOrigin,
  clientIp,
  fail,
  json,
  readJson,
  text,
} from "./http.js";
import { now } from "./db.js";
import {
  createSession,
  endSession,
  limit,
  readSession,
  safeEqual,
} from "./auth.js";
import { saveProductPrice } from "./product-prices.js";
import { loadCatalog, priceProducts, variantsOf } from "./catalog.js";
import { ORDER_STATUS, trackingOf } from "../../assets/js/orders.mjs";
import { shippingKind, shippingProvider } from "../../assets/js/pricing.mjs";
import { czk, orderRows, sendMail, shopEmail } from "./mail.js";
import { createPacket } from "./packeta.js";
import { invoiceFor, invoicePdf, issueInvoice, pdfBase64 } from "./invoice.js";
import { binary } from "./http.js";

export async function requireAdmin(db, request) {
  if ((await readSession(db, request, "admin")) === null)
    fail(401, "Přihlaste se do administrace.");
}

export async function session(db, request, env) {
  return json({
    authenticated: (await readSession(db, request, "admin")) !== null,
    configured: Boolean(env.ADMIN_PASSWORD),
    packeta: Boolean(env.PACKETA_API_PASSWORD),
    mail: Boolean(env.RESEND_API_KEY),
    live: env.SHOP_LIVE === "1",
  });
}

export async function login(db, request, env) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12)
    fail(
      503,
      "Nastavte v Cloudflare tajnou proměnnou ADMIN_PASSWORD (alespoň 12 znaků).",
    );
  await limit(db, `admin-login:${clientIp(request)}`, 10, 900);
  await limit(db, "admin-login:all", 50, 900);
  if (!(await safeEqual(String(data.password || ""), env.ADMIN_PASSWORD)))
    fail(401, "Nesprávné heslo.");
  const cookie = await createSession(db, request, "admin", 0);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

export async function logout(db, request) {
  assertSameOrigin(request);
  return json({ ok: true }, 200, {
    "Set-Cookie": await endSession(db, request, "admin"),
  });
}

const adminOrder = (row) => ({
  ...JSON.parse(row.payload),
  invoice: row.invoice_number || null,
  number: row.number,
  created: row.created,
  status: row.status,
  test: Boolean(row.test),
  registered: row.customer_id != null,
  token: row.public_token,
  withdrawals: row.open_withdrawals || 0,
});

export async function orders(db) {
  const { results } = await db
    .prepare(
      `SELECT o.*, i.number AS invoice_number,
        (SELECT COUNT(*) FROM withdrawals w WHERE w.order_number = o.number AND w.resolved = 0) AS open_withdrawals
       FROM orders o LEFT JOIN invoices i ON i.order_number = o.number
       ORDER BY o.id DESC LIMIT 500`,
    )
    .all();
  return json(results.map(adminOrder));
}

const STATUS_MAIL = {
  zaplacena: [
    "Platba přijata",
    "děkuji, vaše platba dorazila. Svíčky teď pečlivě připravuji a brzy vám dám vědět o odeslání.",
  ],
  odeslana: [
    "Objednávka je na cestě",
    "vaše objednávka je odeslaná. Jakmile dorazí, dopravce vám pošle zprávu.",
  ],
  "k-vyzvednuti": [
    "Objednávka je připravená",
    "vaše objednávka je připravená k osobnímu vyzvednutí. Ozvu se vám a domluvíme čas předání.",
  ],
  zrusena: [
    "Objednávka byla zrušena",
    "vaše objednávka byla zrušena. Pokud jste už platili, peníze vám vrátím na účet, ze kterého platba přišla. S dotazy mi napište.",
  ],
};

export async function setStatus(db, request, env, ctx) {
  assertSameOrigin(request);
  const data = await readJson(request, 4096);
  const number = text(data.number, "objednávka", 20);
  const status = data.status;
  if (!Object.hasOwn(ORDER_STATUS, status)) fail(400, "Neplatný stav.");
  const note = text(data.note, "vzkaz pro zákazníka", 500, false);
  const tracking =
    data.tracking === undefined
      ? undefined
      : text(data.tracking, "sledovací číslo", 40, false);
  if (tracking && !/^[A-Za-z0-9 -]{4,40}$/.test(tracking))
    fail(
      400,
      "Sledovací číslo smí obsahovat jen písmena, čísla, mezery a pomlčky.",
    );
  const row = await db
    .prepare("SELECT * FROM orders WHERE number=?")
    .bind(number)
    .first();
  if (!row) fail(404, "Objednávka neexistuje.");
  const order = JSON.parse(row.payload);
  const statusChanged = row.status !== status;
  const trackingChanged =
    tracking !== undefined && tracking !== (order.tracking || "");
  if (!statusChanged && !trackingChanged && !note) return json(adminOrder(row));
  if (row.status === "zrusena" && statusChanged)
    fail(400, "Zrušenou objednávku už nelze obnovit. Vytvořte novou.");
  if (trackingChanged) order.tracking = tracking;
  if (statusChanged || note)
    order.history = [
      ...(order.history || []),
      { status, at: now(), ...(note ? { note } : {}) },
    ];
  const statements = [
    db
      .prepare("UPDATE orders SET status=?, payload=? WHERE number=?")
      .bind(status, JSON.stringify(order), number),
  ];
  if (statusChanged && status === "zrusena")
    for (const item of order.items)
      statements.push(
        db
          .prepare(
            "UPDATE stock SET quantity = quantity + ? WHERE product_id=? AND variant_id=?",
          )
          .bind(item.qty, item.id, item.variant),
      );
  await db.batch(statements);
  const mail = statusChanged
    ? STATUS_MAIL[status]
    : note || trackingChanged
      ? ["Novinka k vaší objednávce", "mám pro vás novinku k objednávce."]
      : null;
  // Paid → issue the invoice and attach it to the "payment received" e-mail.
  let attachments = [];
  if (statusChanged && status === "zaplacena") {
    const invoice = await issueInvoice(db, env, {
      ...row,
      payload: JSON.stringify(order),
    });
    attachments = [
      {
        filename: `faktura-${invoice.number}.pdf`,
        content: pdfBase64(await invoicePdf(invoice)),
      },
    ];
  }
  if (data.notify !== false && mail) {
    const [title, body] = mail;
    const track = trackingOf(order);
    const origin = new URL(request.url).origin;
    ctx.waitUntil(
      sendMail(env, {
        to: order.customer.email,
        subject: `${title} — objednávka ${number} | LOOMOS`,
        title,
        key: `status-${number}-${status}-${order.history?.length || 0}-${track?.code || ""}`,
        replyTo: shopEmail(env),
        attachments,
        blocks: [
          `Dobrý den, ${order.customer.name},\n${body}`,
          ...(note ? [`Vzkaz ode mě: ${note}`] : []),
          ...(attachments.length
            ? ["Fakturu najdete v příloze tohoto e-mailu."]
            : []),
          ...(track && ["odeslana", "dokoncena"].includes(status)
            ? [
                track.url
                  ? { button: [`Sledovat zásilku ${track.code}`, track.url] }
                  : `Sledovací číslo zásilky: ${track.code}`,
              ]
            : []),
          { rows: orderRows(order) },
          ...(["odeslana", "k-vyzvednuti", "dokoncena"].includes(status)
            ? [
                "Až svíčky nebo lapače vyzkoušíte, budu moc ráda za vaše hodnocení — pomůže dalším zákazníkům i mně.",
                {
                  button: [
                    "Ohodnotit nákup",
                    `${origin}/recenze?t=${row.public_token}`,
                  ],
                },
              ]
            : []),
          {
            button: [
              "Stav objednávky",
              `${origin}/objednavka?t=${row.public_token}`,
              // Secondary next to "Ohodnotit nákup", so one action stands out.
              ["odeslana", "k-vyzvednuti", "dokoncena"].includes(status),
            ],
          },
        ],
      }),
    );
  }
  return json(adminOrder({ ...row, status, payload: JSON.stringify(order) }));
}

export async function packet(db, request, env) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  const number = text(data.number, "objednávka", 20);
  const weight = data.weight;
  if (typeof weight !== "number" || !(weight > 0 && weight <= 15))
    fail(400, "Zadejte hmotnost 0,01–15 kg.");
  const row = await db
    .prepare("SELECT * FROM orders WHERE number=?")
    .bind(number)
    .first();
  if (!row) fail(404, "Objednávka neexistuje.");
  const order = JSON.parse(row.payload);
  if (order.packeta) fail(409, "Zásilka už byla vytvořena.");
  const kind = shippingKind(order.shipping);
  if (kind === "pickup") fail(400, "Osobní odběr nepotřebuje zásilku.");
  if (shippingProvider(order.shipping) !== "packeta")
    fail(400, "Zásilku České pošty podejte přes Českou poštu.");
  if (kind === "point" && !order.packeta_point_id)
    fail(400, "Objednávka nemá výdejní místo vybrané na mapě.");
  // Claim the order first so a double click cannot create two packets.
  const claim = await db
    .prepare(
      "UPDATE orders SET payload=json_set(payload,'$.packeta',json('{\"pending\":true}')) WHERE number=? AND json_extract(payload,'$.packeta') IS NULL",
    )
    .bind(number)
    .run();
  if (!claim.meta.changes) fail(409, "Zásilka se právě vytváří.");
  let result;
  try {
    result = await createPacket(env, { number, order, weight });
  } catch (error) {
    await db
      .prepare(
        "UPDATE orders SET payload=json_remove(payload,'$.packeta') WHERE number=?",
      )
      .bind(number)
      .run();
    throw error;
  }
  await db
    .prepare(
      "UPDATE orders SET payload=json_set(payload,'$.packeta',json(?)) WHERE number=?",
    )
    .bind(JSON.stringify(result), number)
    .run();
  return json(result, 201);
}

export async function stock(db) {
  const { results } = await db.prepare("SELECT * FROM stock").all();
  const map = Object.fromEntries(
    results.map((r) => [`${r.product_id}::${r.variant_id}`, r.quantity]),
  );
  const { all } = await loadCatalog(db);
  return json(
    (await priceProducts(db, all)).priced.flatMap((p) =>
      variantsOf(p).map((v) => ({
        product_id: p.id,
        category: p.category || "svicky",
        active: p.active,
        variant_id: v.id,
        name: p.name + (v.name ? ` — ${v.name}` : ""),
        price: v.price,
        regular_price: p.variants?.length ? v.regular_price : p.regular_price,
        sale_price: p.variants?.length ? v.sale_price : p.sale_price,
        lowest_30: p.variants?.length ? v.lowest_30 : p.lowest_30,
        revision: p.variants?.length ? v.revision : p.revision,
        tracked_since: p.variants?.length ? v.tracked_since : p.tracked_since,
        quantity: map[`${p.id}::${v.id}`] ?? null,
      })),
    ),
  );
}

export async function setPrice(db, request) {
  assertSameOrigin(request);
  return json(
    await saveProductPrice(
      db,
      await readJson(request, 2048),
      (await loadCatalog(db)).all,
      variantsOf,
    ),
  );
}

export async function setStock(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  const product = (await loadCatalog(db)).all.find(
    (p) => p.id === data.product_id,
  );
  const variant =
    product && variantsOf(product).find((v) => v.id === data.variant_id);
  if (!variant) fail(400, "Neznámý produkt.");
  const quantity = data.quantity;
  if (quantity === null)
    await db
      .prepare("DELETE FROM stock WHERE product_id=? AND variant_id=?")
      .bind(product.id, variant.id)
      .run();
  else if (Number.isInteger(quantity) && quantity >= 0 && quantity <= 100000)
    await db
      .prepare(
        "INSERT INTO stock (product_id, variant_id, quantity) VALUES (?,?,?) ON CONFLICT(product_id, variant_id) DO UPDATE SET quantity=excluded.quantity",
      )
      .bind(product.id, variant.id, quantity)
      .run();
  else fail(400, "Zadejte počet kusů (celé číslo).");
  return json({ ok: true });
}

export async function customers(db) {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.email, c.name, c.phone, c.created, c.blocked,
        COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status != 'zrusena' THEN o.total END), 0) AS spent
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id ORDER BY c.id DESC LIMIT 1000`,
    )
    .all();
  return json(results.map((c) => ({ ...c, blocked: Boolean(c.blocked) })));
}

export async function customerAction(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  const id = data.id;
  if (!Number.isInteger(id)) fail(400, "Neplatný zákazník.");
  if (data.action === "block" || data.action === "unblock") {
    const blocked = data.action === "block" ? 1 : 0;
    await db.batch([
      db.prepare("UPDATE customers SET blocked=? WHERE id=?").bind(blocked, id),
      ...(blocked
        ? [
            db
              .prepare(
                "DELETE FROM sessions WHERE kind='customer' AND subject=?",
              )
              .bind(id),
          ]
        : []),
    ]);
  } else if (data.action === "delete") {
    await db.batch([
      db
        .prepare("UPDATE orders SET customer_id=NULL WHERE customer_id=?")
        .bind(id),
      db
        .prepare("DELETE FROM sessions WHERE kind='customer' AND subject=?")
        .bind(id),
      db.prepare("DELETE FROM resets WHERE customer_id=?").bind(id),
      db.prepare("DELETE FROM customers WHERE id=?").bind(id),
    ]);
  } else fail(400, "Neznámá akce.");
  return json({ ok: true });
}

export async function codes(db) {
  const { results } = await db
    .prepare("SELECT * FROM codes ORDER BY created DESC")
    .all();
  return json(results.map((c) => ({ ...c, active: Boolean(c.active) })));
}

const optionalInt = (value, label, min, max) => {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isInteger(value) || value < min || value > max)
    fail(400, `Zkontrolujte pole ${label}.`);
  return value;
};

export async function saveCode(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2048);
  const code = text(data.code, "kód", 40).toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code))
    fail(400, "Kód smí obsahovat jen písmena bez diakritiky, čísla, - a _.");
  if (!["percent", "fixed"].includes(data.type))
    fail(400, "Neplatný typ slevy.");
  const value = optionalInt(
    data.value,
    "hodnota",
    1,
    data.type === "percent" ? 90 : 100000,
  );
  if (value === null) fail(400, "Zadejte hodnotu slevy.");
  const minTotal =
    optionalInt(data.min_total, "minimální nákup", 0, 1000000) ?? 0;
  const maxUses = optionalInt(data.max_uses, "počet použití", 1, 1000000);
  const validFrom = optionalInt(data.valid_from, "platnost od", 0, 4102444800);
  const validTo = optionalInt(data.valid_to, "platnost do", 0, 4102444800);
  const note = text(data.note, "poznámka", 200, false);
  await db
    .prepare(
      `INSERT INTO codes (code, type, value, min_total, max_uses, valid_from, valid_to, active, note, created)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(code) DO UPDATE SET type=excluded.type, value=excluded.value, min_total=excluded.min_total,
         max_uses=excluded.max_uses, valid_from=excluded.valid_from, valid_to=excluded.valid_to,
         active=excluded.active, note=excluded.note`,
    )
    .bind(
      code,
      data.type,
      value,
      minTotal,
      maxUses,
      validFrom,
      validTo,
      data.active === false ? 0 : 1,
      note,
      now(),
    )
    .run()
    .catch((error) => {
      if (/CHECK/i.test(String(error?.message)))
        fail(400, "Limit použití je nižší než počet už uplatněných použití.");
      throw error;
    });
  return json({ ok: true });
}

export async function deleteCode(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  await db
    .prepare("DELETE FROM codes WHERE code=?")
    .bind(text(data.code, "kód", 40))
    .run();
  return json({ ok: true });
}

export async function overview(db) {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE status='nova') AS awaiting_payment,
        (SELECT COUNT(*) FROM orders WHERE status='zaplacena') AS to_ship,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COALESCE(SUM(total),0) FROM orders WHERE status NOT IN ('zrusena','nova') AND test=0) AS revenue,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM stock WHERE quantity <= 2) AS low_stock`,
    )
    .first();
  return json({ ...row, revenue_label: czk(row.revenue) });
}

export async function deleteOrder(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const number = text(data.number, "objednávka", 30);
  const row = await db
    .prepare("SELECT * FROM orders WHERE number=?")
    .bind(number)
    .first();
  if (!row) fail(404, "Objednávka neexistuje.");
  const invoice = await invoiceFor(db, number);
  if (invoice && !row.test)
    fail(
      409,
      `K objednávce je vystavená faktura ${invoice.number}. Smazáním by vznikla díra v číselné řadě faktur — objednávku místo toho zrušte.`,
    );
  const order = JSON.parse(row.payload);
  const statements = [
    db.prepare("DELETE FROM orders WHERE number=?").bind(number),
    db.prepare("DELETE FROM invoices WHERE order_number=?").bind(number),
  ];
  if (row.status !== "zrusena")
    for (const item of order.items)
      statements.push(
        db
          .prepare(
            "UPDATE stock SET quantity = quantity + ? WHERE product_id=? AND variant_id=?",
          )
          .bind(item.qty, item.id, item.variant),
      );
  await db.batch(statements);
  return json({ ok: true });
}

export async function createInvoice(db, request, env) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const row = await db
    .prepare("SELECT * FROM orders WHERE number=?")
    .bind(text(data.number, "objednávka", 30))
    .first();
  if (!row) fail(404, "Objednávka neexistuje.");
  if (row.status === "zrusena")
    fail(400, "Ke zrušené objednávce fakturu nevystavíme.");
  const invoice = await issueInvoice(db, env, row);
  return json({ number: invoice.number });
}

export async function invoiceDownload(db, request) {
  const number = new URL(request.url).searchParams.get("order") || "";
  const invoice = await invoiceFor(db, number);
  if (!invoice) fail(404, "Faktura neexistuje.");
  return binary(await invoicePdf(invoice), "application/pdf", {
    "Content-Disposition": `inline; filename="faktura-${invoice.number}.pdf"`,
  });
}

export async function withdrawals(db) {
  const { results } = await db
    .prepare("SELECT * FROM withdrawals ORDER BY id DESC LIMIT 200")
    .all();
  return json(
    results.map((w) => ({
      ...w,
      matched: Boolean(w.matched),
      resolved: Boolean(w.resolved),
    })),
  );
}

export async function resolveWithdrawal(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 256);
  await db
    .prepare("UPDATE withdrawals SET resolved=1 WHERE id=?")
    .bind(Number(data.id))
    .run();
  return json({ ok: true });
}
