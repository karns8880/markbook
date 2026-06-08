import crypto from "node:crypto";
import { sql } from "@vercel/postgres";

export const SESSION_COOKIE = "markbook_session";
export const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 310000;

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS vaults (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      vault_json TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, 32, "sha256")
    .toString("base64url");
  return `${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [iterations, salt, expected] = String(stored).split("$");
  const actual = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256")
    .toString("base64url");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }
  return secret;
}

export function signSession(user) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", authSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!session.exp || session.exp < Date.now()) return null;
  return session;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function requireSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}
