import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  const filePath = path.resolve(UPLOADS_ROOT, ...parts);

  // Prevent path traversal
  if (!filePath.startsWith(UPLOADS_ROOT)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const contentType = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

  const range = req.headers.get("range");

  if (range) {
    const [, rangeStr] = range.split("=");
    const [startStr, endStr] = rangeStr.split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const webStream = Readable.toWeb(
      fs.createReadStream(filePath, { start, end })
    ) as ReadableStream;

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const webStream = Readable.toWeb(
    fs.createReadStream(filePath)
  ) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
