"use client"
import { FormSelect } from "@/components/ui/FormControls"
import { FormTextarea } from "@/components/ui/FormControls"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import ActionButton from "@/components/ui/ActionButton"
import FormInput from "@/components/ui/FormInput"

import { FormEvent, useCallback, useEffect, useState } from "react"

type ProcedureAction =
  | "REQUEST_REASSESSMENT"
  | "SCHEDULE_ORAL_DEFENSE"
  | "RECORD_ORAL_DEFENSE"
  | "SUBMIT_APPEAL"
  | "DECIDE_APPEAL"
  | "CLOSE_EXPIRED_PERIOD"

type ProcedureData = {
  processId: number
  evaluationMode: "MEMORIAL" | "THESIS" | null
  stage: string
  currentOutcome: "APPROVED" | "REJECTED" | null
  evaluationDeadlineAt: string | null
  evaluationOverdue: boolean
  initialOpinionAt: string | null
  reassessmentDeadlineAt: string | null
  reassessmentRequestedAt: string | null
  reassessmentReason: string | null
  oralDefenseDeadlineAt: string | null
  oralDefenseScheduledAt: string | null
  oralDefenseAccessUrl: string | null
  oralDefenseHeldAt: string | null
  oralDefenseRecordingUrl: string | null
  oralDefenseNotes: string | null
  appealDeadlineAt: string | null
  appealSubmittedAt: string | null
  appealReason: string | null
  appealDecidedAt: string | null
  appealDecisionText: string | null
  availableActions: ProcedureAction[]
  events: Array<{
    id: number
    type: string
    occurredAt: string
    actor: { idUser: number; name: string }
  }>
}

type ApiResponse<T> = { data: T | null; message: string }

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--btn-primary-bg)]"

const procedureEventLabels: Record<string, string> = {
 INITIAL_OUTCOME_RECORDED: "Resultado inicial registrado", REASSESSMENT_REQUESTED: "Reavaliação solicitada",
 ORAL_DEFENSE_SCHEDULED: "Sessão de defesa agendada", ORAL_DEFENSE_RECORDED: "Defesa registrada",
 APPEAL_SUBMITTED: "Recurso apresentado", APPEAL_DECIDED: "Decisão do recurso registrada", DEADLINE_EXPIRED: "Prazo encerrado"
}
function formatDate(value: string | null) {
  if (!value) return "Não definido"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
}

const stageLabels: Record<string, string> = {
  INITIAL_EVALUATION: "Avaliação inicial",
  AWAITING_REASSESSMENT: "Aguardando pedido de reavaliação",
  REASSESSMENT_REQUESTED: "Reavaliação solicitada",
  ORAL_DEFENSE_SCHEDULED: "Defesa oral agendada",
  THESIS_DEFENSE_RECORDED: "Defesa da tese registrada",
  AWAITING_APPEAL: "Aguardando recurso",
  APPEAL_SUBMITTED: "Recurso apresentado",
  COMPLETED: "Rito concluído"
}

