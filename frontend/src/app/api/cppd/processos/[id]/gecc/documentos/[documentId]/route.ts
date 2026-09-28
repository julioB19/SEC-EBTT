import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> }
) {
  const { id, documentId } = await context.params
  return proxyBackend(`/processes/${id}/gecc/documents/${documentId}`, { method: "DELETE" })
}
