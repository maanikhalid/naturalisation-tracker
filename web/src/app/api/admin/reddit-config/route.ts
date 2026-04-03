import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redditConfigSchema } from "@/lib/validation";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.redditTrackingConfig.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json();
  const parsed = redditConfigSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Reddit tracking config." }, { status: 400 });
  }

  const created = await prisma.redditTrackingConfig.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
