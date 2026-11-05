import {
  assertSameOrigin,
  binary,
  clientIp,
  email,
  fail,
  json,
  phone,
  readJson,
  text,
} from "./http.js";
import { now } from "./db.js";
import { limit, randomToken, readSession } from "./auth.js";
import { publicCatalog, resolveItems, stockMap } from "./catalog.js";
import { logOrder } from "./heureka.js";
import {
  priceCart,
  SHIPPING,
  PAYMENT,
  shippingKind,
  shippingProvider,
} from "../../assets/js/pricing.mjs";
import {
  czechAccountToIban,
  formatIban,
  spayd,
  validIban,
} from "../../assets/js/payment.mjs";
import { seller } from "../../assets/js/site.mjs";
import { trackingOf } from "../../assets/js/orders.mjs";
import { czk, orderRows, sendMail, shopEmail, withdrawalNote } from "./mail.js";
import { qrPng } from "./png.js";

export const PAYMENT_DAYS = 7;

/** Bank details from BANK_ACCOUNT ("19-2000145399/0800") or BANK_IBAN. */
export function bank(env) {
  const iban = env.BANK_IBAN
    ? env.BANK_IBAN.replace(/\s/g, "").toUpperCase()
    : env.BANK_ACCOUNT
      ? czechAccountToIban(env.BANK_ACCOUNT)
      : null;
  if (!iban || !validIban(iban)) return null;
  return { iban, account: env.BANK_ACCOUNT || formatIban(iban) };
}
export function paymentInfo(env, order) {
  const b = bank(env);
  if (!b) return null;
  const amount = order.pricing.total;
  const vs = order.number;
  const message = `LOOMOS ${order.number}`;
  return {
    account: b.account,
    iban: formatIban(b.iban),
    amount,
    vs,
    message,
    due_days: PAYMENT_DAYS,
    spayd: spayd({ iban: b.iban, amount, vs, message, recipient: seller.name }),
  };
}

export async function currentCustomer(db, request) {
  const id = await readSession(db, request, "customer");
  if (!id) return null;
  return db
    .prepare(
      "SELECT id, email, name, phone, created FROM customers WHERE id=? AND blocked=0",
    )
    .bind(id)
    .first();
}

/** Look up an applicable discount code or explain why it does not apply. */
export async function loadCode(db, raw) {
  const code = text(raw, "slevový kód", 40, false).toUpperCase();
  if (!code) return null;
  const row = await db
    .prepare("SELECT * FROM codes WHERE code=? AND active=1")
    .bind(code)
    .first();
  const t = now();
  if (
    !row ||
    (row.valid_from && row.valid_from > t) ||
    (row.valid_to && row.valid_to < t)
  )
    fail(400, "Tento slevový kód neplatí.");
  if (row.max_uses != null && row.uses >= row.max_uses)
    fail(400, "Tento slevový kód už byl vyčerpán.");
  return {
    code: row.code.toUpperCase(),
    type: row.type,
    value: row.value,
    min_total: row.min_total,
  };
}

export async function products(db) {
  return json(await publicCatalog(db));
}

export async function checkCode(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2048);
  await limit(db, `code:${clientIp(request)}`, 30, 600);
  return json(await loadCode(db, data.code));
}

const publicOrder = (row, env) => {
  const order = JSON.parse(row.payload);
  return {
    number: row.number,
    created: row.created,
    status: row.status,
    test: Boolean(row.test),
    items: order.items,
    pricing: order.pricing,
    shipping: order.shipping,
    pickup_point: order.pickup_point,
    address: order.address || null,
    balikovna: order.balikovna || null,
    payment:
      row.status === "nova"
        ? paymentInfo(env, { ...order, number: row.number })
        : null,
    tracking: trackingOf({ ...order, shipping: order.shipping }),
    history: (order.history || []).map(({ status, at, note }) => ({
      status,
      at,
      ...(note ? { note } : {}),
    })),
  };
};

export async function viewOrder(db, request, env) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{32}$/.test(token)) fail(404, "Objednávka nenalezena.");
  const row = await db
    .prepare("SELECT * FROM orders WHERE public_token=?")
    .bind(token)
    .first();
  if (!row) fail(404, "Objednávka nenalezena.");
  const invoice = await db
    .prepare("SELECT number FROM invoices WHERE order_number=?")
    .bind(row.number)
    .first();
  return json({ ...publicOrder(row, env), invoice: invoice?.number || null });
}

