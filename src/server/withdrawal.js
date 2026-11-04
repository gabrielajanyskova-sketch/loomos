/**
 * Online withdrawal function (§ 1830a občanského zákoníku, from 1. 1. 2027; EU directive 2023/2673).
 * Customers withdraw without logging in; they get an acknowledgement with date and time by e-mail.
 */
import {
  assertSameOrigin,
  clientIp,
  email,
  fail,
  json,
  readJson,
  text,
} from "./http.js";
import { now } from "./db.js";
import { limit } from "./auth.js";
import { sendMail, shopEmail } from "./mail.js";
import { seller, sellerAddress } from "../../assets/js/site.mjs";
import { invoiceFor, invoicePdf } from "./invoice.js";
import { binary } from "./http.js";

const stamp = (t) =>
  new Date(t * 1000).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" });

export async function withdraw(db, request, env, ctx) {
  assertSameOrigin(request);
  const data = await readJson(request, 4096);
  await limit(db, `withdraw:${clientIp(request)}`, 10, 3600);
  if (data.confirm !== true) fail(400, "Odstoupení je potřeba potvrdit.");
  const name = text(data.name, "jméno a příjmení", 120);
  const address = email(data.email);
  const orderNumber = text(data.order_number, "číslo objednávky", 30);
  const items = text(data.items, "zboží", 1000, false);
  const reason = text(data.reason, "důvod", 1000, false);
  const created = now();
  const row = await db
    .prepare("SELECT * FROM orders WHERE number=? AND lower(email)=?")
    .bind(orderNumber, address)
    .first();
  const statements = [
    db
      .prepare(
        "INSERT INTO withdrawals (created, order_number, name, email, items, reason, matched) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(created, orderNumber, name, address, items, reason, row ? 1 : 0),
  ];
  if (row) {
    const order = JSON.parse(row.payload);
    order.withdrawal = { at: created, items, reason };
    order.history = [
      ...(order.history || []),
      {
        status: row.status,
        at: created,
        note: "Přijala jsem vaše odstoupení od smlouvy.",
      },
    ];
    statements.push(
      db
        .prepare("UPDATE orders SET payload=? WHERE number=?")
        .bind(JSON.stringify(order), orderNumber),
    );
  }
  await db.batch(statements);
  const summary = {
    rows: [
      ["Přijato", stamp(created)],
      ["Číslo objednávky", orderNumber],
      ["Jméno", name],
      ["E-mail", address],
      ["Zboží", items || "celá objednávka"],
      ...(reason ? [["Důvod (nepovinné)", reason]] : []),
    ],
  };
  ctx.waitUntil(
    Promise.all([
      sendMail(env, {
        to: address,
        subject: `Potvrzení odstoupení od smlouvy — objednávka ${orderNumber} | LOOMOS`,
        title: "Odstoupení od smlouvy jsem přijala",
        key: `withdrawal-${orderNumber}-${created}`,
        replyTo: shopEmail(env),
        blocks: [
          `Dobrý den, ${name},\npotvrzuji, že jsem ${stamp(created)} přijala vaše odstoupení od smlouvy.`,
          summary,
          `Zboží mi prosím pošlete zpět do 14 dnů na adresu ${seller.name}, ${sellerAddress} (ne na dobírku). Peníze vrátím do 14 dnů od odstoupení, nejdříve však po obdržení zboží, stejným způsobem, jakým jste platili.`,
          ...(row
            ? []
            : [
                "Objednávku s tímto číslem a e-mailem jsem automaticky nenašla — ozvu se vám, abych ji dohledala.",
              ]),
          "Tento e-mail si prosím uschovejte jako potvrzení.",
        ],
      }),
      sendMail(env, {
        to: shopEmail(env),
        subject: `Odstoupení od smlouvy — objednávka ${orderNumber}`,
        title: "Zákazník odstoupil od smlouvy",
        key: `withdrawal-shop-${orderNumber}-${created}`,
        replyTo: address,
        blocks: [
          row
            ? "Objednávka je v administraci označená."
            : "POZOR: objednávku se nepodařilo spárovat (číslo nebo e-mail nesedí).",
          summary,
        ],
      }),
    ]),
  );
  return json({ ok: true, received: created, matched: Boolean(row) }, 201);
}

/** Customer download of the invoice via the private order link. */
export async function customerInvoice(db, request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{32}$/.test(token)) fail(404, "Nenalezeno.");
  const row = await db
    .prepare("SELECT number FROM orders WHERE public_token=?")
    .bind(token)
    .first();
  const invoice = row && (await invoiceFor(db, row.number));
  if (!invoice) fail(404, "Faktura zatím nebyla vystavena.");
  return binary(await invoicePdf(invoice), "application/pdf", {
    "Content-Disposition": `inline; filename="faktura-${invoice.number}.pdf"`,
    "Cache-Control": "private, no-store",
  });
}
