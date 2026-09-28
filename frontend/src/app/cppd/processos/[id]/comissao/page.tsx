"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { FormEvent, useCallback, useEffect, useState } from "react"
import ConfirmModal from "@/components/ConfirmModal"

type CommissionStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED"
type AcceptanceStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED"
type MemberRole = "PRESIDENT" | "MEMBER" | "PRIMARY" | "SUBSTITUTE"

interface CommissionMember {
  idSpecialCommissionMember: number
  name: string
  email: string | null
  role: MemberRole
  acceptanceStatus: AcceptanceStatus
  acceptedAt: string | null
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
    teacherName: string
    teacherSiape: string | null
    campus: string
    cityState: string
    requiresGecc: boolean
    finalPoints: number | null
    evaluationOpinion: string | null
  }
  commission: {
    idSpecialCommission: number
    type: "RSC" | "FULL_PROFESSOR"
    status: CommissionStatus
    ordinance: string | null
    ordinanceDate: string | null
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
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ordinance, setOrdinance] = useState("")
  const [ordinanceDate, setOrdinanceDate] = useState("")
  const [memberEmail, setMemberEmail] = useState("")
  const [memberRole, setMemberRole] = useState<MemberRole>("MEMBER")
  const [decisionOpinion, setDecisionOpinion] = useState("")
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

  async function mutate(url: string, init: RequestInit, successMessage: string) {
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
        setError(payload?.message ?? "Não foi possível concluir a operação.")
        return false
      }
      setMessage(successMessage)
      return true
    } catch {
      setError("Não foi possível concluir a operação.")
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
      { method: "POST", body: JSON.stringify({ email: memberEmail, role: memberRole }) },
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

  async function finalizeDecision() {
    if (!pendingDecision) return
    if (!decisionOpinion.trim()) {
      setError("Informe o parecer consolidado da CPPD.")
      setPendingDecision(null)
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
        ? "Decisão deferida e organização do GECC iniciada."
        : "Decisão de indeferimento registrada."
    )
    if (saved) setDecisionOpinion("")
    setPendingDecision(null)
  }

  if (loading) {
    return <div className="px-4 py-8 text-sm text-[var(--text-secondary)]">Carregando comissão...</div>
  }

  if (!data) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--state-danger-text)]">{error ?? "Comissão indisponível."}</p>
        <Link href="/cppd/processos" className="mt-4 inline-block text-sm font-semibold underline">
          Voltar para processos
        </Link>
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
            ? "O parecer consolidado será registrado e o organizador documental do GECC será iniciado."
            : "O parecer consolidado será registrado e o processo será encerrado como indeferido."
        }
        confirmText={pendingDecision === "APPROVED" ? "Deferir" : "Indeferir"}
        loading={busy}
        onConfirm={finalizeDecision}
        onCancel={() => setPendingDecision(null)}
      />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/cppd/processos" className="text-xs font-semibold text-[var(--text-secondary)] hover:underline">
              Processos
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Comissão especial</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Processo #{data.process.idProcess} · {data.process.processTypeName} · {data.process.teacherName}
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-semibold">
            {data.commission ? commissionStatusLabel(data.commission.status) : "Não criada"}
          </span>
        </header>

        {error && <p className="text-sm text-[var(--state-danger-text)]">{error}</p>}
        {message && <p className="text-sm text-[var(--state-success-text)]">{message}</p>}

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
              {data.process.status}
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
              <input
                className={inputClass}
                value={ordinance}
                onChange={event => setOrdinance(event.target.value)}
                disabled={!editable || busy}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              Data da portaria
              <input
                type="date"
                className={inputClass}
                value={ordinanceDate}
                onChange={event => setOrdinanceDate(event.target.value)}
                disabled={!editable || busy}
              />
            </label>
          </div>
          {editable && (
            <button
              disabled={busy}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
            >
              Salvar dados
            </button>
          )}
        </form>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Membros</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              O e-mail deve pertencer a um avaliador externo ativo.
            </p>
          </div>

          {editable && (
            <form onSubmit={addMember} className="grid items-end gap-3 sm:grid-cols-[1fr_190px_auto]">
              <label className="text-sm text-[var(--text-primary)]">
                E-mail do avaliador
                <input
                  type="email"
                  required
                  className={inputClass}
                  value={memberEmail}
                  onChange={event => setMemberEmail(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                Função
                <select
                  className={inputClass}
                  value={memberRole}
                  onChange={event => setMemberRole(event.target.value as MemberRole)}
                  disabled={busy}
                >
                  <option value="PRESIDENT">Presidente</option>
                  <option value="MEMBER">Membro</option>
                  <option value="PRIMARY">Titular</option>
                  <option value="SUBSTITUTE">Suplente</option>
                </select>
              </label>
              <button
                disabled={busy}
                className="h-10 rounded-md bg-[var(--btn-primary-bg)] px-4 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
              >
                Adicionar
              </button>
            </form>
          )}

          {data.commission?.members.length ? (
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {data.commission.members.map(member => (
                <div
                  key={member.idSpecialCommissionMember}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{member.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {member.email} · {member.role}
                    </p>
                    {member.acceptanceStatus === "ACCEPTED" && data.commission?.status !== "DRAFT" && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {evaluationStatusLabel(member.evaluation?.status)}
                        {member.evaluation?.status === "SUBMITTED" && (
                          <>
                            {` · ${resultLabel(member.evaluation.result)}`}
                            {member.evaluation.recognizedPoints !== null &&
                              ` · ${member.evaluation.recognizedPoints.toFixed(2).replace(".", ",")} pontos`}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {acceptanceLabel(member.acceptanceStatus)}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.idSpecialCommissionMember)}
                        disabled={busy}
                        className="text-xs font-semibold text-[var(--state-danger-text)] hover:underline disabled:opacity-50"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
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
                <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                  {data.commission.consolidation.opinions.map(opinion => (
                    <article key={opinion.memberId} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{opinion.evaluatorName}</h3>
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          {resultLabel(opinion.result)}
                          {opinion.recognizedPoints !== null &&
                            ` · ${opinion.recognizedPoints.toFixed(2).replace(".", ",")} pontos`}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                        {opinion.opinionText || "Parecer não informado."}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="border-y border-[var(--border-subtle)] py-5 text-center text-sm text-[var(--text-secondary)]">
                  Nenhum parecer individual enviado.
                </p>
              )}

              {data.commission.status === "ACTIVE" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => changeStatus("COMPLETED")}
                    disabled={busy || !data.commission.consolidation.allSubmitted}
                    title={
                      data.commission.consolidation.allSubmitted
                        ? "Concluir comissão"
                        : "Aguarde o envio de todas as avaliações"
                    }
                    className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Concluir comissão
                  </button>
                </div>
              )}

              {data.commission.status === "COMPLETED" && data.process.status === "UNDER_REVIEW" && (
                <div className="space-y-4 border-t border-[var(--border-subtle)] pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Decisão da CPPD</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Registre a conclusão institucional baseada nos pareceres individuais.
                    </p>
                  </div>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">
                    Parecer consolidado
                    <textarea
                      value={decisionOpinion}
                      maxLength={20000}
                      onChange={event => setDecisionOpinion(event.target.value)}
                      disabled={busy}
                      className={`${inputClass} min-h-36 resize-y`}
                    />
                  </label>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setPendingDecision("REJECTED")}
                      disabled={busy || !decisionOpinion.trim()}
                      className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
                    >
                      Indeferir
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDecision("APPROVED")}
                      disabled={busy || !decisionOpinion.trim()}
                      className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
                    >
                      {data.process.requiresGecc ? "Deferir e iniciar GECC" : "Deferir"}
                    </button>
                  </div>
                </div>
              )}

              {data.commission.status === "COMPLETED" && data.process.status !== "UNDER_REVIEW" && (
                <div className="border-t border-[var(--border-subtle)] pt-5">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Decisão da CPPD</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {data.process.status === "AWAITING_GECC" || data.process.status === "APPROVED"
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
                </div>
              )}
            </section>
          )}

        {data.commission?.status === "DRAFT" && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
            <button
              type="button"
              onClick={() => changeStatus("CANCELED")}
              disabled={busy}
              className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
            >
              Cancelar comissão
            </button>
            <button
              type="button"
              onClick={() => changeStatus("ACTIVE")}
              disabled={busy}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
            >
              Ativar comissão
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
