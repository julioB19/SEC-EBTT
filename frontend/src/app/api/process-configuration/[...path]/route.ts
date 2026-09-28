import { NextRequest, NextResponse } from "next/server";
import { proxyBackend } from "@/lib/backendProxy";

type Context = { params: Promise<{ path: string[] }> };

async function backendPath(req: NextRequest, context: Context) {
  const { path } = await context.params;
  if (
    !Array.isArray(path) ||
    !path.length ||
    path.some((segment) => !/^[a-z0-9-]+$/i.test(segment))
  ) {
    return null;
  }

  const search = req.nextUrl.searchParams.toString();
  return `/management/${path.map(encodeURIComponent).join("/")}${search ? `?${search}` : ""}`;
}

async function handle(req: NextRequest, context: Context, method: string) {
  const path = await backendPath(req, context);
  if (!path) {
    return NextResponse.json(
      { status: "error", message: "Caminho inválido", data: null },
      { status: 400 },
    );
  }

  const body = method === "GET" ? undefined : await req.text();
  return proxyBackend(path, { method, body });
}

export function GET(req: NextRequest, context: Context) {
  return handle(req, context, "GET");
}

export function POST(req: NextRequest, context: Context) {
  return handle(req, context, "POST");
}

export function PATCH(req: NextRequest, context: Context) {
  return handle(req, context, "PATCH");
}
