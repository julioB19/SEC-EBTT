import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/special-commission`)
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/special-commission`, {
    method: "PUT",
    body: await req.text()
  })
}
