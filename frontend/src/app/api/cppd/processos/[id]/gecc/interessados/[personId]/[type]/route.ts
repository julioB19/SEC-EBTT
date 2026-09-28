import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; personId: string; type: string }> }
) {
  const { id, personId, type } = await context.params
  return proxyBackend(`/processes/${id}/gecc/interested/${personId}/${type}`, { method: "DELETE" })
}
