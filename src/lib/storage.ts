import fs from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveFile(
  buffer: Buffer,
  subdir: string,
  filename: string
): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  // Serve through the API route so headers/range requests are handled
  // correctly regardless of Next.js static file caching behaviour
  return `/api/files/${subdir}/${filename}`;
}

export async function deleteFile(url: string): Promise<void> {
  const full = urlToLocalPath(url);
  await fs.unlink(full).catch(() => {});
}

// Converts a stored URL back to an absolute filesystem path.
// Handles both the current /api/files/ scheme and legacy /uploads/ URLs.
export function localPath(url: string): string {
  return urlToLocalPath(url);
}

function urlToLocalPath(url: string): string {
  if (url.startsWith("/api/files/")) {
    return path.join(UPLOAD_ROOT, url.slice("/api/files/".length));
  }
  // Legacy URLs stored as /uploads/...
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}
