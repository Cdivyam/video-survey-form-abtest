import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const set = await prisma.videoSet.findUnique({
    where: { id },
    include: { videos: true },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (set.videos.length >= 5) {
    return NextResponse.json({ error: "Max 5 videos per set" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const modelName = formData.get("modelName") as string | null;

  if (!file || !modelName?.trim()) {
    return NextResponse.json({ error: "file and modelName are required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "mp4";
  const filename = `${id}_${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await saveFile(buffer, "videos", filename);

  const video = await prisma.video.create({
    data: {
      videoSetId: id,
      modelName: modelName.trim(),
      fileUrl,
      originalFilename: file.name,
      orderIndex: set.videos.length,
    },
  });

  return NextResponse.json(video, { status: 201 });
}
