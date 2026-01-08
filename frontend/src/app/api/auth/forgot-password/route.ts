import { NextResponse } from "next/server"

const backend = process.env.BACKEND_URL || ""

export async function POST(req: Request) {
  if (!backend) {
    return NextResponse.json({ message: "BACKEND_URL não configurada" }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))

  const r = await fetch(`${backend}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body ?? {})
  })

  const json = await r.json().catch(() => null)

  return NextResponse.json(
    json ?? { message: "Resposta inválida do servidor" },
    { status: r.status }
  )
}
