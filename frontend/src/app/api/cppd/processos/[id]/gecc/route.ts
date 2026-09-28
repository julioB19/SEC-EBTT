import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/gecc`)
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/gecc`, { method: "PUT", body: await req.text() })
}
