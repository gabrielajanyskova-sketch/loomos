/** Product descriptions from the catalog; authoritative prices and stock from D1. */
import products from "../../data/products.json";
import { validateCatalog } from "../../assets/js/catalog.mjs";
import { withSafety } from "../../assets/js/safety.mjs";
import labels from "../../data/labels.json";
import { fail } from "./http.js";
import { priceRows, effectivePrice } from "./product-prices.js";
import { MAX_QTY } from "../../assets/js/pricing.mjs";

export const catalog = withSafety(
  validateCatalog(products).filter((p) => p.active),
  labels,
);
/** All scents incl. inactive ones (Dílnička can produce scents not yet sold in the e-shop). */
export const allScents = withSafety(validateCatalog(products), labels);

export const variantsOf = (p) =>
  p.variants?.length ? p.variants : [{ id: "", name: "", price: p.price }];

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
  const [stock, prices] = await Promise.all([
    stockMap(db),
    priceRows(db, catalog, variantsOf),
  ]);
  const map = new Map(
    prices.map((r) => [`${r.product_id}::${r.variant_id}`, r]),
  );
  const priced = catalog.map((p) => {
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
  return priced.map((p) => ({
    ...p,
    stock: Object.fromEntries(
      variantsOf(p).map((v) => [v.id, stock[`${p.id}::${v.id}`] ?? null]),
    ),
  }));
}

/** Validate cart items against the catalog and return priced lines. */
export function resolveItems(items, pricedCatalog = catalog) {
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
      qty,
    };
  });
}
