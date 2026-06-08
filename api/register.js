const crypto = require("crypto");
const {
  hashPassword,
  initDb,
  json,
  normalizeEmail,
  readBody,
  sessionCookie,
  signSession,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const { email, password } = await readBody(req);
    const normalizedEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return json(res, 400, { error: "邮箱格式不正确" });
    }
    if (String(password || "").length < 8) {
      return json(res, 400, { error: "密码至少 8 位" });
    }

    const sql = await initDb();
    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
    };

    await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${user.id}, ${user.email}, ${user.passwordHash})
    `;

    const token = signSession(user);
    return json(
      res,
      201,
      { user: { id: user.id, email: user.email } },
      { "set-cookie": sessionCookie(req, token) },
    );
  } catch (error) {
    if (String(error.message).includes("duplicate key")) {
      return json(res, 409, { error: "邮箱已注册" });
    }
    return json(res, 500, { error: error.message });
  }
};
