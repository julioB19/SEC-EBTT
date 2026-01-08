import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const backendBase = process.env.BACKEND_URL

async function getAccessToken() {
  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; evidenceFileId: string }> }
) {
  if (!backendBase) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 }
    )
  }

  const { id, evidenceFileId } = await context.params

  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 }
    )
  }

  const backendUrl = `${backendBase}/processes/${id}/evaluation/evidences/${evidenceFileId}/conteudo`

  try {
    const backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    // Se backend devolver erro, repasso o texto/JSON com o mesmo status
    if (!backendRes.ok) {
      const contentType = backendRes.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const body = await backendRes.json()
        return NextResponse.json(body, { status: backendRes.status })
      }

      const text = await backendRes.text()
      console.error(
        "Resposta de erro do backend em GET /processes/:id/evaluation/evidences/:evidenceFileId/conteudo:",
        text.slice(0, 500)
      )

      return NextResponse.json(
        {
          status: "error",
          message:
            "Erro ao obter conteúdo da evidência no backend.",
          data: null
        },
        { status: backendRes.status || 500 }
      )
    }

    // Aqui é o fluxo normal: stream do arquivo (PDF) para o navegador/iframe
    const headers = new Headers()
    const contentType = backendRes.headers.get("content-type")
    const contentDisposition = backendRes.headers.get("content-disposition")

    if (contentType) {
      headers.set("content-type", contentType)
    }
    if (contentDisposition) {
      headers.set("content-disposition", contentDisposition)
    }

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers
    })
  } catch (error) {
    console.error(
      "Erro ao obter conteúdo da evidência (rota Next API CPPD):",
      error
    )

    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao obter conteúdo da evidência.",
        data: null
      },
      { status: 500 }
    )
  }
}
