/** D1 schema. Created lazily, so the owner never has to run SQL by hand. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created INTEGER NOT NULL,
    blocked INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    subject INTEGER NOT NULL,
    expires INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resets (
    token_hash TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stock (
    product_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (product_id, variant_id)
  )`,
  `CREATE TABLE IF NOT EXISTS codes (
    code TEXT PRIMARY KEY COLLATE NOCASE,
    type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
    value INTEGER NOT NULL,
    min_total INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    valid_from INTEGER,
    valid_to INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    note TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL,
    CHECK (max_uses IS NULL OR uses <= max_uses)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE,
    request_id TEXT NOT NULL UNIQUE,
    public_token TEXT NOT NULL UNIQUE,
    created INTEGER NOT NULL,
    status TEXT NOT NULL,
    customer_id INTEGER,
    email TEXT NOT NULL,
    total INTEGER NOT NULL,
    test INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_jars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    water_g INTEGER,
    fill_g INTEGER NOT NULL CHECK (fill_g > 0),
    wicks INTEGER NOT NULL DEFAULT 1,
    wick TEXT NOT NULL DEFAULT '',
    variant_id TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_labels (
    product_id TEXT PRIMARY KEY,
    contains TEXT NOT NULL DEFAULT '',
    extra TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planovano',
    load_percent REAL NOT NULL,
    loss_percent REAL NOT NULL,
    no_ufi INTEGER NOT NULL DEFAULT 1,
    items TEXT NOT NULL,
    result TEXT NOT NULL,
    finished INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id)",
  "CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires)",
];

let ready;
export function database(env) {
  if (!env.DB)
    throw Object.assign(new Error("D1 binding DB is missing"), {
      status: 503,
      expose: "Databáze e-shopu zatím není připojená.",
    });
  ready ||= env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch(
    (error) => {
      ready = null;
      throw error;
    },
  );
  return ready.then(() => env.DB);
}
export const now = () => Math.floor(Date.now() / 1000);
