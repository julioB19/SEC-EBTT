import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const ABRIR_PROCESSO_PATH = "/processos/abrir"

export async function POST(req: Request) {
  if (!backend) {
    return NextResponse.json(
      { message: "BACKEND_URL não configurada" },
      { status: 500 }
    )
  }

  const cookieStore = await cookies()
  const access = cookieStore.get("accessToken")?.value

  if (!access) {
    return NextResponse.json(
      { message: "Não autenticado" },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)

  const r = await fetch(`${backend}${ABRIR_PROCESSO_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`
    },
    body: JSON.stringify(body ?? {})
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
