/**
 * Product pages are prebuilt, but prices, stock and ratings live in D1 and change in admin.
 * When a product page is served, its Product structured data gets the current offer
 * (price, availability) and rating, so Google never sees a stale price.
 */
import { publicCatalog, variantsOf } from "./catalog.js";

const AVAILABLE = "https://schema.org/InStock";
const SOLD_OUT = "https://schema.org/OutOfStock";

/** schema.org Offer(s) and AggregateRating for one priced product from publicCatalog. */
export function offerData(product, url) {
  const offers = variantsOf(product)
    .filter((v) => Number.isInteger(v.price))
    .map((v) => {
      const left = product.stock?.[v.id];
      return {
        "@type": "Offer",
        ...(v.name ? { name: v.name } : {}),
        url,
        price: v.price,
        priceCurrency: "CZK",
        availability: left === 0 ? SOLD_OUT : AVAILABLE,
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@id": new URL("/#organization", url).href },
      };
    });
  return {
    // Photos uploaded in admin replace the ones built into the page.
    ...(product.images?.length
      ? {
          image: product.images.map(
            (img) => new URL(`/api/img?id=${img.id}`, url).href,
          ),
        }
      : {}),
    ...(offers.length
      ? { offers: offers.length > 1 ? offers : offers[0] }
      : {}),
    ...(product.rating?.count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

const LD_JSON = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
const safeJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

/** Add the current offer to the Product node of a prebuilt page; unchanged on any problem. */
export async function withLiveOffer(response, db, id, url) {
  if (!db || response.status !== 200) return response;
  if (!(response.headers.get("Content-Type") || "").includes("text/html"))
    return response;
  try {
    const html = await response.clone().text();
    const match = html.match(LD_JSON);
    if (!match) return response;
    const data = JSON.parse(match[2]);
    const node = data["@graph"]?.find((n) => n["@type"] === "Product");
    const product = (await publicCatalog(db)).find((p) => p.id === id);
    if (!node || !product) return response;
    Object.assign(node, offerData(product, node.url || url));
    const headers = new Headers(response.headers);
    headers.delete("Content-Length");
    return new Response(
      html.replace(
        LD_JSON,
        (_, open, __, close) => open + safeJson(data) + close,
      ),
      { status: 200, headers },
    );
  } catch {
    return response;
  }
}
