"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import ActionButton from "@/components/ui/ActionButton"
import { formatProcessTypeLabel } from "@/utils/processTypeLabels"

import ConfirmModal from "@/components/ConfirmModal"
import { FormTextarea } from "@/components/ui/FormControls"
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
  const [pendingResponse, setPendingResponse] = useState<{memberId: number; response: "ACCEPTED" | "DECLINED"} | null>(null)
  const [responseReason, setResponseReason] = useState("")
  const [responseError, setResponseError] = useState<string | null>(null)
  const [items, setItems] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useFeedbackState<string | null>(null, "error")

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
    setResponseReason("")
    setResponseError(null)
    setPendingResponse({ memberId, response: responseValue })
  }

  async function confirmResponse() {
    if (!pendingResponse) return
    const { memberId, response: responseValue } = pendingResponse
    const reason = responseValue === "DECLINED" ? responseReason.trim() : null
    if (responseValue === "DECLINED" && !reason) { setResponseError("Informe o motivo da recusa."); return }
    const absenceOfConflictDeclared = responseValue === "ACCEPTED"
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
      setPendingResponse(null)
    } catch {
      setError("Não foi possível responder ao convite.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <ConfirmModal open={pendingResponse !== null} title={pendingResponse?.response === "ACCEPTED" ? "Aceitar participação na comissão?" : "Recusar participação na comissão?"} description={pendingResponse?.response === "ACCEPTED" ? "Ao confirmar, declaro que não possuo conflito de interesses ou impedimento para avaliar este processo." : "Informe o motivo da recusa para que a CPPD possa acompanhar a composição da comissão."} error={responseError} loading={busyId !== null} onCancel={() => setPendingResponse(null)} onConfirm={confirmResponse}>
        {pendingResponse?.response === "DECLINED" && <label className="block space-y-2 text-sm"><span>Motivo da recusa</span><FormTextarea aria-label="Motivo da recusa" required value={responseReason} onChange={event => { setResponseReason(event.target.value); setResponseError(null) }} className="w-full rounded-xl border border-[var(--border-subtle)] p-3" /></label>}
      </ConfirmModal>
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Minhas avaliações</h1>
      </header>

      {error && null}

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
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{formatProcessTypeLabel(undefined, item.process.processTypeName)}</h2>
                  <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {acceptanceLabel(item.acceptanceStatus)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)]">
                  Processo #{item.process.idProcess} · {item.process.teacherName}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {item.process.campus} · {item.process.cityState} · Função: {({ PRESIDENT: "Presidente", MEMBER: "Membro", PRIMARY: "Titular", SUBSTITUTE: "Suplente" } as Record<string, string>)[item.role] || "Membro"}
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
                  <ActionButton
                    type="button"
                    onClick={() => respond(item.memberId, "DECLINED")}
                    disabled={busyId === item.memberId}
                    className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
                   disabledReason={(busyId === item.memberId) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                    Recusar
                  </ActionButton>
                  <ActionButton
                    type="button"
                    onClick={() => respond(item.memberId, "ACCEPTED")}
                    disabled={busyId === item.memberId}
                    className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
                   disabledReason={(busyId === item.memberId) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                    Aceitar
                  </ActionButton>
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
