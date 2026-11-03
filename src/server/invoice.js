/** Invoices for a non-VAT payer: numbering, storage and PDF rendering (pdf-lib, runs in Workers). */
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import regularFont from "./fonts/dm-sans-regular.bin";
import boldFont from "./fonts/dm-sans-bold.bin";
import { seller, sellerAddress } from "../../assets/js/site.mjs";
import { shippingSummary } from "../../assets/js/pricing.mjs";
import { now } from "./db.js";
import { bank } from "./shop.js";

export const invoiceFor = (db, orderNumber) =>
  db
    .prepare("SELECT * FROM invoices WHERE order_number=?")
    .bind(orderNumber)
    .first();

/**
 * Issue (once) the invoice for a paid order. Real orders get a yearly sequence
 * (2027001, 2027002 …); test orders use a separate TEST- series so they never use real numbers.
 */
export async function issueInvoice(db, env, row) {
  const existing = await invoiceFor(db, row.number);
  if (existing) return existing;
  const order = JSON.parse(row.payload);
  const year = new Date().getFullYear();
  const test = Boolean(row.test);
  const series = test ? `TEST-${year}` : String(year);
  const issued = now();
  const account = bank(env);
  const snapshot = {
    order_number: row.number,
    customer: order.customer,
    items: order.items,
    pricing: order.pricing,
    shipping: order.shipping,
    pickup_point: order.pickup_point,
    address: order.address || null,
    member: order.member,
    test,
    paid_at: issued,
    bank: account ? { account: account.account } : null,
  };
  // The sequence and the insert run in one statement, so two clicks cannot share a number.
  await db
    .prepare(
      `INSERT INTO invoices (number, series, seq, order_number, issued, payload)
       SELECT ?1 || CASE WHEN ?1 LIKE 'TEST-%' THEN '-' ELSE '' END || printf('%04d', COALESCE(MAX(seq), 0) + 1),
              ?1, COALESCE(MAX(seq), 0) + 1, ?2, ?3, ?4
       FROM invoices WHERE series = ?1
       ON CONFLICT(order_number) DO NOTHING`,
    )
    .bind(series, row.number, issued, JSON.stringify(snapshot))
    .run();
  return invoiceFor(db, row.number);
}

const czk = (n) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace(/ /g, " ");
const date = (t) =>
  new Date(t * 1000).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });

/** Render the stored invoice snapshot as an A4 PDF. */
export async function invoicePdf(invoice) {
  const data = JSON.parse(invoice.payload);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularFont, { subset: true });
  const bold = await pdf.embedFont(boldFont, { subset: true });
  pdf.setTitle(`Faktura ${invoice.number}`);
  pdf.setAuthor(seller.name);
  pdf.setCreator("LOOMOS");
  const page = pdf.addPage([595.28, 841.89]);
  const ink = rgb(0.13, 0.12, 0.11);
  const muted = rgb(0.42, 0.39, 0.36);
  const copper = rgb(0.62, 0.42, 0.26);
  const left = 50;
  const right = 545;
  let y = 790;
  const text = (s, x, yy, { size = 10, font = regular, color = ink } = {}) =>
    page.drawText(String(s), { x, y: yy, size, font, color });
  const textRight = (s, xr, yy, opts = {}) => {
    const size = opts.size || 10;
    const font = opts.font || regular;
    text(s, xr - font.widthOfTextAtSize(String(s), size), yy, opts);
  };
  const line = (yy, color = rgb(0.85, 0.82, 0.78)) =>
    page.drawLine({
      start: { x: left, y: yy },
      end: { x: right, y: yy },
      thickness: 0.7,
      color,
    });

  text("LOOMOS", left, y, { size: 13, font: bold, color: copper });
  textRight(`Faktura ${invoice.number}`, right, y, { size: 16, font: bold });
  y -= 18;
  if (data.test)
    textRight("ZKUŠEBNÍ DOKLAD – NEPLATNÝ", right, y, {
      size: 10,
      font: bold,
      color: rgb(0.75, 0.2, 0.15),
    });
  y -= 30;

  const col2 = 310;
  text("Dodavatel", left, y, { size: 9, color: muted });
  text("Odběratel", col2, y, { size: 9, color: muted });
  y -= 15;
  const supplier = [
    [seller.name, bold],
    [seller.street, regular],
    [`${seller.zip} ${seller.city}`, regular],
    [`IČO: ${seller.ico}`, regular],
    ["Fyzická osoba zapsaná v živnostenském rejstříku", regular],
    ["Neplátce DPH", regular],
    [seller.email, regular],
  ];
  const customer = [
    [data.customer.name, bold],
    [data.customer.email, regular],
    [data.customer.phone, regular],
  ];
  for (let i = 0; i < Math.max(supplier.length, customer.length); i++) {
    if (supplier[i]) text(supplier[i][0], left, y, { font: supplier[i][1] });
    if (customer[i]) text(customer[i][0], col2, y, { font: customer[i][1] });
    y -= 14;
  }
  y -= 12;
  line(y);
  y -= 20;
  const facts = [
    ["Číslo faktury", invoice.number],
    ["Objednávka / variabilní symbol", data.order_number],
    ["Datum vystavení", date(invoice.issued)],
    ["Datum uskutečnění plnění", date(invoice.issued)],
    ["Datum splatnosti", date(invoice.issued)],
    ["Způsob úhrady", "Bankovní převod"],
    ...(data.bank ? [["Účet", data.bank.account]] : []),
    ["Doprava", shippingSummary(data)],
  ];
  for (const [label, value] of facts) {
    text(label, left, y, { color: muted });
    text(value, 230, y);
    y -= 14;
  }
  y -= 12;
  line(y);
  y -= 18;
  text("Položka", left, y, { size: 9, color: muted });
  textRight("Množství", 360, y, { size: 9, color: muted });
  textRight("Cena / ks", 450, y, { size: 9, color: muted });
  textRight("Celkem", right, y, { size: 9, color: muted });
  y -= 16;
  for (const item of data.items) {
    text(item.name, left, y);
    textRight(`${item.qty} ks`, 360, y);
    textRight(czk(item.price), 450, y);
    textRight(czk(item.price * item.qty), right, y);
    y -= 15;
  }
  const p = data.pricing;
  const rows = [];
  if (p.memberSavings)
    rows.push([
      "Sleva pro registrované zákazníky (5 %)",
      `−${czk(p.memberSavings)}`,
    ]);
  if (p.codeDiscount)
    rows.push([`Slevový kód ${p.code}`, `−${czk(p.codeDiscount)}`]);
  rows.push(["Doprava", p.shippingPrice ? czk(p.shippingPrice) : "zdarma"]);
  for (const [label, value] of rows) {
    text(label, left, y);
    textRight(value, right, y);
    y -= 15;
  }
  y -= 6;
  line(y, ink);
  y -= 22;
  text("Celkem", left, y, { size: 13, font: bold });
  textRight(czk(p.total), right, y, { size: 13, font: bold });
  y -= 18;
  text(`Uhrazeno převodem ${date(data.paid_at)} – neplaťte.`, left, y, {
    color: copper,
    font: bold,
  });
  y -= 30;
  text("Dodavatel není plátcem DPH.", left, y, { color: muted, size: 9 });
  page.drawText(
    `${seller.name} · ${sellerAddress} · IČO ${seller.ico} · ${seller.email}`,
    { x: left, y: 40, size: 8, font: regular, color: muted },
  );
  return pdf.save();
}

export const pdfBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
