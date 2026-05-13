import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile, localPath } from "@/lib/storage";
import { probeVideoDimensions } from "@/lib/ffmpeg";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const set = await prisma.videoSet.findUnique({
    where: { id },
    include: { videos: { orderBy: { orderIndex: "asc" } } },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build validated update object
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    data.name = name;
  }

  if (body.layout !== undefined) {
    if (body.layout !== "horizontal" && body.layout !== "vertical") {
      return NextResponse.json({ error: "layout must be 'horizontal' or 'vertical'" }, { status: 400 });
    }
    data.layout = body.layout;
  }

  if (body.padding !== undefined) {
    const padding = parseInt(String(body.padding), 10);
    if (isNaN(padding) || padding < 0) {
      return NextResponse.json({ error: "padding must be a non-negative integer" }, { status: 400 });
    }
    data.padding = padding;
  }

  if (body.keepOriginalSize !== undefined) {
    data.keepOriginalSize = Boolean(body.keepOriginalSize);
  }

  if (body.disabled !== undefined) {
    data.disabled = Boolean(body.disabled);
  }

  // Crop validation — must be non-negative and not exceed video dimensions
  const newCropX = body.cropX !== undefined ? parseInt(String(body.cropX), 10) : undefined;
  const newCropY = body.cropY !== undefined ? parseInt(String(body.cropY), 10) : undefined;

  if (newCropX !== undefined) {
    if (isNaN(newCropX) || newCropX < 0) {
      return NextResponse.json({ error: "cropX must be a non-negative integer" }, { status: 400 });
    }
  }
  if (newCropY !== undefined) {
    if (isNaN(newCropY) || newCropY < 0) {
      return NextResponse.json({ error: "cropY must be a non-negative integer" }, { status: 400 });
    }
  }

  // Probe video dimensions to validate crop doesn't exceed any video
  if ((newCropX !== undefined || newCropY !== undefined) && set.videos.length > 0) {
    const dims = await Promise.all(
      set.videos.map((v) => probeVideoDimensions(localPath(v.fileUrl)))
    );

    for (let i = 0; i < set.videos.length; i++) {
      const d = dims[i];
      if (!d) continue;
      if (newCropX !== undefined && newCropX >= d.width) {
        return NextResponse.json(
          { error: `cropX (${newCropX}) must be less than video width (${d.width}) for "${set.videos[i].modelName}"` },
          { status: 400 }
        );
      }
      if (newCropY !== undefined && newCropY >= d.height) {
        return NextResponse.json(
          { error: `cropY (${newCropY}) must be less than video height (${d.height}) for "${set.videos[i].modelName}"` },
          { status: 400 }
        );
      }
    }
  }

  if (newCropX !== undefined) data.cropX = newCropX;
  if (newCropY !== undefined) data.cropY = newCropY;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.videoSet.update({ where: { id }, data });
  return NextResponse.json(updated);
}

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
  await prisma.videoSet.deleteMany({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
