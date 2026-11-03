import { shippingProvider } from "./pricing.mjs";
/** Order states shared by the admin, the customer account and the server. */
export const ORDER_STATUS = {
  nova: "Čeká na platbu",
  zaplacena: "Zaplaceno — připravujeme",
  odeslana: "Odesláno",
  "k-vyzvednuti": "Připraveno k vyzvednutí",
  dokoncena: "Dokončeno",
  zrusena: "Zrušeno",
};

/** Tracking number entered by the shop or created through the Packeta API. */
export function trackingOf(order) {
  const code = (order.tracking || order.packeta?.barcode || "").trim();
  if (!code) return null;
  const id = encodeURIComponent(code.replace(/\s/g, ""));
  const urls = {
    packeta: `https://tracking.packeta.com/cs/?id=${id}`,
    balikovna: `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=${id}`,
  };
  return { code, url: urls[shippingProvider(order.shipping)] || null };
}

/** Steps of the customer-facing timeline; the third step depends on the delivery method. */
export function orderSteps(shipping) {
  return [
    ["nova", "Přijato"],
    ["zaplacena", "Zaplaceno"],
    shipping === "pickup"
      ? ["k-vyzvednuti", "Připraveno k vyzvednutí"]
      : ["odeslana", "Odesláno"],
    ["dokoncena", shipping === "pickup" ? "Předáno" : "Doručeno"],
  ];
}
