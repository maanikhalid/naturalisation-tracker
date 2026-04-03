import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const params = await context.params;
  const id = params.id;

  await prisma.timelineEntry.update({
    where: { id },
    data: {
      isRemoved: true,
      removedReason: String(body?.reason ?? "Removed by admin"),
    },
  });

  return NextResponse.json({ ok: true });
}
