/** Transactional e-mail through Resend. Keys come only from the environment. */
import { seller, sellerAddress } from "../../assets/js/site.mjs";
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

/**
 * blocks: strings (paragraphs), {rows:[[label, value]]}, {button:[label, url]}, {image:[src, alt]}
 */
function render(title, blocks) {
  const text = [];
  const html = [];
  for (const b of blocks) {
    if (typeof b === "string") {
      text.push(b);
      html.push(
        `<p style="margin:0 0 16px">${esc(b).replace(/\n/g, "<br>")}</p>`,
      );
    } else if (b.rows) {
      text.push(b.rows.map(([l, v]) => (l ? `${l}: ${v}` : v)).join("\n"));
      html.push(
        `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px">${b.rows
          .map(
            ([l, v, strong]) =>
              `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(l)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;${strong ? "font-weight:bold" : ""}">${esc(v)}</td></tr>`,
          )
          .join("")}</table>`,
      );
    } else if (b.button) {
      text.push(`${b.button[0]}: ${b.button[1]}`);
      html.push(
        `<p style="margin:0 0 20px"><a href="${esc(b.button[1])}" style="display:inline-block;background:#cb9568;color:#171614;padding:12px 20px;text-decoration:none;border-radius:3px;font-weight:bold">${esc(b.button[0])}</a></p>`,
      );
    } else if (b.image) {
      html.push(
        `<p style="margin:0 0 16px"><img src="${esc(b.image[0])}" alt="${esc(b.image[1])}" width="220" height="220" style="display:block"></p>`,
      );
    }
  }
  const footer = `${seller.name} · IČO ${seller.ico} · ${sellerAddress}${seller.vatPayer === false ? " · neplátce DPH" : ""} · ${seller.email}`;
  return {
    text: [...text, "", "LOOMOS — ručně vyráběné sójové svíčky", footer].join(
      "\n\n",
    ),
    html: `<!doctype html><html lang="cs"><body style="margin:0;background:#f6f1ea;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#2a2621;font-size:16px;line-height:1.5"><div style="max-width:560px;margin:0 auto;background:#fff;padding:28px 24px;border-radius:4px"><p style="margin:0 0 20px;letter-spacing:.2em;font-size:13px;color:#8a6a4f">LOOMOS</p><h1 style="font-size:24px;font-weight:normal;margin:0 0 20px">${esc(title)}</h1>${html.join("")}</div><p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#7a7067;text-align:center">${esc(footer)}</p></body></html>`,
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
    ]);
  if (order.pricing.codeDiscount)
    rows.push([
      `Slevový kód ${order.pricing.code}`,
      `−${czk(order.pricing.codeDiscount)}`,
    ]);
  rows.push([
    shippingSummary(order),
    order.pricing.shippingPrice ? czk(order.pricing.shippingPrice) : "Zdarma",
  ]);
  rows.push(["Celkem", czk(order.pricing.total), true]);
  if (order.pricing.savings)
    rows.push(["Ušetřili jste", czk(order.pricing.savings)]);
  return rows;
}
