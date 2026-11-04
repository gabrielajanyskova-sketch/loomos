/** Dílnička: production planning (admin only). Supplier oil data never leaves the admin API. */
import oilData from "../../data/oils.json";
import labelDefaults from "../../data/labels.json";
import { assertSameOrigin, fail, json, readJson, text } from "./http.js";
import { now } from "./db.js";
import { allScents as catalog, variantsOf } from "./catalog.js";
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
    note: "Ø 74 × 87 mm, vnitřní Ø 67 mm, sklo cca 296 g. S víčkem plnit cca 165 g. Dodavatel sklenic doporučuje bavlněný knot HTP 105 (hoření cca 33 h); u dřevěného knotu vyzkoušejte vhodnou šířku.",
  },
  {
    name: "Kimberley 30 cl (velká) — průhledná",
    fill_g: 220,
    variant_id: "velka",
    note: "Ø 81,5 × 93 mm, vnitřní Ø 77 mm, sklo cca 370 g. S víčkem plnit cca 200 g. Dodavatel sklenic doporučuje bavlněný knot HTP 126 (hoření až 40 h); u dřevěného knotu vyzkoušejte vhodnou šířku.",
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
          "INSERT INTO workshop_jars (name, fill_g, wicks, wick, variant_id, note) VALUES (?,?,1,'dřevěný knot',?,?)",
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
  font: 6.6,
  phone: "",
  columns: 3,
  rows: 4,
  margin_top: 15,
  margin_left: 15,
  gap: 5,
  icons: true,
  clp: true,
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
            `INSERT INTO workshop_labels (product_id, contains, extra, pictogram, source) VALUES (?,?,?,?,?)
             ON CONFLICT(product_id) DO UPDATE SET contains=excluded.contains, extra=excluded.extra,
               pictogram=excluded.pictogram, source=excluded.source
             WHERE workshop_labels.source != 'upraveno ručně'
               AND (workshop_labels.contains != excluded.contains OR workshop_labels.extra != excluded.extra
                 OR workshop_labels.pictogram != excluded.pictogram OR workshop_labels.source != excluded.source)`,
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

/** The two soy waxes the owner uses (values from the supplier's product pages). */
const DEFAULT_WAXES = [
  {
    name: "Golden Wax 464 (US464)",
    melt: "45–48 °C",
    heat_to: 85,
    add_oil_at: 70,
    pour_from: 60,
    pour_to: 80,
    max_load: "obvykle 7–8 %, max. 10 %",
    cure_min: 10,
    cure_max: 14,
    note: "Lít pomalu do předehřátých sklenic, chladnout na mřížce. Pomalé chladnutí omezuje praskliny a nerovný povrch.",
  },
  {
    name: "Nature Wax C-3",
    melt: "45 °C",
    heat_to: 77,
    add_oil_at: 65,
    pour_from: 55,
    pour_to: 65,
    max_load: "6–8 %, max. 10 %",
    cure_min: 10,
    cure_max: 14,
    note: "Zahřívat na 65–77 °C, nikdy nad 93 °C. Olej přidávat při 65–70 °C. Při chladnu (pod 22 °C) sklenice předehřát kvůli přilnavosti ke sklu. Zapálit nejdříve po 48 hodinách, ideálně po 1–2 týdnech.",
  },
];
const WAX_FIELDS = [
  "name",
  "melt",
  "heat_to",
  "add_oil_at",
  "pour_from",
  "pour_to",
  "max_load",
  "cure_min",
  "cure_max",
  "note",
];
async function seedWaxes(db) {
  const seeded = await db
    .prepare("SELECT 1 FROM workshop_settings WHERE key='seeded_waxes'")
    .first();
  if (seeded) return;
  await db.batch([
    ...DEFAULT_WAXES.map((w) =>
      db
        .prepare(
          `INSERT INTO workshop_waxes (${WAX_FIELDS.join(", ")}) VALUES (${WAX_FIELDS.map(() => "?").join(",")})`,
        )
        .bind(...WAX_FIELDS.map((f) => w[f])),
    ),
    db.prepare(
      "INSERT OR IGNORE INTO workshop_settings (key, value) VALUES ('seeded_waxes', '1')",
    ),
  ]);
}

export async function saveWax(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 4096);
  const temp = (key, label) => {
    const v = data[key];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 20 || n > 120)
      fail(400, `Zkontrolujte teplotu: ${label}.`);
    return n;
  };
  const days = (key) => {
    const v = data[key];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 90)
      fail(400, "Zkontrolujte dobu zrání.");
    return n;
  };
  const values = {
    name: text(data.name, "název vosku", 80),
    melt: text(data.melt, "bod tání", 40, false),
    heat_to: temp("heat_to", "zahřát na"),
    add_oil_at: temp("add_oil_at", "přidat olej při"),
    pour_from: temp("pour_from", "lít od"),
    pour_to: temp("pour_to", "lít do"),
    max_load: text(data.max_load, "max. olej", 60, false),
    cure_min: days("cure_min"),
    cure_max: days("cure_max"),
    note: text(data.note, "poznámka", 500, false),
  };
  const list = WAX_FIELDS.map((f) => values[f]);
  if (data.id)
    await db
      .prepare(
        `UPDATE workshop_waxes SET ${WAX_FIELDS.map((f) => `${f}=?`).join(", ")}, active=? WHERE id=?`,
      )
      .bind(...list, data.active === false ? 0 : 1, Number(data.id))
      .run();
  else
    await db
      .prepare(
        `INSERT INTO workshop_waxes (${WAX_FIELDS.join(", ")}) VALUES (${WAX_FIELDS.map(() => "?").join(",")})`,
      )
      .bind(...list)
      .run();
  return json({ ok: true });
}

