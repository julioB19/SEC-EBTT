import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PATH = "/processos/requerimento"

async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get("accessToken")?.value ?? null
}

function buildBackendUrl(id: string) {
  return `${backend}${PATH}/${id}`
}

export async function POST(
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
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`
    }
  })

  if (!r.ok) {
    const text = await r.text().catch(() => "")
    let json: any = null

    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { message: text || "Erro ao gerar requerimento" }
    }

    return NextResponse.json(json, { status: r.status })
  }

  const arrayBuffer = await r.arrayBuffer()

  const headers = new Headers()
  headers.set(
    "Content-Type",
    r.headers.get("Content-Type") ?? "application/pdf"
  )

  const contentDisposition =
    r.headers.get("Content-Disposition") ||
    r.headers.get("content-disposition")

  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition)
  } else {
    headers.set(
      "Content-Disposition",
      `attachment; filename="requerimento.pdf"`
    )
  }

  return new NextResponse(arrayBuffer, {
    status: r.status,
    headers
  })
}
