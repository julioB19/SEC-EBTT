import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PATH = "/evidencias/arquivos"

async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get("accessToken")?.value ?? null
}

export async function GET(_req: Request) {
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

  const r = await fetch(`${backend}${PATH}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access}`
    },
    cache: "no-store"
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
