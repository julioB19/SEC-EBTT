import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/serverAuth"

async function forward(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = await getAccessTokenFromCookies()
  if (!token) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  const { path } = await context.params
  if (!["cases", "teacher", "management"].includes(path[0])) return new NextResponse(null, { status: 404 })
  const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!backend) return NextResponse.json({ message: "Servidor não configurado" }, { status: 503 })
  if (Number(req.headers.get("content-length") || 0) > 25 * 1024 * 1024) return NextResponse.json({ message: "Arquivo excede o tamanho permitido" }, { status: 413 })
  try {
    const contentType = req.headers.get("content-type")
    const response = await fetch(`${backend.replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}`, { method: req.method, headers: { Authorization: `Bearer ${token}`, ...(contentType ? { "Content-Type": contentType } : {}) }, body: req.method === "GET" ? undefined : await req.arrayBuffer(), cache: "no-store" })
    const headers = new Headers({ "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "private, no-store" })
    const disposition = response.headers.get("content-disposition")
    if (disposition) headers.set("Content-Disposition", disposition)
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers })
  } catch { return NextResponse.json({ message: "Não foi possível comunicar com o servidor" }, { status: 502 }) }
}
export const GET = forward
export const POST = forward
