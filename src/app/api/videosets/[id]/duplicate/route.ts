import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { localPath } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const original = await prisma.videoSet.findUnique({
    where: { id },
    include: { videos: { orderBy: { orderIndex: "asc" } } },
  });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Create new VideoSet with same settings
  const newSet = await prisma.videoSet.create({
    data: {
      projectId: original.projectId,
      name: `${original.name} (copy)`,
      layout: original.layout,
      cropX: original.cropX,
      cropY: original.cropY,
      padding: original.padding,
    },
  });

  // Copy each video file and create new Video records
  const videoDir = path.join(UPLOAD_ROOT, "videos");
  await fs.mkdir(videoDir, { recursive: true });

  await Promise.all(
    original.videos.map(async (v, i) => {
      const srcPath = localPath(v.fileUrl);
      const ext = path.extname(srcPath) || ".mp4";
      const newFilename = `${newSet.id}_${Date.now()}_${i}${ext}`;
      const destPath = path.join(videoDir, newFilename);

      try {
        await fs.copyFile(srcPath, destPath);
      } catch {
        // Source file missing — create placeholder record without file
        await prisma.video.create({
          data: {
            videoSetId: newSet.id,
            modelName: v.modelName,
            fileUrl: v.fileUrl, // point to original (best-effort)
            originalFilename: v.originalFilename,
            orderIndex: i,
          },
        });
        return;
      }

      await prisma.video.create({
        data: {
          videoSetId: newSet.id,
          modelName: v.modelName,
          fileUrl: `/api/files/videos/${newFilename}`,
          originalFilename: v.originalFilename,
          orderIndex: i,
        },
      });
    })
  );

  const result = await prisma.videoSet.findUnique({
    where: { id: newSet.id },
    include: { videos: { orderBy: { orderIndex: "asc" } } },
  });

  return NextResponse.json(result, { status: 201 });
}
