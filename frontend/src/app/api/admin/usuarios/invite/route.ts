import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function backendUrlOrError() {
  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    const body: ApiResponse = { status: "error", message: "BACKEND_URL não configurada", data: null }
    return { ok: false as const, res: NextResponse.json(body, { status: 500 }) }
  }
  return { ok: true as const, backendUrl: backendUrl.replace(/\/+$/g, "") }
}

async function accessTokenOrError() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) {
    const body: ApiResponse = { status: "error", message: "Não autenticado", data: null }
    return { ok: false as const, res: NextResponse.json(body, { status: 401 }) }
  }
  return { ok: true as const, access }
}

function normalizeCpf(value: any) {
  return String(value ?? "").replace(/\D/g, "")
}

export async function POST(req: NextRequest) {
  const backend = backendUrlOrError()
  if (!backend.ok) return backend.res

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const rawBodyText = await req.text()

  let parsed: any = null
  try {
    parsed = rawBodyText ? JSON.parse(rawBodyText) : null
  } catch {
    parsed = null
  }

  if (parsed && typeof parsed === "object" && "cpf" in parsed) {
    parsed.cpf = normalizeCpf(parsed.cpf)
  }

  const forwardBody = parsed ? JSON.stringify(parsed) : rawBodyText

  const backendRes = await fetch(`${backend.backendUrl}/invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.access}`,
      "Content-Type": "application/json"
    },
    body: forwardBody
  })

  const text = await backendRes.text()

  let out: ApiResponse<any>
  try {
    const maybeJson = text ? JSON.parse(text) : null
    if (maybeJson && typeof maybeJson === "object" && "status" in maybeJson && "message" in maybeJson) {
      out = maybeJson
    } else {
      out = {
        status: backendRes.ok ? "success" : "error",
        message: backendRes.ok ? "Link para redefinição de senha enviado por e-mail" : "Falha ao enviar link para redefinição de senha",
        data: maybeJson ?? null,
        details: text || null
      }
    }
  } catch {
    out = {
      status: backendRes.ok ? "success" : "error",
      message: backendRes.ok ? "Link para redefinição de senha enviado por e-mail" : "Falha ao enviar link para redefinição de senha",
      data: null,
      details: text || null
    }
  }

  return NextResponse.json(out, { status: backendRes.status })
}
