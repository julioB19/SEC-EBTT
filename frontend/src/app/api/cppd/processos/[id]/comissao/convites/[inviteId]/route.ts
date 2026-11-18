import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string; inviteId: string }> }) {
  const { id, inviteId } = await context.params
  return proxyBackend(`/processes/${id}/special-commission/invites/${inviteId}`, { method: "DELETE" })
}
