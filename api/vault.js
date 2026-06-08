const { initDb, json, readBody, requireUser } = require("./_lib");

module.exports = async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const sql = await initDb();

    if (req.method === "GET") {
      const result = await sql`
        SELECT vault_json, updated_at
        FROM vaults
        WHERE user_id = ${user.sub}
        LIMIT 1
      `;
      const vault = result.rows[0];
      return json(res, 200, {
        vault: vault ? JSON.parse(vault.vault_json) : null,
        updatedAt: vault?.updated_at || null,
      });
    }

    if (req.method === "PUT") {
      const { vault } = await readBody(req);
      if (!vault || !vault.salt || !vault.iv || !vault.data) {
        return json(res, 400, { error: "保险库数据格式不正确" });
      }
      await sql`
        INSERT INTO vaults (user_id, vault_json, updated_at)
        VALUES (${user.sub}, ${JSON.stringify(vault)}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET vault_json = EXCLUDED.vault_json, updated_at = NOW()
      `;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
