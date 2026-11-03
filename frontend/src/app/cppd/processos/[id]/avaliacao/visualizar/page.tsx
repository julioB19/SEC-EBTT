"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type ProcessStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"

type ProcessType = "PROGRESSAO" | "PROMOCAO"

const PROCESS_STATUS_LABEL: Record<ProcessStatus, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Submetido",
  UNDER_REVIEW: "Em análise",
  RETURNED: "Devolvido",
  APPROVED: "Aprovado",
  REJECTED: "Indeferido"
}

const PROCESS_TYPE_LABEL: Record<ProcessType, string> = {
  PROGRESSAO: "Progressão",
  PROMOCAO: "Promoção"
}

function statusLabel(status: ProcessStatus) {
  return PROCESS_STATUS_LABEL[status] ?? status
}

function typeLabel(type: ProcessType) {
  return PROCESS_TYPE_LABEL[type] ?? type
}

function badgeColor(status: ProcessStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "REJECTED") return "bg-red-100 text-red-800 border-red-200"
  if (status === "RETURNED") return "bg-amber-100 text-amber-800 border-amber-200"
  if (status === "UNDER_REVIEW") return "bg-blue-100 text-blue-800 border-blue-200"
  if (status === "SUBMITTED") return "bg-slate-100 text-slate-800 border-slate-200"
  return "bg-gray-100 text-gray-700 border-gray-200"
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ")
}

function normalizeForCompare(value: string | null | undefined) {
  return normalizeText(value).toLowerCase()
}

function buildLocationLine(campusRaw: string, cidadeUFRaw: string) {
  const campus = normalizeText(campusRaw)
  const cidadeUF = normalizeText(cidadeUFRaw)

  if (!campus && !cidadeUF) return ""

  const campusNorm = normalizeForCompare(campus)
  const cidadeNorm = normalizeForCompare(cidadeUF)
  const cidadeSemUF = normalizeForCompare(cidadeUF.replace(/\s*-\s*[A-Za-z]{2}\s*$/, ""))

  const campusIgualCidade =
    campusNorm !== "" &&
    (campusNorm === cidadeNorm || campusNorm === cidadeSemUF || cidadeNorm.startsWith(campusNorm))

  if (campusIgualCidade) return cidadeUF || campus

  if (campus && cidadeUF) return `${campus} · ${cidadeUF}`
  return campus || cidadeUF
}

interface EvaluationProcessInfoDto {
  idProcess: number
  type: ProcessType
  status: ProcessStatus
  campus: string
  cidadeUF: string
  intersticeStart: string
  intersticeEnd: string
  classeOrigem: string
  nivelOrigem: string
  classeDestino: string
  nivelDestino: string
  teacherName: string
  scoringTableMinRequiredPoints?: number | null
}

interface EvaluationNodeDto {
  idScoringNode: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
}

interface EvaluationItemDto {
  idScoringItem: number
  nodeId: number
  description: string
  points: number
  unit: string | null
  hasMaxPoints: boolean
  maxPoints: number | null
  formulaKey: string | null
}

interface EvaluationScoreDto {
  idProcessScore: number
  itemId: number
  quantity: number
  awardedPoints: number
  evaluatorAwardedPoints: number | null
  evaluatorComment: string | null
  evidenceFile?: {
    idEvidenceFile: number
    originalName: string
    url: string
    sizeBytes: string | null
  } | null
}

interface EvaluationNodeScoreDto {
  nodeId: number
  totalPoints: number
  evaluatorTotalPoints: number | null
}

interface ProcessEvaluationViewDto {
  process: EvaluationProcessInfoDto
  nodes: EvaluationNodeDto[]
  items: EvaluationItemDto[]
  scores: EvaluationScoreDto[]
  nodeScores: EvaluationNodeScoreDto[]
}

interface CppdProcessDetailsDto {
  process: {
    idProcess: number
    status: ProcessStatus
    finalPoints: string | null
    evaluationOpinion: string | null
    evaluatorUserIds: any
    updatedAt: string
    user: { name: string; docente?: { siape: string } | null } | null
    table: { name: string } | null
  }
  evaluatorUsers: { idUser: number; name: string }[]
  finalization: { toStatus: ProcessStatus; createdAt: string } | null
}

