import { NextRequest } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/serverAuth"

export async function GET(_req: NextRequest, context: { params: Promise<{ memberId: string }> }) {
  const token = await getAccessTokenFromCookies()
  if (!token) return new Response("Não autenticado", { status: 401 })
  const backend = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "")
  if (!backend) return new Response("BACKEND_URL não configurada", { status: 500 })
  const { memberId } = await context.params
  const response = await fetch(
    `${backend}/external-evaluator/assignments/${memberId}/evaluation/opinion.pdf`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  const body = await response.arrayBuffer()
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": response.headers.get("content-disposition") ?? "attachment; filename=parecer.pdf"
    }
  })
}
