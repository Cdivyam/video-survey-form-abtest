import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

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