export async function qrImage(db, request, env) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{32}$/.test(token)) fail(404, "Nenalezeno.");
  const row = await db
    .prepare("SELECT number, payload FROM orders WHERE public_token=?")
    .bind(token)
    .first();
  const info =
    row && paymentInfo(env, { ...JSON.parse(row.payload), number: row.number });
  if (!info) fail(404, "Nenalezeno.");
  return binary(await qrPng(info.spayd), "image/png", {
    "Cache-Control": "private, max-age=86400",
    // Shown in the payment e-mail: webmail pages on other domains must be allowed to load it.
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
}

export async function createOrder(db, request, env, ctx) {
  assertSameOrigin(request);
  const data = await readJson(request);
  const requestId = text(data.request_id, "identifikátor", 36);
  if (!/^[0-9a-f-]{36}$/.test(requestId)) fail(400, "Neplatný požadavek.");
  const prior = await db
    .prepare("SELECT * FROM orders WHERE request_id=?")
    .bind(requestId)
    .first();
  if (prior)
    return json({ ...publicOrder(prior, env), token: prior.public_token });
  await limit(
    db,
    `order:${clientIp(request)}`,
    Number(env.ORDER_RATE_LIMIT) || 20,
    3600,
  );

  const customer = {
    name: text(data.name, "jméno a příjmení", 120),
    email: email(data.email),
    phone: phone(data.phone),
  };
  const shipping = data.shipping;
  if (!Object.hasOwn(SHIPPING, shipping)) fail(400, "Vyberte způsob dopravy.");
  let pickupPoint = "";
  let pointId = "";
  let address = null;
  let balikovna = null;
  if (
    shippingProvider(shipping) === "balikovna" &&
    shippingKind(shipping) === "point"
  ) {
    // Česká pošta needs the Balíkovna ZIP and name for the label ("BALÍKOVNA / ZIP NAME").
    balikovna = {
      id: text(String(data.balikovna_id ?? ""), "Balíkovna", 12),
      zip: text(data.balikovna_zip, "PSČ Balíkovny", 6).replace(/\s/g, ""),
      name: text(data.balikovna_name, "Balíkovna", 120),
    };
    if (!/^\d{1,12}$/.test(balikovna.id) || !/^\d{5}$/.test(balikovna.zip))
      fail(400, "Vyberte prosím Balíkovnu na mapě.");
    pickupPoint = `${balikovna.name}, ${balikovna.zip.slice(0, 3)} ${balikovna.zip.slice(3)}`;
  } else if (shippingKind(shipping) === "point") {
    pickupPoint = text(data.pickup_point, "výdejní místo", 200);
    pointId = text(data.packeta_point_id, "výdejní místo", 10, false);
    if (pointId && !/^\d{1,10}$/.test(pointId))
      fail(400, "Neplatné výdejní místo.");
  }
  if (shippingKind(shipping) === "home") {
    address = {
      street: text(data.street, "ulice a číslo domu", 120),
      city: text(data.city, "obec", 80),
      zip: text(data.zip, "PSČ", 10).replace(/\s/g, ""),
    };
    if (!/^\d{5}$/.test(address.zip))
      fail(400, "Zadejte platné PSČ (5 číslic).");
    if (!/\d/.test(address.street)) fail(400, "Doplňte číslo domu.");
  }
  if (!PAYMENT[data.payment]?.available) fail(400, "Vyberte způsob platby.");
  if (data.terms !== true)
    fail(
      400,
      "Pro odeslání objednávky je nutný souhlas s obchodními podmínkami.",
    );
  const note = text(data.note, "poznámka", 1000, false);

  const member = await currentCustomer(db, request);
  const lines = resolveItems(data.items, await publicCatalog(db));
  const code = await loadCode(db, data.code);
  const pricing = priceCart({ lines, member: Boolean(member), code, shipping });
  if (pricing.codeError) fail(400, pricing.codeError);

  const stock = await stockMap(db);
  for (const line of lines)
    if (stock[line.key] !== undefined && stock[line.key] < line.qty)
      fail(
        409,
        stock[line.key]
          ? `${line.name}: skladem zbývá jen ${stock[line.key]} ks.`
          : `${line.name} je bohužel vyprodaná.`,
      );

  const test = env.SHOP_LIVE !== "1";
  const token = randomToken(16);
  const created = now();
  const { lines: priced, ...totals } = pricing;
  const order = {
    customer,
    items: priced.map((l) => ({
      id: l.id,
      variant: l.variant,
      name: l.name,
      price: l.originalUnit,
      unit: l.unit,
      qty: l.qty,
      total: l.total,
    })),
    shipping,
    pickup_point: pickupPoint,
    packeta_point_id: pointId,
    ...(address ? { address } : {}),
    ...(balikovna ? { balikovna } : {}),
    payment: data.payment,
    note,
    member: Boolean(member),
    pricing: totals,
    history: [{ status: "nova", at: created }],
  };
  const yy = String(new Date().getFullYear()).slice(2);
  const statements = [
    db
      .prepare(
        "INSERT INTO orders (request_id, public_token, created, status, customer_id, email, total, test, payload) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        requestId,
        token,
        created,
        "nova",
        member?.id ?? null,
        customer.email,
        pricing.total,
        test ? 1 : 0,
        JSON.stringify(order),
      ),
    db
      .prepare(
        "UPDATE orders SET number = ? || printf('%05d', id) WHERE request_id=?",
      )
      .bind(yy, requestId),
    ...lines.map((l) =>
      db
        .prepare(
          "UPDATE stock SET quantity = quantity - ? WHERE product_id=? AND variant_id=?",
        )
        .bind(l.qty, l.id, l.variant),
    ),
  ];
  if (pricing.code)
    statements.push(
      db
        .prepare("UPDATE codes SET uses = uses + 1 WHERE code=?")
        .bind(pricing.code),
    );
  try {
    await db.batch(statements);
  } catch (error) {
    if (/CHECK constraint/i.test(String(error?.message || error)))
      fail(
        409,
        "Zboží nebo slevový kód se mezitím vyčerpaly. Obnovte prosím košík.",
      );
    if (/UNIQUE/i.test(String(error?.message || error)))
      fail(409, "Objednávka už byla odeslána.");
    throw error;
  }
  const row = await db
    .prepare("SELECT * FROM orders WHERE request_id=?")
    .bind(requestId)
    .first();
  ctx.waitUntil(sendOrderEmails(env, request, row.number, token, order, test));
  // Heureka "Ověřeno zákazníky": not for test orders, and only without the customer's opt-out.
  if (!test && data.heureka_optout !== true)
    ctx.waitUntil(logOrder(env, order, row.number));
  return json({ ...publicOrder(row, env), token }, 201);
}

function orderUrl(request, token) {
  return `${new URL(request.url).origin}/objednavka?t=${token}`;
}

async function sendOrderEmails(env, request, number, token, order, test) {
  const payment = paymentInfo(env, { ...order, number });
  const testNote = test
    ? [
        "Upozornění: e-shop je ve zkušebním provozu. Tato objednávka slouží k testování a nebude vyřízena. Platební údaje jsou jen ukázka, nic neplaťte.",
      ]
    : [];
  const payBlocks = payment
    ? [
        `Prosím o úhradu převodem do ${PAYMENT_DAYS} dnů. Nejrychleji zaplatíte načtením QR kódu v bankovní aplikaci.`,
        {
          rows: [
            ["Číslo účtu", payment.account],
            ["IBAN", payment.iban],
            ["Variabilní symbol", payment.vs, true],
            ["Částka", czk(payment.amount), true],
          ],
        },
        {
          image: [
            `${new URL(request.url).origin}/api/qr?t=${token}`,
            "QR kód pro platbu",
          ],
        },
        "Objednávku odešlu po připsání platby na účet.",
      ]
    : ["Platební údaje vám zašlu v samostatném e-mailu."];
  await Promise.all([
    sendMail(env, {
      to: order.customer.email,
      subject: `${test ? "[ZKUŠEBNÍ] " : ""}Potvrzení objednávky ${number} | LOOMOS`,
      title: "Děkuji za objednávku",
      key: `order-${number}-customer`,
      replyTo: shopEmail(env),
      blocks: [
        ...testNote,
        `Dobrý den, ${order.customer.name},\nděkuji za vaši objednávku v LOOMOS. Číslo objednávky je ${number}.`,
        { rows: orderRows(order) },
        ...payBlocks,
        { button: ["Zobrazit objednávku", orderUrl(request, token)] },
        "S dotazy stačí odpovědět na tento e-mail.",
        withdrawalNote(new URL(request.url).origin, number),
      ],
    }),
    sendMail(env, {
      to: shopEmail(env),
      subject: `${test ? "[ZKUŠEBNÍ] " : ""}Nová objednávka ${number} — ${czk(order.pricing.total)}`,
      title: `Nová objednávka ${number}`,
      key: `order-${number}-shop`,
      replyTo: order.customer.email,
      blocks: [
        { rows: orderRows(order) },
        {
          rows: [
            ["Zákazník", order.customer.name],
            ["E-mail", order.customer.email],
            ["Telefon", order.customer.phone],
            ["Registrovaný", order.member ? "ano" : "ne"],
            ["Poznámka", order.note || "—"],
          ],
        },
        {
          button: [
            "Otevřít administraci",
            `${new URL(request.url).origin}/admin/`,
          ],
        },
      ],
    }),
  ]);
}
