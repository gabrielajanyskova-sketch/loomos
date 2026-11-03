import {
  assertSameOrigin,
  clientIp,
  email,
  fail,
  json,
  password,
  phone,
  readJson,
  text,
} from "./http.js";
import { now } from "./db.js";
import {
  createSession,
  DUMMY_HASH,
  endAllSessions,
  endSession,
  hashPassword,
  limit,
  randomToken,
  sha256,
  verifyPassword,
} from "./auth.js";
import { currentCustomer } from "./shop.js";
import { sendMail, shopEmail } from "./mail.js";

const RESET_SECONDS = 3600;
const publicCustomer = (c) =>
  c && { email: c.email, name: c.name, phone: c.phone, created: c.created };

async function requireCustomer(db, request) {
  const customer = await currentCustomer(db, request);
  if (!customer) fail(401, "Přihlaste se prosím.");
  return customer;
}

export async function me(db, request) {
  return json({ customer: publicCustomer(await currentCustomer(db, request)) });
}

export async function register(db, request, env, ctx) {
  assertSameOrigin(request);
  const data = await readJson(request, 4096);
  await limit(db, `register:${clientIp(request)}`, 5, 3600);
  const address = email(data.email);
  const name = text(data.name, "jméno a příjmení", 120);
  const tel = phone(data.phone, false);
  const secret = password(data.password);
  if (data.terms !== true)
    fail(400, "Pro registraci je nutný souhlas se zpracováním osobních údajů.");
  const hash = await hashPassword(secret);
  const created = now();
  const row = await db
    .prepare(
      "INSERT INTO customers (email, name, phone, password_hash, created) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING id",
    )
    .bind(address, name, tel, hash, created)
    .first();
  if (!row)
    fail(
      409,
      "Účet s tímto e-mailem už existuje. Přihlaste se, nebo si obnovte heslo.",
    );
  ctx.waitUntil(
    sendMail(env, {
      to: address,
      subject: "Vítejte v LOOMOS",
      title: "Váš účet je připravený",
      key: `welcome-${row.id}`,
      replyTo: shopEmail(env),
      blocks: [
        `Dobrý den, ${name},\nděkujeme za registraci. Po přihlášení máte na všechny svíčky automaticky slevu 5 %.`,
        {
          button: [
            "Přejít do obchodu",
            `${new URL(request.url).origin}/obchod`,
          ],
        },
      ],
    }),
  );
  const cookie = await createSession(db, request, "customer", row.id);
  return json(
    { customer: { email: address, name, phone: tel, created } },
    201,
    { "Set-Cookie": cookie },
  );
}

export async function login(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2048);
  const address = email(data.email);
  await limit(db, `login-ip:${clientIp(request)}`, 30, 900);
  await limit(db, `login:${await sha256(address)}`, 10, 900);
  const row = await db
    .prepare("SELECT * FROM customers WHERE email=?")
    .bind(address)
    .first();
  const ok = await verifyPassword(
    typeof data.password === "string" ? data.password : "",
    row?.password_hash || DUMMY_HASH,
  );
  if (!row || !ok) fail(401, "Nesprávný e-mail nebo heslo.");
  if (row.blocked) fail(403, "Účet je zablokovaný. Napište nám prosím.");
  const cookie = await createSession(db, request, "customer", row.id);
  return json({ customer: publicCustomer(row) }, 200, { "Set-Cookie": cookie });
}

export async function logout(db, request) {
  assertSameOrigin(request);
  return json({ ok: true }, 200, {
    "Set-Cookie": await endSession(db, request, "customer"),
  });
}

export async function update(db, request) {
  assertSameOrigin(request);
  const customer = await requireCustomer(db, request);
  const data = await readJson(request, 2048);
  const name = text(data.name, "jméno a příjmení", 120);
  const tel = phone(data.phone, false);
  await db
    .prepare("UPDATE customers SET name=?, phone=? WHERE id=?")
    .bind(name, tel, customer.id)
    .run();
  return json({ customer: publicCustomer({ ...customer, name, phone: tel }) });
}

