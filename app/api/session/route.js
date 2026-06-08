import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user: { id: session.sub, email: session.email } });
}
