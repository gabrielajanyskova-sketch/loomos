/** Admin: add and edit products. Saved products override data/products.json by id (D1 table products). */
import { validateCatalog, SUNCATCHER } from "../../assets/js/catalog.mjs";
import { assertSameOrigin, fail, json, readJson } from "./http.js";
import { now } from "./db.js";
import { bundledProducts, loadCatalog, priceProducts } from "./catalog.js";

const CATEGORIES = ["svicky", SUNCATCHER];

export async function list(db) {
  const { all, deleted } = await loadCatalog(db);
  const { results } = await db.prepare("SELECT id FROM products").all();
  const edited = new Set(results.map((r) => r.id));
  const bundled = new Set(bundledProducts.map((p) => p.id));
  // Prices shown here are the live ones from D1 (Sklad a ceny), not the catalog defaults.
  const { priced } = await priceProducts(db, all);
  return json([
    ...priced.map((p) => ({
      ...p,
      category: p.category || "svicky",
      edited: edited.has(p.id),
      bundled: bundled.has(p.id),
    })),
    ...deleted.map((p) => ({
      ...p,
      category: p.category || "svicky",
      edited: true,
      bundled: bundled.has(p.id),
    })),
  ]);
}

export async function save(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 16384);
  const input = data.product;
  if (!input || typeof input !== "object") fail(400, "Chybí údaje produktu.");
  if (!CATEGORIES.includes(input.category)) fail(400, "Vyberte kategorii.");
  // Only known fields are stored; computed ones (safety texts, flags) are dropped.
  const keys = [
    "id",
    "name",
    "subtitle",
    "notes",
    "description",
    "category",
    "active",
    "price",
    "price_provisional",
    "bulk",
    "badge",
    "size",
    "themes",
    "gift",
    "character",
    "pyramid",
    "variants",
  ];
  const product = Object.fromEntries(
    keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]),
  );
  let valid;
  try {
    [valid] = validateCatalog([product]);
  } catch (error) {
    fail(400, `Zkontrolujte údaje: ${error.message}`);
  }
  const { all } = await loadCatalog(db);
  if (data.new && all.some((p) => p.id === valid.id))
    fail(409, "Produkt s tímto kódem už existuje. Zvolte jiný.");
  if (!data.new && !all.some((p) => p.id === valid.id))
    fail(404, "Produkt neexistuje.");
  const position = all.findIndex((p) => p.id === valid.id);
  await db
    .prepare(
      `INSERT INTO products (id, data, position, updated) VALUES (?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated=excluded.updated`,
    )
    .bind(
      valid.id,
      JSON.stringify(valid),
      position < 0 ? 1000 + all.length : position,
      now(),
    )
    .run();
  return json({ ok: true, id: valid.id });
}

/** Removes the admin version: a product from the file returns to its original, a new one disappears. */
export async function reset(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const id = String(data.id || "");
  const result = await db
    .prepare("DELETE FROM products WHERE id=?")
    .bind(id)
    .run();
  if (!result.meta.changes) fail(404, "Produkt nemá uložené změny.");
  return json({ ok: true });
}

/**
 * Delete: a product added in admin disappears; a product from the original catalog is hidden
 * for good (stored as deleted) and can be restored with "Obnovit" (product-reset).
 */
export async function remove(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const id = String(data.id || "");
  const { all } = await loadCatalog(db);
  const product = all.find((p) => p.id === id);
  if (!product) fail(404, "Produkt neexistuje.");
  if (bundledProducts.some((p) => p.id === id)) {
    const original = bundledProducts.find((p) => p.id === id);
    await db
      .prepare(
        `INSERT INTO products (id, data, position, updated) VALUES (?,?,1000,?)
         ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated=excluded.updated`,
      )
      .bind(
        id,
        JSON.stringify({ ...original, active: false, deleted: true }),
        now(),
      )
      .run();
  } else await db.prepare("DELETE FROM products WHERE id=?").bind(id).run();
  return json({ ok: true });
}
