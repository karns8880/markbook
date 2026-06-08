const crypto = require("crypto");

const SESSION_COOKIE = "markbook_session";
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 310000;

async function getSql() {
  const mod = await import("@vercel/postgres");
  return mod.sql;
}

async function initDb() {
  const sql = await getSql();
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
  return sql;
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, 32, "sha256")
    .toString("base64url");
  return `${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
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

function signSession(user) {
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

function verifySession(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!session.exp || session.exp < Date.now()) return null;
  return session;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function sessionCookie(req, token) {
  const isLocalhost = String(req.headers.host || "").startsWith("localhost");
  const secure = isLocalhost ? "" : " Secure;";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${
    SESSION_DAYS * 24 * 60 * 60
  }`;
}

function clearSessionCookie(req) {
  const isLocalhost = String(req.headers.host || "").startsWith("localhost");
  const secure = isLocalhost ? "" : " Secure;";
  return `${SESSION_COOKIE}=; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=0`;
}

async function requireUser(req, res) {
  const session = verifySession(parseCookies(req)[SESSION_COOKIE]);
  if (!session) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  return session;
}

module.exports = {
  clearSessionCookie,
  hashPassword,
  initDb,
  json,
  normalizeEmail,
  readBody,
  requireUser,
  sessionCookie,
  signSession,
  verifyPassword,
};
