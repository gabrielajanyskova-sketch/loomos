/** D1 schema. Created lazily, so the owner never has to run SQL by hand. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS product_prices (
    product_id TEXT NOT NULL, variant_id TEXT NOT NULL,
    regular_price INTEGER CHECK(regular_price IS NULL OR regular_price BETWEEN 1 AND 100000),
    sale_price INTEGER CHECK(sale_price IS NULL OR (sale_price > 0 AND sale_price < regular_price)),
    reference_price INTEGER, sale_started INTEGER, reference_source TEXT,
    tracked_since INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0, write_token TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(product_id,variant_id)
  )`,
  `CREATE TABLE IF NOT EXISTS price_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, variant_id TEXT NOT NULL,
    regular_price INTEGER, sale_price INTEGER, reference_price INTEGER, reference_source TEXT, created INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, variant_id TEXT NOT NULL,
    price INTEGER, created INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS price_history_lookup ON price_history(product_id,variant_id,created,id)`,
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
    extra TEXT NOT NULL DEFAULT '',
    pictogram INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_waxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    melt TEXT NOT NULL DEFAULT '',
    heat_to INTEGER,
    add_oil_at INTEGER,
    pour_from INTEGER,
    pour_to INTEGER,
    max_load TEXT NOT NULL DEFAULT '',
    cure_min INTEGER,
    cure_max INTEGER,
    note TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_wick_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created INTEGER NOT NULL,
    jar_id INTEGER,
    product_id TEXT NOT NULL DEFAULT '',
    wax_id INTEGER,
    wick TEXT NOT NULL,
    hours REAL,
    melt_mm INTEGER,
    full_pool INTEGER NOT NULL DEFAULT 0,
    soot INTEGER NOT NULL DEFAULT 0,
    mushroom INTEGER NOT NULL DEFAULT 0,
    flame TEXT NOT NULL DEFAULT '',
    rating INTEGER,
    note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    number TEXT PRIMARY KEY,
    series TEXT NOT NULL,
    seq INTEGER NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    issued INTEGER NOT NULL,
    payload TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created INTEGER NOT NULL,
    order_number TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    items TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    matched INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0
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
  // Products added or edited in admin; they override data/products.json by id.
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 1000,
    updated INTEGER NOT NULL
  )`,
  // Product photos uploaded in admin (resized in the browser); served by GET /api/img?id=…
  `CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    data TEXT NOT NULL,
    created INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS product_images_product ON product_images (product_id, position)",
  // "Hlídat dostupnost": one e-mail when a sold-out product is back; the row is deleted after sending.
  `CREATE TABLE IF NOT EXISTS stock_alerts (
    email TEXT NOT NULL COLLATE NOCASE,
    product_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    created INTEGER NOT NULL,
    PRIMARY KEY (email, product_id, variant_id)
  )`,
  // Verified reviews: only customers of a shipped order can rate the products from it.
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    reply TEXT NOT NULL DEFAULT '',
    UNIQUE (order_number, product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'nova',
    data TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_data TEXT
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
