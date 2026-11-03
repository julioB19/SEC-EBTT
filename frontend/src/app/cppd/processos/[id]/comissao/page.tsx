"use client"

import ProcessSteps from "@/components/ProcessSteps"
import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"
import { FormSelect } from "@/components/ui/FormControls"
import { FormTextarea } from "@/components/ui/FormControls"
import { formatProcessTypeLabel } from "@/utils/processTypeLabels"
import CaseCompliancePanel from "@/components/CaseCompliancePanel";

import Link from "next/link"
import { useParams } from "next/navigation"
import { FormEvent, useCallback, useEffect, useState } from "react"
import ConfirmModal from "@/components/ConfirmModal"
import FullProfessorProcedurePanel from "@/components/FullProfessorProcedurePanel"

type CommissionStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED"
type AcceptanceStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED"
type MemberRole = "PRESIDENT" | "MEMBER" | "PRIMARY" | "SUBSTITUTE"

interface CommissionMember {
  idSpecialCommissionMember: number
  name: string
  email: string | null
  role: MemberRole
  origin: "INTERNAL" | "EXTERNAL"
  acceptanceStatus: AcceptanceStatus
  acceptedAt: string | null
  conflictDeclarationAt: string | null
  responseReason: string | null
  evaluation: {
    idIndividualEvaluation: number
    status: string
    result: string | null
    recognizedPoints: number | null
    opinionText: string | null
    submittedAt: string | null
  } | null
}

interface CommissionConsolidation {
  totalMembers: number
  submittedCount: number
  pendingCount: number
  allSubmitted: boolean
  averageRecognizedPoints: number | null
  results: Record<string, number>
  opinions: Array<{
    memberId: number
    evaluatorName: string
    result: string | null
    recognizedPoints: number | null
    opinionText: string | null
    submittedAt: string | null
  }>
}

interface CommissionData {
  process: {
    idProcess: number
    status: string
    processTypeName: string
    processTypeCategory: string | null
    teacherName: string
    teacherSiape: string | null
    campus: string
    cityState: string
    finalPoints: number | null
    evaluationOpinion: string | null
  }
  commission: {
    idSpecialCommission: number
    type: "RSC" | "FULL_PROFESSOR"
    status: CommissionStatus
    ordinance: string | null
    ordinanceDate: string | null
    evaluationDeadlineAt: string | null
    evaluationOverdue: boolean
    members: CommissionMember[]
    consolidation: CommissionConsolidation
  } | null
}

interface ApiResponse<T> {
  status: string
  message: string
  data: T | null
}

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--btn-primary-bg)]"

function memberRoleLabel(role: MemberRole) {
  return { PRESIDENT: "Presidente", MEMBER: "Membro", PRIMARY: "Titular", SUBSTITUTE: "Suplente" }[role]
}

function processStageLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho", DOCUMENTATION_PENDING: "Documentação pendente", SUBMITTED: "Submetido",
    UNDER_REVIEW: "Em análise", AWAITING_EVALUATOR_ACCEPTANCE: "Aguardando aceite dos avaliadores",
    AWAITING_ORDINANCE: "Aguardando portaria", IN_EVALUATION: "Em avaliação", RETURNED: "Devolvido",
    APPROVED: "Deferido", REJECTED: "Indeferido", FINALIZED: "Finalizado"
  }
  return labels[status] ?? "Em andamento"
}

function acceptanceLabel(status: AcceptanceStatus) {
  if (status === "ACCEPTED") return "Convite aceito"
  if (status === "DECLINED") return "Convite recusado"
  if (status === "CANCELED") return "Cancelado"
  return "Aguardando resposta"
}

function commissionStatusLabel(status: CommissionStatus) {
  if (status === "ACTIVE") return "Ativa"
  if (status === "COMPLETED") return "Concluída"
  if (status === "CANCELED") return "Cancelada"
  return "Rascunho"
}

