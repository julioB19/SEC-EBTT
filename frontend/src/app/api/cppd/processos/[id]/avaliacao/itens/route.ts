import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const backendBase = process.env.BACKEND_URL

async function getAccessToken() {
  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function PATCH(
  req: NextRequest,
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

  const body = await req.json()

  try {
    const backendRes = await fetch(
      // 🔗 Alinhado com o backend: PATCH /processes/:id/evaluation/items
      `${backendBase}/processes/${id}/evaluation/items`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    )

    const contentType = backendRes.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      const backendBody = await backendRes.json()
      return NextResponse.json(backendBody, { status: backendRes.status })
    }

    const text = await backendRes.text()
    console.error(
      "Resposta NÃO-JSON do backend em PATCH /processes/:id/evaluation/items:",
      text.slice(0, 500)
    )

    return NextResponse.json(
      {
        status: "error",
        message:
          "Resposta inesperada do backend ao atualizar pontuação de item da CPPD.",
        data: null
      },
      { status: backendRes.status || 500 }
    )
  } catch (error) {
    console.error("Erro ao atualizar pontuação de item CPPD:", error)

    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao atualizar pontuação de item CPPD.",
        data: null
      },
      { status: 500 }
    )
  }
}
