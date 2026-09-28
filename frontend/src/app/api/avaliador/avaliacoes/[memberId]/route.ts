import { NextRequest } from "next/server"
import { proxyBackend } from "@/lib/backendProxy"

export async function GET(_req: NextRequest, context: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await context.params
  return proxyBackend(`/external-evaluator/assignments/${memberId}/evaluation`)
}

export async function PUT(req: NextRequest, context: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await context.params
  return proxyBackend(`/external-evaluator/assignments/${memberId}/evaluation`, {
    method: "PUT",
    body: await req.text()
  })
}
