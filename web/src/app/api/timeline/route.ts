import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasBlockedWord } from "@/lib/profanity";
import { timelineInputSchema, usernameSchema } from "@/lib/validation";

export async function GET() {
  const rows = await prisma.timelineEntry.findMany({
    where: { isRemoved: false },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const json = await request.json();
  const input = timelineInputSchema.safeParse(json);

  if (!input.success) {
    return NextResponse.json(
      { error: "Invalid submission data." },
      { status: 400 }
    );
  }

  const data = input.data;
  const username = data.username?.trim();

  if (username) {
    if (!usernameSchema.safeParse(username).success) {
      return NextResponse.json(
        { error: "Username must be 3-30 chars using letters, numbers, - or _." },
        { status: 400 }
      );
    }
    if (hasBlockedWord(username)) {
      return NextResponse.json(
        { error: "Username contains blocked words." },
        { status: 400 }
      );
    }

    const existing = await prisma.timelineEntry.findFirst({
      where: {
        username,
        applicationDate: new Date(data.applicationDate),
        isRemoved: false,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Duplicate entry found for username and application date." },
        { status: 409 }
      );
    }
  }

  const created = await prisma.timelineEntry.create({
    data: {
      username: username || null,
      applicationMethod: data.applicationMethod,
      applicationDate: new Date(data.applicationDate),
      biometricDate: new Date(data.biometricDate),
      approvalDate: data.approvalDate ? new Date(data.approvalDate) : null,
      receivedHomeOfficeEmail: data.receivedHomeOfficeEmail,
      ceremonyDate: data.ceremonyDate ? new Date(data.ceremonyDate) : null,
      status: data.status,
      sourceType: "WEBSITE",
      isVerified: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
