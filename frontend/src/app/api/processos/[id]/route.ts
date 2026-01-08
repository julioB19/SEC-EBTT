import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PROCESSOS_PATH = "/processos"

async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get("accessToken")?.value ?? null
}

function buildBackendUrl(id: string) {
  return `${backend}${PROCESSOS_PATH}/${id}`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params

  const r = await fetch(buildBackendUrl(id), {
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params
  const body = await req.json().catch(() => null)

  const r = await fetch(buildBackendUrl(id), {
    method: "PATCH",
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params

  const r = await fetch(buildBackendUrl(id), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${access}`
    }
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
