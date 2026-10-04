"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type AcceptanceStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED"

interface Assignment {
  memberId: number
  acceptanceStatus: AcceptanceStatus
  acceptedAt: string | null
  conflictDeclarationAt: string | null
  responseReason: string | null
  role: string
  commission: {
    type: "RSC" | "FULL_PROFESSOR"
    status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED"
    ordinance: string | null
    ordinanceDate: string | null
  }
  process: {
    idProcess: number
    status: string
    processTypeName: string
    campus: string
    cityState: string
    teacherName: string
    teacherSiape: string | null
    updatedAt: string
  }
  evaluation: {
    idIndividualEvaluation: number
    status: string
    result: string | null
    recognizedPoints: number | null
    opinionText: string | null
    submittedAt: string | null
  } | null
}

interface ApiResponse<T> {
  status: string
  message: string
  data: T | null
}

function acceptanceLabel(status: AcceptanceStatus) {
  if (status === "ACCEPTED") return "Aceito"
  if (status === "DECLINED") return "Recusado"
  if (status === "CANCELED") return "Cancelado"
  return "Aguardando sua resposta"
}

export default function ExternalEvaluatorPage() {
  const [items, setItems] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/avaliador/avaliacoes", {
        credentials: "include",
        cache: "no-store"
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<Assignment[]> | null
      if (!response.ok || !payload?.data) {
        setItems([])
        setError(payload?.message ?? "Não foi possível carregar suas avaliações.")
        return
      }
      setItems(payload.data)
    } catch {
      setError("Não foi possível carregar suas avaliações.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function respond(memberId: number, responseValue: "ACCEPTED" | "DECLINED") {
    let absenceOfConflictDeclared = false
    let reason: string | null = null
    if (responseValue === "ACCEPTED") {
      absenceOfConflictDeclared = window.confirm(
        "Ao aceitar, declaro que não possuo conflito de interesses ou impedimento para avaliar este processo. Deseja continuar?"
      )
      if (!absenceOfConflictDeclared) return
    } else {
      reason = window.prompt("Informe o motivo da recusa:")?.trim() || null
      if (!reason) return
    }
    setBusyId(memberId)
    setError(null)
    try {
      const response = await fetch(`/api/avaliador/avaliacoes/${memberId}/resposta`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: responseValue,
          absenceOfConflictDeclared,
          reason
        })
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<Assignment[]> | null
      if (!response.ok || !payload?.data) {
        setError(payload?.message ?? "Não foi possível responder ao convite.")
        return
      }
      setItems(payload.data)
    } catch {
      setError("Não foi possível responder ao convite.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Minhas avaliações</h1>
      </header>

      {error && <p className="text-sm text-[var(--state-danger-text)]">{error}</p>}

      {loading ? (
        <p className="border-t border-[var(--border-subtle)] py-8 text-center text-sm text-[var(--text-secondary)]">
          Carregando avaliações...
        </p>
      ) : items.length === 0 ? (
        <section className="border-t border-[var(--border-subtle)] py-8 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">Nenhuma avaliação atribuída</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Os processos aparecerão aqui quando você for incluído em uma comissão.
          </p>
        </section>
      ) : (
        <section className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {items.map(item => (
            <article key={item.memberId} className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{item.process.processTypeName}</h2>
                  <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {acceptanceLabel(item.acceptanceStatus)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)]">
                  Processo #{item.process.idProcess} · {item.process.teacherName}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {item.process.campus} · {item.process.cityState} · Função: {item.role}
                </p>
                {item.acceptanceStatus === "ACCEPTED" && item.commission.status === "DRAFT" && (
                  <p className="pt-1 text-xs text-[var(--text-secondary)]">
                    Aceite registrado. A avaliação será liberada após a emissão da portaria.
                  </p>
                )}
                {item.acceptanceStatus === "ACCEPTED" && item.commission.status === "COMPLETED" && (
                  <p className="pt-1 text-xs font-semibold text-[var(--state-success-text)]">
                    Comissão concluída. O parecer permanece disponível para consulta.
                  </p>
                )}
                {item.acceptanceStatus === "ACCEPTED" && item.commission.status === "CANCELED" && (
                  <p className="pt-1 text-xs text-[var(--state-danger-text)]">
                    Comissão cancelada.
                  </p>
                )}
                {item.acceptanceStatus === "ACCEPTED" && item.commission.status === "ACTIVE" && (
                  <p className="pt-1 text-xs font-semibold text-[var(--state-success-text)]">
                    {item.evaluation?.status === "SUBMITTED" ? "Avaliação enviada." : "Avaliação disponível."}
                  </p>
                )}
              </div>

              {item.acceptanceStatus === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => respond(item.memberId, "DECLINED")}
                    disabled={busyId === item.memberId}
                    className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(item.memberId, "ACCEPTED")}
                    disabled={busyId === item.memberId}
                    className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
                  >
                    Aceitar
                  </button>
                </div>
              )}
              {item.acceptanceStatus === "ACCEPTED" &&
                (item.commission.status === "ACTIVE" || item.commission.status === "COMPLETED") && (
                  <Link
                    href={`/avaliador/avaliacoes/${item.memberId}`}
                    className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-center text-sm font-semibold text-[var(--btn-primary-text)]"
                  >
                    {item.evaluation?.status === "SUBMITTED" ? "Consultar" : "Avaliar"}
                  </Link>
                )}
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
