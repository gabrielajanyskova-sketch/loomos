/**
 * Verified reviews. Only the customer of a shipped order (link with the order's secret token)
 * can rate the products from it, once per product. Reviews are published at once; the owner can
 * hide only abusive or unrelated ones and reply publicly.
 */
import {
  assertSameOrigin,
  clientIp,
  fail,
  json,
  readJson,
  text,
} from "./http.js";
import { now } from "./db.js";
import { limit } from "./auth.js";

const REVIEWABLE = ["odeslana", "k-vyzvednuti", "dokoncena"];

/** "Jana Nováková" → "Jana N." (the full surname is never published). */
export const publicName = (name) => {
  const [first = "Zákazník", second = ""] = String(name).trim().split(/\s+/);
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
};

async function orderByToken(db, token) {
  if (!/^[0-9a-f]{32}$/.test(token || "")) fail(404, "Objednávka nenalezena.");
  const row = await db
    .prepare("SELECT number, status, payload FROM orders WHERE public_token=?")
    .bind(token)
    .first();
  if (!row) fail(404, "Objednávka nenalezena.");
  return { ...row, order: JSON.parse(row.payload) };
}

/** What the customer can still rate for this order. */
export async function pending(db, request) {
  const { number, status, order } = await orderByToken(
    db,
    new URL(request.url).searchParams.get("t"),
  );
  const { results } = await db
    .prepare("SELECT product_id FROM reviews WHERE order_number=?")
    .bind(number)
    .all();
  const done = new Set(results.map((r) => r.product_id));
  const items = [...new Map(order.items.map((i) => [i.id, i])).values()];
  return json({
    number,
    open: REVIEWABLE.includes(status),
    name: publicName(order.customer.name),
    items: items.map((i) => ({
      id: i.id,
      name: i.name.replace(/ — (Malá|Velká)$/, ""),
      reviewed: done.has(i.id),
    })),
  });
}

export async function create(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 16384);
  await limit(db, `review:${clientIp(request)}`, 20, 3600);
  const { number, status, order } = await orderByToken(db, data.token);
  if (!REVIEWABLE.includes(status))
    fail(409, "Hodnotit půjde, až bude objednávka odeslaná.");
  const bought = new Set(order.items.map((i) => i.id));
  const name =
    text(data.name, "jméno", 40, false) || publicName(order.customer.name);
  const list = Array.isArray(data.reviews) ? data.reviews.slice(0, 20) : [];
  const rows = list
    .filter((r) => r && bought.has(r.product_id))
    .map((r) => {
      const rating = Number(r.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        fail(400, "Vyberte počet hvězdiček (1–5).");
      return {
        product_id: r.product_id,
        rating,
        text: text(r.text, "hodnocení", 1500, false),
      };
    });
  if (!rows.length) fail(400, "Ohodnoťte prosím alespoň jeden produkt.");
  const created = now();
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO reviews (order_number, product_id, name, rating, text, created) VALUES (?,?,?,?,?,?)",
        )
        .bind(number, r.product_id, name, r.rating, r.text, created),
    ),
  );
  return json({ ok: true }, 201);
}

/** Public: reviews of one product, newest first. */
export async function forProduct(db, request) {
  const id = new URL(request.url).searchParams.get("product") || "";
  const { results } = await db
    .prepare(
      "SELECT name, rating, text, created, reply FROM reviews WHERE product_id=? AND hidden=0 ORDER BY created DESC LIMIT 100",
    )
    .bind(id)
    .all();
  return json(results);
}

/** product id → {average, count}, for product cards and pages. */
export async function ratingSummary(db) {
  const { results } = await db
    .prepare(
      "SELECT product_id, AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE hidden=0 GROUP BY product_id",
    )
    .all();
  return new Map(
    results.map((r) => [
      r.product_id,
      { average: Math.round(r.average * 10) / 10, count: r.count },
    ]),
  );
}

/* ---------- admin ---------- */
export async function adminList(db) {
  const { results } = await db
    .prepare("SELECT * FROM reviews ORDER BY created DESC LIMIT 300")
    .all();
  return json(results);
}

export async function adminUpdate(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 4096);
  const id = Number(data.id);
  if (data.action === "hide" || data.action === "show")
    await db
      .prepare("UPDATE reviews SET hidden=? WHERE id=?")
      .bind(data.action === "hide" ? 1 : 0, id)
      .run();
  else if (data.action === "reply")
    await db
      .prepare("UPDATE reviews SET reply=? WHERE id=?")
      .bind(text(data.reply, "odpověď", 1000, false), id)
      .run();
  else fail(400, "Neznámá akce.");
  return json({ ok: true });
}
