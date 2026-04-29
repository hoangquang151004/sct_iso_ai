import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const backendBase = () =>
  (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );

type RouteCtx = { params: Promise<{ path?: string[] }> };

function copyUpstreamCookies(upstream: Response, out: Headers): void {
  const raw = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = raw.getSetCookie?.() ?? [];
  for (const line of cookies) {
    out.append("set-cookie", line);
  }
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join("/") : "";
  const url = `${backendBase()}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  const init: RequestInit = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(60_000),
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) init.body = buf;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        detail: `Không kết nối được tới backend ${backendBase()}: ${msg}`,
      },
      { status: 502 },
    );
  }

  const out = new Headers();
  const ctOut = upstream.headers.get("content-type");
  if (ctOut) out.set("content-type", ctOut);
  const xRequestId = upstream.headers.get("x-request-id");
  if (xRequestId) out.set("x-request-id", xRequestId);
  copyUpstreamCookies(upstream, out);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