interface ApiResponse<T = any> {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function formatDateISOToBr(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR")
}

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return ""
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function docentePreencheu(score: EvaluationScoreDto | null | undefined) {
  if (!score) return false
  const qty = score.quantity ?? 0
  const pts = score.awardedPoints ?? 0
  return qty > 0 || pts > 0
}

function itemAvaliado(score: EvaluationScoreDto | null | undefined) {
  if (!score) return false
  return score.evaluatorAwardedPoints !== null && score.evaluatorAwardedPoints !== undefined
}

function safeNumber(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

type TreeNode = {
  nodeId: number
  name: string
  code: string | null
  parentId: number | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
  items: EvaluationItemDto[]
  children: TreeNode[]
}

function buildTree(nodes: EvaluationNodeDto[], items: EvaluationItemDto[]): TreeNode[] {
  const map = new Map<number, TreeNode>()

  nodes.forEach(n => {
    map.set(n.idScoringNode, {
      nodeId: n.idScoringNode,
      name: n.name,
      code: n.code,
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      hasFormula: n.hasFormula,
      formulaExpression: n.formulaExpression ?? null,
      items: [],
      children: []
    })
  })

  const itemsByNode = new Map<number, EvaluationItemDto[]>()
  items.forEach(it => {
    const list = itemsByNode.get(it.nodeId) ?? []
    list.push(it)
    itemsByNode.set(it.nodeId, list)
  })

  map.forEach(node => {
    node.items = itemsByNode.get(node.nodeId)?.sort((a, b) => a.idScoringItem - b.idScoringItem) ?? []
  })

  const roots: TreeNode[] = []
  map.forEach(node => {
    if (node.parentId === null || node.parentId === undefined) roots.push(node)
    else {
      const parent = map.get(node.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })

  const sortTree = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.sortOrder - b.sortOrder)
    arr.forEach(n => sortTree(n.children))
  }

  sortTree(roots)
  return roots
}

type NodeTotalsDocente = { total: number }
type NodeTotalsCppd = { total: number }

export default function CppdAvaliacaoVisualizarPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const processId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useFeedbackState<string | null>(null, "error")

  const [view, setView] = useState<ProcessEvaluationViewDto | null>(null)
  const [details, setDetails] = useState<CppdProcessDetailsDto | null>(null)

  const [activeItemId, setActiveItemId] = useState<number | null>(null)

  function redirectToLogin() {
    const nextPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/cppd"
    router.push(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  async function fetchApi<T>(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    })

    if (res.status === 401 || res.status === 403) {
      redirectToLogin()
      return { ok: false, status: res.status, payload: null as ApiResponse<T> | null }
    }

    const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null
    return { ok: res.ok, status: res.status, payload }
  }

  useEffect(() => {
    if (!Number.isFinite(processId) || processId <= 0) return

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const r1 = await fetchApi<ProcessEvaluationViewDto>(
          `/api/cppd/processos/${processId}/avaliacao/visualizar`,
          { method: "GET" }
        )

        if (!r1.payload || !r1.ok || r1.payload.status === "error" || !r1.payload.data) {
          setView(null)
          setError(r1.payload?.message ?? "Falha ao carregar processo para visualização.")
          return
        }

        setView(r1.payload.data)

        const r2 = await fetchApi<CppdProcessDetailsDto>(
          `/api/cppd/processos/${processId}/avaliacao/detalhes`,
          { method: "GET" }
        )

        if (r2.payload && r2.ok && r2.payload.status !== "error" && r2.payload.data) {
          setDetails(r2.payload.data)
        } else {
          setDetails(null)
        }

        setActiveItemId(null)
      } catch (err) {
        console.error("Erro ao carregar visualização:", err)
        setView(null)
        setDetails(null)
        setError("Erro inesperado ao carregar visualização.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [processId])

  const scoreByItem = useMemo(() => {
    const map = new Map<number, EvaluationScoreDto>()
    if (view?.scores) view.scores.forEach(s => map.set(s.itemId, s))
    return map
  }, [view])

  const filteredItems = useMemo(() => {
    if (!view) return []
    return view.items.filter(it => docentePreencheu(scoreByItem.get(it.idScoringItem)))
  }, [view, scoreByItem])

  const treeRoots: TreeNode[] = useMemo(() => {
    if (!view) return []
    return buildTree(view.nodes, filteredItems)
  }, [view, filteredItems])

  function getCppdPoints(itemId: number): number | null {
    const s = scoreByItem.get(itemId)
    if (!s) return null
    if (s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined) {
      return safeNumber(s.evaluatorAwardedPoints)
    }
    return null
  }

  function getDocenteQuantityForFormula(item: EvaluationItemDto) {
    const s = scoreByItem.get(item.idScoringItem)
    return s ? safeNumber(s.quantity) : 0
  }

  function getCppdQuantityForFormula(item: EvaluationItemDto) {
    const s = scoreByItem.get(item.idScoringItem)
    if (!s) return 0

    const cppdPoints = getCppdPoints(item.idScoringItem)
    const pointsEffective = cppdPoints !== null ? cppdPoints : safeNumber(s.awardedPoints)

    const unitPoints = safeNumber(item.points)
    if (unitPoints > 0) return pointsEffective / unitPoints

    return safeNumber(s.quantity)
  }

  function evalFormula(node: TreeNode, vars: Record<string, number>, fallback: number) {
    try {
      const argNames = Object.keys(vars)
      const argValues = Object.values(vars)

      if (argNames.length === 0) return fallback

      const fn = new Function(...argNames, `return ${node.formulaExpression};`) as (...args: number[]) => number
      const result = fn(...argValues)
      const num = Number(result)

      return Number.isFinite(num) ? num : fallback
    } catch (e) {
      console.error("Erro avaliando fórmula do bloco", node.nodeId, e)
      return fallback
    }
  }

  function computeNodeTotalDocente(node: TreeNode): NodeTotalsDocente {
    const baseSum = node.items.reduce((acc, item) => {
      const s = scoreByItem.get(item.idScoringItem)
      return acc + (s && docentePreencheu(s) ? safeNumber(s.awardedPoints) : 0)
    }, 0)

    let selfTotal = baseSum

    if (node.hasFormula && node.formulaExpression) {
      const vars: Record<string, number> = {}
      node.items.forEach(item => {
        if (!item.formulaKey) return
        vars[item.formulaKey] = getDocenteQuantityForFormula(item)
      })

      selfTotal = evalFormula(node, vars, baseSum)
    }

    const childrenSum = node.children.reduce((acc, child) => acc + computeNodeTotalDocente(child).total, 0)

    return { total: selfTotal + childrenSum }
  }

  function computeNodeTotalCppd(node: TreeNode): NodeTotalsCppd {
    const baseSum = node.items.reduce((acc, item) => {
      const s = scoreByItem.get(item.idScoringItem)
      if (!s || !docentePreencheu(s)) return acc

      const v =
        s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
          ? safeNumber(s.evaluatorAwardedPoints)
          : safeNumber(s.awardedPoints)

      return acc + v
    }, 0)

    let selfTotal = baseSum

    if (node.hasFormula && node.formulaExpression) {
      const vars: Record<string, number> = {}
      node.items.forEach(item => {
        if (!item.formulaKey) return
        vars[item.formulaKey] = getCppdQuantityForFormula(item)
      })

      selfTotal = evalFormula(node, vars, baseSum)
    }

    const childrenSum = node.children.reduce((acc, child) => acc + computeNodeTotalCppd(child).total, 0)

    return { total: selfTotal + childrenSum }
  }

  const overallTotals = useMemo(() => {
    if (!view) return { docenteTotal: 0, cppdTotal: 0 }

    const docenteTotal = treeRoots.reduce((acc, root) => acc + safeNumber(computeNodeTotalDocente(root).total), 0)
    const cppdTotal = treeRoots.reduce((acc, root) => acc + safeNumber(computeNodeTotalCppd(root).total), 0)

    return { docenteTotal, cppdTotal }
  }, [view, treeRoots])

  const currentScore = useMemo(() => {
    if (activeItemId === null) return null
    return scoreByItem.get(activeItemId) ?? null
  }, [activeItemId, scoreByItem])

  const currentEvidence = currentScore?.evidenceFile ?? null
  const currentEvidenceUrl =
    currentEvidence != null
      ? `/api/cppd/processos/${processId}/avaliacao/evidencias/${currentEvidence.idEvidenceFile}/conteudo`
      : null

  const opinion = details?.process?.evaluationOpinion ?? ""

  async function handleCopyParecer() {
    try {
      const md = opinion || ""
      if (!md.trim()) return

      const supportsRich =
        typeof window !== "undefined" &&
        "ClipboardItem" in window &&
        !!navigator.clipboard?.write

      if (supportsRich) {
        const html = document.querySelector("#parecer-renderizado")?.innerHTML ?? ""

        const item = new ClipboardItem({
          "text/plain": new Blob([md], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        })

        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(md)
      }
    } catch (err) {
      console.error("Erro ao copiar parecer:", err)
    }
  }

  if (!Number.isFinite(processId) || processId <= 0) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-primary)]">ID de processo inválido.</p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-secondary)]">Carregando visualização...</p>
        </div>
      </main>
    )
  }

  if (error || !view) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8 space-y-4">
          <h1 className="text-2xl font-semibold">Consulta da avaliação</h1>
          <p className="text-sm text-[var(--text-secondary)]">Não foi possível exibir esta avaliação. Confira a situação do processo e tente novamente.</p>

          <></>
        </div>
      </main>
    )
  }

  const process = view.process
  const locationLine = buildLocationLine(process.campus, process.cidadeUF)

  function renderItemRow(item: EvaluationItemDto) {
    const score = scoreByItem.get(item.idScoringItem) ?? null
    const docenteFilled = docentePreencheu(score)
    if (!docenteFilled) return null

    const avaliado = itemAvaliado(score)

    const docentePointsValue = score ? score.awardedPoints ?? 0 : null
    const cppdSavedPoints =
      score?.evaluatorAwardedPoints !== null && score?.evaluatorAwardedPoints !== undefined
        ? score.evaluatorAwardedPoints
        : null

    const changedByCppd =
      avaliado &&
      score &&
      score.evaluatorAwardedPoints !== null &&
      Number(score.evaluatorAwardedPoints) !== Number(score.awardedPoints)

    return (
      <div
        key={item.idScoringItem}
        className={
          "border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--surface-muted-bg)] " +
          "hover:bg-[var(--surface-muted-hover)] cursor-pointer " +
          (activeItemId === item.idScoringItem ? " ring-1 ring-[var(--border-strong)]" : "")
        }
        onClick={() => setActiveItemId(item.idScoringItem)}
      >
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {avaliado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium px-2 py-0.5 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Avaliado
                  </span>
                )}

                {changedByCppd && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-medium px-2 py-0.5 border border-indigo-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Pontuação alterada
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-start gap-2 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)] break-words min-w-0">
                  {item.description}
                </span>

                {item.formulaKey && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold
                               bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                               text-[var(--text-primary)] shrink-0"
                    title="Variável usada na fórmula do bloco"
                  >
                    {item.formulaKey}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-row items-center gap-2 shrink-0 whitespace-nowrap">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                           bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                           text-[var(--text-primary)] w-fit"
              >
                Docente:
                <span className="ml-1 font-semibold">
                  {docentePointsValue !== null ? formatNumber(docentePointsValue) : "—"} pts
                </span>
              </span>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                           bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                           text-[var(--text-primary)] w-fit"
              >
                CPPD:
                <span className="ml-1 font-semibold">
                  {cppdSavedPoints !== null ? formatNumber(cppdSavedPoints) : "—"} pts
                </span>
              </span>
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)]">
            Unidade: {item.unit ?? "-"} · Pontos por unidade:{" "}
            <span className="font-medium">{formatNumber(item.points)}</span>
            {item.hasMaxPoints && item.maxPoints !== null && (
              <>
                {" "}
                · Máx: <span className="font-medium">{formatNumber(item.maxPoints)}</span> pts
              </>
            )}
          </div>

          {score?.evaluatorComment && score.evaluatorComment.trim() !== "" && (
            <div className="text-[11px] text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">Comentário:</span>{" "}
              {score.evaluatorComment}
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderNode(node: TreeNode) {
    const label = node.code ? `${node.code} - ${node.name}` : node.name

    const docenteTotals = computeNodeTotalDocente(node)
    const cppdTotals = computeNodeTotalCppd(node)

    const hasAnyItemHere = node.items.length > 0
    const hasAnyChildVisible = node.children.some(c => true)
    if (!hasAnyItemHere && !hasAnyChildVisible) return null

    return (
      <div key={node.nodeId} className="space-y-3">
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
              {node.hasFormula && node.formulaExpression && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Bloco com cálculo automático
                </div>
              )}
            </div>
          </div>

          {node.items.length > 0 && (
            <div className="space-y-3">
              {node.items.map(item => renderItemRow(item)).filter(Boolean)}
            </div>
          )}

          {node.children.length > 0 && (
            <div className="mt-4 border-l-2 border-dashed border-[var(--border-subtle)] pl-4 space-y-4">
              {node.children.map(child => renderNode(child)).filter(Boolean)}
            </div>
          )}

          {node.items.length === 0 && node.children.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">Nenhuma atividade cadastrada neste bloco.</p>
          )}

          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-[var(--text-muted)]">Resumo deste bloco</div>

            <div className="flex flex-col items-end text-[var(--text-secondary)] text-[11px]">
              <span>Total de pontos (docente):</span>
              <span className="font-semibold text-[var(--text-primary)]">{formatNumber(docenteTotals.total)} pts</span>

              <span className="mt-1">Total de pontos (CPPD):</span>
              <span className="font-semibold text-[var(--text-primary)]">{formatNumber(cppdTotals.total)} pts</span>

              {node.hasFormula && node.formulaExpression && (
                <span className="mt-2 text-[10px] text-[var(--text-muted)] text-right whitespace-nowrap">
                  Fórmula: <span className="font-semibold text-[var(--text-primary)]">{node.formulaExpression}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Avaliação (somente leitura)</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Processo #{process.idProcess} · {process.teacherName}
            </p>

            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span
                className={
                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border " +
                  badgeColor(process.status)
                }
                title={process.status}
              >
                {statusLabel(process.status)}
              </span>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                           bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                           text-[var(--text-primary)]"
              >
                Tipo: <span className="ml-1 font-semibold">{typeLabel(process.type)}</span>
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {locationLine}
              {locationLine ? " · " : ""}
              Interstício {formatDateISOToBr(process.intersticeStart)} a {formatDateISOToBr(process.intersticeEnd)} ·{" "}
              {process.classeOrigem}
              {process.nivelOrigem} → {process.classeDestino}
              {process.nivelDestino}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <></>
          </div>
        </header>

        {details && (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap gap-2">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                               bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                               text-[var(--text-primary)]"
              >
                Atualizado: <span className="ml-1 font-semibold">{formatDateTime(details.process.updatedAt)}</span>
              </span>

              {details.finalization && (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                                 bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                                 text-[var(--text-primary)]"
                >
                  Finalizado em: <span className="ml-1 font-semibold">{formatDateTime(details.finalization.createdAt)}</span>
                </span>
              )}
            </div>

            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">Membros avaliadores:</span>{" "}
              {details.evaluatorUsers.length === 0 ? "—" : details.evaluatorUsers.map(u => u.name).join(", ")}
            </div>
          </section>
        )}

        {details && (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Parecer</div>

              <button
                type="button"
                onClick={handleCopyParecer}
                className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                           text-xs text-[var(--btn-secondary-text)]
                           hover:bg-[var(--btn-secondary-hover-bg)] transition"
              >
                Copiar parecer
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted-bg)] p-4">
              <div id="parecer-renderizado" className="prose prose-sm max-w-none">
                {opinion.trim() === "" ? (
                  <p className="text-xs text-[var(--text-secondary)]">Nenhum parecer registrado.</p>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{opinion}</ReactMarkdown>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-col md:flex-row gap-4 md:items-start">
          <div className="w-full md:w-1/2 space-y-4">
            {treeRoots.length === 0 && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm text-sm text-[var(--text-secondary)]">
                Nenhum item foi preenchido pelo docente neste processo.
              </div>
            )}

            {treeRoots.map(node => renderNode(node)).filter(Boolean)}

            <div className="mt-3 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] text-[var(--text-secondary)]">Pontuação total (somente itens preenchidos)</div>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                                 bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                                 text-[var(--text-primary)]"
                >
                  Docente:
                  <span className="ml-1 font-semibold">{formatNumber(overallTotals.docenteTotal)} pts</span>
                </span>

                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                                 bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                                 text-[var(--text-primary)]"
                >
                  CPPD:
                  <span className="ml-1 font-semibold">{formatNumber(overallTotals.cppdTotal)} pts</span>
                </span>
                
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 md:sticky md:top-4 self-start">
            <div
              className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                          rounded-2xl p-4 shadow-sm min-h-[400px] md:min-h-[500px]
                          flex flex-col"
            >
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Comprovante anexado</h2>

              {!activeItemId && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Selecione um item preenchido pelo docente para visualizar o comprovante correspondente.
                </p>
              )}

              {activeItemId && !currentEvidence && (
                <p className="text-xs text-[var(--text-secondary)]">O item selecionado não possui comprovante anexado.</p>
              )}

              {activeItemId && currentEvidence && currentEvidenceUrl && (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-primary)] truncate">{currentEvidence.originalName}</p>
                      {currentEvidence.sizeBytes && (
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Tamanho: {currentEvidence.sizeBytes} bytes
                        </p>
                      )}
                    </div>
                    <a
                      href={currentEvidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-[var(--link-primary)] hover:underline"
                    >
                      Abrir em nova aba
                    </a>
                  </div>

                  <div className="mt-2 border border-[var(--border-subtle)] rounded-xl overflow-hidden h-[60vh] md:h-[70vh]">
                    <iframe src={currentEvidenceUrl} className="w-full h-full bg-[var(--surface-muted)]" />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
