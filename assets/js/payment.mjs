/** Czech QR Platba (SPAYD) and IBAN helpers shared by the browser and the server. */
import qrcode from "qrcode-generator";

const mod97 = (digits) => {
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest;
};
const toDigits = (text) =>
  [...text.toUpperCase()]
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join("");

/** "19-2000145399/0800" or "2000145399/0800" → "CZ65 0800 0000 1920 0014 5399" (no spaces). */
export function czechAccountToIban(account) {
  const match = String(account)
    .replace(/\s/g, "")
    .match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!match) return null;
  const [, prefix = "0", number, bank] = match;
  const bban = bank + prefix.padStart(6, "0") + number.padStart(10, "0");
  const check = 98 - mod97(toDigits(bban + "CZ00"));
  return "CZ" + String(check).padStart(2, "0") + bban;
}
export function validIban(iban) {
  const value = String(iban).replace(/\s/g, "").toUpperCase();
  return (
    /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value) &&
    mod97(toDigits(value.slice(4) + value.slice(0, 4))) === 1
  );
}
export const formatIban = (iban) => iban.replace(/(.{4})(?=.)/g, "$1 ");

/** SPAYD 1.0 payload for the Czech banking QR standard. */
export function spayd({ iban, amount, vs, message, recipient }) {
  const clean = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[*]/g, "")
      .slice(0, 60);
  const parts = [
    "SPD*1.0",
    `ACC:${iban}`,
    `AM:${Number(amount).toFixed(2)}`,
    "CC:CZK",
  ];
  if (vs) parts.push(`X-VS:${vs}`);
  if (recipient) parts.push(`RN:${clean(recipient)}`);
  if (message) parts.push(`MSG:${clean(message)}`);
  return parts.join("*");
}

export function qrMatrix(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => qr.isDark(r, c)),
  );
}
/** Inline SVG (no styles, CSP-safe). */
export function qrSvg(text, label = "QR kód pro platbu") {
  const m = qrMatrix(text);
  const n = m.length + 8;
  let path = "";
  m.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="220" height="220" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
