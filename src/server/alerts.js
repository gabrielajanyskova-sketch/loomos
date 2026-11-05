/** "Hlídat dostupnost": customers ask for one e-mail when a sold-out product is in stock again. */
import {
  assertSameOrigin,
  clientIp,
  email,
  fail,
  json,
  readJson,
} from "./http.js";
import { now } from "./db.js";
import { limit } from "./auth.js";
import { loadCatalog, stockMap, variantsOf } from "./catalog.js";
import { sendMail, shopEmail } from "./mail.js";

export async function subscribe(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  await limit(db, `alert:${clientIp(request)}`, 10, 3600);
  const address = email(data.email);
  const { byId } = await loadCatalog(db);
  const product = byId.get(String(data.product_id || ""));
  const variant =
    product &&
    variantsOf(product).find((v) => v.id === String(data.variant_id ?? ""));
  if (!variant) fail(400, "Neznámý produkt.");
  const stock = (await stockMap(db))[`${product.id}::${variant.id}`];
  if (stock !== 0)
    fail(409, "Tohle zboží je skladem, můžete ho rovnou objednat.");
  await db
    .prepare(
      "INSERT OR IGNORE INTO stock_alerts (email, product_id, variant_id, created) VALUES (?,?,?,?)",
    )
    .bind(address, product.id, variant.id, now())
    .run();
  return json({ ok: true }, 201);
}

/**
 * Sends the waiting e-mails for everything that is in stock again and deletes those rows.
 * Called after admin changes (stock, prices, finished workshop batch, cancelled order).
 */
export async function notifyRestocked(db, env, origin) {
  const { results } = await db
    .prepare(
      `SELECT a.email, a.product_id, a.variant_id FROM stock_alerts a
       LEFT JOIN stock s ON s.product_id = a.product_id AND s.variant_id = a.variant_id
       WHERE s.quantity IS NULL OR s.quantity > 0`,
    )
    .all();
  if (!results.length) return 0;
  const { byId } = await loadCatalog(db);
  let sent = 0;
  for (const alert of results) {
    const product = byId.get(alert.product_id);
    const variant = product
      ? variantsOf(product).find((v) => v.id === alert.variant_id)
      : null;
    if (product && variant) {
      const name = product.name + (variant.name ? ` — ${variant.name}` : "");
      const url = `${origin}/produkty/${encodeURIComponent(product.id)}${variant.id ? `?velikost=${encodeURIComponent(variant.id)}` : ""}`;
      await sendMail(env, {
        to: alert.email,
        subject: `${product.name} je zase skladem | LOOMOS`,
        title: "Je zase skladem",
        key: `restock-${alert.product_id}-${alert.variant_id}-${alert.email}-${now()}`,
        replyTo: shopEmail(env),
        blocks: [
          `Dobrý den,\nhlídali jste dostupnost: ${name} je zase skladem. Kusů bývá málo, tak neváhejte.`,
          { button: ["Zobrazit v e-shopu", url] },
          "Tohle je jediná zpráva — váš e-mail jsem po odeslání z hlídání smazala.",
        ],
      });
      sent++;
    }
    await db
      .prepare(
        "DELETE FROM stock_alerts WHERE email=? AND product_id=? AND variant_id=?",
      )
      .bind(alert.email, alert.product_id, alert.variant_id)
      .run();
  }
  return sent;
}

/** Admin overview: how many people wait for which product. */
export async function overview(db) {
  const { results } = await db
    .prepare(
      "SELECT product_id, variant_id, COUNT(*) AS count FROM stock_alerts GROUP BY product_id, variant_id",
    )
    .all();
  return json(results);
}
