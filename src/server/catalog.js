/** Product descriptions from the catalog; authoritative prices and stock from D1. */
import products from "../../data/products.json";
import { validateCatalog } from "../../assets/js/catalog.mjs";
import { withSafety } from "../../assets/js/safety.mjs";
import labels from "../../data/labels.json";
import { fail } from "./http.js";
import { priceRows, effectivePrice } from "./product-prices.js";
import { ratingSummary } from "./reviews.js";
import { MAX_QTY } from "../../assets/js/pricing.mjs";

const bundled = validateCatalog(products);

/** Accept one product from the admin only if it passes the same validation as the bundled file. */
function valid(product) {
  try {
    return validateCatalog([product])[0];
  } catch {
    return null;
  }
}

/**
 * Catalog = data/products.json, overridden and extended by products saved in admin (D1 table products).
 * Returns every product (incl. inactive) plus the active ones and a lookup by id.
 */
export async function loadCatalog(db) {
  const { results } = await db
    .prepare("SELECT id, data, position FROM products ORDER BY position, id")
    .all();
  const saved = new Map();
  for (const row of results) {
    const product = valid(JSON.parse(row.data));
    if (product && product.id === row.id) saved.set(row.id, product);
  }
  // A product deleted in admin is kept as {deleted: true} so it can be restored.
  const merged = [
    ...bundled.map((p) => saved.get(p.id) || p),
    ...[...saved.values()].filter((p) => !bundled.some((b) => b.id === p.id)),
  ].filter((p) => !p.deleted);
  const photos = await imagesByProduct(db);
  const all = withSafety(merged, labels).map((p) =>
    photos.has(p.id) ? { ...p, images: photos.get(p.id) } : p,
  );
  const active = all.filter((p) => p.active);
  const deleted = [...saved.values()].filter((p) => p.deleted);
  return { all, active, deleted, byId: new Map(active.map((p) => [p.id, p])) };
}
export const bundledProducts = bundled;

/** Photos uploaded in admin: product id → [{id, width, height}], main photo first. */
async function imagesByProduct(db) {
  const { results } = await db
    .prepare(
      "SELECT id, product_id, width, height FROM product_images ORDER BY product_id, position, id",
    )
    .all();
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push({ id: r.id, width: r.width, height: r.height });
  }
  return map;
}

export const variantsOf = (p) =>
  p.variants?.length
    ? p.variants
    : [{ id: "", name: "", price: p.price, bulk: p.bulk }];

/** Map "id::variant" → quantity, or undefined when stock is not tracked. */
export async function stockMap(db) {
  const { results } = await db
    .prepare("SELECT product_id, variant_id, quantity FROM stock")
    .all();
  return Object.fromEntries(
    results.map((r) => [`${r.product_id}::${r.variant_id}`, r.quantity]),
  );
}

export async function publicCatalog(db) {
  const [list, ratings] = await Promise.all([
    withStock(db, (await loadCatalog(db)).active),
    ratingSummary(db),
  ]);
  return list.map((p) =>
    ratings.has(p.id) ? { ...p, rating: ratings.get(p.id) } : p,
  );
}

/** Prices from D1 (product_prices, with history) applied to products; missing rows are seeded. */
export async function priceProducts(db, list) {
  const [stock, prices] = await Promise.all([
    stockMap(db),
    priceRows(db, list, variantsOf),
  ]);
  const map = new Map(
    prices.map((r) => [`${r.product_id}::${r.variant_id}`, r]),
  );
  const priced = list.map((p) => {
    const variants = variantsOf(p).map((v) => {
      const row = map.get(`${p.id}::${v.id}`);
      return {
        ...v,
        price: effectivePrice(row),
        regular_price: row.regular_price,
        sale_price: row.sale_price,
        lowest_30: row.reference_price,
        revision: row.revision,
        tracked_since: row.tracked_since,
      };
    });
    const first = variants[0];
    return {
      ...p,
      price: first.price,
      regular_price: first.regular_price,
      sale_price: first.sale_price,
      lowest_30: first.lowest_30,
      ...(p.variants?.length
        ? { variants }
        : { revision: first.revision, tracked_since: first.tracked_since }),
    };
  });
  return { priced, stock };
}

async function withStock(db, list) {
  const { priced, stock } = await priceProducts(db, list);
  return priced.map((p) => ({
    ...p,
    stock: Object.fromEntries(
      variantsOf(p).map((v) => [v.id, stock[`${p.id}::${v.id}`] ?? null]),
    ),
  }));
}

/** Validate cart items against the catalog and return priced lines. */
export function resolveItems(items, pricedCatalog) {
  const currentById = new Map(pricedCatalog.map((p) => [p.id, p]));
  if (!Array.isArray(items) || items.length < 1 || items.length > 50)
    fail(400, "Košík je prázdný.");
  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item !== "object") fail(400, "Neplatná položka.");
    const product = currentById.get(item.id);
    const qty = item.qty;
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY)
      fail(400, "Zkontrolujte položky a množství v košíku.");
    const variants = variantsOf(product);
    const variantId =
      typeof item.variant === "string" && item.variant
        ? item.variant
        : variants[0].id;
    const variant = variants.find((v) => v.id === variantId);
    if (!variant || !Number.isInteger(variant.price))
      fail(400, "Zvolená velikost není dostupná.");
    const key = `${product.id}::${variant.id}`;
    if (seen.has(key)) fail(400, "Položka je v košíku dvakrát.");
    seen.add(key);
    return {
      key,
      id: product.id,
      variant: variant.id,
      name: product.name + (variant.name ? ` — ${variant.name}` : ""),
      price: variant.price,
      ...(variant.bulk
        ? { bulk: variant.bulk, group: product.category || "svicky" }
        : {}),
      qty,
    };
  });
}
