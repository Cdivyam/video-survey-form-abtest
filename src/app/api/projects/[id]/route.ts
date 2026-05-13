import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      videoSets: { include: { videos: { orderBy: { orderIndex: "asc" } } }, orderBy: { createdAt: "desc" } },
      surveyTemplates: true,
      surveys: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { sessions: { where: { completedAt: { not: null } } } } },
          surveyVideoSets: {
            orderBy: { positionIndex: "asc" },
            select: {
              compositeStatus: true,
              positionIndex: true,
              videoSet: { select: { id: true, name: true, disabled: true } },
            },
          },
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
