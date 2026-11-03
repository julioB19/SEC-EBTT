"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import ActionButton from "@/components/ui/ActionButton"
import FormInput from "@/components/ui/FormInput"
import { FormSelect } from "@/components/ui/FormControls"

import Link from "next/link"
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
  purpose: ScoringTablePurpose
  minRequiredPoints: string | null
  startsOn?: string | null
  endsOn?: string | null
}

type ScoringTablePurpose =
  | "PROGRESSION_PROMOTION"
  | "RSC"
  | "FULL_PROFESSOR_EVALUATION"
  | "OTHER"

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
  const [purpose, setPurpose] = useState<ScoringTablePurpose>("PROGRESSION_PROMOTION")
  const [minRequiredPoints, setMinRequiredPoints] = useState("120")
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useFeedbackState<string | null>(null, "error")
  const [infoMessage, setInfoMessage] = useFeedbackState<string | null>(null, "auto")

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
      purpose,
      minRequiredPoints: minRequiredPoints.trim() || null,
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
      <div className="max-w-3xl mx-auto space-y-6 px-4 md:px-6 lg:px-8 py-6">
        <header className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Criar Tabela de Pontuação</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              A tabela será criada como <span className="font-semibold text-[var(--text-primary)]">Rascunho</span>.
              Depois você monta os blocos no builder.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <></>

            <ActionButton
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background]
                         disabled:opacity-60 disabled:cursor-not-allowed"
             disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              {loading ? "Criando..." : "Criar"}
            </ActionButton>
          </div>
        </header>

        {(infoMessage || error) && (
          <div className="space-y-2">
            {infoMessage && (
              null
            )}
            {error && (
              null
            )}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
            <FormInput
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                         px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Tabela EBTT 2025"
              disabled={loading}
             disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Nome" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Finalidade
              </label>
              <FormSelect
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                           px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                value={purpose}
                onChange={e => {
                  const next = e.target.value as ScoringTablePurpose
                  setPurpose(next)
                  if (next === "RSC" && minRequiredPoints === "120") {
                    setMinRequiredPoints("60")
                  } else if (next === "PROGRESSION_PROMOTION" && minRequiredPoints === "60") {
                    setMinRequiredPoints("120")
                  }
                }}
                disabled={loading}
               disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Finalidade" >
                <option value="PROGRESSION_PROMOTION">Progressão e promoção</option>
                <option value="RSC">RSC</option>
                <option value="FULL_PROFESSOR_EVALUATION">Classe Titular</option>
                <option value="OTHER">Outra finalidade</option>
              </FormSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Pontuação mínima
              </label>
              <FormInput
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                           px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                value={minRequiredPoints}
                onChange={e => setMinRequiredPoints(e.target.value)}
                placeholder="Ex: 60"
                disabled={loading}
               disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Pontuação mínima" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Início de vigência (opcional)
              </label>
              <FormInput
                type="date"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                           px-3 py-2 text-sm text-[var(--text-primary)] outline-none
                           disabled:opacity-60 disabled:cursor-not-allowed"
                value={startsOn}
                onChange={e => setStartsOn(e.target.value)}
                disabled={loading}
               disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Início de vigência (opcional)" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Fim de vigência (opcional)
              </label>
              <FormInput
                type="date"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                           px-3 py-2 text-sm text-[var(--text-primary)] outline-none
                           disabled:opacity-60 disabled:cursor-not-allowed"
                value={endsOn}
                onChange={e => setEndsOn(e.target.value)}
                disabled={loading}
               disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Fim de vigência (opcional)" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <ActionButton
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background]
                         disabled:opacity-60 disabled:cursor-not-allowed"
             disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              {loading ? "Criando..." : "Criar tabela"}
            </ActionButton>
          </div>
        </section>
      </div>
    </main>
  )
}
