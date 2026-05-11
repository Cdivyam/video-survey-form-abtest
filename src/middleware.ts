import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

// Routes accessible without a session
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/sessions",  // respondent session create + fetch
  "/api/responses", // respondent response submission
  "/api/files",     // composite video serving for respondents
  "/s/",            // respondent survey pages
  "/fonts/",        // static font files
  "/_next/",
  "/favicon",
];

function isPublic(pathname: string): boolean {
  return pathname === "/" ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get("admin_session")?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
