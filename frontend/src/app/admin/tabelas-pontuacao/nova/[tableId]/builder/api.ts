import { ApiResponse } from "./types"

async function fetchApi<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  })

  const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null
  return { ok: res.ok, status: res.status, payload }
}


export async function obterEstruturaTabela(tableId: number) {
  const { ok, payload } = await fetchApi<any>(`/api/admin/tabelas-pontuacao/${tableId}/estrutura`, {
    method: "GET",
    cache: "no-store"
  })

  if (!payload) throw new Error("Resposta inválida do servidor (sem JSON).")
  if (!ok || payload.status === "error") {
    const details = payload.details ?? payload.data ?? null
    throw new Error(details ? `${payload.message} - ${JSON.stringify(details)}` : payload.message)
  }

  return payload.data
}


export async function criarNo(tableId: number, body: any) {
  const { ok, payload } = await fetchApi<any>(`/api/admin/tabelas-pontuacao/${tableId}/blocos`, {
    method: "POST",
    body: JSON.stringify(body)
  })

  if (!payload) throw new Error("Resposta inválida do servidor (sem JSON).")
  if (!ok || payload.status === "error") {
    const details = payload.details ?? payload.data ?? null
    throw new Error(details ? `${payload.message} - ${JSON.stringify(details)}` : payload.message)
  }

  return payload.data
}

export async function atualizarNo(nodeId: number, body: any) {
  const { ok, payload } = await fetchApi<any>(`/api/admin/tabelas-pontuacao/blocos/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  })

  if (!payload) throw new Error("Resposta inválida do servidor (sem JSON).")
  if (!ok || payload.status === "error") {
    const details = payload.details ?? payload.data ?? null
    throw new Error(details ? `${payload.message} - ${JSON.stringify(details)}` : payload.message)
  }

  return payload.data
}


export async function criarItem(nodeId: number, body: any) {
  const { ok, payload } = await fetchApi<any>(`/api/admin/tabelas-pontuacao/blocos/${nodeId}/itens`, {
    method: "POST",
    body: JSON.stringify(body)
  })

  if (!payload) throw new Error("Resposta inválida do servidor (sem JSON).")
  if (!ok || payload.status === "error") {
    const details = payload.details ?? payload.data ?? null
    throw new Error(details ? `${payload.message} - ${JSON.stringify(details)}` : payload.message)
  }

  return payload.data
}

export async function atualizarItem(itemId: number, body: any) {
  const { ok, payload } = await fetchApi<any>(`/api/admin/tabelas-pontuacao/itens/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  })

  if (!payload) throw new Error("Resposta inválida do servidor (sem JSON).")
  if (!ok || payload.status === "error") {
    const details = payload.details ?? payload.data ?? null
    throw new Error(details ? `${payload.message} - ${JSON.stringify(details)}` : payload.message)
  }

  return payload.data
}
