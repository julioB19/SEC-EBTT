"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import ConfirmModal from "@/components/ConfirmModal"
import Modal from "@/components/Modal"

type EvaluationResult = "APPROVED" | "REJECTED" | "DEFERRED" | "DENIED"

type EvidenceFile = {
  idEvidenceFile: number
  originalName: string
  mimeType: string | null
  sizeBytes: number | null
}

type EvaluationData = {
  memberId: number
  memberRole: string
  commission: {
    type: "RSC" | "FULL_PROFESSOR"
    status: "ACTIVE" | "COMPLETED"
    ordinance: string | null
    ordinanceDate: string | null
  }
  process: {
    idProcess: number
    status: string
    processTypeName: string
    teacherName: string
    teacherSiape: string | null
    campus: string
    cityState: string
    externalNumber: string | null
    rscDetails: {
      targetLevel: string | null
      reportFile: EvidenceFile | null
    } | null
    fullProfessorDetails: {
      evaluationMode: "MEMORIAL" | "THESIS" | null
      finalReferenceDate: string | null
      memorialFile: EvidenceFile | null
      thesisFile: EvidenceFile | null
      doctorateDegree: {
        course: string | null
        institution: string | null
        conclusionDate: string | null
        evidenceFile: EvidenceFile | null
      } | null
    } | null
  }
  scoringTable: {
    idScoringTable: number
    name: string
    minRequiredPoints: number | null
    nodes: Array<{
      idScoringNode: number
      parentId: number | null
      name: string
      code: string | null
      sortOrder: number
      maxPoints: number | null
    }>
    items: Array<{
      idScoringItem: number
      nodeId: number
      description: string
      unit: string | null
      basePoints: number
      factor: number | null
      weight: number | null
      maxQuantity: number | null
      claimedQuantity: number
      claimedPoints: number
      evidenceFile: EvidenceFile | null
    }>
  } | null
  evaluation: {
    idIndividualEvaluation: number
    status: "DRAFT" | "SUBMITTED" | "RETURNED" | "CANCELED"
    result: EvaluationResult | null
    recognizedPoints: number | null
    opinionText: string | null
    submittedAt: string | null
    scores: Array<{
      itemId: number
      quantity: number
      recognizedQuantity: number
      awardedPoints: number
      evaluatorComment: string | null
    }>
  }
}

type ApiResponse<T> = { status: string; message: string; data: T | null }
type ScoreInput = { recognizedQuantity: string; evaluatorComment: string }

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--input-border-focus)] disabled:bg-[var(--surface-muted-bg)] disabled:opacity-80"

function formatDate(value: string | null) {
  if (!value) return "Não informada"
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value))
}

function resultLabel(value: EvaluationResult | null) {
  if (value === "APPROVED") return "Aprovado"
  if (value === "REJECTED") return "Reprovado"
  if (value === "DEFERRED") return "Deferido"
  if (value === "DENIED") return "Indeferido"
  return "Não informado"
}

function calculateRecognizedSummary(
  data: EvaluationData | null,
  scores: Record<number, ScoreInput>
) {
  if (!data?.scoringTable) return { total: 0, byRscLevel: {} as Record<string, number> }
  const pointsByNode = new Map<number, number>()
  for (const item of data.scoringTable.items) {
    const quantity = Number(scores[item.idScoringItem]?.recognizedQuantity ?? 0)
    if (!Number.isInteger(quantity) || quantity < 0) continue
    const factor = item.factor ?? 1
    const weight = item.weight ?? 1
    const points = Math.round(quantity * item.basePoints * factor * weight)
    pointsByNode.set(item.nodeId, (pointsByNode.get(item.nodeId) ?? 0) + points)
  }
  const nodeById = new Map(data.scoringTable.nodes.map(node => [node.idScoringNode, node]))
  const children = new Map<number | null, number[]>()
  for (const node of data.scoringTable.nodes) {
    const parentId = node.parentId ?? null
    children.set(parentId, [...(children.get(parentId) ?? []), node.idScoringNode])
  }
  const calculateNode = (nodeId: number): number => {
    const node = nodeById.get(nodeId)
    const childPoints = (children.get(nodeId) ?? [])
      .reduce((total, childId) => total + calculateNode(childId), 0)
    const total = (pointsByNode.get(nodeId) ?? 0) + childPoints
    return node?.maxPoints === null || node?.maxPoints === undefined
      ? total
      : Math.min(total, node.maxPoints)
  }
  const byRscLevel: Record<string, number> = {}
  let total = 0
  for (const rootId of children.get(null) ?? []) {
    const node = nodeById.get(rootId)
    const nodeTotal = calculateNode(rootId)
    total += nodeTotal
    if (node?.code && /^RSC_(I|II|III)$/.test(node.code)) byRscLevel[node.code] = nodeTotal
  }
  return { total, byRscLevel }
}

