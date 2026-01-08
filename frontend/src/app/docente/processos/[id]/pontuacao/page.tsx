// src/app/docente/processos/[id]/pontuacao/page.tsx
"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Modal from "@/components/Modal"

type ProcessType = "PROGRESSAO" | "PROMOCAO"

type ProcessStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"

type ModalVariant = "success" | "error" | "info"

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

type Evidence = {
  evidenceFileId: number
  originalName: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
}

type CurrentScore = {
  processScoreId: number
  quantity: number
  awardedPoints: string
  evidences: Evidence[]
}

type ScoringItem = {
  itemId: number
  description: string
  unit: string | null
  points: string | number
  hasMaxPoints: boolean
  maxPoints?: string | number | null
  active: boolean
  formulaKey: string | null
  currentScore: CurrentScore | null
}

type BlockNode = {
  nodeId: number
  name: string
  code: string | null
  parentId: number | null
  sortOrder: number
  items: ScoringItem[]
  hasFormula: boolean
  formulaExpression: string | null
  totalPoints: number | null
}

type EstruturaPontuacao = {
  processId: number
  scoringTableId: number
  type: ProcessType
  status: ProcessStatus
  blocks: BlockNode[]
}

type TreeNode = {
  nodeId: number
  name: string
  code: string | null
  parentId: number | null
  sortOrder: number
  items: ScoringItem[]
  children: TreeNode[]
  hasFormula: boolean
  formulaExpression: string | null
  totalPoints: number | null
}

type UserEvidenceFile = {
  evidenceFileId: number
  originalName: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedAt: string
}

type EvidenceModalMode = "attachRequired" | "change"

type EvidenceModalState = {
  open: boolean
  itemId: number | null
  mode: EvidenceModalMode
  existingEvidence: Evidence | null
  files: UserEvidenceFile[]
  loading: boolean
}

type PendingScore = {
  itemId: number
  quantity: number
  awardedPoints: string
}

// ícones simples em SVG
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
        fill="currentColor"
      />
    </svg>
  )
}

function FileSwapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm5 1.5V9h4.5L13 4.5ZM9 13h6v1.5H9V13Zm0 3h4v1.5H9V16Z"
        fill="currentColor"
      />
    </svg>
  )
}

// helper pra atualizar item recursivamente na árvore
function updateItemInTree(
  nodes: TreeNode[],
  itemId: number,
  updater: (item: ScoringItem) => ScoringItem
): TreeNode[] {
  return nodes.map(node => ({
    ...node,
    items: node.items.map(item =>
      item.itemId === itemId ? updater(item) : item
    ),
    children: updateItemInTree(node.children, itemId, updater)
  }))
}

function statusLabel(status: ProcessStatus) {
  switch (status) {
    case "DRAFT":
      return "Rascunho"
    case "SUBMITTED":
      return "Submetido"
    case "UNDER_REVIEW":
      return "Em análise"
    case "RETURNED":
      return "Devolvido"
    case "APPROVED":
      return "Aprovado"
    case "REJECTED":
      return "Indeferido"
    default:
      return status
  }
}

function badgeColor(status: ProcessStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800"
  if (status === "REJECTED") return "bg-red-100 text-red-800"
  if (status === "RETURNED") return "bg-amber-100 text-amber-800"
  if (status === "UNDER_REVIEW") return "bg-blue-100 text-blue-800"
  if (status === "SUBMITTED") return "bg-slate-100 text-slate-800"
  return "bg-gray-100 text-gray-700"
}