function evaluationStatusLabel(status: string | undefined) {
  if (status === "SUBMITTED") return "Avaliação enviada"
  if (status === "RETURNED") return "Avaliação devolvida"
  if (status === "CANCELED") return "Avaliação cancelada"
  return "Avaliação pendente"
}

function resultLabel(result: string | null) {
  if (result === "APPROVED") return "Aprovado"
  if (result === "REJECTED") return "Reprovado"
  if (result === "DEFERRED") return "Deferido"
  if (result === "DENIED") return "Indeferido"
  return "Não informado"
}

export default function SpecialCommissionPage() {
  const params = useParams<{ id: string }>()
  const processId = Number(params.id)
  const [data, setData] = useState<CommissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useFeedbackState<string | null>(null, "error")
  const [message, setMessage] = useFeedbackState<string | null>(null, "auto")
  const [ordinance, setOrdinance] = useState("")
  const [ordinanceDate, setOrdinanceDate] = useState("")
  const [memberEmail, setMemberEmail] = useState("")
  const [memberOrigin, setMemberOrigin] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL")
  const [memberRole, setMemberRole] = useState<MemberRole>("MEMBER")
  const [decisionOpinion, setDecisionOpinion] = useState("")
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [pendingDecision, setPendingDecision] = useState<"APPROVED" | "REJECTED" | null>(null)

  const applyResponse = useCallback((payload: ApiResponse<CommissionData> | null) => {
    if (!payload?.data) return false
    setData(payload.data)
    setOrdinance(payload.data.commission?.ordinance ?? "")
    setOrdinanceDate(payload.data.commission?.ordinanceDate?.slice(0, 10) ?? "")
    return true
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/cppd/processos/${processId}/comissao`, {
        credentials: "include",
        cache: "no-store"
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<CommissionData> | null
      if (!response.ok || !applyResponse(payload)) {
        setError(payload?.message ?? "Não foi possível carregar a comissão.")
      }
    } catch {
      setError("Não foi possível carregar a comissão.")
    } finally {
      setLoading(false)
    }
  }, [applyResponse, processId])

  useEffect(() => {
    if (Number.isInteger(processId) && processId > 0) load()
  }, [load, processId])

  async function mutate(url: string, init: RequestInit, successMessage: string, onFailure?: (message: string) => void) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(url, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<CommissionData> | null
      if (!response.ok || !applyResponse(payload)) {
        const failureMessage = payload?.message ?? "Não foi possível concluir a operação."
        setError(failureMessage)
        onFailure?.(failureMessage)
        return false
      }
      setMessage(successMessage)
      return true
    } catch {
      const failureMessage = "Não foi possível concluir a operação. Verifique sua conexão e tente novamente."
      setError(failureMessage)
      onFailure?.(failureMessage)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveCommission(event: FormEvent) {
    event.preventDefault()
    await mutate(
      `/api/cppd/processos/${processId}/comissao`,
      {
        method: "PUT",
        body: JSON.stringify({ ordinance: ordinance || null, ordinanceDate: ordinanceDate || null })
      },
      "Dados da comissão salvos."
    )
  }

  async function addMember(event: FormEvent) {
    event.preventDefault()
    const saved = await mutate(
      `/api/cppd/processos/${processId}/comissao/membros`,
      { method: "POST", body: JSON.stringify({ email: memberEmail, origin: memberOrigin, role: memberRole }) },
      "Avaliador adicionado e avaliação individual criada."
    )
    if (saved) setMemberEmail("")
  }

  async function removeMember(memberId: number) {
    await mutate(
      `/api/cppd/processos/${processId}/comissao/membros/${memberId}`,
      { method: "DELETE" },
      "Avaliador removido da comissão."
    )
  }

  async function changeStatus(status: "ACTIVE" | "COMPLETED" | "CANCELED") {
    await mutate(
      `/api/cppd/processos/${processId}/comissao/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      status === "ACTIVE"
        ? "Comissão ativada."
        : status === "COMPLETED"
          ? "Comissão concluída e processo encaminhado para análise da CPPD."
          : "Comissão cancelada."
    )
  }

  function requestDecision(decision: "APPROVED" | "REJECTED") {
    setDecisionError(null)
    setPendingDecision(decision)
  }

  async function finalizeDecision() {
    if (!pendingDecision || busy) return
    setDecisionError(null)
    if (!decisionOpinion.trim()) {
      setDecisionError("Informe o parecer consolidado da CPPD.")
      return
    }
    const decision = pendingDecision
    const saved = await mutate(
      `/api/cppd/processos/${processId}/comissao/decisao`,
      {
        method: "POST",
        body: JSON.stringify({ decision, opinionText: decisionOpinion.trim() })
      },
      decision === "APPROVED"
        ? "Decisão de deferimento registrada."
        : "Decisão de indeferimento registrada.",
      setDecisionError
    )
    if (saved) {
      setDecisionOpinion("")
      setPendingDecision(null)
    }
  }

  if (loading) {
    return <div className="px-4 py-8 text-sm text-[var(--text-secondary)]">Carregando comissão...</div>
  }

  if (!data) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--state-danger-text)]">{error ?? "Comissão indisponível."}</p>
        <></>
      </div>
    )
  }

  const editable = !data.commission || data.commission.status === "DRAFT"

  return (
    <main className="min-h-[60vh]">
      <ConfirmModal
        open={pendingDecision !== null}
        title={pendingDecision === "APPROVED" ? "Deferir o processo?" : "Indeferir o processo?"}
        description={
          pendingDecision === "APPROVED"
            ? "O parecer consolidado será registrado e o processo será deferido."
            : "O parecer consolidado será registrado e o processo será encerrado como indeferido."
        }
        confirmText={pendingDecision === "APPROVED" ? "Deferir" : "Indeferir"}
        loading={busy}
        error={decisionError}
        onConfirm={finalizeDecision}
        onCancel={() => { if (!busy) setPendingDecision(null) }}
      />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/cppd/processos" className="text-xs font-semibold text-[var(--text-secondary)] hover:underline">
              Processos
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Comissão especial</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Processo #{data.process.idProcess} · {formatProcessTypeLabel(undefined, data.process.processTypeName)} · {data.process.teacherName}
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-semibold">
            {data.commission ? commissionStatusLabel(data.commission.status) : "Não criada"}
          </span>
        </header>
<ProcessSteps steps={data.commission?.status === "DRAFT" || !data.commission ? [
 { title: "Registrar a portaria", description: "Informe o ato que institui a comissão e sua data." },
 { title: "Compor a comissão", description: "Adicione os membros elegíveis e acompanhe seus aceites." },
 { title: "Ativar a avaliação", description: "Após todos os aceites, ative a comissão no final da tela." }
] : [
 { title: "Consultar os pareceres", description: "Expanda os cards para revisar os resultados e a fundamentação de cada avaliador." },
 { title: "Conferir os documentos", description: "Gere os PDFs disponíveis, receba as versões assinadas e registre sua conferência." },
 { title: "Concluir a etapa", description: "Use o último bloco para concluir a comissão ou registrar a decisão da CPPD, conforme a situação." }
]} />

        {error && null}
        {message && null}

        <section className="border-y border-[var(--border-subtle)] py-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="block text-xs text-[var(--text-secondary)]">Campus</span>
              {data.process.campus}
            </div>
            <div>
              <span className="block text-xs text-[var(--text-secondary)]">Cidade/UF</span>
              {data.process.cityState}
            </div>
            <div>
              <span className="block text-xs text-[var(--text-secondary)]">Etapa</span>
              {processStageLabel(data.process.status)}
            </div>
          </div>
        </section>

        <form onSubmit={saveCommission} className="space-y-4 border-b border-[var(--border-subtle)] pb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Portaria</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Obrigatória para ativar a comissão após todos os aceites.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[var(--text-primary)]">
              Número da portaria
              <FormInput
                className={inputClass}
                value={ordinance}
                onChange={event => setOrdinance(event.target.value)}
                disabled={!editable || busy}
               disabledReason={(!editable) ? "Portaria e composição só podem ser alteradas enquanto a comissão estiver em rascunho." : (busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Número da portaria" />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              Data da portaria
              <FormInput
                type="date"
                className={inputClass}
                value={ordinanceDate}
                onChange={event => setOrdinanceDate(event.target.value)}
                disabled={!editable || busy}
               disabledReason={(!editable) ? "Portaria e composição só podem ser alteradas enquanto a comissão estiver em rascunho." : (busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Data da portaria" />
            </label>
          </div>
          {editable && (
            <ActionButton
              disabled={busy}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
             disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              Salvar dados
            </ActionButton>
          )}
        </form>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Membros</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Informe uma conta ativa: docente para membro interno ou avaliador externo aprovado para membro externo. A comissão deve ter um interno e três externos.
            </p>
          </div>

          {editable && (
            <form onSubmit={addMember} className="grid items-end gap-3 sm:grid-cols-[1fr_150px_190px_auto]">
              <label className="text-sm text-[var(--text-primary)]">
                E-mail do avaliador
                <FormInput
                  type="email"
                  required
                  className={inputClass}
                  value={memberEmail}
                  onChange={event => setMemberEmail(event.target.value)}
                  disabled={busy}
                 fieldKind={"email"} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="E-mail do avaliador" />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                Origem
                <FormSelect
                  className={inputClass}
                  value={memberOrigin}
                  onChange={event => {
                    const origin = event.target.value as "INTERNAL" | "EXTERNAL"
                    setMemberOrigin(origin)
                    if (data.process.processTypeCategory === "FULL_PROFESSOR") {
                      setMemberRole(origin === "INTERNAL" ? "PRESIDENT" : "MEMBER")
                    }
                  }}
                  disabled={busy}
                 disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Origem" >
                  <option value="EXTERNAL">Externo</option>
                  <option value="INTERNAL">Interno</option>
                </FormSelect>
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                Função
                <FormSelect
                  className={inputClass}
                  value={memberRole}
                  onChange={event => setMemberRole(event.target.value as MemberRole)}
                  disabled={busy}
                 disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Função" >
                  <option value="PRESIDENT">Presidente</option>
                  <option value="MEMBER">Membro</option>
                  <option value="PRIMARY">Titular</option>
                  <option value="SUBSTITUTE">Suplente</option>
                </FormSelect>
              </label>
              <ActionButton
                disabled={busy}
                className="h-10 rounded-md bg-[var(--btn-primary-bg)] px-4 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
               disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                Adicionar
              </ActionButton>
            </form>
          )}

          {data.commission?.members.length ? (
            <div className="space-y-3">
              {data.commission.members.map(member => (
                <details
                  key={member.idSpecialCommissionMember}
                  className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--input-border-focus)] [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 space-y-1">
                      <span className="block break-words text-sm font-semibold text-[var(--text-primary)]">{member.name}</span>
                      <span className="block text-xs text-[var(--text-secondary)]">
                        {member.origin === "INTERNAL" ? "Interno" : "Externo"} · {memberRoleLabel(member.role)} · {acceptanceLabel(member.acceptanceStatus)}
                      </span>
                      {member.acceptanceStatus === "ACCEPTED" && data.commission?.status !== "DRAFT" && (
                        <span className="block text-xs text-[var(--text-secondary)]">
                          {evaluationStatusLabel(member.evaluation?.status)}
                          {member.evaluation?.status === "SUBMITTED" && (
                            <>
                              {` · ${resultLabel(member.evaluation.result)}`}
                              {member.evaluation.recognizedPoints !== null &&
                                ` · ${member.evaluation.recognizedPoints.toFixed(2).replace(".", ",")} pontos`}
                            </>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                      <span className="group-open:hidden">Ver detalhes</span>
                      <span className="hidden group-open:inline">Ocultar detalhes</span>
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 7.5 5 5 5-5"/></svg>
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-[var(--border-subtle)] p-4 text-sm">
                    <p className="break-words text-[var(--text-secondary)]">E-mail: {member.email || "Não informado"}</p>
                    {member.conflictDeclarationAt && (
                      <p className="text-xs text-[var(--state-success-text)]">
                        Ausência de conflito declarada em {new Date(member.conflictDeclarationAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                    {member.acceptanceStatus === "DECLINED" && member.responseReason && (
                      <p className="text-xs text-[var(--state-danger-text)]">
                        Motivo da recusa: {member.responseReason}
                      </p>
                    )}
                    {editable && (
                      <ActionButton
                        type="button"
                        onClick={() => removeMember(member.idSpecialCommissionMember)}
                        disabled={busy}
                        className="text-xs font-semibold text-[var(--state-danger-text)] hover:underline disabled:opacity-50"
                       disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                        Remover
                      </ActionButton>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="border-y border-[var(--border-subtle)] py-6 text-center text-sm text-[var(--text-secondary)]">
              Nenhum membro adicionado.
            </p>
          )}
        </section>

        {data.commission &&
          (data.commission.status === "ACTIVE" || data.commission.status === "COMPLETED") && (
            <section className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Consolidação das avaliações</h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {data.commission.consolidation.submittedCount} de {data.commission.consolidation.totalMembers} pareceres enviados
                  </p>
                </div>
                {data.commission.consolidation.averageRecognizedPoints !== null && (
                  <div className="text-right">
                    <span className="block text-xs text-[var(--text-secondary)]">Média reconhecida</span>
                    <strong className="text-xl text-[var(--text-primary)]">
                      {data.commission.consolidation.averageRecognizedPoints.toFixed(2).replace(".", ",")}
                    </strong>
                  </div>
                )}
              </div>

              {data.commission.consolidation.opinions.length > 0 ? (
                <div className="space-y-3">
                  {data.commission.consolidation.opinions.map(opinion => (
                    <details key={opinion.memberId} className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--input-border-focus)] [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 space-y-1">
                          <span className="block break-words text-sm font-semibold text-[var(--text-primary)]">{opinion.evaluatorName}</span>
                          <span className="block text-xs font-semibold text-[var(--text-secondary)]">
                            {resultLabel(opinion.result)}
                            {opinion.recognizedPoints !== null &&
                              ` · ${opinion.recognizedPoints.toFixed(2).replace(".", ",")} pontos`}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                          <span className="group-open:hidden">Ver parecer</span>
                          <span className="hidden group-open:inline">Ocultar parecer</span>
                          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 7.5 5 5 5-5"/></svg>
                        </span>
                      </summary>
                      <div className="border-t border-[var(--border-subtle)] p-4">
                        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Parecer individual</h3>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">
                          {opinion.opinionText || "Parecer não informado."}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="border-y border-[var(--border-subtle)] py-5 text-center text-sm text-[var(--text-secondary)]">
                  Nenhum parecer individual enviado.
                </p>
              )}

            </section>
          )}

        <CaseCompliancePanel processId={processId} actor="CPPD" />
        {data.process.processTypeCategory === "FULL_PROFESSOR" && (
          <FullProfessorProcedurePanel processId={processId} actor="CPPD" />
        )}

        {data.commission?.status === "DRAFT" && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
            <ActionButton
              type="button"
              onClick={() => changeStatus("CANCELED")}
              disabled={busy}
              className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
             disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              Cancelar comissão
            </ActionButton>
            <ActionButton
              type="button"
              onClick={() => changeStatus("ACTIVE")}
              disabled={busy}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
             disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              Ativar comissão
            </ActionButton>
          </div>
        )}
        {data.commission?.status === "ACTIVE" && (
          <section aria-labelledby="commission-completion-title" className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h2 id="commission-completion-title" className="text-base font-semibold text-[var(--text-primary)]">Conclusão da comissão</h2>
              <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
                Após conferir os pareceres, conclua esta etapa para encaminhar o processo à análise da CPPD.
              </p>
              <p id="commission-completion-hint" className="text-xs text-[var(--text-secondary)]">
                {busy
                  ? "Aguarde a operação em andamento terminar."
                  : data.commission.consolidation.allSubmitted
                    ? "Todos os pareceres foram enviados. Ao concluir, as avaliações individuais deixam de aceitar alterações."
                    : `Aguardando ${data.commission.consolidation.pendingCount} de ${data.commission.consolidation.totalMembers} pareceres. O botão será liberado após o envio de todas as avaliações.`}
              </p>
            </div>
            <span className="inline-flex shrink-0 self-start sm:self-center" title={busy ? "Aguarde a operação em andamento terminar." : !data.commission.consolidation.allSubmitted ? "Aguarde o envio de todas as avaliações." : undefined}>
              <ActionButton
                type="button"
                onClick={() => changeStatus("COMPLETED")}
                disabled={busy || !data.commission.consolidation.allSubmitted}
                aria-describedby="commission-completion-hint"
                className="rounded-full bg-[var(--btn-primary-bg)] px-5 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:pointer-events-none disabled:opacity-50"
               disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : (!data.commission.consolidation.allSubmitted) ? "Aguarde o envio dos quatro pareceres individuais da comissão." : "Este controle está indisponível na etapa atual."} >
                Concluir comissão
              </ActionButton>
            </span>
          </section>
        )}

        {data.commission?.status === "COMPLETED" && data.process.status === "UNDER_REVIEW" && (
          <section aria-labelledby="cppd-decision-title" className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5">
            <div>
              <h2 id="cppd-decision-title" className="text-base font-semibold text-[var(--text-primary)]">Decisão da CPPD</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Registre a conclusão institucional baseada nos pareceres individuais.
              </p>
            </div>
            {decisionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{decisionError}</p>}
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Parecer consolidado
              <FormTextarea
                value={decisionOpinion}
                maxLength={20000}
                onChange={event => setDecisionOpinion(event.target.value)}
                disabled={busy}
                className={`${inputClass} min-h-36 resize-y`}
               disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Parecer consolidado" />
            </label>
            <div className="flex flex-wrap justify-end gap-3">
              <ActionButton
                type="button"
                onClick={() => requestDecision("REJECTED")}
                disabled={busy || !decisionOpinion.trim()}
                className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
               disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : (!decisionOpinion.trim()) ? "Preencha o parecer consolidado da CPPD antes de registrar a decisão." : "Este controle está indisponível na etapa atual."} >
                Indeferir
              </ActionButton>
              <ActionButton
                type="button"
                onClick={() => requestDecision("APPROVED")}
                disabled={busy || !decisionOpinion.trim()}
                className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
               disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : (!decisionOpinion.trim()) ? "Preencha o parecer consolidado da CPPD antes de registrar a decisão." : "Este controle está indisponível na etapa atual."} >
                Deferir
              </ActionButton>
            </div>
          </section>
        )}

        {data.commission?.status === "COMPLETED" && data.process.status !== "UNDER_REVIEW" && (
          <section aria-labelledby="cppd-decision-title" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5">
            <h2 id="cppd-decision-title" className="text-base font-semibold text-[var(--text-primary)]">Decisão da CPPD</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {data.process.status === "APPROVED"
                ? "Processo deferido."
                : "Processo indeferido."}
              {data.process.finalPoints !== null &&
                ` Pontuação consolidada: ${data.process.finalPoints.toFixed(2).replace(".", ",")}.`}
            </p>
            {data.process.evaluationOpinion && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                {data.process.evaluationOpinion}
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
