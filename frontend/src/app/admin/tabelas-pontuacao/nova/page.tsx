"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

type CreateTablePayload = {
  name: string
  startsOn?: string | null
  endsOn?: string | null
}

type CreatedTable = {
  idScoringTable: number
  name: string
  status: "DRAFT" | "ACTIVE"
  startsOn: string | null
  endsOn: string | null
}

function toIsoOrNull(value: string) {
  const v = String(value ?? "").trim()
  if (!v) return null
  const date = new Date(`${v}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export default function NovaTabelaPontuacaoPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

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

  async function handleCreate() {
    const trimmed = String(name ?? "").trim()

    if (!trimmed) {
      setError("Informe o nome da tabela.")
      return
    }

    const payloadToSend: CreateTablePayload = {
      name: trimmed,
      startsOn: toIsoOrNull(startsOn),
      endsOn: toIsoOrNull(endsOn)
    }

    setLoading(true)
    setError(null)
    setInfoMessage(null)

    try {
      const { ok, payload } = await fetchApi<CreatedTable>("/api/admin/tabelas-pontuacao", {
        method: "POST",
        body: JSON.stringify(payloadToSend)
      })

      if (!payload) {
        if (!ok) setError("Falha ao criar tabela de pontuação.")
        return
      }

      if (!ok || payload.status === "error") {
        setError(payload.message ?? "Falha ao criar tabela de pontuação.")
        return
      }

      const created = payload.data
      if (!created?.idScoringTable) {
        setError("Resposta inválida do servidor ao criar a tabela.")
        return
      }

      setInfoMessage("Tabela criada com sucesso. Redirecionando...")

      router.push(`/admin/tabelas-pontuacao/nova/${created.idScoringTable}/builder`)
    } catch (err) {
      console.error("Erro ao criar tabela:", err)
      setError("Erro inesperado ao criar tabela.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Criar Tabela de Pontuação</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              A tabela será criada como <span className="font-semibold text-[var(--text-primary)]">DRAFT</span>. Depois você monta os blocos no builder.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                         text-xs text-[var(--btn-secondary-text)]
                         hover:bg-[var(--btn-secondary-hover-bg)] transition
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Voltar
            </button>
          </div>
        </header>

        {(infoMessage || error) && (
          <div className="space-y-1">
            {infoMessage && <p className="text-xs text-[var(--state-success-text)]">{infoMessage}</p>}
            {error && <p className="text-xs text-[var(--state-danger-text)]">{error}</p>}
          </div>
        )}

        <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm space-y-4 max-w-2xl">
          <div className="space-y-1">
            <label className="text-[11px] text-[var(--text-secondary)]">Nome</label>
            <input
              className="w-full text-sm rounded-xl border border-[var(--border-subtle)]
                         bg-[var(--surface-bg)] px-3 py-2
                         text-[var(--text-primary)]
                         focus:outline-none focus:border-[var(--border-strong)]"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Tabela EBTT 2025"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-secondary)]">Início de vigência (opcional)</label>
              <input
                type="date"
                className="w-full text-sm rounded-xl border border-[var(--border-subtle)]
                           bg-[var(--surface-bg)] px-3 py-2
                           text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--border-strong)]"
                value={startsOn}
                onChange={e => setStartsOn(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-secondary)]">Fim de vigência (opcional)</label>
              <input
                type="date"
                className="w-full text-sm rounded-xl border border-[var(--border-subtle)]
                           bg-[var(--surface-bg)] px-3 py-2
                           text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--border-strong)]"
                value={endsOn}
                onChange={e => setEndsOn(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="inline-flex items-center rounded-full px-6 py-2 text-xs font-semibold
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)]
                         disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "Criando..." : "Criar tabela"}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
