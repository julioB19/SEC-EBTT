import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/full-professor-procedure`)
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/full-professor-procedure/actions`, { method: "POST", body: await req.text() })
}
