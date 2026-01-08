import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ itemId: string }> }) {
  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    const body: ApiResponse = { status: "error", message: "BACKEND_URL não configurada", data: null }
    return NextResponse.json(body, { status: 500 })
  }

  const access = (await cookies()).get("accessToken")?.value
  if (!access) {
    const body: ApiResponse = { status: "error", message: "Não autenticado", data: null }
    return NextResponse.json(body, { status: 401 })
  }

  const { itemId } = await ctx.params
  const url = `${backendUrl}/admin/tabelas-pontuacao/itens/${itemId}`
  const bodyText = await req.text()

  const backendRes = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`
    },
    body: bodyText
  })

  const contentType = backendRes.headers.get("content-type") ?? "application/json"
  const text = await backendRes.text()

  return new NextResponse(text, { status: backendRes.status, headers: { "Content-Type": contentType } })
}
