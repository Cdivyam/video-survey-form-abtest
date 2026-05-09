import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { modelName } = await req.json();
  if (!modelName?.trim()) {
    return NextResponse.json({ error: "modelName is required" }, { status: 400 });
  }
  const video = await prisma.video.update({
    where: { id },
    data: { modelName: modelName.trim() },
  });
  return NextResponse.json(video);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteFile(video.fileUrl);
  await prisma.video.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
