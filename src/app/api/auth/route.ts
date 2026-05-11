import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import fs from "fs";
import path from "path";

function readAdminPassword(): string | null {
  const filePath = path.join(process.cwd(), "data", "admin.password");
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    console.error("[auth] data/admin.password not found — access denied");
    return null;
  }
}

const COOKIE = "admin_session";
const COOKIE_MAX_AGE = 12 * 60 * 60; // 12 hours in seconds

export async function POST(req: Request) {
  const { password } = await req.json();
  const stored = readAdminPassword();

  if (!stored || password !== stored) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
