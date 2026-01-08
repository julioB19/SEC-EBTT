import { NextResponse } from "next/server"

const backend = process.env.BACKEND_URL!
const BACKEND_REGISTER_PATH = "/register/docente" 

function normalizeCpf(cpf: string) {
  return (cpf ?? "").replace(/\D/g, "")
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.cpf) {
      body.cpf = normalizeCpf(body.cpf)
    }

    const r = await fetch(`${backend}${BACKEND_REGISTER_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    const json = await r.json().catch(() => ({}))
    return NextResponse.json(json, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { 
        message: "Erro ao conectar com o servidor", 
        error: e?.message ?? "unknown" 
      },
      { status: 502 }
    )
  }
}
