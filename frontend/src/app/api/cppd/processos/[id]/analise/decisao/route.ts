import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return proxyBackend(`/cppd/processos/${id}/analise-documental/decisao`, {
    method: "POST",
    body: await req.text(),
  })
}
