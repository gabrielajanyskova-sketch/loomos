/** Individual inquiries (custom sun catchers, stickers, logos): stored in D1 and e-mailed to the shop. */
import {
  assertSameOrigin,
  binary,
  clientIp,
  email,
  fail,
  json,
  phone,
  readJson,
  text,
} from "./http.js";
import { now } from "./db.js";
import { limit } from "./auth.js";
import { sendMail, shopEmail } from "./mail.js";

export const INQUIRY_TYPES = {
  "lapac-slunce": "Lapač slunce",
  samolepka: "Samolepka / nálepka",
  logo: "Logo (samolepka, polep)",
  jine: "Něco jiného",
};
const FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};
/** D1 stores at most ~2 MB per row; photos are resized in the browser before upload. */
const MAX_FILE = 1_400_000;

export async function create(db, request, env, ctx) {
  assertSameOrigin(request);
  const data = await readJson(request, 2_000_000);
  await limit(db, `inquiry:${clientIp(request)}`, 5, 3600);
  if (data.consent !== true)
    fail(400, "Potvrďte prosím souhlas se zpracováním údajů.");
  if (!(data.type in INQUIRY_TYPES)) fail(400, "Vyberte, o co máte zájem.");
  const quantity = Number(data.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
    fail(400, "Zadejte počet kusů.");
  const inquiry = {
    type: data.type,
    name: text(data.name, "jméno", 120),
    email: email(data.email),
    phone: phone(data.phone, false),
    size: text(data.size, "velikost", 120, false),
    quantity,
    material: text(data.material, "fólie", 120, false),
    motif: text(data.motif, "popis motivu", 3000),
    deadline: text(data.deadline, "termín", 120, false),
  };
  let file = null;
  if (data.file) {
    const name = text(data.file.name, "název souboru", 120)
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .slice(0, 120);
    const ext = FILE_TYPES[data.file.type];
    if (!ext)
      fail(400, "Pošlete prosím obrázek (JPG, PNG, WebP, SVG) nebo PDF.");
    const base64 = String(data.file.data || "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
      fail(400, "Soubor se nepodařilo načíst.");
    if ((base64.length * 3) / 4 > MAX_FILE)
      fail(413, "Soubor je příliš velký (max. 1,4 MB). Pošlete menší.");
    file = { name, type: data.file.type, data: base64 };
  }
  const created = now();
  const row = await db
    .prepare(
      "INSERT INTO inquiries (created, data, file_name, file_type, file_data) VALUES (?,?,?,?,?) RETURNING id",
    )
    .bind(
      created,
      JSON.stringify(inquiry),
      file?.name ?? null,
      file?.type ?? null,
      file?.data ?? null,
    )
    .first();
  const rows = {
    rows: [
      ["Co", INQUIRY_TYPES[inquiry.type]],
      ["Velikost", inquiry.size || "—"],
      ["Počet kusů", String(inquiry.quantity)],
      ["Fólie / materiál", inquiry.material || "—"],
      ["Termín", inquiry.deadline || "—"],
    ],
  };
  const mails = Promise.all([
    sendMail(env, {
      to: shopEmail(env),
      subject: `Poptávka č. ${row.id}: ${INQUIRY_TYPES[inquiry.type]} — ${inquiry.name}`,
      title: "Nová individuální poptávka",
      key: `inquiry-shop-${row.id}`,
      replyTo: inquiry.email,
      attachments: file ? [{ filename: file.name, content: file.data }] : [],
      blocks: [
        `${inquiry.name}, ${inquiry.email}${inquiry.phone ? ", " + inquiry.phone : ""}`,
        rows,
        `Motiv a popis:\n${inquiry.motif}`,
        file
          ? `Příloha: ${file.name}`
          : "Bez přílohy. Odpovědět můžete přímo na tento e-mail.",
      ],
    }),
    sendMail(env, {
      to: inquiry.email,
      subject: "Poptávku jsem přijala | LOOMOS",
      title: "Děkuji za poptávku",
      key: `inquiry-customer-${row.id}`,
      replyTo: shopEmail(env),
      blocks: [
        `Dobrý den, ${inquiry.name},\nděkuji za poptávku. Projdu ji a do pár dnů se vám ozvu s návrhem a cenou.`,
        rows,
        `Váš popis:\n${inquiry.motif}`,
        "Pokud budete chtít něco doplnit, stačí odpovědět na tento e-mail.",
      ],
    }),
  ]);
  ctx?.waitUntil ? ctx.waitUntil(mails) : await mails;
  return json({ ok: true, id: row.id }, 201);
}

/* ---------- admin ---------- */
export async function list(db) {
  const { results } = await db
    .prepare(
      "SELECT id, created, status, data, file_name, file_type FROM inquiries ORDER BY id DESC LIMIT 200",
    )
    .all();
  return json(
    results.map((r) => ({
      ...JSON.parse(r.data),
      id: r.id,
      created: r.created,
      status: r.status,
      file_name: r.file_name,
      file_type: r.file_type,
      type_label: INQUIRY_TYPES[JSON.parse(r.data).type] || "",
    })),
  );
}

export async function file(db, request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  const row = await db
    .prepare("SELECT file_name, file_type, file_data FROM inquiries WHERE id=?")
    .bind(id)
    .first();
  if (!row?.file_data) fail(404, "Soubor nenalezen.");
  const bytes = Uint8Array.from(atob(row.file_data), (c) => c.charCodeAt(0));
  // Always a download in a sandbox: an uploaded SVG must never run on the shop's origin.
  return binary(bytes, "application/octet-stream", {
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
  });
}

export async function update(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const id = Number(data.id);
  if (data.action === "delete") {
    await db.prepare("DELETE FROM inquiries WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  if (!["nova", "vyrizena"].includes(data.status)) fail(400, "Neplatný stav.");
  await db
    .prepare("UPDATE inquiries SET status=? WHERE id=?")
    .bind(data.status, id)
    .run();
  return json({ ok: true });
}
