import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sets = await prisma.videoSet.findMany({
    where: { projectId: id },
    include: { videos: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sets);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const set = await prisma.videoSet.create({
    data: { projectId: id, name: name.trim() },
    include: { videos: true },
  });
  return NextResponse.json(set, { status: 201 });
}
