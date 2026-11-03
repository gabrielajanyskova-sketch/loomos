/** Dílnička: production planning (admin only). Supplier oil data never leaves the admin API. */
import oilData from "../../data/oils.json";
import labelDefaults from "../../data/labels.json";
import { assertSameOrigin, fail, json, readJson, text } from "./http.js";
import { now } from "./db.js";
import { catalog, variantsOf } from "./catalog.js";
import { calcBatch, DEFAULTS } from "../../assets/js/workshop-calc.mjs";

const oils = oilData.map((o) => ({
  ...o,
  name: catalog.find((p) => p.id === o.product_id)?.name || o.supplier_name,
}));
const scentIds = new Set(catalog.map((p) => p.id));

async function settings(db) {
  const { results } = await db
    .prepare("SELECT key, value FROM workshop_settings")
    .all();
  const stored = Object.fromEntries(
    results
      .filter((r) => r.key in DEFAULTS)
      .map((r) => [r.key, Number(r.value)]),
  );
  return { ...DEFAULTS, ...stored };
}
const jarsOf = async (db, all = false) =>
  (
    await db
      .prepare(
        `SELECT * FROM workshop_jars ${all ? "" : "WHERE active=1"} ORDER BY name`,
      )
      .all()
  ).results;

/** The two jars the shop sells in (supplier data, NI Candle Supplies). Added once; editable later. */
const DEFAULT_JARS = [
  {
    name: "Oxford 20 cl (střední) — průhledná",
    fill_g: 180,
    variant_id: "mala",
    note: "Ø 74 × 87 mm, vnitřní Ø 67 mm, sklo cca 296 g. S víčkem plnit cca 165 g. Dodavatel doporučuje knot HTP 105, hoření cca 33 h.",
  },
  {
    name: "Kimberley 30 cl (velká) — průhledná",
    fill_g: 220,
    variant_id: "velka",
    note: "Ø 81,5 × 93 mm, vnitřní Ø 77 mm, sklo cca 370 g. S víčkem plnit cca 200 g. Dodavatel doporučuje knot HTP 126, hoření až 40 h.",
  },
];
async function seedJars(db) {
  const seeded = await db
    .prepare("SELECT 1 FROM workshop_settings WHERE key='seeded_jars'")
    .first();
  if (seeded) return;
  await db.batch([
    ...DEFAULT_JARS.map((j) =>
      db
        .prepare(
          "INSERT INTO workshop_jars (name, fill_g, wicks, wick, variant_id, note) VALUES (?,?,1,'',?,?)",
        )
        .bind(j.name, j.fill_g, j.variant_id, j.note),
    ),
    db.prepare(
      "INSERT OR IGNORE INTO workshop_settings (key, value) VALUES ('seeded_jars', '1')",
    ),
  ]);
}

export const LABEL_DEFAULTS = {
  diameter: 60,
  font: 6.5,
  phone: "",
  columns: 3,
  rows: 4,
  margin_top: 15,
  margin_left: 15,
  gap: 5,
};
async function labelSettings(db) {
  const row = await db
    .prepare("SELECT value FROM workshop_settings WHERE key='label'")
    .first();
  try {
    return { ...LABEL_DEFAULTS, ...(row ? JSON.parse(row.value) : {}) };
  } catch {
    return { ...LABEL_DEFAULTS };
  }
}

/** Label texts from the supplier's CLP documents; never overwrites the owner's edits. */
const seedLabels = (db) =>
  db.batch(
    labelDefaults
      .filter((l) => scentIds.has(l.product_id))
      .map((l) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO workshop_labels (product_id, contains, extra, pictogram, source) VALUES (?,?,?,?,?)",
          )
          .bind(
            l.product_id,
            l.contains,
            l.extra,
            l.pictogram ? 1 : 0,
            l.supplier,
          ),
      ),
  );

