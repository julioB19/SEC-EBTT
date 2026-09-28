import "server-only"
import { NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "./serverAuth"

function getBackendUrl() {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!url) throw new Error("BACKEND_URL não configurada")
  return url.replace(/\/+$/, "")
}

export async function proxyBackend(path: string, init: RequestInit = {}) {
  const token = await getAccessTokenFromCookies()
  if (!token) {
    return NextResponse.json({ status: "error", message: "Não autenticado", data: null }, { status: 401 })
  }

  try {
    const response = await fetch(`${getBackendUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      },
      cache: "no-store"
    })
    const body = await response.json().catch(() => ({
      status: "error",
      message: "Resposta inesperada do backend",
      data: null
    }))
    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error("Backend proxy request failed:", error)
    return NextResponse.json({ status: "error", message: "Erro interno", data: null }, { status: 500 })
  }
}
