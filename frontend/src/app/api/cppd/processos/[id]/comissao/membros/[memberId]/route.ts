import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await context.params
  return proxyBackend(`/processes/${id}/special-commission/members/${memberId}`, { method: "DELETE" })
}
