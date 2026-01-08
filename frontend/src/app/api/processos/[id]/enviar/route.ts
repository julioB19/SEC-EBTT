import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_URL || ""

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  if (!BACKEND_URL) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Variável de ambiente BACKEND_URL não configurada no servidor.",
        data: null
      },
      { status: 500 }
    )
  }

  try {
    const cookieStore = await cookies()
    const accessToken = (await cookieStore).get("accessToken")?.value

    const headers: HeadersInit = {
      Accept: "application/json"
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/processos/${id}/enviar`,
      {
        method: "POST",
        headers
      }
    )

    const rawText = await backendRes.text()
    let payload: any = null

    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = null
    }

    if (!backendRes.ok) {
      return NextResponse.json(
        {
          status: payload?.status ?? "error",
          message:
            payload?.message ??
            `Falha ao enviar processo para avaliação (status ${backendRes.status}).`,
          data: payload?.data ?? null
        },
        { status: backendRes.status }
      )
    }

    return NextResponse.json(
      {
        status: payload?.status ?? "success",
        message:
          payload?.message ??
          "Processo enviado para avaliação com sucesso.",
        data: payload?.data ?? null
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Erro ao chamar backend /processos/:id/enviar:", error)

    return NextResponse.json(
      {
        status: "error",
        message:
          "Não foi possível conectar ao servidor de backend. Verifique se o backend está em execução e acessível.",
        data: null
      },
      { status: 502 }
    )
  }
}
