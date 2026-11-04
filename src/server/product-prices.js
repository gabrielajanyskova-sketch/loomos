/** Persistent prices and actual public price history; never trust cart prices. */
import { fail } from "./http.js";
import { now } from "./db.js";
const DAY30 = 30 * 86400;
export const effectivePrice = (row) => row.sale_price ?? row.regular_price;
const validPrice = (value) =>
  value === null ||
  (Number.isSafeInteger(value) && value > 0 && value <= 100000);

export async function priceRows(db, catalog, variantsOf) {
  let rows = (await db.prepare("SELECT * FROM product_prices").all()).results;
  const keys = new Set(rows.map((r) => `${r.product_id}::${r.variant_id}`));
  const missing = catalog.flatMap((p) =>
    variantsOf(p)
      .filter((v) => !keys.has(`${p.id}::${v.id}`))
      .map((v) => ({ product_id: p.id, variant_id: v.id, price: v.price })),
  );
  if (missing.length) {
    const time = now();
    await db.batch(
      missing.flatMap((r) => [
        db
          .prepare(
            "INSERT OR IGNORE INTO product_prices(product_id,variant_id,regular_price,tracked_since) VALUES(?,?,?,?)",
          )
          .bind(r.product_id, r.variant_id, r.price, time),
        db
          .prepare(
            "INSERT INTO price_history(product_id,variant_id,price,created) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM price_history WHERE product_id=? AND variant_id=?)",
          )
          .bind(
            r.product_id,
            r.variant_id,
            r.price,
            time,
            r.product_id,
            r.variant_id,
          ),
      ]),
    );
    rows = (await db.prepare("SELECT * FROM product_prices").all()).results;
  }
  return rows;
}

/** Includes the price carried into the window, even if last set months ago. */
export function referenceWindow(history, trackedSince, time) {
  const cutoff = time - DAY30;
  const ordered = [...history].sort(
    (a, b) => a.created - b.created || a.id - b.id,
  );
  const carried = ordered.filter((r) => r.created <= cutoff).at(-1);
  const values = [
    carried,
    ...ordered.filter((r) => r.created > cutoff && r.created <= time),
  ]
    .filter((r) => Number.isInteger(r?.price))
    .map((r) => r.price);
  return {
    complete: trackedSince <= cutoff,
    minimum: values.length ? Math.min(...values) : null,
  };
}

export async function saveProductPrice(db, data, catalog, variantsOf) {
  const product = catalog.find((p) => p.id === data.product_id);
  const variant =
    product && variantsOf(product).find((v) => v.id === data.variant_id);
  if (!variant) fail(400, "Neznámý produkt.");
  const regular = data.regular_price,
    sale = data.sale_price;
  if (
    !validPrice(regular) ||
    !validPrice(sale) ||
    (sale !== null && (regular === null || sale >= regular))
  )
    fail(
      400,
      "Zadejte cenu v celých Kč. Zlevněná cena musí být nižší než běžná.",
    );
  const quantity = data.quantity;
  if (
    quantity !== undefined &&
    quantity !== null &&
    (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000)
  )
    fail(400, "Zadejte počet kusů (celé číslo).");
  const current = (await priceRows(db, catalog, variantsOf)).find(
    (r) => r.product_id === product.id && r.variant_id === variant.id,
  );
  if (!Number.isInteger(data.revision) || data.revision !== current.revision)
    fail(409, "Cenu mezitím někdo změnil. Obnovte sklad.");
  const time = now();
  const history = (
    await db
      .prepare(
        "SELECT id,price,created FROM price_history WHERE product_id=? AND variant_id=? ORDER BY created,id",
      )
      .bind(product.id, variant.id)
      .all()
  ).results;
  const window = referenceWindow(history, current.tracked_since, time);
  let reference = null,
    started = null;
  if (sale !== null) {
    if (current.regular_price === null)
      fail(
        400,
        "Nejdříve uložte běžnou cenu. Bez předchozí nabídkové ceny nelze oznámit slevu.",
      );
    const continuing =
      current.sale_price !== null &&
      regular === current.regular_price &&
      sale <= current.sale_price;
    if (continuing) {
      reference = current.reference_price;
      started = current.sale_started;
    } else {
      if (current.sale_price !== null)
        fail(
          400,
          "Před změnou běžné ceny nebo zvýšením slevové ceny nejdříve ukončete slevu.",
        );
      if (regular !== current.regular_price)
        fail(400, "Běžnou cenu a začátek slevy ukládejte samostatně.");
      reference = window.minimum;
      if (!window.complete) {
        if (
          !validPrice(data.confirmed_lowest_30) ||
          data.confirmed_lowest_30 === null ||
          data.confirmed_lowest_30 > window.minimum
        )
          fail(
            400,
            "Historie zatím nepokrývá 30 dní. Doplňte ověřenou nejnižší cenu za 30 dní před slevou; nesmí být vyšší než zaznamenané minimum.",
          );
        reference = data.confirmed_lowest_30;
      }
      started = time;
    }
    if (reference === null || sale >= reference)
      fail(400, "Slevová cena musí být nižší než nejnižší cena před slevou.");
  }
  const changed = effectivePrice(current) !== (sale ?? regular);
  const statements = [];
  if (changed)
    statements.push(
      db
        .prepare(
          "INSERT INTO price_history(product_id,variant_id,price,created) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM product_prices WHERE product_id=? AND variant_id=? AND revision=?)",
        )
        .bind(
          product.id,
          variant.id,
          sale ?? regular,
          time,
          product.id,
          variant.id,
          current.revision,
        ),
    );
  const token = crypto.randomUUID();
  const updateIndex = statements.length;
  statements.push(
    db
      .prepare(
        "UPDATE product_prices SET regular_price=?,sale_price=?,reference_price=?,sale_started=?,reference_source=?,write_token=?,revision=revision+1 WHERE product_id=? AND variant_id=? AND revision=?",
      )
      .bind(
        regular,
        sale,
        reference,
        started,
        sale === null
          ? null
          : current.sale_price !== null
            ? current.reference_source
            : window.complete
              ? "history"
              : "owner-confirmed",
        token,
        product.id,
        variant.id,
        current.revision,
      ),
  );
  if (quantity !== undefined) {
    if (quantity === null)
      statements.push(
        db
          .prepare(
            "DELETE FROM stock WHERE product_id=? AND variant_id=? AND EXISTS(SELECT 1 FROM product_prices WHERE product_id=? AND variant_id=? AND write_token=?)",
          )
          .bind(product.id, variant.id, product.id, variant.id, token),
      );
    else
      statements.push(
        db
          .prepare(
            "INSERT INTO stock(product_id,variant_id,quantity) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM product_prices WHERE product_id=? AND variant_id=? AND write_token=?) ON CONFLICT(product_id,variant_id) DO UPDATE SET quantity=excluded.quantity",
          )
          .bind(
            product.id,
            variant.id,
            quantity,
            product.id,
            variant.id,
            token,
          ),
      );
  }
  statements.push(
    db
      .prepare(
        "INSERT INTO price_events(product_id,variant_id,regular_price,sale_price,reference_price,reference_source,created) SELECT product_id,variant_id,regular_price,sale_price,reference_price,reference_source,? FROM product_prices WHERE product_id=? AND variant_id=? AND write_token=?",
      )
      .bind(time, product.id, variant.id, token),
  );
  // D1 serializes this transactional batch. A stale revision cannot write price history.
  const result = await db.batch(statements);
  if (result[updateIndex].meta.changes !== 1)
    fail(409, "Cenu mezitím někdo změnil. Obnovte sklad.");
  return { ok: true };
}
