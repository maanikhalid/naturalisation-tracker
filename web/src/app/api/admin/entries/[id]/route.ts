import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasBlockedWord } from "@/lib/profanity";
import { adminTimelineInputSchema, usernameSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const id = params.id;

  const json = await request.json();
  const parsed = adminTimelineInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timeline data." }, { status: 400 });
  }

  const data = parsed.data;
  const username = data.username?.trim();
  if (username) {
    if (!usernameSchema.safeParse(username).success) {
      return NextResponse.json(
        { error: "Username must be 3-30 chars using letters, numbers, - or _." },
        { status: 400 }
      );
    }
    if (hasBlockedWord(username)) {
      return NextResponse.json({ error: "Username contains blocked words." }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.timelineEntry.update({
      where: { id },
      data: {
        username: username || null,
        applicationMethod: data.applicationMethod,
        applicationDate: new Date(data.applicationDate),
        biometricDate: new Date(data.biometricDate),
        approvalDate: data.approvalDate ? new Date(data.approvalDate) : null,
        receivedHomeOfficeEmail: data.receivedHomeOfficeEmail,
        ceremonyDate: data.ceremonyDate ? new Date(data.ceremonyDate) : null,
        status: data.status,
        sourceType: data.sourceType,
        isVerified: data.isVerified,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }
    throw e;
  }
}
