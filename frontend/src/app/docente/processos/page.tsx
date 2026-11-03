"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import { formatProcessTypeLabel } from "@/utils/processTypeLabels"

import { useEffect, useState } from "react"
import Link from "next/link"
import { primaryButtonClass } from "@/components/ui/systemStyles"

type ProcessStatus =
  | "DRAFT"
  | "DOCUMENTATION_PENDING"
  | "SUBMITTED"
  | "AWAITING_EVALUATOR_ACCEPTANCE"
  | "AWAITING_ORDINANCE"
  | "UNDER_REVIEW"
  | "IN_EVALUATION"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"
  | "FINALIZED"

type Processo = {
  processId: number
  type: "PROGRESSAO" | "PROMOCAO" | null
  processTypeCode: string
  processTypeName: string
  processTypeCategory: string | null
  status: ProcessStatus
  scoringTableId: number | null
  createdAt: string
  userId: number
  campus: string
  cidadeUF: string
  intersticeStart: string | null
  intersticeEnd: string | null
  classeOrigem: string | null
  nivelOrigem: string | null
  classeDestino: string | null
  nivelDestino: string | null
  rscDetails: { targetLevel: string | null } | null
}

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}


function normalizeYMD(value: string | null | undefined) {
  if (!value) return ""

  const s = value.toString()
  const base = s.length >= 10 ? s.slice(0, 10) : s

  const [year, month, day] = base.split("-")
  if (!year || !month || !day) return ""

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0"
  )}`
}

function formatDate(value: string | null | undefined) {
  const ymd = normalizeYMD(value)
  if (!ymd) return ""
  const [year, month, day] = ymd.split("-")
  return `${day}/${month}/${year}`
}


function badgeColor(status: ProcessStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800"
  if (status === "REJECTED") return "bg-red-100 text-red-800"
  if (status === "RETURNED") return "bg-amber-100 text-amber-800"
  if (status === "DOCUMENTATION_PENDING") return "bg-amber-100 text-amber-800"
  if (status === "UNDER_REVIEW" || status === "IN_EVALUATION") return "bg-blue-100 text-blue-800"
  if (status !== "DRAFT") return "bg-slate-100 text-slate-800"
  return "bg-gray-100 text-gray-700"
}

function statusLabel(status: ProcessStatus) {
  switch (status) {
    case "DRAFT":
      return "Rascunho"
    case "DOCUMENTATION_PENDING":
      return "Documentação pendente"
    case "SUBMITTED":
      return "Submetido"
    case "AWAITING_EVALUATOR_ACCEPTANCE":
      return "Aguardando aceite"
    case "AWAITING_ORDINANCE":
      return "Aguardando portaria"
    case "UNDER_REVIEW":
      return "Em análise"
    case "IN_EVALUATION":
      return "Em avaliação"
    case "RETURNED":
      return "Devolvido"
    case "APPROVED":
      return "Aprovado"
    case "REJECTED":
      return "Indeferido"
    case "FINALIZED":
      return "Finalizado"
    default:
      return status
  }
}

function processTypeLabel(process: Processo) {
  return formatProcessTypeLabel(process.processTypeCode, process.processTypeName)
}


export default function MeusProcessosPage() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useFeedbackState<string | null>(null, "error")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const r = await fetch("/api/processos", {
          method: "GET",
          credentials: "include"
        })

        const json = (await r.json().catch(() => null)) as ApiResponse<Processo[]>

        if (!r.ok) {
          setError(json?.message || "Erro ao carregar processos")
          setProcessos([])
          return
        }

        setProcessos(json?.data ?? [])
      } catch (e: any) {
        setError(e?.message || "Erro inesperado ao carregar processos")
        setProcessos([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Meus Processos
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Acompanhe aqui todas as suas solicitações de carreira.
            </p>
          </div>
          <Link
            href="/docente/processos/abrir"
            className={`${primaryButtonClass} shrink-0`}
          >
            Abrir novo processo
          </Link>
        </header>

        {loading && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando processos...
            </p>
          </div>
        )}

        {!loading && error && (
          null
        )}

        {!loading && !error && processos.length === 0 && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm text-sm text-[var(--text-secondary)]">
            <p>Você ainda não tem processos cadastrados.</p>
            <div className="mt-4">
              <Link
                href="/docente/processos/abrir"
                className="inline-flex items-center justify-center rounded-full
                           bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium
                           text-[var(--btn-primary-text)]
                           hover:bg-[var(--btn-primary-hover-bg)] transition"
              >
                Abrir primeiro processo
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && processos.length > 0 && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--table-header-bg)]">
                  <tr className="text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    <th className="px-4 py-3">Nº</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Detalhamento</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {processos.map(p => (
                    <tr
                      key={p.processId}
                      className="border-t border-[var(--border-subtle)] hover:bg-[var(--table-row-hover-bg)]"
                    >
                      <td className="px-4 py-2 align-top text-[var(--text-secondary)]">
                        {p.processId}
                      </td>
                      <td className="px-4 py-2 align-top text-[var(--text-secondary)]">
                        {processTypeLabel(p)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                            badgeColor(p.status)
                          }
                        >
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-top text-[var(--text-secondary)]">
                        {p.processTypeCategory === "CAREER" || p.type ? (
                          <>
                            {formatDate(p.intersticeStart)} a {formatDate(p.intersticeEnd)}
                            <span className="block text-xs text-[var(--text-muted)]">
                              {p.classeOrigem}{p.nivelOrigem} para {p.classeDestino}{p.nivelDestino}
                            </span>
                          </>
                        ) : p.processTypeCategory === "RSC" ? (
                          p.rscDetails?.targetLevel?.replace("_", " ") || "RSC"
                        ) : (
                          "Memorial ou tese"
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        <Link
                          href={`/docente/processos/${p.processId}`}
                          className="text-xs px-3 py-1.5 rounded-full
                                     bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                     hover:bg-[var(--btn-primary-hover-bg)] transition"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
