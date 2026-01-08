import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type RouteContext = {
  params: Promise<{
    evidenceFileId: string
  }>
}

function buildBackendUrl(evidenceFileId: string) {
  const base = process.env.BACKEND_URL || "http://localhost:3000"
  return `${base}/evidencias/${evidenceFileId}/conteudo`
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { evidenceFileId } = await context.params

    if (!evidenceFileId) {
      return new Response("Parâmetro de evidência inválido", { status: 400 })
    }

    const cookieStore: any = await cookies()

    const access =
      cookieStore.get("access_token")?.value ??
      cookieStore.get("access")?.value ??
      cookieStore.get("accessToken")?.value

    if (!access) {
      return new Response("Não autenticado", { status: 401 })
    }

    const backendUrl = buildBackendUrl(evidenceFileId)

    const r = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`
      }
    })

    if (!r.ok) {
      const text = await r.text().catch(() => "Erro ao obter arquivo de evidência")
      return new Response(text, { status: r.status })
    }

    const contentType = r.headers.get("content-type") ?? "application/pdf"
    let contentDisposition = r.headers.get("content-disposition") ?? ""

    if (contentType === "application/pdf" && contentDisposition) {
      contentDisposition = contentDisposition.replace(
        /(filename="[^"]+)\.(png|jpg|jpeg)"/i,
        '$1.pdf"'
      )
    }

    const headers: Record<string, string> = {
      "content-type": contentType
    }

    if (contentDisposition) {
      headers["content-disposition"] = contentDisposition
    }

    if (r.body) {
      return new Response(r.body, {
        status: r.status,
        headers
      })
    }

    const arrayBuffer = await r.arrayBuffer()
    return new Response(arrayBuffer, {
      status: r.status,
      headers
    })
  } catch (e) {
    console.error("Erro no proxy de visualização de evidência:", e)
    return new Response("Erro interno ao obter arquivo de evidência", {
      status: 500
    })
  }
}
