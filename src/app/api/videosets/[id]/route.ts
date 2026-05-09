import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const set = await prisma.videoSet.findUnique({
    where: { id },
    include: { videos: true },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all(set.videos.map((v: { fileUrl: string }) => deleteFile(v.fileUrl)));
  await prisma.videoSet.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
