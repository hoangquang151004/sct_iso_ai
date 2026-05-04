import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/api", "/images", "/assets"];

const isStaticPath = (pathname: string) =>
  STATIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * Next.js 16+ Proxy convention (replacing Middleware)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
