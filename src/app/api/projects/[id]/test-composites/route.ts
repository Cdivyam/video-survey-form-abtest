import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { localPath } from "@/lib/storage";
import { createComposite, type CompositeSettings } from "@/lib/ffmpeg";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

const SLOT_LABELS = ["A", "B", "C", "D", "E"] as const;
const OUTPUT_DIR = path.join(process.cwd(), "public", "uploads", "test_composites");

function computeHash(vs: {
  layout: string;
  cropX: number;
  cropY: number;
  padding: number;
  keepOriginalSize: boolean;
  videos: { fileUrl: string; orderIndex: number }[];
}): string {
  const payload = {
    layout: vs.layout,
    cropX: vs.cropX,
    cropY: vs.cropY,
    padding: vs.padding,
    keepOriginalSize: vs.keepOriginalSize,
    videos: [...vs.videos]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((v) => v.fileUrl),
  };
  return crypto.createHash("md5").update(JSON.stringify(payload)).digest("hex");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sets = await prisma.videoSet.findMany({
    where: { projectId: id },
    include: { videos: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const results: {
    videoSetId: string;
    status: "generated" | "skipped" | "failed" | "empty";
    testCompositeUrl: string | null;
  }[] = [];

  for (const vs of sets) {
    if (vs.videos.length === 0) {
      results.push({ videoSetId: vs.id, status: "empty", testCompositeUrl: null });
      continue;
    }

    const currentHash = computeHash(vs);

    // Skip if hash unchanged and file still exists
    if (vs.testCompositeHash === currentHash && vs.testCompositeUrl) {
      const filePath = localPath(vs.testCompositeUrl);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        results.push({ videoSetId: vs.id, status: "skipped", testCompositeUrl: vs.testCompositeUrl });
        continue;
      }
    }

    const outputFilename = `${vs.id}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    const testCompositeUrl = `/api/files/test_composites/${outputFilename}`;

    const orderedVideos = [...vs.videos].sort((a, b) => a.orderIndex - b.orderIndex);
    const inputPaths = orderedVideos.map((v) => localPath(v.fileUrl));
    const slotLabels = orderedVideos.map((_, i) => SLOT_LABELS[i]);

    const settings: CompositeSettings = {
      layout: vs.layout === "vertical" ? "vertical" : "horizontal",
      cropX: vs.cropX,
      cropY: vs.cropY,
      padding: vs.padding,
      keepOriginalSize: vs.keepOriginalSize,
    };

    console.log(`[test-composite] generating ${vs.name} (${vs.id})`);

    try {
      await createComposite(inputPaths, slotLabels, outputPath, settings);
      await prisma.videoSet.update({
        where: { id: vs.id },
        data: { testCompositeUrl, testCompositeHash: currentHash },
      });
      results.push({ videoSetId: vs.id, status: "generated", testCompositeUrl });
      console.log(`[test-composite] done: ${vs.name}`);
    } catch (err) {
      console.error(`[test-composite] failed: ${vs.name}`, err);
      results.push({ videoSetId: vs.id, status: "failed", testCompositeUrl: vs.testCompositeUrl ?? null });
    }
  }

  return NextResponse.json({ results });
}
