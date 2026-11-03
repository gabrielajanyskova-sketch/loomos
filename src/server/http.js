/** Small HTTP helpers for Cloudflare Pages Functions. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}
export function binary(body, type, headers = {}) {
  return new Response(body, {
    headers: { "Content-Type": type, ...SECURITY_HEADERS, ...headers },
  });
}

/** Reject cross-site writes: browsers always send Origin on POST. */
export function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "cross-site")
    fail(403, "Požadavek musí pocházet z tohoto e-shopu.");
  if (origin && origin !== new URL(request.url).origin)
    fail(403, "Požadavek musí pocházet z tohoto e-shopu.");
  if (!origin && site && !["same-origin", "none"].includes(site))
    fail(403, "Požadavek musí pocházet z tohoto e-shopu.");
}

export async function readJson(request, limit = 32768) {
  if (
    (request.headers.get("Content-Type") || "").split(";")[0] !==
    "application/json"
  )
    fail(415, "Je vyžadován JSON.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > limit) fail(413, "Požadavek je příliš velký.");
  const text = await request.text();
  if (text.length > limit) fail(413, "Požadavek je příliš velký.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(400, "Neplatný požadavek.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail(400, "Neplatný požadavek.");
  return data;
}

export function cookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
export function setCookie(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Validated string field. */
export function text(value, label, max, required = true) {
  if (value == null) value = "";
  if (typeof value !== "string" || value.length > max)
    fail(400, `Zkontrolujte pole ${label}.`);
  const trimmed = value.trim();
  if (required && !trimmed) fail(400, `Vyplňte pole ${label}.`);
  return trimmed;
}
export function email(value) {
  const v = text(value, "e-mail", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
    fail(400, "Zadejte platný e-mail.");
  return v;
}
export function phone(value, required = true) {
  const v = text(value, "telefon", 30, required);
  if (v && !/^\+?[0-9 ()-]{9,20}$/.test(v))
    fail(400, "Zadejte platný telefon.");
  return v;
}
export function password(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 200)
    fail(400, "Heslo musí mít alespoň 8 znaků.");
  return value;
}
export const clientIp = (request) =>
  request.headers.get("CF-Connecting-IP") || "local";
