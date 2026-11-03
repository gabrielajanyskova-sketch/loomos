/**
 * Shared price calculation for the browser (display) and the server (authoritative).
 * All amounts are whole Czech crowns.
 */
export const MEMBER_DISCOUNT_PERCENT = 5;
export const SHIPPING = {
  pickup: { label: "Osobní odběr — Starojická Lhota", price: 0 },
  zasilkovna: { label: "Zásilkovna — výdejní místo", price: 79 },
};
export const PAYMENT = {
  transfer: { label: "Bankovní převod (QR platba)", available: true },
  card: { label: "Platba kartou online", available: false },
};
export const MAX_QTY = 20;

export const memberPrice = (price) =>
  Math.round((price * (100 - MEMBER_DISCOUNT_PERCENT)) / 100);

/**
 * @param {object} input
 * @param {{key:string,name:string,price:number,qty:number}[]} input.lines unit prices from the catalog
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
  const priced = lines.map((line) => {
    const unit = member ? memberPrice(line.price) : line.price;
    return {
      ...line,
      originalUnit: line.price,
      unit,
      originalTotal: line.price * line.qty,
      total: unit * line.qty,
    };
  });
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
  const shippingPrice = shipping ? (SHIPPING[shipping]?.price ?? 0) : 0;
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
    savings: memberSavings + codeDiscount,
    total,
  };
}