export async function changePassword(db, request) {
  assertSameOrigin(request);
  const customer = await requireCustomer(db, request);
  const data = await readJson(request, 2048);
  await limit(db, `password:${customer.id}`, 10, 900);
  const row = await db
    .prepare("SELECT password_hash FROM customers WHERE id=?")
    .bind(customer.id)
    .first();
  if (!(await verifyPassword(String(data.current || ""), row.password_hash)))
    fail(400, "Současné heslo nesouhlasí.");
  const hash = await hashPassword(password(data.password));
  await db
    .prepare("UPDATE customers SET password_hash=? WHERE id=?")
    .bind(hash, customer.id)
    .run();
  await endAllSessions(db, "customer", customer.id);
  const cookie = await createSession(db, request, "customer", customer.id);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

export async function forgot(db, request, env, ctx) {
  assertSameOrigin(request);
  const data = await readJson(request, 1024);
  const address = email(data.email);
  await limit(db, `forgot-ip:${clientIp(request)}`, 10, 3600);
  await limit(db, `forgot:${await sha256(address)}`, 3, 3600);
  const row = await db
    .prepare("SELECT id, name FROM customers WHERE email=? AND blocked=0")
    .bind(address)
    .first();
  if (row) {
    const token = randomToken();
    await db
      .prepare(
        "INSERT INTO resets (token_hash, customer_id, expires) VALUES (?,?,?)",
      )
      .bind(await sha256(token), row.id, now() + RESET_SECONDS)
      .run();
    ctx.waitUntil(
      sendMail(env, {
        to: address,
        subject: "Obnovení hesla | LOOMOS",
        title: "Nastavte si nové heslo",
        key: `reset-${await sha256(token)}`,
        blocks: [
          `Dobrý den, ${row.name},\nněkdo (nejspíš vy) požádal o obnovení hesla k účtu LOOMOS. Odkaz platí 1 hodinu.`,
          {
            button: [
              "Nastavit nové heslo",
              `${new URL(request.url).origin}/obnova-hesla?token=${token}`,
            ],
          },
          "Pokud jste o obnovení nežádali, e-mail klidně ignorujte. Vaše heslo zůstává beze změny.",
        ],
      }),
    );
  }
  // Same answer either way, so the form does not reveal who has an account.
  return json({
    ok: true,
    message:
      "Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro obnovení hesla.",
  });
}

export async function reset(db, request) {
  assertSameOrigin(request);
  const data = await readJson(request, 2048);
  const token = String(data.token || "");
  if (!/^[0-9a-f]{64}$/.test(token))
    fail(400, "Odkaz pro obnovení je neplatný.");
  await limit(db, `reset:${clientIp(request)}`, 20, 3600);
  const secret = password(data.password);
  const hashToken = await sha256(token);
  const row = await db
    .prepare(
      "UPDATE resets SET used=1 WHERE token_hash=? AND used=0 AND expires>? RETURNING customer_id",
    )
    .bind(hashToken, now())
    .first();
  if (!row)
    fail(
      400,
      "Odkaz pro obnovení vypršel nebo už byl použitý. Požádejte o nový.",
    );
  await db
    .prepare("UPDATE customers SET password_hash=? WHERE id=?")
    .bind(await hashPassword(secret), row.customer_id)
    .run();
  await endAllSessions(db, "customer", row.customer_id);
  await db
    .prepare("DELETE FROM resets WHERE customer_id=? OR expires<?")
    .bind(row.customer_id, now())
    .run();
  const cookie = await createSession(db, request, "customer", row.customer_id);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

export async function myOrders(db, request) {
  const customer = await requireCustomer(db, request);
  const { results } = await db
    .prepare(
      "SELECT number, created, status, total, public_token FROM orders WHERE customer_id=? ORDER BY id DESC LIMIT 100",
    )
    .bind(customer.id)
    .all();
  return json(
    results.map((o) => ({
      number: o.number,
      created: o.created,
      status: o.status,
      total: o.total,
      token: o.public_token,
    })),
  );
}

/** GDPR: the customer can delete the account; orders stay for accounting but are unlinked. */
export async function deleteAccount(db, request) {
  assertSameOrigin(request);
  const customer = await requireCustomer(db, request);
  const data = await readJson(request, 1024);
  const row = await db
    .prepare("SELECT password_hash FROM customers WHERE id=?")
    .bind(customer.id)
    .first();
  if (!(await verifyPassword(String(data.password || ""), row.password_hash)))
    fail(400, "Heslo nesouhlasí.");
  await db.batch([
    db
      .prepare("UPDATE orders SET customer_id=NULL WHERE customer_id=?")
      .bind(customer.id),
    db
      .prepare("DELETE FROM sessions WHERE kind='customer' AND subject=?")
      .bind(customer.id),
    db.prepare("DELETE FROM resets WHERE customer_id=?").bind(customer.id),
    db.prepare("DELETE FROM customers WHERE id=?").bind(customer.id),
  ]);
  return json({ ok: true }, 200, {
    "Set-Cookie": await endSession(db, request, "customer"),
  });
}
