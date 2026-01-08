import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PROCESSOS_PATH = "/processos"

export async function GET(req: Request) {
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

  const url = new URL(req.url)
  const status = url.searchParams.get("status")

  const backendUrl = new URL(backend + PROCESSOS_PATH)
  if (status) backendUrl.searchParams.set("status", status)

  const r = await fetch(backendUrl.toString(), {
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