export default function FullProfessorProcedurePanel({
  processId,
  actor
}: {
  processId: number
  actor: "CPPD" | "TEACHER"
}) {
  const [data, setData] = useState<ProcedureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useFeedbackState<string | null>(null, "error")
  const [message, setMessage] = useFeedbackState<string | null>(null, "auto")
  const [reason, setReason] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [accessUrl, setAccessUrl] = useState("")
  const [heldAt, setHeldAt] = useState("")
  const [recordingUrl, setRecordingUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [outcome, setOutcome] = useState<"APPROVED" | "REJECTED">("APPROVED")

  const endpoint = actor === "CPPD"
    ? `/api/cppd/processos/${processId}/classe-titular/rito`
    : `/api/processos/${processId}/classe-titular/rito`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, { credentials: "include", cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as ApiResponse<ProcedureData> | null
      if (!response.ok || !payload?.data) throw new Error(payload?.message || "Não foi possível carregar o rito")
      setData(payload.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o rito")
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { load() }, [load])

  async function execute(action: ProcedureAction, values: Record<string, unknown> = {}) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values })
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<ProcedureData> | null
      if (!response.ok || !payload?.data) throw new Error(payload?.message || "Não foi possível atualizar o rito")
      setData(payload.data)
      setMessage("Etapa registrada com sucesso.")
      setReason("")
      setNotes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o rito")
    } finally {
      setBusy(false)
    }
  }

  function submitReason(event: FormEvent, action: "REQUEST_REASSESSMENT" | "SUBMIT_APPEAL") {
    event.preventDefault()
    execute(action, { reason })
  }

  if (loading) return <section className="border-t border-[var(--border-subtle)] py-5 text-sm text-[var(--text-secondary)]">Carregando rito da Classe Titular...</section>
  if (!data) return <section className="border-t border-[var(--border-subtle)] py-5 text-sm text-[var(--state-danger-text)]">{error}</section>

  const actions = new Set(data.availableActions)
  return (
    <section className="space-y-5 border-t border-[var(--border-subtle)] pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Rito da Classe Titular</h2>
          <p className="text-sm text-[var(--text-secondary)]">{stageLabels[data.stage] ?? data.stage}</p>
        </div>
        {data.currentOutcome && <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-semibold">Resultado: {data.currentOutcome === "APPROVED" ? "aprovado" : "reprovado"}</span>}
      </div>

      {error && null}
      {message && null}

      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="block text-xs text-[var(--text-secondary)]">Prazo da comissão</span>{formatDate(data.evaluationDeadlineAt)}{data.evaluationOverdue && <strong className="ml-2 text-[var(--state-danger-text)]">Vencido</strong>}</div>
        <div><span className="block text-xs text-[var(--text-secondary)]">Prazo para reavaliação</span>{formatDate(data.reassessmentDeadlineAt)}</div>
        <div><span className="block text-xs text-[var(--text-secondary)]">Limite da defesa oral</span>{formatDate(data.oralDefenseDeadlineAt)}</div>
        <div><span className="block text-xs text-[var(--text-secondary)]">Prazo para recurso</span>{formatDate(data.appealDeadlineAt)}</div>
      </div>

      {(actions.has("REQUEST_REASSESSMENT") || actions.has("SUBMIT_APPEAL")) && (
        <form onSubmit={event => submitReason(event, actions.has("REQUEST_REASSESSMENT") ? "REQUEST_REASSESSMENT" : "SUBMIT_APPEAL")} className="space-y-3">
          <label className="block text-sm">{actions.has("REQUEST_REASSESSMENT") ? "Justificativa da reavaliação" : "Fundamentos do recurso"}<FormTextarea required maxLength={20000} value={reason} onChange={event => setReason(event.target.value)} className={`${inputClass} min-h-28`} /></label>
          <ActionButton disabled={busy} className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50" disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{actions.has("REQUEST_REASSESSMENT") ? "Solicitar reavaliação" : "Apresentar recurso"}</ActionButton>
        </form>
      )}

      {actions.has("SCHEDULE_ORAL_DEFENSE") && (
        <form onSubmit={event => { event.preventDefault(); execute("SCHEDULE_ORAL_DEFENSE", { scheduledAt: new Date(scheduledAt).toISOString(), accessUrl }) }} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Data e hora da defesa<FormInput required type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className={inputClass}  aria-label="Data e hora da defesa" /></label>
          <label className="text-sm">Endereço da sala virtual<FormInput required type="url" value={accessUrl} onChange={event => setAccessUrl(event.target.value)} className={inputClass}  aria-label="Endereço da sala virtual" /></label>
          <ActionButton disabled={busy} className="w-fit rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50" disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Agendar defesa</ActionButton>
        </form>
      )}

      {actions.has("RECORD_ORAL_DEFENSE") && (
        <form onSubmit={event => { event.preventDefault(); execute("RECORD_ORAL_DEFENSE", { heldAt: heldAt ? new Date(heldAt).toISOString() : undefined, recordingUrl, notes, ...(data.evaluationMode === "MEMORIAL" ? { outcome } : {}) }) }} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Data e hora realizada<FormInput type="datetime-local" value={heldAt} onChange={event => setHeldAt(event.target.value)} className={inputClass}  aria-label="Data e hora realizada" /></label>
          <label className="text-sm">Endereço da gravação<FormInput required type="url" value={recordingUrl} onChange={event => setRecordingUrl(event.target.value)} className={inputClass}  aria-label="Endereço da gravação" /></label>
          {data.evaluationMode === "MEMORIAL" && <label className="text-sm">Resultado<FormSelect value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)} className={inputClass} aria-label="Resultado" ><option value="APPROVED">Aprovado</option><option value="REJECTED">Reprovado</option></FormSelect></label>}
          <label className="text-sm sm:col-span-2">Registro da ata<FormTextarea required maxLength={20000} value={notes} onChange={event => setNotes(event.target.value)} className={`${inputClass} min-h-28`}  aria-label="Registro da ata" /></label>
          <ActionButton disabled={busy} className="w-fit rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50" disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Registrar sessão</ActionButton>
        </form>
      )}

      {actions.has("DECIDE_APPEAL") && (
        <form onSubmit={event => { event.preventDefault(); execute("DECIDE_APPEAL", { outcome, decisionText: notes }) }} className="space-y-3">
          <label className="block text-sm">Resultado do recurso<FormSelect value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)} className={inputClass} aria-label="Resultado do recurso" ><option value="APPROVED">Provido</option><option value="REJECTED">Negado</option></FormSelect></label>
          <label className="block text-sm">Decisão fundamentada<FormTextarea required maxLength={20000} value={notes} onChange={event => setNotes(event.target.value)} className={`${inputClass} min-h-28`}  aria-label="Decisão fundamentada" /></label>
          <ActionButton disabled={busy} className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50" disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Registrar decisão</ActionButton>
        </form>
      )}

      {actions.has("CLOSE_EXPIRED_PERIOD") && <ActionButton type="button" disabled={busy} onClick={() => execute("CLOSE_EXPIRED_PERIOD")} className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50" disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Encerrar prazo sem manifestação</ActionButton>}

      {(data.oralDefenseScheduledAt || data.oralDefenseHeldAt) && <div className="text-sm text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Sessão:</strong> {data.oralDefenseHeldAt ? `realizada em ${formatDate(data.oralDefenseHeldAt)}` : `agendada para ${formatDate(data.oralDefenseScheduledAt)}`}{data.oralDefenseAccessUrl && <> · <a className="underline" href={data.oralDefenseAccessUrl} target="_blank" rel="noreferrer">sala virtual</a></>}{data.oralDefenseRecordingUrl && <> · <a className="underline" href={data.oralDefenseRecordingUrl} target="_blank" rel="noreferrer">gravação</a></>}</div>}

      {data.events.length > 0 && <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">Histórico do rito</h3><div className="mt-2 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">{data.events.map(event => <div key={event.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs text-[var(--text-secondary)]"><span>{procedureEventLabels[event.type] || "Atualização do rito"} · {event.actor.name || "Responsável não identificado"}</span><span>{formatDate(event.occurredAt)}</span></div>)}</div></div>}
    </section>
  )
}