export async function overview(db) {
  await seedJars(db);
  await seedWaxes(db);
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
  const [waxes, waxSetting, wickTests] = await Promise.all([
    db.prepare("SELECT * FROM workshop_waxes ORDER BY id").all(),
    db
      .prepare("SELECT value FROM workshop_settings WHERE key='wax_id'")
      .first(),
    db
      .prepare("SELECT * FROM workshop_wick_tests ORDER BY id DESC LIMIT 300")
      .all(),
  ]);
  return json({
    waxes: waxes.results,
    wick_tests: wickTests.results.map((t) => ({
      ...t,
      full_pool: Boolean(t.full_pool),
      soot: Boolean(t.soot),
      mushroom: Boolean(t.mushroom),
    })),
    wax_id: waxSetting
      ? Number(waxSetting.value)
      : (waxes.results[0]?.id ?? null),
    oils,
    scents: catalog.map((p) => ({
      id: p.id,
      name: p.active ? p.name : `${p.name} (zatím není v e-shopu)`,
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
      ...(Number.isInteger(data.wax_id) ? [["wax_id", data.wax_id]] : []),
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
  if (Number.isInteger(data.wax_id)) {
    const wax = await db
      .prepare("SELECT * FROM workshop_waxes WHERE id=?")
      .bind(data.wax_id)
      .first();
    if (wax) result.wax = wax;
  }
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
    icons: data.icons === true || data.icons === "on",
    clp: data.clp === true || data.clp === "on",
  };
  if (value.clp && value.font < 6.6)
    fail(
      400,
      "Podle pravidel CLP musí mít písmo aspoň 6,6 pt (výška malých písmen 1,2 mm). Zvětšete písmo, nebo vypněte kontrolu CLP.",
    );
  await db
    .prepare(
      "INSERT INTO workshop_settings (key, value) VALUES ('label', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(JSON.stringify(value))
    .run();
  return json({ ok: true });
}

/** Wick test log: which wick size works in which jar with which wax and scent. */
export async function saveWickTest(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 4096);
  const optional = (key, max, decimals = false) => {
    const v = data[key];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      n > max ||
      (!decimals && !Number.isInteger(n))
    )
      fail(400, "Zkontrolujte čísla v testu knotu.");
    return n;
  };
  const productId = data.product_id || "";
  if (productId && !scentIds.has(productId)) fail(400, "Neznámá vůně.");
  if (!["", "mala", "dobra", "velka", "nestabilni"].includes(data.flame || ""))
    fail(400, "Neplatný plamen.");
  const rating = optional("rating", 5);
  if (rating !== null && rating < 1) fail(400, "Hodnocení je 1–5.");
  await db
    .prepare(
      "INSERT INTO workshop_wick_tests (created, jar_id, product_id, wax_id, wick, hours, melt_mm, full_pool, soot, mushroom, flame, rating, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      now(),
      optional("jar_id", 1e9),
      productId,
      optional("wax_id", 1e9),
      text(data.wick, "knot", 80),
      optional("hours", 100, true),
      optional("melt_mm", 300),
      data.full_pool ? 1 : 0,
      data.soot ? 1 : 0,
      data.mushroom ? 1 : 0,
      data.flame || "",
      rating,
      text(data.note, "poznámka", 500, false),
    )
    .run();
  return json({ ok: true }, 201);
}

export async function deleteWickTest(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 512);
  await db
    .prepare("DELETE FROM workshop_wick_tests WHERE id=?")
    .bind(Number(data.id))
    .run();
  return json({ ok: true });
}
