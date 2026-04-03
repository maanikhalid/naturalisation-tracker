import { NextResponse } from "next/server";
import { createAdminToken, setAdminCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createAdminToken(user.username);
  await setAdminCookie(token);
  return NextResponse.json({ ok: true });
}
