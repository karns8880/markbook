import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDb, requireSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = requireSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await initDb();
    const result = await sql`
      SELECT vault_json, updated_at
      FROM vaults
      WHERE user_id = ${session.sub}
      LIMIT 1
    `;
    const vault = result.rows[0];
    return NextResponse.json({
      vault: vault ? JSON.parse(vault.vault_json) : null,
      updatedAt: vault?.updated_at || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = requireSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { vault } = await request.json();
    if (!vault || !vault.salt || !vault.iv || !vault.data) {
      return NextResponse.json({ error: "保险库数据格式不正确" }, { status: 400 });
    }

    await initDb();
    await sql`
      INSERT INTO vaults (user_id, vault_json, updated_at)
      VALUES (${session.sub}, ${JSON.stringify(vault)}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET vault_json = EXCLUDED.vault_json, updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
