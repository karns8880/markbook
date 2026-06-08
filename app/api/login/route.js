import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  SESSION_COOKIE,
  cookieOptions,
  initDb,
  normalizeEmail,
  signSession,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    await initDb();
    const result = await sql`
      SELECT id, email, password_hash
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
    }

    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    response.cookies.set(SESSION_COOKIE, signSession(user), cookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
