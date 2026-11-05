/** Transactional e-mail through Resend. Keys come only from the environment. */
import { brand, seller, sellerAddress } from "../../assets/js/site.mjs";
import { shippingSummary } from "../../assets/js/pricing.mjs";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const czk = (n) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n);

/** Colours of the website (dark background, copper accents, green savings). */
const C = {
  page: "#171614",
  card: "#1f1d1a",
  line: "#3a352f",
  text: "#ede6dc",
  muted: "#aaa399",
  copper: "#cb9568",
  green: "#a9c99a",
};
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "Helvetica,Arial,sans-serif";
/** PNG (not WebP) so the logo shows in every mail client, including Outlook. */
const LOGO = `${brand.url}/assets/img/email-logo.png`;

/**
 * blocks: strings (paragraphs), {rows:[[label, value, strong?, tone?]]} (tone "saving" = green),
 * {button:[label, url, secondary?]}, {image:[src, alt]}
 */
function render(title, blocks) {
  const text = [];
  const html = [];
  for (const b of blocks) {
    if (typeof b === "string") {
      text.push(b);
      html.push(
        `<p style="margin:0 0 16px;color:${C.text}">${esc(b).replace(/\n/g, "<br>")}</p>`,
      );
    } else if (b.rows) {
      text.push(b.rows.map(([l, v]) => (l ? `${l}: ${v}` : v)).join("\n"));
      html.push(
        `<table role="presentation" width="100%" style="width:100%;border-collapse:collapse;margin:4px 0 22px">${b.rows
          .map(([l, v, strong, tone]) => {
            const colour = tone === "saving" ? C.green : C.text;
            const cell = `padding:9px 0;border-bottom:1px solid ${C.line};color:${colour};${strong ? `font-family:${SERIF};font-size:20px;font-weight:bold;` : ""}`;
            return `<tr><td style="${cell}">${esc(l)}</td><td style="${cell}text-align:right;white-space:nowrap;${strong ? `color:${C.copper};` : ""}">${esc(v)}</td></tr>`;
          })
          .join("")}</table>`,
      );
    } else if (b.button) {
      const [label, url, secondary] = b.button;
      text.push(`${label}: ${url}`);
      html.push(
        `<p style="margin:0 0 14px"><a href="${esc(url)}" style="display:inline-block;padding:13px 24px;text-decoration:none;font-family:${SANS};font-size:15px;font-weight:bold;letter-spacing:.02em;${secondary ? `background:transparent;color:${C.copper};border:1px solid ${C.copper}` : `background:${C.copper};color:${C.page};border:1px solid ${C.copper}`}">${esc(label)} →</a></p>`,
      );
    } else if (b.image) {
      html.push(
        `<p style="margin:0 0 16px"><img src="${esc(b.image[0])}" alt="${esc(b.image[1])}" width="220" height="220" style="display:block;background:#fff;padding:8px"></p>`,
      );
    }
  }
  const footer = `${seller.name} · IČO ${seller.ico} · ${sellerAddress}${seller.vatPayer === false ? " · neplátce DPH" : ""} · ${seller.email}`;
  return {
    text: [...text, "", "LOOMOS · loomos.cz", footer].join("\n\n"),
    html: `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;background:${C.page};padding:28px 12px;font-family:${SANS};color:${C.text};font-size:16px;line-height:1.6"><table role="presentation" width="100%" style="background:${C.page}"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:${C.card};border:1px solid ${C.line}"><tr><td align="center" style="padding:28px 24px 8px"><a href="${brand.url}" style="text-decoration:none"><img src="${LOGO}" alt="LOOMOS" width="100" height="94" style="display:block;border:0"></a></td></tr><tr><td style="padding:12px 28px 26px"><h1 style="margin:8px 0 24px;text-align:center;font-family:${SERIF};font-size:30px;line-height:1.2;font-weight:normal;color:${C.text}">${esc(title)}</h1>${html.join("")}</td></tr></table><p style="max-width:560px;margin:18px auto 0;font-size:12px;line-height:1.5;color:${C.muted};text-align:center">${esc(footer)}<br><a href="${brand.url}" style="color:${C.copper}">loomos.cz</a></p></td></tr></table></body></html>`,
  };
}

export async function sendMail(
  env,
  { to, subject, title, blocks, replyTo, key, attachments },
) {
  if (!env.RESEND_API_KEY) {
    console.log(`E-mail "${key}" skipped: RESEND_API_KEY is not set.`);
    return false;
  }
  const { text, html } = render(title || subject, blocks);
  try {
    const response = await fetch(
      env.RESEND_API_URL || "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          from: env.MAIL_FROM || "LOOMOS <objednavky@loomos.cz>",
          to: [to],
          subject,
          text,
          html,
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(attachments?.length ? { attachments } : {}),
        }),
      },
    );
    if (!response.ok) console.log(`E-mail "${key}" failed: ${response.status}`);
    return response.ok;
  } catch {
    console.log(`E-mail "${key}" failed: network`);
    return false;
  }
}

export const shopEmail = (env) => env.SHOP_EMAIL || seller.email;

export function orderRows(order) {
  // Items at their (quantity) price before the member discount, which follows as its own row.
  const rows = order.items.map((i) => [
    `${i.qty}× ${i.name}${i.price ? ` (${czk(i.price)}/ks)` : ""}`,
    czk((i.price ?? i.unit) * i.qty),
  ]);
  if (order.pricing.memberSavings)
    rows.push([
      "Sleva pro registrované (5 %)",
      `−${czk(order.pricing.memberSavings)}`,
      false,
      "saving",
    ]);
  if (order.pricing.codeDiscount)
    rows.push([
      `Slevový kód ${order.pricing.code}`,
      `−${czk(order.pricing.codeDiscount)}`,
      false,
      "saving",
    ]);
  rows.push([
    shippingSummary(order),
    order.pricing.shippingPrice ? czk(order.pricing.shippingPrice) : "Zdarma",
  ]);
  rows.push(["Celkem", czk(order.pricing.total), true]);
  if (order.pricing.savings)
    rows.push(["Ušetřili jste", czk(order.pricing.savings), false, "saving"]);
  return rows;
}
