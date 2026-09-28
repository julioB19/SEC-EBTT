import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyBackend(`/processes/${id}/special-commission/status`, {
    method: "PATCH",
    body: await req.text()
  })
}
