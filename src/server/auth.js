import { cookies, fail, setCookie } from "./http.js";
import { now } from "./db.js";

const encoder = new TextEncoder();
const hex = (buffer) =>
  [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const fromHex = (s) =>
  new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));

export const sha256 = async (value) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
export const randomToken = (bytes = 32) =>
  hex(crypto.getRandomValues(new Uint8Array(bytes)));

/** Constant-time comparison of two strings via their hashes. */
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Cloudflare Workers cap PBKDF2 at 100 000 iterations.
const ITERATIONS = 100000;
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      256,
    ),
  );
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${hex(salt)}$${await pbkdf2(password, salt, ITERATIONS)}`;
}
export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored).split("$");
  if (scheme !== "pbkdf2" || !hash) return false;
  return safeEqual(
    await pbkdf2(password, fromHex(salt), Number(iterations)),
    hash,
  );
}
// Checked when the account does not exist, so timing does not reveal registered e-mails.
export const DUMMY_HASH = `pbkdf2$${ITERATIONS}$${"0".repeat(32)}$${"0".repeat(64)}`;

export const SESSION = {
  customer: { cookie: "lm_session", seconds: 30 * 24 * 3600 },
  admin: { cookie: "lm_admin", seconds: 8 * 3600 },
};

export async function createSession(db, request, kind, subject) {
  const token = randomToken();
  const { cookie, seconds } = SESSION[kind];
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires < ?").bind(now()),
    db
      .prepare(
        "INSERT INTO sessions (token_hash, kind, subject, expires) VALUES (?,?,?,?)",
      )
      .bind(await sha256(token), kind, subject, now() + seconds),
  ]);
  return setCookie(request, cookie, token, seconds);
}
export async function readSession(db, request, kind) {
  const token = cookies(request)[SESSION[kind].cookie];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db
    .prepare(
      "SELECT subject FROM sessions WHERE token_hash=? AND kind=? AND expires>?",
    )
    .bind(await sha256(token), kind, now())
    .first();
  return row ? row.subject : null;
}
export async function endSession(db, request, kind) {
  const token = cookies(request)[SESSION[kind].cookie];
  if (token && /^[0-9a-f]{64}$/.test(token))
    await db
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(await sha256(token))
      .run();
  return setCookie(request, SESSION[kind].cookie, "", 0);
}
export const endAllSessions = (db, kind, subject) =>
  db
    .prepare("DELETE FROM sessions WHERE kind=? AND subject=?")
    .bind(kind, subject)
    .run();

/** Fixed-window rate limit stored in D1. */
export async function limit(db, key, max, windowSeconds) {
  const t = now();
  const row = await db
    .prepare(
      `INSERT INTO limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
       RETURNING count`,
    )
    .bind(key, t + windowSeconds, t)
    .first();
  if (row.count > max)
    fail(429, "Příliš mnoho pokusů. Zkuste to prosím později.");
}
