/** Packeta (Zásilkovna) REST/XML API. The API password is only read from the environment. */
import { fail } from "./http.js";

const xml = (s) =>
  String(s).replace(
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
const unxml = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const tag = (body, name) => {
  const m = body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m
    ? unxml(
        m[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      )
    : "";
};

/** "Hlavní 12/3a" → { street: "Hlavní", houseNumber: "12/3a" } */
export function splitStreet(value) {
  const m = String(value)
    .trim()
    .match(/^(.*?)[\s,]+(\d[\w/-]*)$/);
  return m ? { street: m[1], houseNumber: m[2] } : { street: value };
}

export async function createPacket(env, { number, order, weight }) {
  if (!env.PACKETA_API_PASSWORD)
    fail(503, "V Cloudflare chybí tajná proměnná PACKETA_API_PASSWORD.");
  const name = order.customer.name.trim();
  const split = name.lastIndexOf(" ");
  const attributes = {
    number,
    name: split > 0 ? name.slice(0, split) : name,
    surname: split > 0 ? name.slice(split + 1) : name,
    email: order.customer.email,
    phone: order.customer.phone,
    ...(order.address
      ? {
          // Packeta carrier for home delivery in the Czech Republic (override with PACKETA_HOME_CARRIER_ID).
          addressId: env.PACKETA_HOME_CARRIER_ID || "106",
          ...splitStreet(order.address.street),
          city: order.address.city,
          zip: order.address.zip,
        }
      : { addressId: order.packeta_point_id }),
    value: order.pricing.total,
    cod: 0,
    weight: Math.round(weight * 1000) / 1000,
    eshop: env.PACKETA_SENDER || "",
  };
  const fields = Object.entries(attributes)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `<${k}>${xml(v)}</${k}>`)
    .join("");
  let body;
  try {
    const response = await fetch(
      env.PACKETA_API_URL || "https://www.zasilkovna.cz/api/rest",
      {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8" },
        body: `<createPacket><apiPassword>${xml(env.PACKETA_API_PASSWORD)}</apiPassword><packetAttributes>${fields}</packetAttributes></createPacket>`,
      },
    );
    body = (await response.text()).slice(0, 65536);
  } catch {
    fail(502, "Zásilkovna teď neodpovídá. Zkuste to znovu.");
  }
  if (tag(body, "status") !== "ok") {
    const message = [tag(body, "string"), tag(body, "detail")]
      .filter(Boolean)
      .join(" ");
    fail(
      400,
      `Zásilkovna: ${message || "zásilku se nepodařilo vytvořit."}`.slice(
        0,
        400,
      ),
    );
  }
  return {
    id: tag(body, "id"),
    barcode: tag(body, "barcodeText") || tag(body, "barcode"),
  };
}