export default function IndividualEvaluationPage() {
  const params = useParams<{ memberId: string }>()
  const memberId = Number(params.memberId)
  const [data, setData] = useState<EvaluationData | null>(null)
  const [scores, setScores] = useState<Record<number, ScoreInput>>({})
  const [result, setResult] = useState<EvaluationResult | "">("")
  const [opinionText, setOpinionText] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [modal, setModal] = useState({ open: false, title: "", message: "", variant: "info" as "info" | "success" | "error" })

  const applyData = useCallback((next: EvaluationData) => {
    setData(next)
    setResult(next.evaluation.result ?? "")
    setOpinionText(next.evaluation.opinionText ?? "")
    setScores(
      Object.fromEntries(
        next.evaluation.scores.map(score => [
          score.itemId,
          {
            recognizedQuantity: String(score.recognizedQuantity ?? score.quantity),
            evaluatorComment: score.evaluatorComment ?? ""
          }
        ])
      )
    )
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/avaliador/avaliacoes/${memberId}`, {
        credentials: "include",
        cache: "no-store"
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<EvaluationData> | null
      if (!response.ok || !payload?.data) {
        setError(payload?.message ?? "Não foi possível carregar a avaliação.")
        return
      }
      applyData(payload.data)
    } catch {
      setError("Não foi possível carregar a avaliação.")
    } finally {
      setLoading(false)
    }
  }, [applyData, memberId])

  useEffect(() => {
    if (Number.isInteger(memberId) && memberId > 0) load()
  }, [load, memberId])

  const editable =
    data?.commission.status === "ACTIVE" &&
    (data.evaluation.status === "DRAFT" || data.evaluation.status === "RETURNED")

  const recognizedSummary = useMemo(
    () => calculateRecognizedSummary(data, scores),
    [data, scores]
  )
  const recognizedPoints = recognizedSummary.total
  const targetLevel = data?.process.rscDetails?.targetLevel ?? ""
  const automaticRscResult: EvaluationResult =
    recognizedPoints >= (data?.scoringTable?.minRequiredPoints ?? 60) &&
    (recognizedSummary.byRscLevel[targetLevel] ?? 0) >= 36
      ? "DEFERRED"
      : "DENIED"

  function nodePath(nodeId: number) {
    if (!data?.scoringTable) return "Pontuação"
    const nodes = new Map(data.scoringTable.nodes.map(node => [node.idScoringNode, node]))
    const names: string[] = []
    let current = nodes.get(nodeId)
    while (current) {
      names.unshift(current.name)
      current = current.parentId ? nodes.get(current.parentId) : undefined
    }
    return names.join(" / ") || "Pontuação"
  }

  function buildPayload() {
    return {
      result: data?.commission.type === "RSC" ? null : result || null,
      opinionText: opinionText.trim() || null,
      scores: Object.entries(scores)
        .filter(([, score]) => score.recognizedQuantity.trim() !== "")
        .map(([itemId, score]) => ({
          itemId: Number(itemId),
          recognizedQuantity: Number(score.recognizedQuantity),
          evaluatorComment: score.evaluatorComment.trim() || null
        }))
    }
  }

  async function persist(submit: boolean) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        submit
          ? `/api/avaliador/avaliacoes/${memberId}/enviar`
          : `/api/avaliador/avaliacoes/${memberId}`,
        {
          method: submit ? "POST" : "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload())
        }
      )
      const payload = (await response.json().catch(() => null)) as ApiResponse<EvaluationData> | null
      if (!response.ok || !payload?.data) {
        const message = payload?.message ?? "Não foi possível salvar a avaliação."
        setError(message)
        setModal({ open: true, title: "Não foi possível concluir", message, variant: "error" })
        return
      }
      applyData(payload.data)
      setModal({
        open: true,
        title: submit ? "Avaliação enviada" : "Rascunho salvo",
        message: submit
          ? "Seu parecer individual foi enviado à CPPD e não pode mais ser alterado."
          : "As informações da avaliação foram salvas.",
        variant: "success"
      })
    } catch {
      setError("Não foi possível salvar a avaliação.")
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  function FileLink({ file, label }: { file: EvidenceFile | null; label: string }) {
    if (!file) return null
    return (
      <a
        href={`/api/avaliador/avaliacoes/${memberId}/evidencias/${file.idEvidenceFile}`}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-emerald-700 hover:underline break-all"
      >
        {label}: {file.originalName}
      </a>
    )
  }

  if (loading) return <p className="mx-auto max-w-6xl py-8 text-sm text-[var(--text-secondary)]">Carregando avaliação...</p>

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <p className="text-sm text-[var(--state-danger-text)]">{error ?? "Avaliação indisponível."}</p>
        <Link href="/avaliador" className="mt-4 inline-block text-sm font-semibold underline">Voltar</Link>
      </div>
    )
  }

  const fullDetails = data.process.fullProfessorDetails
  const selectedFullFile =
    fullDetails?.evaluationMode === "THESIS" ? fullDetails.thesisFile : fullDetails?.memorialFile ?? null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <ConfirmModal
        open={confirmOpen}
        title="Enviar avaliação individual?"
        description="Após o envio, a pontuação e o parecer não poderão ser alterados."
        confirmText="Enviar avaliação"
        loading={busy}
        onConfirm={() => persist(true)}
        onCancel={() => setConfirmOpen(false)}
      />
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={() => setModal(current => ({ ...current, open: false }))}
      />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/avaliador" className="text-xs font-semibold text-[var(--text-secondary)] hover:underline">Minhas avaliações</Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Avaliação individual</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Processo #{data.process.idProcess} · {data.process.processTypeName}
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-semibold">
          {data.evaluation.status === "SUBMITTED" ? "Enviada" : data.evaluation.status === "RETURNED" ? "Devolvida" : "Rascunho"}
        </span>
      </header>

      {error && <p className="text-sm text-[var(--state-danger-text)]">{error}</p>}

      <section className="grid gap-4 border-y border-[var(--border-subtle)] py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="block text-xs text-[var(--text-secondary)]">Docente</span>{data.process.teacherName}</div>
        <div><span className="block text-xs text-[var(--text-secondary)]">SIAPE</span>{data.process.teacherSiape ?? "Não informado"}</div>
        <div><span className="block text-xs text-[var(--text-secondary)]">Campus</span>{data.process.campus}</div>
        <div><span className="block text-xs text-[var(--text-secondary)]">Portaria</span>{data.commission.ordinance ?? "Não informada"}</div>
      </section>

      <section className="space-y-3 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Documentos para análise</h2>
          <p className="text-sm text-[var(--text-secondary)]">Abra os arquivos anexados pelo docente antes de emitir o parecer.</p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <FileLink file={data.process.rscDetails?.reportFile ?? null} label="Relatório RSC" />
          <FileLink
            file={selectedFullFile}
            label={fullDetails?.evaluationMode === "THESIS" ? "Tese" : "Memorial"}
          />
          <FileLink file={fullDetails?.doctorateDegree?.evidenceFile ?? null} label="Comprovante de doutorado" />
        </div>
        {fullDetails?.doctorateDegree && (
          <p className="text-xs text-[var(--text-secondary)]">
            Doutorado: {fullDetails.doctorateDegree.course ?? "curso não informado"} · {fullDetails.doctorateDegree.institution ?? "instituição não informada"} · conclusão em {formatDate(fullDetails.doctorateDegree.conclusionDate)}
          </p>
        )}
      </section>

      {data.commission.type === "RSC" && data.scoringTable && (
        <section className="space-y-4 border-b border-[var(--border-subtle)] pb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Pontuação reconhecida</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {data.scoringTable.name} · Mínimo para deferimento: {(data.scoringTable.minRequiredPoints ?? 60).toFixed(2).replace(".", ",")}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-xs text-[var(--text-secondary)]">Total reconhecido</span>
              <strong className="text-xl text-[var(--text-primary)]">{recognizedPoints.toFixed(2).replace(".", ",")}</strong>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] md:hidden">
            {data.scoringTable.items.map(item => {
              const current = scores[item.idScoringItem] ?? { recognizedQuantity: "", evaluatorComment: "" }
              return (
                <article key={item.idScoringItem} className="space-y-3 py-4">
                  <div>
                    <span className="block text-xs text-[var(--text-secondary)]">{nodePath(item.nodeId)}</span>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{item.description}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Quantidade: {item.claimedQuantity} · Pontuação declarada: {item.claimedPoints.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Fator: {item.factor ?? 1} · Peso: {item.weight ?? 1} · Limite: {item.maxQuantity ?? "—"} {item.unit ?? "unidades"}
                    </p>
                    <FileLink file={item.evidenceFile} label="Evidência" />
                  </div>
                  <label className="block text-xs font-medium text-[var(--text-primary)]">
                    Quantidade reconhecida
                    <input
                      type="number"
                      min="0"
                      max={item.claimedQuantity}
                      step="1"
                      value={current.recognizedQuantity}
                      onChange={event => setScores(previous => ({
                        ...previous,
                        [item.idScoringItem]: { ...current, recognizedQuantity: event.target.value }
                      }))}
                      disabled={!editable || busy}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-xs font-medium text-[var(--text-primary)]">
                    Observação
                    <input
                      value={current.evaluatorComment}
                      maxLength={500}
                      onChange={event => setScores(previous => ({
                        ...previous,
                        [item.idScoringItem]: { ...current, evaluatorComment: event.target.value }
                      }))}
                      disabled={!editable || busy}
                      className={inputClass}
                    />
                  </label>
                </article>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto border-y border-[var(--border-subtle)] md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--table-header-bg)] text-xs text-[var(--text-secondary)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">Declarado</th>
                  <th className="w-36 px-3 py-2 font-semibold">Qtd. reconhecida</th>
                  <th className="w-64 px-3 py-2 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.scoringTable.items.map(item => {
                  const current = scores[item.idScoringItem] ?? { recognizedQuantity: "", evaluatorComment: "" }
                  return (
                    <tr key={item.idScoringItem}>
                      <td className="px-3 py-3 align-top">
                        <span className="block text-xs text-[var(--text-secondary)]">{nodePath(item.nodeId)}</span>
                        <span className="font-medium text-[var(--text-primary)]">{item.description}</span>
                        <span className="block text-xs text-[var(--text-secondary)]">Quantidade declarada: {item.claimedQuantity}</span>
                        <span className="block text-xs text-[var(--text-secondary)]">Fator: {item.factor ?? 1} · Peso: {item.weight ?? 1}</span>
                        <FileLink file={item.evidenceFile} label="Evidência" />
                      </td>
                      <td className="px-3 py-3 text-right align-top font-semibold">{item.claimedPoints.toFixed(2).replace(".", ",")}</td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="number"
                          min="0"
                          max={item.claimedQuantity}
                          step="1"
                          value={current.recognizedQuantity}
                          onChange={event => setScores(previous => ({
                            ...previous,
                            [item.idScoringItem]: { ...current, recognizedQuantity: event.target.value }
                          }))}
                          disabled={!editable || busy}
                          aria-label={`Quantidade reconhecida para ${item.description}`}
                          className={inputClass.replace("mt-1 ", "")}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          value={current.evaluatorComment}
                          maxLength={500}
                          onChange={event => setScores(previous => ({
                            ...previous,
                            [item.idScoringItem]: { ...current, evaluatorComment: event.target.value }
                          }))}
                          disabled={!editable || busy}
                          aria-label={`Observação para ${item.description}`}
                          className={inputClass.replace("mt-1 ", "")}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          {data.commission.type === "RSC" ? (
            <div className="text-sm font-medium text-[var(--text-primary)]">
              Resultado calculado
              <div className={inputClass}>
                {resultLabel(data.evaluation.status === "SUBMITTED"
                  ? data.evaluation.result
                  : automaticRscResult)}
              </div>
              <p className="mt-1 text-xs font-normal text-[var(--text-secondary)]">
                Regra: 60 pontos totais e 36 no nível pretendido.
              </p>
            </div>
          ) : (
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Resultado
              <select
                className={inputClass}
                value={result}
                onChange={event => setResult(event.target.value as EvaluationResult | "")}
                disabled={!editable || busy}
              >
                <option value="">Selecione</option>
                <option value="APPROVED">Aprovado</option>
                <option value="REJECTED">Reprovado</option>
              </select>
            </label>
          )}
          <div className="text-sm text-[var(--text-secondary)] sm:self-end">
            {data.evaluation.status === "SUBMITTED" && `Resultado enviado: ${resultLabel(data.evaluation.result)}`}
          </div>
        </div>
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          Parecer individual
          <textarea
            className={`${inputClass} min-h-40 resize-y`}
            value={opinionText}
            maxLength={20000}
            onChange={event => setOpinionText(event.target.value)}
            disabled={!editable || busy}
            placeholder="Registre a fundamentação da avaliação."
          />
        </label>
      </section>

      {editable && (
        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
          <button
            type="button"
            onClick={() => persist(false)}
            disabled={busy}
            className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50"
          >
            {busy ? "Salvando..." : "Salvar rascunho"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50"
          >
            Enviar avaliação
          </button>
        </div>
      )}
      {data.evaluation.status === "SUBMITTED" && (
        <div className="flex justify-end border-t border-[var(--border-subtle)] pt-5">
          <a
            href={`/api/avaliador/avaliacoes/${memberId}/parecer`}
            className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)]"
          >
            Baixar parecer em PDF
          </a>
        </div>
      )}
    </div>
  )
}
