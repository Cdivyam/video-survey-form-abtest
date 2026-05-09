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
  return `/uploads/${subdir}/${filename}`;
}

export async function deleteFile(url: string): Promise<void> {
  const relative = url.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", relative);
  await fs.unlink(full).catch(() => {});
}

export function localPath(url: string): string {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}
