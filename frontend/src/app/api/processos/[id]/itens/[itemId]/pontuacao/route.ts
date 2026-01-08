import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PATH = "/processos"

async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get("accessToken")?.value ?? null
}

function buildBackendUrl(id: string, itemId: string) {
  return `${backend}${PATH}/${id}/itens/${itemId}/pontuacao`
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!backend) {
    return NextResponse.json(
      { message: "BACKEND_URL não configurada" },
      { status: 500 }
    )
  }

  const access = await getAccessToken()
  if (!access) {
    return NextResponse.json(
      { message: "Não autenticado" },
      { status: 401 }
    )
  }

  const { id, itemId } = await params
  const body = await req.text()

  const r = await fetch(buildBackendUrl(id, itemId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json"
    },
    body
  })

  const text = await r.text().catch(() => "")
  let json: any = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  return NextResponse.json(json, { status: r.status })
}
