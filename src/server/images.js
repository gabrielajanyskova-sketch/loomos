/** Product photos managed in admin. Stored in D1 (resized in the browser), served publicly by id. */
import { assertSameOrigin, binary, fail, json, readJson } from "./http.js";
import { now } from "./db.js";
import { loadCatalog } from "./catalog.js";

const TYPES = ["image/webp", "image/jpeg", "image/png"];
/** D1 keeps at most ~2 MB per row; photos arrive already scaled to max. 1600 px. */
const MAX_BYTES = 1_400_000;

export async function serve(db, request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) fail(404, "Obrázek nenalezen.");
  const row = await db
    .prepare("SELECT type, data FROM product_images WHERE id=?")
    .bind(id)
    .first();
  if (!row) fail(404, "Obrázek nenalezen.");
  const bytes = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  // An id is never reused for different content, so the photo can be cached for good.
  return binary(bytes, row.type, {
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
}

export async function upload(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2_000_000);
  const { all } = await loadCatalog(db);
  if (!all.some((p) => p.id === data.product_id)) fail(400, "Neznámý produkt.");
  if (!TYPES.includes(data.type))
    fail(400, "Nahrajte fotku ve formátu JPG, PNG nebo WebP.");
  const base64 = String(data.data || "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    fail(400, "Fotku se nepodařilo načíst.");
  if ((base64.length * 3) / 4 > MAX_BYTES)
    fail(413, "Fotka je i po zmenšení příliš velká.");
  const width = Number(data.width);
  const height = Number(data.height);
  if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 4000))
    fail(400, "Neplatné rozměry fotky.");
  const last = await db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) AS pos FROM product_images WHERE product_id=?",
    )
    .bind(data.product_id)
    .first();
  const row = await db
    .prepare(
      "INSERT INTO product_images (product_id, position, type, width, height, data, created) VALUES (?,?,?,?,?,?,?) RETURNING id",
    )
    .bind(
      data.product_id,
      last.pos + 1,
      data.type,
      width,
      height,
      base64,
      now(),
    )
    .first();
  return json({ ok: true, id: row.id }, 201);
}

export async function update(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const id = Number(data.id);
  const image = await db
    .prepare("SELECT id, product_id FROM product_images WHERE id=?")
    .bind(id)
    .first();
  if (!image) fail(404, "Fotka nenalezena.");
  if (data.action === "delete") {
    await db.prepare("DELETE FROM product_images WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  if (data.action === "main") {
    // The chosen photo goes first; the others keep their order behind it.
    const { results } = await db
      .prepare(
        "SELECT id FROM product_images WHERE product_id=? ORDER BY position, id",
      )
      .bind(image.product_id)
      .all();
    const order = [id, ...results.map((r) => r.id).filter((x) => x !== id)];
    await db.batch(
      order.map((imageId, position) =>
        db
          .prepare("UPDATE product_images SET position=? WHERE id=?")
          .bind(position, imageId),
      ),
    );
    return json({ ok: true });
  }
  fail(400, "Neznámá akce.");
}