export async function overview(db) {
  await seedJars(db);
  await seedLabels(db);
  const [jars, config, batches, labels, label] = await Promise.all([
    jarsOf(db, true),
    settings(db),
    db
      .prepare("SELECT * FROM workshop_batches ORDER BY id DESC LIMIT 50")
      .all(),
    db.prepare("SELECT * FROM workshop_labels").all(),
    labelSettings(db),
  ]);
  return json({
    oils,
    scents: catalog.map((p) => ({
      id: p.id,
      name: p.name,
      variants: variantsOf(p).map((v) => ({ id: v.id, name: v.name })),
    })),
    jars,
    settings: config,
    labels: Object.fromEntries(
      labels.results.map((l) => [
        l.product_id,
        {
          contains: l.contains,
          extra: l.extra,
          pictogram: Boolean(l.pictogram),
          source: l.source,
        },
      ]),
    ),
    label,
    batches: batches.results.map((b) => ({
      ...b,
      items: JSON.parse(b.items),
      result: JSON.parse(b.result),
    })),
  });
}

const percent = (value, label, max) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max)
    fail(400, `Zkontrolujte pole ${label}.`);
  return Math.round(n * 100) / 100;
};

export async function saveSettings(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  const load = percent(data.load_percent, "vonný olej %", 20);
  const loss = percent(data.loss_percent, "rezerva %", 30);
  await db.batch(
    [
      ["load_percent", load],
      ["loss_percent", loss],
      ["no_ufi", data.no_ufi === false || data.no_ufi === 0 ? 0 : 1],
    ].map(([k, v]) =>
      db
        .prepare(
          "INSERT INTO workshop_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .bind(k, String(v)),
    ),
  );
  return json({ ok: true });
}

export async function saveJar(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2048);
  const name = text(data.name, "název sklenice", 80);
  const fill = Number(data.fill_g);
  const water =
    data.water_g === null || data.water_g === "" ? null : Number(data.water_g);
  const wicks = Number(data.wicks ?? 1);
  if (!Number.isInteger(fill) || fill < 1 || fill > 10000)
    fail(400, "Zadejte náplň v gramech (celé číslo).");
  if (
    water !== null &&
    (!Number.isInteger(water) || water < 1 || water > 20000)
  )
    fail(400, "Zkontrolujte hmotnost vody.");
  if (!Number.isInteger(wicks) || wicks < 1 || wicks > 5)
    fail(400, "Počet knotů musí být 1–5.");
  if (!["", "mala", "velka"].includes(data.variant_id))
    fail(400, "Neplatná velikost v e-shopu.");
  const values = [
    name,
    water,
    fill,
    wicks,
    text(data.wick, "knot", 80, false),
    data.variant_id,
    text(data.note, "poznámka", 200, false),
    data.active === false ? 0 : 1,
  ];
  if (data.id)
    await db
      .prepare(
        "UPDATE workshop_jars SET name=?, water_g=?, fill_g=?, wicks=?, wick=?, variant_id=?, note=?, active=? WHERE id=?",
      )
      .bind(...values, Number(data.id))
      .run();
  else
    await db
      .prepare(
        "INSERT INTO workshop_jars (name, water_g, fill_g, wicks, wick, variant_id, note, active) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(...values)
      .run();
  return json({ ok: true });
}

function parseItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    fail(400, "Přidejte alespoň jeden řádek výroby.");
  return items.map((i) => {
    const count = Number(i?.count);
    if (
      !scentIds.has(i?.product_id) ||
      !Number.isInteger(Number(i?.jar_id)) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10000
    )
      fail(400, "Zkontrolujte vůni, sklenici a počet kusů.");
    return { product_id: i.product_id, jar_id: Number(i.jar_id), count };
  });
}

export async function saveBatch(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 16384);
  const items = parseItems(data.items);
  const config = {
    load_percent: percent(data.load_percent, "vonný olej %", 20),
    loss_percent: percent(data.loss_percent, "rezerva %", 30),
    no_ufi: data.no_ufi === false || data.no_ufi === 0 ? 0 : 1,
  };
  const jars = await jarsOf(db, true);
  for (const i of items)
    if (!jars.some((j) => j.id === i.jar_id)) fail(400, "Neznámá sklenice.");
  const result = calcBatch({ items, jars, oils, ...config });
  await db
    .prepare(
      "INSERT INTO workshop_batches (created, name, load_percent, loss_percent, no_ufi, items, result) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      now(),
      text(data.name, "název výroby", 120, false),
      config.load_percent,
      config.loss_percent,
      config.no_ufi,
      JSON.stringify(items),
      JSON.stringify(result),
    )
    .run();
  return json({ ok: true }, 201);
}

