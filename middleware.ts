import { NextRequest, NextResponse } from "next/server";

// Protect /dashboard — redirect to /login if no session cookie present.
// Firebase Auth is client-side, so we use the `zelo_session` cookie which
// we set server-side via the /api/auth/session route after ID-token verification.
// While that isn't wired yet we fall back to the `zelo_connected` cookie so the
// existing flow keeps working.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const hasSession = request.cookies.has("zelo_session") || request.cookies.has("zelo_connected");
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
