/** Catalog = data/products.json (bundled, single source of truth for prices) + stock from D1. */
import products from "../../data/products.json";
import { validateCatalog } from "../../assets/js/catalog.mjs";
import { withSafety } from "../../assets/js/safety.mjs";
import labels from "../../data/labels.json";
import { fail } from "./http.js";
import { MAX_QTY } from "../../assets/js/pricing.mjs";

export const catalog = withSafety(
  validateCatalog(products).filter((p) => p.active),
  labels,
);
const byId = new Map(catalog.map((p) => [p.id, p]));

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
  const stock = await stockMap(db);
  return catalog.map((p) => ({
    ...p,
    stock: Object.fromEntries(
      variantsOf(p).map((v) => [v.id, stock[`${p.id}::${v.id}`] ?? null]),
    ),
  }));
}

/** Validate cart items against the catalog and return priced lines. */
export function resolveItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50)
    fail(400, "Košík je prázdný.");
  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item !== "object") fail(400, "Neplatná položka.");
    const product = byId.get(item.id);
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