function formatPoints(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function ProcessoPontuacaoPage() {
  const params = useParams()
  const id = (params as any)?.id as string | undefined

  const [estrutura, setEstrutura] = useState<EstruturaPontuacao | null>(null)
  const [treeRoots, setTreeRoots] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [savingItemId, setSavingItemId] = useState<number | null>(null)
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  const [pendingScore, setPendingScore] = useState<PendingScore | null>(null)

  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalState>({
    open: false,
    itemId: null,
    mode: "change",
    existingEvidence: null,
    files: [],
    loading: false
  })

  const [previewEvidence, setPreviewEvidence] = useState<Evidence | null>(null)

  const [itemForm, setItemForm] = useState<
    Record<
      number,
      {
        quantity: string
        awardedPoints: string
      }
    >
  >({})

  function openModal(payload: Omit<ModalState, "open">) {
    setModal({
      open: true,
      ...payload
    })
  }

  function closeModal() {
    setModal(prev => ({ ...prev, open: false }))
  }

  function buildTree(blocks: BlockNode[]): TreeNode[] {
    const map = new Map<number, TreeNode>()

    blocks.forEach(b => {
      map.set(b.nodeId, {
        nodeId: b.nodeId,
        name: b.name,
        code: b.code,
        parentId: b.parentId,
        sortOrder: b.sortOrder,
        items: b.items,
        children: [],
        hasFormula: b.hasFormula,
        formulaExpression: b.formulaExpression,
        totalPoints: b.totalPoints
      })
    })

    const roots: TreeNode[] = []

    map.forEach(node => {
      if (node.parentId === null || node.parentId === undefined) {
        roots.push(node)
      } else {
        const parent = map.get(node.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      }
    })

    const sortTree = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder)
      nodes.forEach(n => sortTree(n.children))
    }

    sortTree(roots)
    return roots
  }

  const carregarEstrutura = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setError(null)

    try {
      const r = await fetch(`/api/processos/${id}/pontuacao/estrutura`, {
        method: "GET",
        credentials: "include"
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<EstruturaPontuacao>

      if (!r.ok) {
        setError(json?.message || "Erro ao carregar estrutura de pontuação")
        setEstrutura(null)
        setTreeRoots([])
        return
      }

      if (!json?.data) {
        setError("Estrutura de pontuação não encontrada")
        setEstrutura(null)
        setTreeRoots([])
        return
      }

      const data = json.data
      setEstrutura(data)

      const tree = buildTree(data.blocks)
      setTreeRoots(tree)

      const formState: typeof itemForm = {}
      data.blocks.forEach(block => {
        block.items.forEach(item => {
          const current = item.currentScore
          formState[item.itemId] = {
            quantity: current ? String(current.quantity) : "",
            awardedPoints: current ? String(current.awardedPoints) : ""
          }
        })
      })
      setItemForm(formState)
    } catch (e: any) {
      setError(e?.message || "Erro inesperado ao carregar estrutura de pontuação")
      setEstrutura(null)
      setTreeRoots([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    carregarEstrutura()
  }, [carregarEstrutura])

  const canEditScores =
    estrutura &&
    (estrutura.status === "DRAFT" ||
      estrutura.status === "RETURNED" ||
      estrutura.status === "REJECTED")

  const totalProcessPoints = useMemo(() => {
    if (!treeRoots || treeRoots.length === 0) return 0

    return treeRoots.reduce((acc, node) => acc + computeNodeTotal(node), 0)
  }, [treeRoots])

  const hasMinimumPoints = totalProcessPoints >= 120

  async function loadUserEvidenceFiles() {
    try {
      const r = await fetch("/api/evidencias/arquivos", {
        method: "GET",
        credentials: "include"
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<
        UserEvidenceFile[]
      >

      if (!r.ok) {
        openModal({
          title: "Erro ao carregar arquivos",
          message:
            json?.message ||
            "Não foi possível listar os arquivos de evidência já enviados.",
          variant: "error"
        })
        return []
      }

      return json.data || []
    } catch (e: any) {
      openModal({
        title: "Erro ao carregar arquivos",
        message:
          e?.message ||
          "Ocorreu um erro inesperado ao buscar os arquivos de evidência.",
        variant: "error"
      })
      return []
    }
  }

  async function openEvidenceModalForItem(
    itemId: number,
    mode: EvidenceModalMode,
    existingEvidence: Evidence | null
  ) {
    setEvidenceModal({
      open: true,
      itemId,
      mode,
      existingEvidence,
      files: [],
      loading: true
    })

    const files = await loadUserEvidenceFiles()

    setEvidenceModal(prev => ({
      ...prev,
      files,
      loading: false
    }))
  }

  function closeEvidenceModal() {
    setEvidenceModal(prev => ({
      ...prev,
      open: false,
      itemId: null,
      existingEvidence: null
    }))
  }

  function handleChangeQuantity(item: ScoringItem, value: string) {
    if (!canEditScores) return

    if (activeItemId !== null && activeItemId !== item.itemId) {
      openModal({
        title: "Finalize o item atual",
        message:
          "Conclua o preenchimento (salvar pontuação e anexar comprovante) do item em edição antes de iniciar outro.",
        variant: "info"
      })
      return
    }

    if (activeItemId === null) {
      setActiveItemId(item.itemId)
    }

    setItemForm(prev => {
      const prevItem = prev[item.itemId] || { quantity: "", awardedPoints: "" }

      if (item.hasMaxPoints) {
        return {
          ...prev,
          [item.itemId]: {
            ...prevItem,
            quantity: value
          }
        }
      }

      const quantityNumber =
        value === "" || value === null ? 0 : Number(value)

      let newPoints = 0
      if (!Number.isNaN(quantityNumber) && quantityNumber >= 0) {
        const base = Number(item.points)
        if (!Number.isNaN(base)) {
          newPoints = quantityNumber * base
        }
      }

      return {
        ...prev,
        [item.itemId]: {
          quantity: value,
          awardedPoints: newPoints.toFixed(2)
        }
      }
    })
  }

  function handleChangePoints(item: ScoringItem, value: string) {
    if (!canEditScores) return

    const itemId = item.itemId

    if (activeItemId !== null && activeItemId !== itemId) {
      openModal({
        title: "Finalize o item atual",
        message:
          "Conclua o preenchimento (salvar pontuação e anexar comprovante) do item em edição antes de iniciar outro.",
        variant: "info"
      })
      return
    }

    if (activeItemId === null) {
      setActiveItemId(itemId)
    }

    setItemForm(prev => ({
      ...prev,
      [itemId]: {
        quantity: prev[itemId]?.quantity ?? "",
        awardedPoints: value
      }
    }))
  }

  function handleCancelItemEdition(item: ScoringItem) {
    setItemForm(prev => ({
      ...prev,
      [item.itemId]: {
        quantity: item.currentScore ? String(item.currentScore.quantity) : "",
        awardedPoints: item.currentScore
          ? String(item.currentScore.awardedPoints)
          : ""
      }
    }))

    setPendingScore(prev => (prev && prev.itemId === item.itemId ? null : prev))

    setActiveItemId(null)
  }

  // atualiza só um item na estrutura e na árvore depois de salvar pontuação
  function applySavedScoreToState(itemId: number, data: any) {
    const newEvidenceArray: Evidence[] =
      data.evidence != null
        ? [
          {
            evidenceFileId: data.evidence.evidenceFileId,
            originalName: data.evidence.originalName,
            url: data.evidence.url,
            mimeType: data.evidence.mimeType,
            sizeBytes: data.evidence.sizeBytes
          }
        ]
        : []

    setEstrutura(prev => {
      if (!prev) return prev

      return {
        ...prev,
        blocks: prev.blocks.map(block => ({
          ...block,
          items: block.items.map(i => {
            if (i.itemId !== itemId) return i

            return {
              ...i,
              currentScore: {
                processScoreId: data.processScoreId,
                quantity: data.quantity,
                awardedPoints: data.awardedPoints,
                evidences: newEvidenceArray
              }
            }
          })
        }))
      }
    })

    setTreeRoots(prev =>
      updateItemInTree(prev, itemId, i => {
        return {
          ...i,
          currentScore: {
            processScoreId: data.processScoreId,
            quantity: data.quantity,
            awardedPoints: data.awardedPoints,
            evidences: newEvidenceArray
          }
        }
      })
    )

    setItemForm(prev => ({
      ...prev,
      [itemId]: {
        quantity: String(data.quantity),
        awardedPoints: String(data.awardedPoints)
      }
    }))
  }

  function computeNodeTotal(node: TreeNode): number {
    // 1) soma simples dos pontos dos itens do bloco
    const baseSum = node.items.reduce((acc, item) => {
      const pts = item.currentScore
        ? Number(item.currentScore.awardedPoints)
        : 0

      return acc + (Number.isNaN(pts) ? 0 : pts)
    }, 0)

    // 2) total "do próprio bloco" (sem considerar filhos ainda)
    let selfTotal = baseSum

    // se tiver fórmula, aplicamos em cima das variáveis dos itens
    if (node.hasFormula && node.formulaExpression) {
    const vars: Record<string, number> = {}

    node.items.forEach(item => {
      if (!item.formulaKey) return

      const val = item.currentScore
        ? Number(item.currentScore.quantity)
        : 0

      vars[item.formulaKey] = Number.isNaN(val) ? 0 : val
    })

    try {
      const argNames = Object.keys(vars)
      const argValues = Object.values(vars)

      if (argNames.length > 0) {
        const fn = new Function(
          ...argNames,
          `return ${node.formulaExpression};`
        ) as (...args: number[]) => number

        const result = fn(...argValues)
        const num = Number(result)

        selfTotal = Number.isFinite(num) ? num : baseSum
      } else {
        selfTotal = baseSum
      }
    } catch (e) {
      console.error("Erro avaliando fórmula do bloco", node.nodeId, e)
      selfTotal = baseSum
    }
  }

    // 3) soma recursiva dos filhos
    const childrenSum = node.children.reduce(
      (acc, child) => acc + computeNodeTotal(child),
      0
    )

    // 4) total final = o que pertence a este bloco + tudo que está abaixo dele
    return selfTotal + childrenSum
  }

  // atualiza só evidência de um item (estrutura + árvore)
  function applyEvidenceUpdateToState(itemId: number, data: any) {
    const newEvidence: Evidence = {
      evidenceFileId: data.evidence.evidenceFileId,
      originalName: data.evidence.originalName,
      url: data.evidence.url,
      mimeType: data.evidence.mimeType,
      sizeBytes: data.evidence.sizeBytes
    }

    setEstrutura(prev => {
      if (!prev) return prev

      return {
        ...prev,
        blocks: prev.blocks.map(block => ({
          ...block,
          items: block.items.map(i => {
            if (i.itemId !== itemId) return i

            const current = i.currentScore
            if (current) {
              return {
                ...i,
                currentScore: {
                  ...current,
                  processScoreId: data.processScoreId,
                  evidences: [newEvidence]
                }
              }
            }

            return {
              ...i,
              currentScore: {
                processScoreId: data.processScoreId,
                quantity: 0,
                awardedPoints: "0.00",
                evidences: [newEvidence]
              }
            }
          })
        }))
      }
    })

    setTreeRoots(prev =>
      updateItemInTree(prev, itemId, i => {
        const current = i.currentScore
        if (current) {
          return {
            ...i,
            currentScore: {
              ...current,
              processScoreId: data.processScoreId,
              evidences: [newEvidence]
            }
          }
        }

        return {
          ...i,
          currentScore: {
            processScoreId: data.processScoreId,
            quantity: 0,
            awardedPoints: "0.00",
            evidences: [newEvidence]
          }
        }
      })
    )
  }

  async function salvarPontuacaoFinal(
    itemId: number,
    quantityNumber: number,
    awardedPointsToSend: string
  ) {
    if (!estrutura || !id) return

    setSavingItemId(itemId)

    try {
      const r = await fetch(`/api/processos/${id}/itens/${itemId}/pontuacao`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          quantity: quantityNumber,
          awardedPoints: awardedPointsToSend
        })
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<any>

      if (!r.ok) {
        openModal({
          title: "Erro ao salvar pontuação",
          message: json?.message || "Não foi possível salvar a pontuação deste item.",
          variant: "error"
        })
        return
      }

      if (json?.data) {
        applySavedScoreToState(itemId, json.data)
      }

      openModal({
        title: "Pontuação salva",
        message: "Pontuação do item salva com sucesso.",
        variant: "success"
      })

      setActiveItemId(null)
      setPendingScore(prev => (prev && prev.itemId === itemId ? null : prev))
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao salvar a pontuação.",
        variant: "error"
      })
    } finally {
      setSavingItemId(null)
    }
  }

  async function handleSalvarItem(itemId: number) {
    if (!estrutura || !id) return

    const item = estrutura.blocks.flatMap(b => b.items).find(i => i.itemId === itemId)
    if (!item) {
      openModal({
        title: "Erro",
        message: "Item de pontuação não encontrado na estrutura.",
        variant: "error"
      })
      return
    }

    const form = itemForm[itemId] || { quantity: "", awardedPoints: "" }

    let quantityNumber = 0
    let awardedPointsToSend = "0"
    let finalPointsNumber = 0

    if (item.hasMaxPoints) {
      const pointsNumber =
        form.awardedPoints === "" || form.awardedPoints === null
          ? 0
          : Number(form.awardedPoints)

      if (Number.isNaN(pointsNumber) || pointsNumber < 0) {
        openModal({
          title: "Valor inválido",
          message: "Informe um valor numérico válido para a pontuação.",
          variant: "error"
        })
        return
      }

      let maxAllowed: number | null = null
      if (item.maxPoints !== null && item.maxPoints !== undefined) {
        maxAllowed = Number(item.maxPoints)
      } else if (item.points !== null && item.points !== undefined) {
        maxAllowed = Number(item.points)
      }

      if (
        maxAllowed !== null &&
        !Number.isNaN(maxAllowed) &&
        pointsNumber > maxAllowed
      ) {
        openModal({
          title: "Pontuação acima do permitido",
          message:
            "O valor informado ultrapassa o máximo permitido para este item. Por favor, revise e ajuste a pontuação antes de salvar.",
          variant: "error"
        })
        return
      }

      quantityNumber = 0
      finalPointsNumber = pointsNumber
      awardedPointsToSend = pointsNumber.toFixed(2)
    } else {
      quantityNumber =
        form.quantity === "" || form.quantity === null ? 0 : Number(form.quantity)

      if (Number.isNaN(quantityNumber) || quantityNumber < 0) {
        openModal({
          title: "Valor inválido",
          message: "Informe uma quantidade numérica maior ou igual a zero.",
          variant: "error"
        })
        return
      }

      const base = Number(item.points)
      const autoPoints =
        !Number.isNaN(base) && quantityNumber >= 0 ? quantityNumber * base : 0

      finalPointsNumber = autoPoints
      awardedPointsToSend = autoPoints.toFixed(2)
    }

    const hasEvidence =
      item.currentScore &&
      item.currentScore.evidences &&
      item.currentScore.evidences.length > 0

    if (finalPointsNumber > 0 && !hasEvidence) {
      setPendingScore({
        itemId,
        quantity: quantityNumber,
        awardedPoints: awardedPointsToSend
      })

      await openEvidenceModalForItem(itemId, "attachRequired", null)

      return
    }

    await salvarPontuacaoFinal(itemId, quantityNumber, awardedPointsToSend)
  }

  async function handleUploadEvidenceFromModal(file: File | null) {
    if (!file || !estrutura || !id || !evidenceModal.itemId) return

    const itemId = evidenceModal.itemId
    setUploadingItemId(itemId)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const r = await fetch(
        `/api/processos/${id}/pontuacao/itens/${itemId}/evidencias`,
        {
          method: "POST",
          credentials: "include",
          body: formData
        }
      )

      const json = (await r.json().catch(() => null)) as ApiResponse<any>

      if (!r.ok) {
        openModal({
          title: "Erro ao anexar evidência",
          message: json?.message || "Não foi possível anexar o arquivo.",
          variant: "error"
        })
        return
      }

      if (json?.data) {
        applyEvidenceUpdateToState(itemId, json.data)
      }

      if (pendingScore && pendingScore.itemId === itemId) {
        await salvarPontuacaoFinal(
          pendingScore.itemId,
          pendingScore.quantity,
          pendingScore.awardedPoints
        )
      }

      closeEvidenceModal()
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao anexar o arquivo.",
        variant: "error"
      })
    } finally {
      setUploadingItemId(null)
    }
  }

  async function handleReuseEvidenceFromModal(fileId: number) {
    if (!estrutura || !id || !evidenceModal.itemId) return

    const itemId = evidenceModal.itemId
    setUploadingItemId(itemId)

    try {
      const r = await fetch(
        `/api/processos/${id}/pontuacao/itens/${itemId}/evidencias/reusar`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ evidenceFileId: fileId })
        }
      )

      const json = (await r.json().catch(() => null)) as ApiResponse<any>

      if (!r.ok) {
        openModal({
          title: "Erro ao reutilizar evidência",
          message: json?.message || "Não foi possível reutilizar este arquivo.",
          variant: "error"
        })
        return
      }

      if (json?.data) {
        applyEvidenceUpdateToState(itemId, json.data)
      }

      if (pendingScore && pendingScore.itemId === itemId) {
        await salvarPontuacaoFinal(
          pendingScore.itemId,
          pendingScore.quantity,
          pendingScore.awardedPoints
        )
      }

      closeEvidenceModal()
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao vincular o arquivo.",
        variant: "error"
      })
    } finally {
      setUploadingItemId(null)
    }
  }

  function renderItemRow(item: ScoringItem) {
    const form = itemForm[item.itemId] || {
      quantity: "",
      awardedPoints: ""
    }

    const hasEvidence =
      item.currentScore &&
      item.currentScore.evidences &&
      item.currentScore.evidences.length > 0

    const evidence = hasEvidence ? item.currentScore!.evidences[0] : null

    const isMaxItem = item.hasMaxPoints

    const maxValueRaw =
      item.maxPoints !== null && item.maxPoints !== undefined
        ? item.maxPoints
        : item.hasMaxPoints
          ? item.points
          : null

    const maxValue =
      maxValueRaw !== null && maxValueRaw !== undefined
        ? Number(maxValueRaw)
        : null

    const maxLabel =
      maxValue !== null && !Number.isNaN(maxValue)
        ? formatPoints(maxValue)
        : null

    const previewPoints =
      !isMaxItem && form.awardedPoints
        ? formatPoints(form.awardedPoints)
        : isMaxItem && form.awardedPoints
          ? formatPoints(form.awardedPoints)
          : "0,00"

    const isLockedByAnother =
      activeItemId !== null && activeItemId !== item.itemId

    const isThisActive = activeItemId === item.itemId

    const hasScore =
      item.currentScore &&
      (Number(item.currentScore.awardedPoints) > 0 ||
        Number(item.currentScore.quantity) > 0)

    const showEvidenceArea = Boolean(hasScore)

    let exceedsMax = false
    if (isMaxItem && maxValue !== null && !Number.isNaN(maxValue)) {
      const numeric = Number(form.awardedPoints)
      if (!Number.isNaN(numeric) && numeric > maxValue) {
        exceedsMax = true
      }
    }

    return (
      <div
        key={item.itemId}
        className={
          "border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--surface-muted-bg)] flex flex-col gap-2 " +
          (isThisActive ? "border-blue-400 shadow-sm" : "")
        }
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {item.description}
              </div>

              {hasScore && !isThisActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium px-2 py-0.5 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Item preenchido
                </span>
              )}

              {isThisActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Em edição
                </span>
              )}
            </div>

            {!isMaxItem && (
              <div className="text-xs text-[var(--text-muted)]">
                <span className="font-medium">
                  {formatPoints(item.points)}
                </span>{" "}
                {Number(item.points) > 1 ? "pontos" : "ponto"} para cada{" "}
                <span className="font-medium">
                  {item.unit || "unidade"}
                </span>
              </div>
            )}

            {isMaxItem && maxLabel && (
              <div
                className={
                  "text-xs " +
                  (exceedsMax
                    ? "text-red-600 font-medium"
                    : "text-[var(--text-muted)]")
                }
              >
                Pontuação máxima neste item:{" "}
                <span className="font-medium">{maxLabel} pontos</span>.
              </div>
            )}

            {isThisActive && (
              <div className="text-[11px] text-blue-600">
                Você está preenchendo este item. Salve a pontuação e anexe o
                comprovante antes de iniciar outro.
              </div>
            )}

            {isMaxItem && exceedsMax && (
              <div className="text-[11px] text-red-600">
                Valor informado ultrapassa o máximo permitido para este item.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full md:w-72">
            {!isMaxItem && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-[var(--input-border)] rounded-xl px-2 py-1.5 text-sm
                                 bg-[var(--input-bg)] text-[var(--text-primary)]
                                 placeholder:text-[var(--input-placeholder)]
                                 focus:outline-none focus:border-[var(--input-border-focus)]"
                      value={form.quantity}
                      onChange={e =>
                        handleChangeQuantity(item, e.target.value)
                      }
                      disabled={
                        !canEditScores ||
                        savingItemId === item.itemId ||
                        isLockedByAnother
                      }
                    />
                  </div>
                </div>

                <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl px-2 py-1.5">
                  <span className="font-medium">Pontos calculados: </span>
                  <span className="font-semibold">
                    {previewPoints || "0,00"}
                  </span>
                </div>
              </>
            )}

            {isMaxItem && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Pontos (até {maxLabel ?? "o máximo definido"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={
                      "w-full border rounded-xl px-2 py-1.5 text-sm " +
                      (exceedsMax
                        ? "border-red-400 text-red-700 bg-red-50"
                        : "border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--input-border-focus)]")
                    }
                    value={form.awardedPoints}
                    onChange={e =>
                      handleChangePoints(item, e.target.value)
                    }
                    disabled={
                      !canEditScores ||
                      savingItemId === item.itemId ||
                      isLockedByAnother
                    }
                  />
                </div>
              </div>
            )}

            {isThisActive && hasScore && item.currentScore && (
              <div className="text-[11px] text-[var(--text-muted)]">
                <span className="font-medium">Pontos já gravados: </span>
                {formatPoints(item.currentScore.awardedPoints) || "0,00"}
              </div>
            )}

            {isThisActive && (
              <button
                type="button"
                onClick={() => handleSalvarItem(item.itemId)}
                disabled={
                  !canEditScores ||
                  savingItemId === item.itemId ||
                  isLockedByAnother
                }
                className="w-full mt-1 px-3 py-1.5 rounded-full text-xs font-medium
                           bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                           hover:bg-[var(--btn-primary-hover-bg)]
                           disabled:opacity-50 transition"
              >
                {savingItemId === item.itemId ? "Salvando..." : "Salvar pontuação"}
              </button>
            )}

            {isThisActive && (
              <button
                type="button"
                className="w-full mt-1 px-3 py-1.5 rounded-full border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50"
                onClick={() => handleCancelItemEdition(item)}
              >
                Cancelar edição deste item
              </button>
            )}
          </div>
        </div>

        {showEvidenceArea && (
          <div className="border-t border-[var(--border-subtle)] pt-2 mt-1 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-xs text-[var(--text-secondary)]">
              {evidence && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 text-[11px] px-3 py-1 rounded-full border border-[var(--border-subtle)] hover:bg-[var(--btn-secondary-hover-bg)]"
                  onClick={() => setPreviewEvidence(evidence)}
                >
                  <EyeIcon className="w-3 h-3" />
                  <span>Visualizar comprovante</span>
                </button>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-2">
              {evidence && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full border border-[var(--border-subtle)] text-[11px] font-medium hover:bg-[var(--btn-secondary-hover-bg)]"
                  onClick={() =>
                    openEvidenceModalForItem(item.itemId, "change", evidence)
                  }
                  disabled={!canEditScores || isLockedByAnother}
                >
                  <FileSwapIcon className="w-3 h-3" />
                  <span>Alterar comprovante</span>
                </button>
              )}

              {!evidence && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full border border-[var(--border-subtle)] text-[11px] font-medium hover:bg-[var(--btn-secondary-hover-bg)]"
                  onClick={() =>
                    openEvidenceModalForItem(item.itemId, "change", null)
                  }
                  disabled={!canEditScores || isLockedByAnother}
                >
                  <FileSwapIcon className="w-3 h-3" />
                  <span>Anexar comprovante</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderNode(node: TreeNode) {
    const nodeLabel = node.code ? `${node.code} - ${node.name}` : node.name
    const nodeTotal = computeNodeTotal(node)

    return (
      <div key={node.nodeId} className="space-y-3">
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
          {/* Cabeçalho do bloco */}
          <div className="flex justify-between items-center gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {nodeLabel}
              </div>
              {node.hasFormula && node.formulaExpression && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Bloco com cálculo automático
                </div>
              )}
            </div>
          </div>

          {/* Itens do bloco */}
          {node.items.length > 0 && (
            <div className="space-y-2">
              {node.items.map(item => renderItemRow(item))}
            </div>
          )}

          {/* Filhos do bloco */}
          {node.children.length > 0 && (
            <div className="mt-4 border-l-2 border-dashed border-[var(--border-subtle)] pl-4 space-y-4">
              {node.children.map(child => renderNode(child))}
            </div>
          )}

          {node.items.length === 0 && node.children.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              Nenhuma atividade cadastrada neste bloco.
            </p>
          )}

          {/* Rodapé – resumo do bloco */}
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-[var(--text-muted)]">
              Resumo deste bloco
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[11px] text-[var(--text-secondary)]">
                Total de pontos do bloco
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)] px-3 py-1 rounded-full bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]">
                {formatPoints(nodeTotal)} pontos
              </span>
              {node.hasFormula && node.formulaExpression && (
                <span className="mt-1 text-[10px] text-[var(--text-muted)] text-right whitespace-nowrap">
                  Valor calculado a partir da fórmula:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {node.formulaExpression}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const previewUrl = previewEvidence
    ? `/api/evidencias/${previewEvidence.evidenceFileId}/conteudo`
    : ""

  return (
    <main className="min-h-[60vh]">
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      {previewEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--surface-bg)] rounded-2xl shadow-xl max-w-3xl w-full h-[80vh] mx-4 flex flex-col border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-[var(--text-primary)] break-words">
                  {previewEvidence.originalName}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {previewEvidence.sizeBytes
                    ? `${(previewEvidence.sizeBytes / (1024 * 1024)).toFixed(
                        2
                      )} MB`
                    : "tamanho não informado"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-full border border-[var(--btn-secondary-border)]
                             text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]"
                  onClick={() => setPreviewEvidence(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-b-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {evidenceModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--surface-bg)] rounded-2xl shadow-xl max-w-lg w-full mx-4 p-4 space-y-4 border border-[var(--border-subtle)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {evidenceModal.mode === "attachRequired"
                    ? "Anexar comprovante obrigatório"
                    : "Gerenciar comprovante"}
                </h2>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  {evidenceModal.mode === "attachRequired"
                    ? "Para lançar pontuação neste item, é obrigatório anexar pelo menos um comprovante. Você pode reutilizar um arquivo já enviado ou enviar um novo."
                    : "Você pode alterar o comprovante deste item reutilizando um arquivo já enviado ou enviando um novo."}
                </p>
              </div>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-full border border-[var(--btn-secondary-border)]
                           text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]"
                onClick={() => {
                  closeEvidenceModal()
                }}
              >
                Fechar
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                Enviar novo arquivo (PDF ou imagem &lt;= 5MB)
              </label>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/jpg,image/png"
                className="block w-full text-xs border border-[var(--input-border)] rounded-xl px-2 py-1.5 bg-[var(--input-bg)] text-[var(--text-primary)]"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  if (file) {
                    handleUploadEvidenceFromModal(file)
                    e.target.value = ""
                  }
                }}
                disabled={uploadingItemId === evidenceModal.itemId}
              />
              {uploadingItemId === evidenceModal.itemId && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Enviando arquivo, aguarde...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Arquivos já enviados
                </span>
              </div>
              <div className="border border-[var(--border-subtle)] rounded-xl max-h-56 overflow-y-auto bg-[var(--surface-bg)]">
                {evidenceModal.loading && (
                  <p className="text-[11px] text-[var(--text-muted)] p-3">
                    Carregando arquivos...
                  </p>
                )}

                {!evidenceModal.loading &&
                  evidenceModal.files.length === 0 && (
                    <p className="text-[11px] text-[var(--text-muted)] p-3">
                      Você ainda não enviou arquivos de evidência.
                    </p>
                  )}

                {!evidenceModal.loading &&
                  evidenceModal.files.length > 0 && (
                    <ul className="divide-y divide-[var(--border-subtle)] text-xs">
                      {evidenceModal.files.map(file => (
                        <li key={file.evidenceFileId} className="p-2.5 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium break-all text-[var(--text-primary)]">
                                {file.originalName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1 text-[11px] px-3 py-1 rounded-full border border-[var(--border-subtle)] hover:bg-[var(--btn-secondary-hover-bg)]"
                                onClick={() =>
                                  setPreviewEvidence({
                                    evidenceFileId: file.evidenceFileId,
                                    originalName: file.originalName,
                                    url: file.url,
                                    mimeType: file.mimeType,
                                    sizeBytes: file.sizeBytes
                                  })
                                }
                              >
                                <EyeIcon className="w-3 h-3" />
                                <span>Visualizar</span>
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1 text-[11px] px-3 py-1 rounded-full border border-[var(--border-subtle)] hover:bg-[var(--btn-secondary-hover-bg)]"
                                onClick={() =>
                                  handleReuseEvidenceFromModal(file.evidenceFileId)
                                }
                                disabled={uploadingItemId === evidenceModal.itemId}
                              >
                                <FileSwapIcon className="w-3 h-3" />
                                <span>Usar este comprovante</span>
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Pontuação do Processo {id ? `#${id}` : ""}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Para cada atividade, informe a quantidade (quando não houver limite)
              ou os pontos finais (quando houver pontuação máxima) e anexe os
              comprovantes.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={id ? `/docente/processos/${id}` : "/docente/processos"}
              className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                         text-sm text-[var(--btn-secondary-text)]
                         hover:bg-[var(--btn-secondary-hover-bg)] transition"
            >
              Voltar aos detalhes do processo
            </Link>
          </div>
        </header>
        {loading && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando estrutura de pontuação...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--state-danger-bg)] p-4 text-sm text-[var(--state-danger-text)]">
            {error}
          </div>
        )}

        {!loading && !error && estrutura && (
          <>
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm flex flex-wrap gap-3 justify-between items-center">
              <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                <div>
                  <span className="font-medium text-[var(--text-primary)]">
                    Tipo:
                  </span>{" "}
                  {estrutura.type === "PROGRESSAO"
                    ? "Progressão"
                    : "Promoção"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">
                    Situação:
                  </span>
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                      badgeColor(estrutura.status)
                    }
                  >
                    {statusLabel(estrutura.status)}
                  </span>
                </div>
              </div>
              {!canEditScores && (
                <p className="text-[11px] text-[var(--text-muted)] max-w-xs">
                  A pontuação só pode ser alterada quando o processo está nos
                  status <span className="font-medium">RASCUNHO</span>,{" "}
                  <span className="font-medium">RETORNADO</span> ou{" "}
                  <span className="font-medium">REJEITADO</span>. No momento, os
                  campos estão somente para leitura.
                </p>
              )}
            </section>

            {/* Resumo de pontuação (sem botão de enviar) */}
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm flex flex-wrap gap-4 justify-between items-start">
              <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                <div className="font-semibold text-[var(--text-primary)]">
                  Resumo
                </div>
                <div>
                  Pontuação total do processo:{" "}
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatPoints(totalProcessPoints)} pontos
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  É necessário atingir pelo menos{" "}
                  <span className="font-medium">120 pontos</span> para enviar o
                  processo para avaliação da CPPD.
                </div>

                {!hasMinimumPoints && (
                  <div className="text-[11px] text-red-600 mt-1">
                    Pontuação mínima ainda não alcançada. Continue preenchendo
                    a planilha para atingir os 120 pontos necessários.
                  </div>
                )}

                {estrutura.status !== "DRAFT" &&
                  estrutura.status !== "RETURNED" && (
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">
                      O processo só pode ser enviado enquanto estiver nos status{" "}
                      <span className="font-medium">Rascunho</span> ou{" "}
                      <span className="font-medium">Devolvido</span>.
                    </div>
                  )}
              </div>

              <div className="flex flex-col gap-2 max-w-xs text-[11px] text-[var(--text-muted)]">
                <p>
                  Antes de enviar, revise cuidadosamente as informações
                  preenchidas e os comprovantes anexados.
                </p>
                <p>
                  O envio do processo para a CPPD é realizado na tela de{" "}
                  <span className="font-medium">detalhes do processo</span>.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              {treeRoots.length === 0 && (
                <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm text-sm text-[var(--text-secondary)]">
                  Nenhuma estrutura de pontuação definida para esta tabela.
                </div>
              )}

              {treeRoots.map(root => renderNode(root))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
