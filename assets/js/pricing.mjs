/**
 * Shared price calculation for the browser (display) and the server (authoritative).
 * All amounts are whole Czech crowns.
 */
export const MEMBER_DISCOUNT_PERCENT = 5;
/**
 * kind: "pickup" (in person), "point" (pick-up point / Z-BOX / Balíkovna chosen on a map)
 * or "home" (home delivery). provider: "packeta" (Zásilkovna) or "balikovna" (Česká pošta).
 * `packeta` holds the Packeta map widget filter.
 */
export const SHIPPING = {
  pickup: {
    label: "Osobní odběr — Starojická Lhota",
    price: 0,
    kind: "pickup",
  },
  zasilkovna: {
    short: "Výdejní místo",
    logo: "/assets/img/carrier-zasilkovna.svg",
    label: "Zásilkovna — výdejní místo",
    price: 109,
    kind: "point",
    provider: "packeta",
    packeta: { vendors: [{ country: "cz" }] },
  },
  zbox: {
    short: "Z-BOX",
    logo: "/assets/img/carrier-zasilkovna.svg",
    label: "Zásilkovna — Z-BOX",
    price: 109,
    kind: "point",
    provider: "packeta",
    packeta: { vendors: [{ country: "cz", group: "zbox" }] },
  },
  domu: {
    short: "Doručení domů",
    logo: "/assets/img/carrier-zasilkovna.svg",
    label: "Zásilkovna — doručení domů",
    price: 149,
    kind: "home",
    provider: "packeta",
  },
  balikovna: {
    short: "Pobočka Balíkovny",
    logo: "/assets/img/carrier-balikovna.svg",
    label: "Balíkovna — Česká pošta",
    price: 99,
    kind: "point",
    provider: "balikovna",
  },
  balikovna_domu: {
    short: "Doručení domů",
    logo: "/assets/img/carrier-balikovna-adresa.webp",
    label: "Česká pošta — doručení domů",
    price: 129,
    kind: "home",
    provider: "balikovna",
  },
};
export const shippingKind = (id) => SHIPPING[id]?.kind || "pickup";
export const shippingProvider = (id) => SHIPPING[id]?.provider || null;
/** One line describing where the order goes. */
export function shippingSummary(order) {
  const s = SHIPPING[order.shipping];
  if (!s) return order.shipping || "";
  if (s.kind === "point") return `${s.label}: ${order.pickup_point}`;
  if (s.kind === "home" && order.address)
    return `${s.label}: ${order.address.street}, ${order.address.zip} ${order.address.city}`;
  return s.label;
}
export const PAYMENT = {
  transfer: { label: "Bankovní převod (QR platba)", available: true },
  card: { label: "Platba kartou online", available: false },
};
export const MAX_QTY = 20;
/** Goods total (after discounts) from which every delivery option is free. */
export const FREE_SHIPPING_FROM = 1200;

export const memberPrice = (price) =>
  Math.round((price * (100 - MEMBER_DISCOUNT_PERCENT)) / 100);

/**
 * @param {object} input
 * @param {{key:string,name:string,price:number,qty:number,group?:string,bulk?:{min_qty:number,price:number}}[]} input.lines
 *   unit prices from the catalog; lines with the same group and quantity price count together
 *   (e.g. any two sun catchers, whatever the motif, are 175 Kč each)
 * @param {boolean} input.member logged-in customer → 5 % off every item
 * @param {{code:string,type:"percent"|"fixed",value:number,min_total?:number}|null} input.code
 * @param {keyof SHIPPING|null} input.shipping
 */
export function priceCart({
  lines,
  member = false,
  code = null,
  shipping = null,
}) {
  const bulkKey = (line) =>
    `${line.group ?? line.key}|${line.bulk.min_qty}|${line.bulk.price}`;
  const bulkQty = new Map();
  for (const line of lines)
    if (line.bulk)
      bulkQty.set(bulkKey(line), (bulkQty.get(bulkKey(line)) || 0) + line.qty);
  const priced = lines.map((line) => {
    // Quantity price (e.g. 175 Kč per piece from 2 pieces of any motif) comes before the member
    // discount. Never above the current price (e.g. while a sale price is lower).
    const base =
      line.bulk && bulkQty.get(bulkKey(line)) >= line.bulk.min_qty
        ? Math.min(line.bulk.price, line.price)
        : line.price;
    const unit = member ? memberPrice(base) : base;
    return {
      ...line,
      ...(line.bulk ? { bulkCount: bulkQty.get(bulkKey(line)) } : {}),
      listUnit: line.price,
      originalUnit: base,
      unit,
      originalTotal: base * line.qty,
      total: unit * line.qty,
    };
  });
  const bulkSavings = priced.reduce(
    (s, l) => s + (l.listUnit - l.originalUnit) * l.qty,
    0,
  );
  const itemsOriginal = priced.reduce((s, l) => s + l.originalTotal, 0);
  const items = priced.reduce((s, l) => s + l.total, 0);
  const memberSavings = itemsOriginal - items;
  let codeDiscount = 0;
  let codeError = "";
  if (code) {
    if (items < (code.min_total || 0))
      codeError = `Kód platí od nákupu ${code.min_total} Kč.`;
    else
      codeDiscount =
        code.type === "percent"
          ? Math.round((items * code.value) / 100)
          : Math.min(code.value, items);
  }
  const goods = items - codeDiscount;
  const freeShipping = goods >= FREE_SHIPPING_FROM;
  const shippingPrice =
    shipping && !freeShipping ? (SHIPPING[shipping]?.price ?? 0) : 0;
  const total = items - codeDiscount + shippingPrice;
  return {
    lines: priced,
    itemsOriginal,
    memberSavings,
    items,
    code: code && !codeError ? code.code : null,
    codeDiscount,
    codeError,
    shippingPrice,
    freeShipping,
    missingForFreeShipping: Math.max(0, FREE_SHIPPING_FROM - goods),
    bulkSavings,
    savings: memberSavings + codeDiscount + bulkSavings,
    total,
  };
}
