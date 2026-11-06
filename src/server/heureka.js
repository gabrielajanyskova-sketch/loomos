/**
 * Heureka.cz: "Ověřeno zákazníky" (satisfaction questionnaire after an order, opt-out in checkout)
 * and the XML product feed for the price comparison. Active only with the HEUREKA_API_KEY secret.
 */
import { json } from "./http.js";
import { publicCatalog, variantsOf } from "./catalog.js";
import { SHIPPING, FREE_SHIPPING_FROM } from "../../assets/js/pricing.mjs";
import { isCandle } from "../../assets/js/catalog.mjs";
import { candlePhoto, candlePhotos } from "../../assets/js/ui.mjs";

/** Public flags the checkout needs (no secrets). */
export const config = (db, request, env) =>
  json({ heureka: Boolean(env.HEUREKA_API_KEY) });

/** Order log for the questionnaire; never blocks or fails the order. */
export async function logOrder(env, order, number) {
  if (!env.HEUREKA_API_KEY) return false;
  try {
    const response = await fetch(
      env.HEUREKA_API_URL ||
        "https://api.heureka.cz/shop-certification/v2/order/log",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: env.HEUREKA_API_KEY,
          email: order.customer.email,
          orderId: Number(number),
          productItemIds: [
            ...new Set(
              order.items.map((i) =>
                i.variant ? `${i.id}-${i.variant}` : i.id,
              ),
            ),
          ],
        }),
      },
    );
    if (!response.ok)
      console.log(`Heureka order log failed: ${response.status}`);
    return response.ok;
  } catch {
    console.log("Heureka order log failed: network");
    return false;
  }
}

const xml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );

/** Heureka XML feed: one SHOPITEM per size, sizes grouped by ITEMGROUP_ID. */
export async function feed(db, request) {
  const origin = new URL(request.url).origin;
  const products = await publicCatalog(db);
  const deliveries = [
    ["ZASILKOVNA", SHIPPING.zasilkovna],
    ["ZASILKOVNA_NA_ADRESU", SHIPPING.domu],
    ["BALIKOVNA", SHIPPING.balikovna],
    ["CESKA_POSTA", SHIPPING.balikovna_domu],
  ].filter(([, s]) => s);
  const items = products.flatMap((p) =>
    variantsOf(p)
      .filter((v) => Number.isInteger(v.price))
      .map((v) => {
        const id = v.id ? `${p.id}-${v.id}` : p.id;
        const image = p.images?.length
          ? `${origin}/api/img?id=${p.images[0].id}`
          : isCandle(p)
            ? `${origin}${candlePhotos.has(p.id) ? candlePhoto(p.id) : "/assets/img/candle-960.webp"}`
            : `${origin}/assets/img/${p.id}-960.webp`;
        const stock = p.stock?.[v.id];
        return `<SHOPITEM><ITEM_ID>${xml(id)}</ITEM_ID>${p.variants?.length ? `<ITEMGROUP_ID>${xml(p.id)}</ITEMGROUP_ID>` : ""}<PRODUCTNAME>${xml(isCandle(p) ? `Sójová svíčka LOOMOS ${p.name}${v.name ? " — " + v.name.toLowerCase() : ""}` : `Lapač slunce LOOMOS ${p.name}`)}</PRODUCTNAME><PRODUCT>${xml(p.name)}</PRODUCT><DESCRIPTION>${xml(p.description)}</DESCRIPTION><URL>${xml(`${origin}/produkty/${p.id}${v.id ? `?velikost=${v.id}` : ""}`)}</URL><IMGURL>${xml(image)}</IMGURL><PRICE_VAT>${v.price}</PRICE_VAT><MANUFACTURER>LOOMOS</MANUFACTURER><CATEGORYTEXT>${xml(isCandle(p) ? "Dům a zahrada | Bytové doplňky | Svíčky" : "Dům a zahrada | Bytové doplňky | Dekorace")}</CATEGORYTEXT><DELIVERY_DATE>${stock === 0 ? "" : stock == null ? 7 : 3}</DELIVERY_DATE>${deliveries.map(([name, s]) => `<DELIVERY><DELIVERY_ID>${name}</DELIVERY_ID><DELIVERY_PRICE>${v.price >= FREE_SHIPPING_FROM ? 0 : s.price}</DELIVERY_PRICE></DELIVERY>`).join("")}${v.detail ? `<PARAM><PARAM_NAME>Velikost</PARAM_NAME><VAL>${xml(v.detail)}</VAL></PARAM>` : ""}</SHOPITEM>`;
      }),
  );
  return new Response(
    `<?xml version="1.0" encoding="utf-8"?>\n<SHOP>${items.join("\n")}</SHOP>\n`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
