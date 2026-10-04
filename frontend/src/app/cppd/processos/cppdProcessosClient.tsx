"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

type ViewMode = "pending" | "evaluated"

type ProcessStatus =
  | "DRAFT"
  | "DOCUMENTATION_PENDING"
  | "SUBMITTED"
  | "AWAITING_EVALUATOR_ACCEPTANCE"
  | "AWAITING_ORDINANCE"
  | "UNDER_REVIEW"
  | "IN_EVALUATION"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "FINALIZED"

type ProcessType = "PROGRESSAO" | "PROMOCAO"

interface ListProcessDto {
  idProcess: number
  status: ProcessStatus
  type: ProcessType
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  finalPoints: string | null
  campus: string
  cidadeUF: string
  user: {
    idUser: number
    name: string
    docente: { siape: string } | null
  }
  table: {
    idScoringTable: number
    name: string
    minRequiredPoints: string | null
  }
  processTypeConfig: {
    name: string
    category: string
    requiresCommittee: boolean
    requiresScoring: boolean
  } | null
}

interface ApiResponse<T = any> {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function statusLabel(s: ProcessStatus) {
  if (s === "SUBMITTED") return "Enviado"
  if (s === "DOCUMENTATION_PENDING") return "Documentação pendente"
  if (s === "AWAITING_EVALUATOR_ACCEPTANCE") return "Aguardando avaliadores"
  if (s === "AWAITING_ORDINANCE") return "Aguardando portaria"
  if (s === "UNDER_REVIEW") return "Em análise"
  if (s === "IN_EVALUATION") return "Em avaliação"
  if (s === "APPROVED") return "Deferido"
  if (s === "REJECTED") return "Indeferido"
  if (s === "RETURNED") return "Devolvido"
  if (s === "FINALIZED") return "Finalizado"
  return s
}

function typeLabel(t: ProcessType) {
  if (t === "PROGRESSAO") return "Progressão"
  return "Promoção"
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR")
}

export default function CppdProcessosClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialView = (
    searchParams.get("view") === "evaluated" ? "evaluated" : "pending"
  ) as ViewMode
  const [view, setView] = useState<ViewMode>(initialView)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ListProcessDto[]>([])

  function updateQuery(mode: ViewMode) {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("view", mode)
    router.replace(`/cppd/processos?${params.toString()}`)
  }

  async function load(mode: ViewMode) {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/cppd/processos?view=${mode}`, {
        method: "GET",
        credentials: "include",
      })

      const payload = (await res.json().catch(() => null)) as ApiResponse<
        ListProcessDto[]
      > | null

      if (!payload || !res.ok || payload.status === "error" || !payload.data) {
        setItems([])
        setError(payload?.message ?? "Falha ao carregar processos.")
        return
      }

      setItems(payload.data)
    } catch (err) {
      console.error("Erro ao carregar processos:", err)
      setItems([])
      setError("Erro inesperado ao carregar processos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const count = useMemo(() => items.length, [items])

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-4">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Processos
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {view === "pending"
                ? "Pendentes de avaliação"
                : "Avaliados (com parecer)"}{" "}
              • <span className="font-semibold">{count}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setView("pending")
                updateQuery("pending")
              }}
              className={
                "px-4 py-2 rounded-full text-xs font-semibold border transition " +
                (view === "pending"
                  ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border-transparent"
                  : "border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]")
              }
            >
              Pendentes
            </button>

            <button
              type="button"
              onClick={() => {
                setView("evaluated")
                updateQuery("evaluated")
              }}
              className={
                "px-4 py-2 rounded-full text-xs font-semibold border transition " +
                (view === "evaluated"
                  ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border-transparent"
                  : "border-[var(--btn-secondary-border)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]")
              }
            >
              Avaliados
            </button>
          </div>
        </header>

        {error && (
          <p className="text-xs text-[var(--state-danger-text)] whitespace-pre-wrap">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            {view === "pending"
              ? "Nenhum processo pendente."
              : "Nenhum processo avaliado encontrado."}
          </p>
        ) : (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-xs">
                <thead className="bg-[var(--surface-muted-bg)]">
                  <tr className="text-left text-[var(--text-secondary)]">
                    <th className="px-4 py-3">Processo</th>
                    <th className="px-4 py-3">Docente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tabela</th>
                    <th className="px-4 py-3">Data da avaliação</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((p) => (
                    <tr
                      key={p.idProcess}
                      className="border-t border-[var(--border-subtle)]"
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                        #{p.idProcess}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {p.user?.name ?? "—"}
                        {p.user?.docente?.siape ? (
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {" "}
                            • SIAPE {p.user.docente.siape}
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {p.processTypeConfig?.name ?? typeLabel(p.type)}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {statusLabel(p.status)}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {p.table?.name ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {formatDate(p.updatedAt)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {view === "pending" &&
                          p.processTypeConfig?.requiresCommittee ? (
                          <Link
                            href={`/cppd/processos/${p.idProcess}/comissao`}
                            className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold
                                      bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                      hover:bg-[var(--btn-primary-hover-bg)] transition"
                          >
                            Comissão
                          </Link>
                        ) : view === "pending" ? (
                          <Link
                            href={
                              p.processTypeConfig?.requiresScoring === false
                                ? `/cppd/processos/${p.idProcess}/analise`
                                : `/cppd/processos/${p.idProcess}/avaliacao`
                            }
                            className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold
                                      bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                      hover:bg-[var(--btn-primary-hover-bg)] transition"
                          >
                            Avaliar
                          </Link>
                        ) : p.processTypeConfig?.requiresCommittee ? (
                          <Link
                            href={`/cppd/processos/${p.idProcess}/comissao`}
                            className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold
                                      border border-[var(--btn-secondary-border)]
                                      text-[var(--btn-secondary-text)]
                                      hover:bg-[var(--btn-secondary-hover-bg)] transition"
                          >
                            Ver comissão
                          </Link>
                        ) : (
                          <Link
                            href={`/cppd/processos/${p.idProcess}/avaliacao/visualizar`}
                            className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold
                                      border border-[var(--btn-secondary-border)]
                                      text-[var(--btn-secondary-text)]
                                      hover:bg-[var(--btn-secondary-hover-bg)] transition"
                          >
                            Ver avaliação
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
