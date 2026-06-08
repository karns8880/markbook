const {
  initDb,
  json,
  normalizeEmail,
  readBody,
  sessionCookie,
  signSession,
  verifyPassword,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const { email, password } = await readBody(req);
    const normalizedEmail = normalizeEmail(email);
    const sql = await initDb();
    const result = await sql`
      SELECT id, email, password_hash
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return json(res, 401, { error: "邮箱或密码不正确" });
    }

    const token = signSession(user);
    return json(
      res,
      200,
      { user: { id: user.id, email: user.email } },
      { "set-cookie": sessionCookie(req, token) },
    );
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
