import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const backendBase = process.env.BACKEND_URL

async function getAccessToken() {
  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!backendBase) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 }
    )
  }

  const { id } = await context.params

  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 }
    )
  }

  try {
    const backendRes = await fetch(
      // ⚠️ Ajusta esse path para bater EXATAMENTE com a rota que tu criou no backend
      `${backendBase}/processes/${id}/evaluation/view`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      }
    )

    const contentType = backendRes.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      const body = await backendRes.json()
      return NextResponse.json(body, { status: backendRes.status })
    }

    const text = await backendRes.text()
    console.error(
      "Resposta NÃO-JSON do backend em GET /processes/:id/evaluation/view:",
      text.slice(0, 500)
    )

    return NextResponse.json(
      {
        status: "error",
        message: "Resposta inesperada do backend ao buscar visualização da avaliação.",
        data: null
      },
      { status: backendRes.status || 500 }
    )
  } catch (error) {
    console.error("Erro ao buscar visualização da avaliação:", error)
    return NextResponse.json(
      { status: "error", message: "Erro ao buscar visualização da avaliação.", data: null },
      { status: 500 }
    )
  }
}
