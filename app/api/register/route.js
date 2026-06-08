import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  SESSION_COOKIE,
  cookieOptions,
  hashPassword,
  initDb,
  normalizeEmail,
  signSession,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }
    if (String(password || "").length < 8) {
      return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
    }

    await initDb();
    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
    };

    await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${user.id}, ${user.email}, ${user.passwordHash})
    `;

    const response = NextResponse.json(
      { user: { id: user.id, email: user.email } },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE, signSession(user), cookieOptions());
    return response;
  } catch (error) {
    if (String(error.message).includes("duplicate key")) {
      return NextResponse.json({ error: "邮箱已注册" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
