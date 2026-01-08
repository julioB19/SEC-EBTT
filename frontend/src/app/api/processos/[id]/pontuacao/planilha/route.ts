import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_URL || ""

async function proxyPlanilha(id: string) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { message: "BACKEND_URL não configurada" },
      { status: 500 }
    )
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get("accessToken")?.value

  if (!accessToken) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  const backendResponse = await fetch(
    `${BACKEND_URL}/processos/${id}/pontuacao/planilha`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  )

  if (!backendResponse.ok) {
    const text = await backendResponse.text().catch(() => "")
    let json: any = null

    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { message: text || "Erro ao gerar planilha de pontuação" }
    }

    return NextResponse.json(json, { status: backendResponse.status })
  }

  const arrayBuffer = await backendResponse.arrayBuffer()

  const headers = new Headers()
  headers.set(
    "Content-Type",
    backendResponse.headers.get("Content-Type") ?? "application/pdf"
  )

  const contentDisposition =
    backendResponse.headers.get("Content-Disposition") ||
    backendResponse.headers.get("content-disposition")

  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition)
  } else {
    headers.set(
      "Content-Disposition",
      `attachment; filename="pontuacao-processo-${id}.pdf"`
    )
  }

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers
  })
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params
  return proxyPlanilha(id)
}

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params
  return proxyPlanilha(id)
}
