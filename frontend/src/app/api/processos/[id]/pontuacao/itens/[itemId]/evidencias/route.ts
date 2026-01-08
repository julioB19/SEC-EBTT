import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type RouteContext = {
  params: Promise<{
    id: string
    itemId: string
  }>
}

function buildBackendUrl(id: string, itemId: string) {
  const base = process.env.BACKEND_URL || "http://localhost:3000"
  return `${base}/processos/${id}/pontuacao/itens/${itemId}/evidencias`
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id, itemId } = await context.params

    const cookieStore: any = await cookies()

    const access =
      cookieStore.get("access_token")?.value ??
      cookieStore.get("access")?.value ??
      cookieStore.get("accessToken")?.value

    if (!access) {
      return NextResponse.json(
        {
          status: "ERROR",
          message: "Não autenticado",
          data: null
        },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const url = buildBackendUrl(id, itemId)

    const fetchFn: any = fetch

    const r = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`
      },
      body: formData,
      duplex: "half"
    })

    const json = await r.json().catch(() => null)

    return NextResponse.json(json, { status: r.status })
  } catch (e: any) {
    console.error("Erro no proxy de upload de evidência:", e)
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Erro interno ao enviar evidência",
        data: null
      },
      { status: 500 }
    )
  }
}
