import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PROCESS_TYPES_PATH = "/processos/tipos"

export async function GET() {
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

  const r = await fetch(`${backend}${PROCESS_TYPES_PATH}`, {
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
