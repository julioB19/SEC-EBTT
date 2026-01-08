import dayjs from "dayjs"
import "dayjs/locale/pt-br"
import { ClassLevel, ProcessStatus, ProcessType } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { BusinessRuleError, NotFoundError } from "./processoService"
import {
  CppdItemScoreDto,
  FinalizeEvaluationDto,
  GenerateParecerPreviewDto
} from "../type/dto/processEvaluationDto"
import { ProcessEvaluationViewDto } from "../type/dto/processEvaluationViewDto"
import { ParecerPreviewDto, DivergentItemDto } from "../type/dto/processEvaluationParecerDto"

dayjs.locale("pt-br")

function decimalToNumber(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber()
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

function safeNumber(n: any) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function normalizeDecimalString(v: string | null): string | null {
  if (v === null || v === undefined) return null
  const raw = String(v).trim()
  if (raw === "") return null

  const normalized = raw.replace(",", ".")
  const num = Number(normalized)

  if (!Number.isFinite(num)) {
    throw new BusinessRuleError("Pontuação informada pela CPPD é inválida.")
  }

  return num.toFixed(2)
}

const LEGAL_MIN_POINTS_TEXT = "pontuação exigida pela Resolução nº 104/2013"
const LEGAL_BASIS_TEXT =
  "com base no Art. 2º (2º parágrafo), do capítulo I, da Resolução - Conselho Superior nº 104/2013"

function sanitizeCampus(value: string) {
  const v = String(value ?? "").trim()
  if (v === "") return ""

  return v
    .replace(/^docente\s*[-:]\s*/i, "")
    .replace(/^professor\s*[-:]\s*/i, "")
    .replace(/^servidor\s*[-:]\s*/i, "")
    .trim()
}

type TreeNode = {
  nodeId: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
  items: {
    idScoringItem: number
    description: string
    formulaKey: string | null
    nodeId: number
    points: number
  }[]
  children: TreeNode[]
}

type CppdDecision = "APPROVED" | "REJECTED" | "RETURNED"

export class ProcessEvaluationService {
  async getProcessForEvaluation(processId: number): Promise<ProcessEvaluationViewDto> {
    const process = await prisma.careerProcess.findUnique({
      where: { idProcess: processId },
      include: {
        user: { include: { docente: true } },
        table: true
      }
    })

    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    if (process.status !== ProcessStatus.SUBMITTED && process.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("Process is not available for CPPD evaluation")
    }

    const scoringTableId = process.scoringTableId

    const [nodes, items, scores, nodeScores] = await Promise.all([
      prisma.scoringNode.findMany({
        where: { scoringTableId, deletedDate: null, active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          idScoringNode: true,
          parentId: true,
          name: true,
          code: true,
          sortOrder: true,
          hasFormula: true,
          formulaExpression: true
        }
      }),
      prisma.scoringItem.findMany({
        where: { scoringTableId, deletedDate: null, active: true }
      }),
      prisma.processScore.findMany({
        where: { processId, deletedDate: null },
        include: { item: true, evidenceFile: true },
        orderBy: { idProcessScore: "asc" }
      }),
      prisma.processNodeScore.findMany({
        where: { processId, deletedDate: null }
      })
    ])

    const minRequiredPoints =
      process.table.minRequiredPoints !== null && process.table.minRequiredPoints !== undefined
        ? decimalToNumber(process.table.minRequiredPoints)
        : null

    return {
      process: {
        idProcess: process.idProcess,
        type: process.type,
        status: process.status,
        campus: process.campus,
        cidadeUF: process.cidadeUF,
        intersticeStart: process.intersticeStart.toISOString(),
        intersticeEnd: process.intersticeEnd.toISOString(),
        classeOrigem: process.classeOrigem,
        nivelOrigem: process.nivelOrigem,
        classeDestino: process.classeDestino,
        nivelDestino: process.nivelDestino,
        teacherName: process.user.name,
        scoringTableMinRequiredPoints: minRequiredPoints
      },
      nodes: nodes.map(n => ({
        idScoringNode: n.idScoringNode,
        parentId: n.parentId ?? null,
        name: n.name,
        code: n.code ?? null,
        sortOrder: n.sortOrder,
        hasFormula: n.hasFormula,
        formulaExpression: n.formulaExpression ?? null
      })),
      items: items.map(i => ({
        idScoringItem: i.idScoringItem,
        nodeId: i.nodeId,
        description: i.description,
        points: decimalToNumber(i.points),
        unit: i.unit,
        hasMaxPoints: i.hasMaxPoints,
        maxPoints: i.maxPoints ? decimalToNumber(i.maxPoints) : null,
        formulaKey: i.formulaKey ?? null
      })),
      scores: scores.map(s => ({
        idProcessScore: s.idProcessScore,
        itemId: s.itemId,
        quantity: s.quantity,
        awardedPoints: decimalToNumber(s.awardedPoints),
        evaluatorAwardedPoints:
          s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
            ? decimalToNumber(s.evaluatorAwardedPoints)
            : null,
        evaluatorComment: s.evaluatorComment ?? null,
        evidenceFile: s.evidenceFile
          ? {
              idEvidenceFile: s.evidenceFile.idEvidenceFile,
              originalName: s.evidenceFile.originalName,
              url: s.evidenceFile.url,
              sizeBytes: s.evidenceFile.sizeBytes ? s.evidenceFile.sizeBytes.toString() : null
            }
          : null
      })),
      nodeScores: nodeScores.map(ns => ({
        nodeId: ns.nodeId,
        totalPoints: decimalToNumber(ns.totalPoints),
        evaluatorTotalPoints:
          ns.evaluatorTotalPoints !== null && ns.evaluatorTotalPoints !== undefined
            ? decimalToNumber(ns.evaluatorTotalPoints)
            : null
      }))
    }
  }

  async updateItemScores(processId: number, updates: CppdItemScoreDto[]) {
    const process = await prisma.careerProcess.findUnique({ where: { idProcess: processId } })
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    if (process.status !== ProcessStatus.SUBMITTED && process.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("Only SUBMITTED or UNDER_REVIEW processes can have scores updated")
    }

    if (!updates || updates.length === 0) return this.getProcessForEvaluation(processId)

    await prisma.$transaction(async tx => {
      for (const u of updates) {
        const itemId = Number(u.itemId)
        if (!Number.isFinite(itemId) || itemId <= 0) continue

        const existing = await tx.processScore.findUnique({
          where: { processId_itemId: { processId, itemId } }
        })

        if (!existing || existing.deletedDate) {
          throw new BusinessRuleError(
            "Não foi possível avaliar este item porque não existe pontuação registrada pelo docente para ele."
          )
        }

        const normalized = normalizeDecimalString(u.evaluatorAwardedPoints)

        await tx.processScore.update({
          where: { processId_itemId: { processId, itemId } },
          data: {
            evaluatorAwardedPoints: normalized,
            evaluatorComment: u.evaluatorComment === undefined ? null : u.evaluatorComment
          }
        })
      }
    })

    return this.recalculateEvaluationTotals(processId)
  }

  async setEvaluationEvaluators(processId: number, currentUserId: number, evaluatorUserIds: number[]) {
    const process = await prisma.careerProcess.findUnique({ where: { idProcess: processId } })
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    if (process.status !== ProcessStatus.SUBMITTED && process.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("Process is not available for CPPD evaluation")
    }

    const sanitized = Array.isArray(evaluatorUserIds)
      ? evaluatorUserIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)
      : []

    const unique = Array.from(new Set([currentUserId, ...sanitized]))

    await prisma.careerProcess.update({
      where: { idProcess: processId },
      data: { evaluatorUserIds: unique }
    })

    return this.getProcessForEvaluation(processId)
  }

  async generateParecerPreview(
    processId: number,
    currentUserId: number,
    dto: GenerateParecerPreviewDto
  ): Promise<ParecerPreviewDto> {
    const view = await this.getProcessForEvaluation(processId)

    const allEvaluated = this.checkAllFilledItemsEvaluated(view)
    if (!allEvaluated) {
      throw new BusinessRuleError(
        "Finalize a avaliação de todos os itens preenchidos pelo docente antes de gerar o parecer."
      )
    }

    if (dto.evaluatorUserIds && Array.isArray(dto.evaluatorUserIds)) {
      await this.setEvaluationEvaluators(processId, currentUserId, dto.evaluatorUserIds)
    }

    await this.recalculateEvaluationTotals(processId)

    const refreshed = await prisma.careerProcess.findUnique({
      where: { idProcess: processId },
      include: {
        user: { include: { docente: true } },
        table: true
      }
    })
    if (!refreshed || refreshed.deletedDate) throw new NotFoundError("Process not found")

    const { totalsDocente, totalsCppd } = await this.computeOverallTotals(processId)
    const divergentItems = await this.getDivergentItems(processId)

    const minRequiredPoints =
      refreshed.table.minRequiredPoints !== null && refreshed.table.minRequiredPoints !== undefined
        ? decimalToNumber(refreshed.table.minRequiredPoints)
        : null

    const suggestedOpinion =
      dto.overrideOpinion && dto.overrideOpinion.trim() !== ""
        ? dto.overrideOpinion.trim()
        : this.buildDefaultOpinion({
            processType: refreshed.type,
            teacherName: refreshed.user.name,
            teacherSiape: refreshed.user.docente?.siape ?? null,
            campus: refreshed.campus,
            cidadeUF: refreshed.cidadeUF,
            classeOrigem: refreshed.classeOrigem,
            nivelOrigem: refreshed.nivelOrigem,
            classeDestino: refreshed.classeDestino,
            nivelDestino: refreshed.nivelDestino,
            points: totalsCppd,
            minRequiredPoints,
            intersticeStart: refreshed.intersticeStart,
            intersticeEnd: refreshed.intersticeEnd
          })

    const evaluatorIdsRaw = (refreshed.evaluatorUserIds as any) ?? []
    const evaluatorUserIds =
      Array.isArray(evaluatorIdsRaw) && evaluatorIdsRaw.length > 0
        ? evaluatorIdsRaw.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n))
        : [currentUserId]

    return {
      totals: {
        docenteTotal: totalsDocente,
        cppdTotal: totalsCppd,
        minRequiredPoints
      },
      divergentItems,
      suggestedOpinion,
      evaluatorUserIds
    }
  }

  async finalizeEvaluation(processId: number, currentUserId: number, dto: FinalizeEvaluationDto) {
    const processFull = await prisma.careerProcess.findUnique({
      where: { idProcess: processId },
      include: {
        user: { include: { docente: true } },
        table: true
      }
    })
    if (!processFull || processFull.deletedDate) throw new NotFoundError("Process not found")

    if (processFull.status !== ProcessStatus.SUBMITTED && processFull.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("Only SUBMITTED or UNDER_REVIEW processes can be evaluated")
    }

    if (!dto.decision) throw new BusinessRuleError("CPPD decision is required")

    const view = await this.getProcessForEvaluation(processId)
    if (!this.checkAllFilledItemsEvaluated(view)) {
      throw new BusinessRuleError(
        "Finalize a avaliação de todos os itens preenchidos pelo docente antes de finalizar o processo."
      )
    }

    const sanitized = Array.isArray(dto.evaluatorUserIds)
      ? dto.evaluatorUserIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)
      : []
    const evaluatorUserIds = Array.from(new Set([currentUserId, ...sanitized]))

    await this.recalculateEvaluationTotals(processId)
    const { totalsCppd } = await this.computeOverallTotals(processId)

    const minRequiredPoints =
      processFull.table.minRequiredPoints !== null && processFull.table.minRequiredPoints !== undefined
        ? decimalToNumber(processFull.table.minRequiredPoints)
        : null

    const toStatus =
      dto.decision === "APPROVED"
        ? ProcessStatus.APPROVED
        : dto.decision === "REJECTED"
        ? ProcessStatus.REJECTED
        : ProcessStatus.RETURNED

    const opinion =
      dto.overrideOpinion && dto.overrideOpinion.trim() !== ""
        ? dto.overrideOpinion.trim()
        : this.buildDefaultOpinion({
            processType: processFull.type,
            teacherName: processFull.user.name,
            teacherSiape: processFull.user.docente?.siape ?? null,
            campus: processFull.campus,
            cidadeUF: processFull.cidadeUF,
            classeOrigem: processFull.classeOrigem,
            nivelOrigem: processFull.nivelOrigem,
            classeDestino: processFull.classeDestino,
            nivelDestino: processFull.nivelDestino,
            points: totalsCppd,
            minRequiredPoints,
            intersticeStart: processFull.intersticeStart,
            intersticeEnd: processFull.intersticeEnd,
            decision: dto.decision
          })

    const result = await prisma.$transaction(async tx => {
      const fromStatus = processFull.status

      const updated = await tx.careerProcess.update({
        where: { idProcess: processId },
        data: {
          status: toStatus,
          finalPoints: totalsCppd.toFixed(2),
          evaluationOpinion: opinion,
          evaluatorUserIds
        }
      })

      await tx.processStatusHistory.create({
        data: {
          processId,
          fromStatus,
          toStatus,
          changedById: currentUserId,
          note: null
        }
      })

      if (toStatus === ProcessStatus.APPROVED) {
        const docente = await tx.docenteProfile.findUnique({
          where: { userId: processFull.userId }
        })

        if (!docente || docente.deletedDate) {
          throw new BusinessRuleError("DocenteProfile não encontrado para atualizar progressão/promoção.")
        }

        const targetLevel = this.toClassLevel(processFull.classeDestino, processFull.nivelDestino)

        await tx.docenteProfile.update({
          where: { userId: processFull.userId },
          data: {
            classLevel: targetLevel,
            start_interstice: processFull.intersticeEnd
          }
        })
      }

      return updated
    })

    return {
      idProcess: result.idProcess,
      status: result.status,
      finalPoints: result.finalPoints ? decimalToNumber(result.finalPoints) : null,
      evaluationOpinion: result.evaluationOpinion,
      evaluatorUserIds: result.evaluatorUserIds
    }
  }


  private async recalculateEvaluationTotals(processId: number) {
    const process = await prisma.careerProcess.findUnique({ where: { idProcess: processId } })
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    const scoringTableId = process.scoringTableId

    const [nodes, items, scores] = await Promise.all([
      prisma.scoringNode.findMany({
        where: { scoringTableId, deletedDate: null, active: true },
        select: {
          idScoringNode: true,
          parentId: true,
          name: true,
          code: true,
          sortOrder: true,
          hasFormula: true,
          formulaExpression: true
        },
        orderBy: { sortOrder: "asc" }
      }),
      prisma.scoringItem.findMany({
        where: { scoringTableId, deletedDate: null, active: true }
      }),
      prisma.processScore.findMany({
        where: { processId, deletedDate: null }
      })
    ])

    const scoreByItemId = new Map<number, typeof scores[number]>()
    scores.forEach(s => scoreByItemId.set(s.itemId, s))

    const treeRoots = this.buildTree(nodes, items)

    const nodeTotals = new Map<number, { docente: number; cppd: number | null }>()

    const computeNodeDocente = (node: TreeNode): number => {
      const baseSum = node.items.reduce((acc, item) => {
        const s = scoreByItemId.get(item.idScoringItem)
        return acc + (s ? decimalToNumber(s.awardedPoints) : 0)
      }, 0)

      const self = this.evalFormula(
        node,
        item => {
          const s = scoreByItemId.get(item.idScoringItem)
          return s ? safeNumber(s.quantity) : 0
        },
        baseSum
      )

      const childrenSum = node.children.reduce((acc, child) => acc + computeNodeDocente(child), 0)
      const total = safeNumber(self) + safeNumber(childrenSum)

      nodeTotals.set(node.nodeId, {
        ...(nodeTotals.get(node.nodeId) ?? { docente: 0, cppd: null }),
        docente: total
      })

      return total
    }

    const computeNodeCppd = (node: TreeNode): { total: number | null; anyCppd: boolean } => {
      let anyCppdHere = false

      const baseSum = node.items.reduce((acc, item) => {
        const s = scoreByItemId.get(item.idScoringItem)
        if (!s) return acc

        const hasCppd = s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
        if (hasCppd) anyCppdHere = true

        const cppdOrDocente = hasCppd
          ? decimalToNumber(s.evaluatorAwardedPoints)
          : decimalToNumber(s.awardedPoints)
        return acc + cppdOrDocente
      }, 0)

      const self = this.evalFormula(
        node,
        item => {
          const s = scoreByItemId.get(item.idScoringItem)
          if (!s) return 0

          const hasCppd = s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
          if (hasCppd) anyCppdHere = true

          const effectivePoints = hasCppd
            ? decimalToNumber(s.evaluatorAwardedPoints)
            : decimalToNumber(s.awardedPoints)

          const unitPoints = safeNumber(item.points)
          if (unitPoints > 0) return effectivePoints / unitPoints

          return safeNumber(s.quantity)
        },
        baseSum
      )

      let anyCppdChildren = false
      const childrenSum = node.children.reduce((acc, child) => {
        const r = computeNodeCppd(child)
        if (r.anyCppd) anyCppdChildren = true
        return acc + safeNumber(r.total ?? 0)
      }, 0)

      const any = anyCppdHere || anyCppdChildren
      const total = any ? safeNumber(self) + safeNumber(childrenSum) : null

      nodeTotals.set(node.nodeId, {
        ...(nodeTotals.get(node.nodeId) ?? { docente: 0, cppd: null }),
        cppd: total
      })

      return { total, anyCppd: any }
    }

    treeRoots.forEach(root => computeNodeDocente(root))
    treeRoots.forEach(root => computeNodeCppd(root))

    for (const [nodeId, totals] of nodeTotals.entries()) {
      await prisma.processNodeScore.upsert({
        where: { processId_nodeId: { processId, nodeId } },
        create: {
          processId,
          nodeId,
          totalPoints: totals.docente.toFixed(2),
          evaluatorTotalPoints: totals.cppd !== null ? totals.cppd.toFixed(2) : null
        },
        update: {
          totalPoints: totals.docente.toFixed(2),
          evaluatorTotalPoints: totals.cppd !== null ? totals.cppd.toFixed(2) : null
        }
      })
    }

    const finalCppd = treeRoots.reduce((acc, root) => {
      const t = nodeTotals.get(root.nodeId)?.cppd
      return acc + safeNumber(t ?? 0)
    }, 0)

    await prisma.careerProcess.update({
      where: { idProcess: processId },
      data: { finalPoints: finalCppd.toFixed(2) }
    })

    return this.getProcessForEvaluation(processId)
  }

  private evalFormula(
    node: TreeNode,
    valueGetter: (item: TreeNode["items"][number]) => number,
    baseFallback: number
  ) {
    if (!node.hasFormula || !node.formulaExpression) return baseFallback

    const vars: Record<string, number> = {}
    node.items.forEach(item => {
      if (!item.formulaKey) return
      vars[item.formulaKey] = safeNumber(valueGetter(item))
    })

    try {
      const argNames = Object.keys(vars)
      const argValues = Object.values(vars)
      if (argNames.length === 0) return baseFallback

      const fn = new Function(...argNames, `return ${node.formulaExpression};`) as (...args: number[]) => number
      const result = fn(...argValues)
      const num = Number(result)

      return Number.isFinite(num) ? num : baseFallback
    } catch (e) {
      console.error("Erro avaliando fórmula do bloco:", node.nodeId, e)
      return baseFallback
    }
  }

  private buildTree(nodes: any[], items: any[]): TreeNode[] {
    const map = new Map<number, TreeNode>()

    nodes.forEach(n => {
      map.set(n.idScoringNode, {
        nodeId: n.idScoringNode,
        parentId: n.parentId ?? null,
        name: n.name,
        code: n.code ?? null,
        sortOrder: n.sortOrder,
        hasFormula: n.hasFormula,
        formulaExpression: n.formulaExpression ?? null,
        items: [],
        children: []
      })
    })

    const itemsByNode = new Map<number, any[]>()
    items.forEach(it => {
      const list = itemsByNode.get(it.nodeId) ?? []
      list.push(it)
      itemsByNode.set(it.nodeId, list)
    })

    map.forEach(node => {
      const list = itemsByNode.get(node.nodeId) ?? []
      node.items = list
        .sort((a, b) => a.idScoringItem - b.idScoringItem)
        .map(i => ({
          idScoringItem: i.idScoringItem,
          description: i.description,
          formulaKey: i.formulaKey ?? null,
          nodeId: i.nodeId,
          points: decimalToNumber(i.points)
        }))
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

  private checkAllFilledItemsEvaluated(view: ProcessEvaluationViewDto) {
    const scoreByItem = new Map<number, any>()
    view.scores.forEach(s => scoreByItem.set(s.itemId, s))

    let totalFilled = 0
    let totalEvaluated = 0

    view.items.forEach(item => {
      const s = scoreByItem.get(item.idScoringItem)
      if (!s) return

      const filled = (s.quantity ?? 0) > 0 || (s.awardedPoints ?? 0) > 0
      if (!filled) return

      totalFilled += 1
      const evaluated = s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
      if (evaluated) totalEvaluated += 1
    })

    return totalFilled > 0 && totalFilled === totalEvaluated
  }

  private async computeOverallTotals(processId: number) {
    const process = await prisma.careerProcess.findUnique({ where: { idProcess: processId } })
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    const [nodes, items, scores] = await Promise.all([
      prisma.scoringNode.findMany({
        where: { scoringTableId: process.scoringTableId, deletedDate: null, active: true },
        select: {
          idScoringNode: true,
          parentId: true,
          name: true,
          code: true,
          sortOrder: true,
          hasFormula: true,
          formulaExpression: true
        }
      }),
      prisma.scoringItem.findMany({
        where: { scoringTableId: process.scoringTableId, deletedDate: null, active: true }
      }),
      prisma.processScore.findMany({
        where: { processId, deletedDate: null }
      })
    ])

    const scoreByItemId = new Map<number, typeof scores[number]>()
    scores.forEach(s => scoreByItemId.set(s.itemId, s))

    const roots = this.buildTree(nodes, items)

    const computeDocente = (node: TreeNode): number => {
      const base = node.items.reduce((acc, it) => {
        const s = scoreByItemId.get(it.idScoringItem)
        return acc + (s ? decimalToNumber(s.awardedPoints) : 0)
      }, 0)

      const self = this.evalFormula(
        node,
        it => {
          const s = scoreByItemId.get(it.idScoringItem)
          return s ? safeNumber(s.quantity) : 0
        },
        base
      )

      const children = node.children.reduce((acc, c) => acc + computeDocente(c), 0)
      return safeNumber(self) + safeNumber(children)
    }

    const computeCppd = (node: TreeNode): number => {
      const base = node.items.reduce((acc, it) => {
        const s = scoreByItemId.get(it.idScoringItem)
        if (!s) return acc
        const hasCppd = s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
        const v = hasCppd ? decimalToNumber(s.evaluatorAwardedPoints) : decimalToNumber(s.awardedPoints)
        return acc + v
      }, 0)

      const self = this.evalFormula(
        node,
        it => {
          const s = scoreByItemId.get(it.idScoringItem)
          if (!s) return 0

          const hasCppd = s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
          const effectivePoints = hasCppd
            ? decimalToNumber(s.evaluatorAwardedPoints)
            : decimalToNumber(s.awardedPoints)

          const unitPoints = safeNumber(it.points)
          if (unitPoints > 0) return effectivePoints / unitPoints

          return safeNumber(s.quantity)
        },
        base
      )

      const children = node.children.reduce((acc, c) => acc + computeCppd(c), 0)
      return safeNumber(self) + safeNumber(children)
    }

    const totalsDocente = roots.reduce((acc, r) => acc + computeDocente(r), 0)
    const totalsCppd = roots.reduce((acc, r) => acc + computeCppd(r), 0)

    return {
      totalsDocente: Number(totalsDocente.toFixed(2)),
      totalsCppd: Number(totalsCppd.toFixed(2))
    }
  }

  private async getDivergentItems(processId: number): Promise<DivergentItemDto[]> {
    const scores = await prisma.processScore.findMany({
      where: { processId, deletedDate: null },
      include: { item: true },
      orderBy: { idProcessScore: "asc" }
    })

    const divergent: DivergentItemDto[] = []

    for (const s of scores) {
      const docente = decimalToNumber(s.awardedPoints)
      const cppd =
        s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
          ? decimalToNumber(s.evaluatorAwardedPoints)
          : null

      if (cppd === null) continue
      if (Number(docente) === Number(cppd)) continue

      divergent.push({
        itemId: s.itemId,
        description: s.item.description,
        docentePoints: Number(docente.toFixed(2)),
        cppdPoints: Number(cppd.toFixed(2)),
        evaluatorComment: s.evaluatorComment ?? null
      })
    }

    return divergent
  }

  private toClassLevel(classe: string, nivel: string): ClassLevel {
    const raw = `${String(classe).trim().toUpperCase()}${String(nivel).trim()}`
    const allowed = new Set(["A1", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1"])

    if (!allowed.has(raw)) {
      throw new BusinessRuleError(`Classe/Nível de destino inválido para atualizar o docente: ${raw}`)
    }

    return raw as ClassLevel
  }

  private buildDefaultOpinion(args: {
    processType: ProcessType
    teacherName: string
    teacherSiape?: string | null
    campus: string
    cidadeUF: string
    classeOrigem: string
    nivelOrigem: string
    classeDestino: string
    nivelDestino: string
    points: number
    minRequiredPoints: number | null
    intersticeStart: Date
    intersticeEnd: Date
    decision?: CppdDecision
  }) {
    const tipo = args.processType === ProcessType.PROMOCAO ? "promoção" : "progressão"

    const dataIni = dayjs(args.intersticeStart).format("DD/MM/YYYY")
    const dataFim = dayjs(args.intersticeEnd).format("DD/MM/YYYY")

    const siape =
      args.teacherSiape && String(args.teacherSiape).trim() !== ""
        ? String(args.teacherSiape).trim()
        : null
    const siapeChunk = siape ? `, SIAPE **${siape}**` : ""

    const campusOnly = sanitizeCampus(args.campus)

    const inferredDecision: CppdDecision =
      args.minRequiredPoints !== null && args.points < args.minRequiredPoints ? "REJECTED" : "APPROVED"

    const decision = args.decision ?? inferredDecision

    const decisionText =
      decision === "APPROVED"
        ? "**deferimento da solicitação**"
        : decision === "REJECTED"
        ? "**indeferimento da solicitação**"
        : "**devolução do processo para correção**"

    const forwardingText =
      decision === "RETURNED"
        ? `Encaminha-se o presente parecer ao(à) **docente interessado(a)** para correção/ajustes, a fim de que o processo possa ser reapresentado.\n\n`
        : `Encaminha-se o presente parecer à **Coordenação de Gestão de Pessoas**, a fim de que seja dado o devido andamento.\n\n`

    const hasMin = args.minRequiredPoints !== null
    const isBelowMin = hasMin && args.points < (args.minRequiredPoints as number)

    const pointsText = hasMin
      ? isBelowMin
        ? `e obteve **${args.points} pontos**, abaixo da ${LEGAL_MIN_POINTS_TEXT}; `
        : `e obteve **${args.points} pontos**, em conformidade com a ${LEGAL_MIN_POINTS_TEXT}; `
      : `e obteve **${args.points} pontos**; `

    const effectsText =
      decision === "APPROVED"
        ? `, com efeitos financeiros a contar de **${dataFim}**`
        : ""

    return (
      `Avalia-se a solicitação de **${tipo}** por desempenho acadêmico do(a) servidor(a) **${args.teacherName}**${siapeChunk} - ` +
      `do Instituto Federal de Educação, Ciência e Tecnologia Farroupilha – Campus **${campusOnly}**, ` +
      `da **Classe ${args.classeOrigem} - Nível ${args.nivelOrigem}** para a **Classe ${args.classeDestino} - Nível ${args.nivelDestino}**. ` +
      `O(a) docente foi submetido(a) ao processo de avaliação de desempenho ${pointsText}` +
      `também cumpriu o interstício de **${dataIni} a ${dataFim}**. ` +
      `Sendo assim, a **Comissão Permanente de Pessoal Docente (CPPD)** opina pelo ${decisionText} para **${tipo}**, ` +
      `${LEGAL_BASIS_TEXT}${effectsText}.\n\n` +
      forwardingText +
      `É o parecer.`
    )
  }

  async getProcessForEvaluationReadOnly(processId: number): Promise<ProcessEvaluationViewDto> {
    const process = await prisma.careerProcess.findUnique({
      where: { idProcess: processId },
      include: {
        user: { include: { docente: true } },
        table: true
      }
    })

    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    const allowed = new Set<ProcessStatus>([
      ProcessStatus.SUBMITTED,
      ProcessStatus.UNDER_REVIEW,
      ProcessStatus.APPROVED,
      ProcessStatus.REJECTED,
      ProcessStatus.RETURNED
    ])

    if (!allowed.has(process.status)) {
      throw new BusinessRuleError("Process is not available for CPPD view")
    }

    const scoringTableId = process.scoringTableId

    const [nodes, items, scores, nodeScores] = await Promise.all([
      prisma.scoringNode.findMany({
        where: { scoringTableId, deletedDate: null, active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          idScoringNode: true,
          parentId: true,
          name: true,
          code: true,
          sortOrder: true,
          hasFormula: true,
          formulaExpression: true
        }
      }),
      prisma.scoringItem.findMany({
        where: { scoringTableId, deletedDate: null, active: true }
      }),
      prisma.processScore.findMany({
        where: { processId, deletedDate: null },
        include: { item: true, evidenceFile: true },
        orderBy: { idProcessScore: "asc" }
      }),
      prisma.processNodeScore.findMany({
        where: { processId, deletedDate: null }
      })
    ])

    const minRequiredPoints =
      process.table.minRequiredPoints !== null && process.table.minRequiredPoints !== undefined
        ? decimalToNumber(process.table.minRequiredPoints)
        : null

    return {
      process: {
        idProcess: process.idProcess,
        type: process.type,
        status: process.status,
        campus: process.campus,
        cidadeUF: process.cidadeUF,
        intersticeStart: process.intersticeStart.toISOString(),
        intersticeEnd: process.intersticeEnd.toISOString(),
        classeOrigem: process.classeOrigem,
        nivelOrigem: process.nivelOrigem,
        classeDestino: process.classeDestino,
        nivelDestino: process.nivelDestino,
        teacherName: process.user.name,
        scoringTableMinRequiredPoints: minRequiredPoints
      },
      nodes: nodes.map(n => ({
        idScoringNode: n.idScoringNode,
        parentId: n.parentId ?? null,
        name: n.name,
        code: n.code ?? null,
        sortOrder: n.sortOrder,
        hasFormula: n.hasFormula,
        formulaExpression: n.formulaExpression ?? null
      })),
      items: items.map(i => ({
        idScoringItem: i.idScoringItem,
        nodeId: i.nodeId,
        description: i.description,
        points: decimalToNumber(i.points),
        unit: i.unit,
        hasMaxPoints: i.hasMaxPoints,
        maxPoints: i.maxPoints ? decimalToNumber(i.maxPoints) : null,
        formulaKey: i.formulaKey ?? null
      })),
      scores: scores.map(s => ({
        idProcessScore: s.idProcessScore,
        itemId: s.itemId,
        quantity: s.quantity,
        awardedPoints: decimalToNumber(s.awardedPoints),
        evaluatorAwardedPoints:
          s.evaluatorAwardedPoints !== null && s.evaluatorAwardedPoints !== undefined
            ? decimalToNumber(s.evaluatorAwardedPoints)
            : null,
        evaluatorComment: s.evaluatorComment ?? null,
        evidenceFile: s.evidenceFile
          ? {
              idEvidenceFile: s.evidenceFile.idEvidenceFile,
              originalName: s.evidenceFile.originalName,
              url: s.evidenceFile.url,
              sizeBytes: s.evidenceFile.sizeBytes ? s.evidenceFile.sizeBytes.toString() : null
            }
          : null
      })),
      nodeScores: nodeScores.map(ns => ({
        nodeId: ns.nodeId,
        totalPoints: decimalToNumber(ns.totalPoints),
        evaluatorTotalPoints:
          ns.evaluatorTotalPoints !== null && ns.evaluatorTotalPoints !== undefined
            ? decimalToNumber(ns.evaluatorTotalPoints)
            : null
      }))
    }
  }
}
