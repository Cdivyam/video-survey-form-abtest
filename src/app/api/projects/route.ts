import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { videoSets: true, surveys: true } },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const project = await prisma.project.create({ data: { name: name.trim() } });
  return NextResponse.json(project, { status: 201 });
}
