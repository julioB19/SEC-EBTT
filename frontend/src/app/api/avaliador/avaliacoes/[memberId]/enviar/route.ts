import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function POST(req: NextRequest, context: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await context.params
  return proxyBackend(`/external-evaluator/assignments/${memberId}/evaluation/submit`, {
    method: "POST",
    body: await req.text()
  })
}