/** Mark a batch as made; candles in jars linked to a shop size are added to stock. */
export async function finishBatch(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  const batch = await db
    .prepare("SELECT * FROM workshop_batches WHERE id=?")
    .bind(Number(data.id))
    .first();
  if (!batch) fail(404, "Výroba neexistuje.");
  if (batch.status === "hotovo") fail(409, "Výroba už je hotová.");
  const jars = await jarsOf(db, true);
  const added = new Map();
  for (const item of JSON.parse(batch.items)) {
    const jar = jars.find((j) => j.id === item.jar_id);
    const product = catalog.find((p) => p.id === item.product_id);
    if (!jar?.variant_id || !product) continue;
    if (!variantsOf(product).some((v) => v.id === jar.variant_id)) continue;
    const key = `${product.id}::${jar.variant_id}`;
    added.set(key, (added.get(key) || 0) + item.count);
  }
  const claim = await db
    .prepare(
      "UPDATE workshop_batches SET status='hotovo', finished=? WHERE id=? AND status!='hotovo'",
    )
    .bind(now(), batch.id)
    .run();
  if (!claim.meta.changes) fail(409, "Výroba už je hotová.");
  if (added.size)
    await db.batch(
      [...added].map(([key, count]) => {
        const [product, variant] = key.split("::");
        return db
          .prepare(
            "INSERT INTO stock (product_id, variant_id, quantity) VALUES (?,?,?) ON CONFLICT(product_id, variant_id) DO UPDATE SET quantity = quantity + excluded.quantity",
          )
          .bind(product, variant, count);
      }),
    );
  return json({
    ok: true,
    stocked: [...added].map(([key, count]) => ({ key, count })),
  });
}

export async function deleteBatch(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  await db
    .prepare("DELETE FROM workshop_batches WHERE id=?")
    .bind(Number(data.id))
    .run();
  return json({ ok: true });
}

/** Text from the supplier's "KE STAŽENÍ" documents (Substances / Mixtures) for each scent. */
export async function saveLabel(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 8192);
  if (!scentIds.has(data.product_id)) fail(400, "Neznámá vůně.");
  await db
    .prepare(
      "INSERT INTO workshop_labels (product_id, contains, extra, pictogram, source) VALUES (?,?,?,?,'upraveno ručně') ON CONFLICT(product_id) DO UPDATE SET contains=excluded.contains, extra=excluded.extra, pictogram=excluded.pictogram, source=excluded.source",
    )
    .bind(
      data.product_id,
      text(data.contains, "obsahuje", 1000, false),
      text(data.extra, "další upozornění", 1500, false),
      data.pictogram === true ? 1 : 0,
    )
    .run();
  return json({ ok: true });
}

export async function saveLabelSettings(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2048);
  const num = (key, min, max) => {
    const n = Number(data[key]);
    if (!Number.isFinite(n) || n < min || n > max)
      fail(400, `Zkontrolujte nastavení etiket (${key}).`);
    return Math.round(n * 10) / 10;
  };
  const phoneValue = text(data.phone, "telefon", 30, false);
  if (phoneValue && !/^\+?[0-9 ()-]{9,20}$/.test(phoneValue))
    fail(400, "Zadejte platný telefon.");
  const value = {
    diameter: num("diameter", 20, 120),
    font: num("font", 4, 12),
    phone: phoneValue,
    columns: num("columns", 1, 10),
    rows: num("rows", 1, 15),
    margin_top: num("margin_top", 0, 60),
    margin_left: num("margin_left", 0, 60),
    gap: num("gap", 0, 30),
  };
  await db
    .prepare(
      "INSERT INTO workshop_settings (key, value) VALUES ('label', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(JSON.stringify(value))
    .run();
  return json({ ok: true });
}
