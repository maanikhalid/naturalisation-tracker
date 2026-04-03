import { NextResponse } from "next/server";
import { createAdminToken, setAdminCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
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
  } catch (err) {
    console.error("Admin login failed", err);
    return NextResponse.json(
      {
        error:
          "Login could not complete. Check server logs: DATABASE_URL, database reachability, and ADMIN_JWT_SECRET must be set.",
      },
      { status: 500 }
    );
  }
}
