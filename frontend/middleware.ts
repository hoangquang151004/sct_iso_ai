import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/api", "/images", "/assets"];

const isStaticPath = (pathname: string) =>
  STATIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * Cookie refresh thường thuộc origin API (path=/auth), không gửi kèm request tới
 * Next.js — không dùng cookie để bắt buộc đăng nhập ở đây. Việc chặn route do
 * AuthGate + /auth/me trên client.
 */
export function middleware(request: NextRequest) {
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
