import dayjs from "dayjs"
import { latestRequirementDate, addMonthsClamped, formatCalendarDate } from "../util/careerDates"
import "dayjs/locale/pt-br"
import { ClassLevel, ProcessStatus, ProcessType } from "@prisma/client"
import { BusinessRuleError, NotFoundError } from "./processoService"
import {
  CppdItemScoreDto,
  FinalizeEvaluationDto,
  GenerateParecerPreviewDto
} from "../type/dto/processEvaluationDto"
import { ProcessEvaluationViewDto } from "../type/dto/processEvaluationViewDto"
import { ParecerPreviewDto, DivergentItemDto } from "../type/dto/processEvaluationParecerDto"
import {
  MissingDocenteProfileError,
  StaleDocenteProfileError,
  MissingProcessScoreError,
  MissingScoreJustificationError,
  StaleCareerEvaluationError,
  ProcessEvaluationRepository
} from "../repository/processEvaluationRepository"
import path from "path"
import fs from "fs"

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

type CppdDecision = "APPROVED" | "REJECTED"

type ScoredCareerProcessFields = {
  scoringTableId: number
  type: ProcessType
  table: { minRequiredPoints: unknown }
  intersticeStart: Date
  intersticeEnd: Date
  classeOrigem: string
  nivelOrigem: string
  classeDestino: string
  nivelDestino: string
}

function assertScoredCareerProcess<T>(
  process: T
): asserts process is T & ScoredCareerProcessFields {
  const value = process as any
  if (
    !value?.scoringTableId ||
    !value?.table ||
    !value?.type ||
    !value?.intersticeStart ||
    !value?.intersticeEnd ||
    !value?.classeOrigem ||
    !value?.nivelOrigem ||
    !value?.classeDestino ||
    !value?.nivelDestino
  ) {
    throw new BusinessRuleError(
      "A avaliação CPPD por pontuação está disponível apenas para processos de carreira completos."
    )
  }
}

export class ProcessEvaluationService {
  constructor(private readonly repository = new ProcessEvaluationRepository()) {}

  async getEvidenceContentForCppd(processId: number, evidenceFileId: number) {
    const { process: processRecord, file, linked } = await this.repository.findEvidenceLinkedToProcess(
      processId,
      evidenceFileId
    )

    if (!processRecord) throw new NotFoundError("Processo não encontrado")
    if (!file) throw new NotFoundError("Arquivo de evidência não encontrado")
    if (!linked) throw new BusinessRuleError("Esta evidência não está vinculada ao processo informado.")
    if (!file.url || !file.url.startsWith("/uploads/")) {
      throw new BusinessRuleError("Caminho do arquivo de evidência inválido.")
    }

    const filePath = path.join(process.cwd(), "uploads", file.url.replace("/uploads/", ""))
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("Arquivo de evidência não encontrado no servidor.")
    }

    return {
      filePath,
      originalName: file.originalName,
      mimeType: file.mimeType ?? "application/pdf"
    }
  }

  async getProcessForEvaluation(processId: number, finalizing = false): Promise<ProcessEvaluationViewDto> {
    const process = await this.repository.findProcessWithUserAndTable(processId)

    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    if (process.status !== ProcessStatus.SUBMITTED && process.status !== ProcessStatus.UNDER_REVIEW) {
      if (finalizing) throw new StaleCareerEvaluationError()
      throw new BusinessRuleError("Process is not available for CPPD evaluation")
    }

    assertScoredCareerProcess(process)

    const scoringTableId = process.scoringTableId

    const { nodes, items, scores, nodeScores } =
      await this.repository.findEvaluationData(processId, scoringTableId, true)

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
    const process = await this.repository.findProcess(processId)
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    if (process.status !== ProcessStatus.SUBMITTED && process.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("Only SUBMITTED or UNDER_REVIEW processes can have scores updated")
    }

    if (!updates || updates.length === 0) return this.getProcessForEvaluation(processId)

    const normalizedUpdates = updates
      .map(u => ({
        itemId: Number(u.itemId),
        evaluatorAwardedPoints: normalizeDecimalString(u.evaluatorAwardedPoints),
        evaluatorComment: u.evaluatorComment?.trim() || null
      }))
      .filter(u => Number.isFinite(u.itemId) && u.itemId > 0)

    try {
      await this.repository.updateItemScores(processId, normalizedUpdates)
    } catch (error) {
      if (error instanceof MissingScoreJustificationError) throw new BusinessRuleError(error.message)
      if (!(error instanceof MissingProcessScoreError)) throw error
      throw new BusinessRuleError(
        "Não foi possível avaliar este item porque não existe pontuação registrada pelo docente para ele."
      )
    }

    return this.recalculateEvaluationTotals(processId)
  }

  async setEvaluationEvaluators(processId: number, currentUserId: number, evaluatorUserIds: number[]) {
    const process = await this.repository.findProcess(processId)
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")

    if (process.status !== ProcessStatus.SUBMITTED && process.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("Process is not available for CPPD evaluation")
    }

    const sanitized = Array.isArray(evaluatorUserIds)
      ? evaluatorUserIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)
      : []

    const unique = Array.from(new Set([currentUserId, ...sanitized]))

    await this.repository.setEvaluators(processId, unique)

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

    const refreshed = await this.repository.findProcessWithUserAndTable(processId)
    if (!refreshed || refreshed.deletedDate) throw new NotFoundError("Process not found")
    assertScoredCareerProcess(refreshed)

    const { totalsDocente, totalsCppd } = await this.computeOverallTotals(processId)
    const divergentItems = await this.getDivergentItems(processId)

    const minRequiredPoints =
      refreshed.table.minRequiredPoints !== null && refreshed.table.minRequiredPoints !== undefined
        ? decimalToNumber(refreshed.table.minRequiredPoints)
        : null

    const requirementsAt = dto.requirementsMetAtISO ? new Date(dto.requirementsMetAtISO) : refreshed.submittedAt ?? refreshed.intersticeEnd
    if (!Number.isFinite(requirementsAt.getTime()) || requirementsAt > new Date()) throw new BusinessRuleError("Informe uma data de cumprimento dos requisitos que já ocorreu")
    const months = refreshed.classeOrigem === "A" && refreshed.nivelOrigem === "1" && refreshed.classeDestino === "B" && refreshed.nivelDestino === "1" ? 36 : 24
    const financialEffectsAt = latestRequirementDate([refreshed.intersticeEnd, addMonthsClamped(refreshed.intersticeStart, months), requirementsAt])
    const suggestedOpinion =
      dto.overrideOpinion && dto.overrideOpinion.trim() !== ""
        ? this.withOfficialFinancialDate(dto.overrideOpinion.trim(), dto.decision ?? "APPROVED", financialEffectsAt)
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
            intersticeEnd: refreshed.intersticeEnd,
            financialEffectsAt,
            decision: dto.decision
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
    const processFull = await this.repository.findProcessWithUserAndTable(processId)
    if (!processFull || processFull.deletedDate) throw new NotFoundError("Process not found")

    if (processFull.status !== ProcessStatus.SUBMITTED && processFull.status !== ProcessStatus.UNDER_REVIEW) {
      throw new StaleCareerEvaluationError()
    }

    assertScoredCareerProcess(processFull)

    if (!dto.decision) throw new BusinessRuleError("CPPD decision is required")

    const view = await this.getProcessForEvaluation(processId, true)
    if (view.scores.some(score => score.evaluatorAwardedPoints != null &&
      Number(score.evaluatorAwardedPoints) !== Number(score.awardedPoints) && !score.evaluatorComment?.trim())) {
      throw new BusinessRuleError(new MissingScoreJustificationError().message)
    }
    if (!this.checkAllFilledItemsEvaluated(view)) {
      throw new BusinessRuleError(
        "Finalize a avaliação de todos os itens preenchidos pelo docente antes de finalizar o processo."
      )
    }

    const sanitized = Array.isArray(dto.evaluatorUserIds)
      ? dto.evaluatorUserIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)
      : []
    const evaluatorUserIds = Array.from(new Set([currentUserId, ...sanitized]))

    await this.recalculateEvaluationTotals(processId, true)
    const { totalsCppd } = await this.computeOverallTotals(processId)

    const minRequiredPoints =
      processFull.table.minRequiredPoints !== null && processFull.table.minRequiredPoints !== undefined
        ? decimalToNumber(processFull.table.minRequiredPoints)
        : null

    if (dto.decision === "APPROVED" && totalsCppd < Math.max(120, minRequiredPoints ?? 120)) {
      throw new BusinessRuleError("A pontuação mínima reconhecida pela CPPD não foi atingida")
    }
    if (dto.decision === "APPROVED" && processFull.classeOrigem === "C" && processFull.nivelOrigem === "4" && processFull.classeDestino === "D") {
      throw new BusinessRuleError("A promoção à Classe Titular exige o processo e o rito próprios")
    }

    const requirementsMetAt = dto.requirementsMetAtISO ? new Date(dto.requirementsMetAtISO) : processFull.submittedAt ?? processFull.intersticeEnd
    if (!Number.isFinite(requirementsMetAt.getTime()) || requirementsMetAt > new Date()) throw new BusinessRuleError("Informe uma data de cumprimento dos requisitos que já ocorreu")
    const requiredMonths = processFull.classeOrigem === "A" && processFull.nivelOrigem === "1" && processFull.classeDestino === "B" && processFull.nivelDestino === "1" ? 36 : 24
    const eligibilityAt = addMonthsClamped(processFull.intersticeStart, requiredMonths)
    if (dto.decision === "APPROVED" && eligibilityAt > new Date()) throw new BusinessRuleError("A concessão exige o interstício mínimo completo; a preparação antecipada não permite deferimento antecipado")
    const financialEffectsAt = dto.decision === "APPROVED" ? latestRequirementDate([processFull.intersticeEnd, eligibilityAt, requirementsMetAt]) : null

    const toStatus =
      dto.decision === "APPROVED"
        ? ProcessStatus.APPROVED
        : ProcessStatus.REJECTED

    const opinion =
      dto.overrideOpinion && dto.overrideOpinion.trim() !== ""
        ? this.withOfficialFinancialDate(dto.overrideOpinion.trim(), dto.decision, financialEffectsAt)
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
            financialEffectsAt,
            decision: dto.decision
          })

    let result
    try {
      result = await this.repository.finalizeEvaluation({
        processId,
        userId: processFull.userId,
        fromStatus: processFull.status,
        toStatus,
        finalPoints: totalsCppd.toFixed(2),
        evaluationOpinion: opinion,
        evaluatorUserIds,
        changedById: currentUserId,
        targetLevel: toStatus === ProcessStatus.APPROVED
          ? this.toClassLevel(processFull.classeDestino, processFull.nivelDestino)
          : null,
        intersticeEnd: processFull.intersticeEnd,
        originLevel: this.toClassLevel(processFull.classeOrigem, processFull.nivelOrigem),
        financialEffectsAt
      })
    } catch (error) {
      if (error instanceof StaleDocenteProfileError) throw new BusinessRuleError("A classe atual do docente mudou; revise a origem do processo antes da decisão")
      if (!(error instanceof MissingDocenteProfileError)) throw error
      throw new BusinessRuleError("DocenteProfile não encontrado para atualizar progressão/promoção.")
    }

    return {
      idProcess: result.idProcess,
      status: result.status,
      finalPoints: result.finalPoints ? decimalToNumber(result.finalPoints) : null,
      evaluationOpinion: result.evaluationOpinion,
      evaluatorUserIds: result.evaluatorUserIds
    }
  }


  private async recalculateEvaluationTotals(processId: number, finalizing = false) {
    const process = await this.repository.findProcessWithUserAndTable(processId)
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")
    assertScoredCareerProcess(process)

    const scoringTableId = process.scoringTableId

    const { nodes, items, scores } =
      await this.repository.findEvaluationData(processId, scoringTableId)

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
      await this.repository.upsertNodeTotals(
        processId,
        nodeId,
        totals.docente.toFixed(2),
        totals.cppd !== null ? totals.cppd.toFixed(2) : null
      )
    }

    const finalCppd = treeRoots.reduce((acc, root) => {
      const t = nodeTotals.get(root.nodeId)?.cppd
      return acc + safeNumber(t ?? 0)
    }, 0)

    await this.repository.updateFinalPoints(processId, finalCppd.toFixed(2))

    return this.getProcessForEvaluation(processId, finalizing)
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
    const process = await this.repository.findProcessWithUserAndTable(processId)
    if (!process || process.deletedDate) throw new NotFoundError("Process not found")
    assertScoredCareerProcess(process)

    const { nodes, items, scores } =
      await this.repository.findEvaluationData(processId, process.scoringTableId)

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
    const scores = await this.repository.findScoresWithItems(processId)

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

  private withOfficialFinancialDate(opinion: string, decision: CppdDecision, financialEffectsAt: Date | null) {
    const canonical = opinion.replace(/, com efeitos financeiros a contar de \*\*[^*]+\*\*/g, "")
      .replace(/\n\nData oficial de efeitos financeiros: [^\n]+\./g, "")
    return decision === "APPROVED" && financialEffectsAt
      ? `${canonical}\n\nData oficial de efeitos financeiros: ${formatCalendarDate(financialEffectsAt)}.` : canonical
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
    financialEffectsAt?: Date | null
  }) {
    const tipo = args.processType === ProcessType.PROMOCAO ? "promoção" : "progressão"

    const dataIni = formatCalendarDate(args.intersticeStart)
    const dataFim = formatCalendarDate(args.intersticeEnd)

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
        : "**indeferimento da solicitação**"

    const forwardingText =
      `Encaminha-se o presente parecer à **Coordenação de Gestão de Pessoas**, a fim de que seja dado o devido andamento.\n\n`

    const hasMin = args.minRequiredPoints !== null
    const isBelowMin = hasMin && args.points < (args.minRequiredPoints as number)

    const pointsText = hasMin
      ? isBelowMin
        ? `e obteve **${args.points} pontos**, abaixo da ${LEGAL_MIN_POINTS_TEXT}; `
        : `e obteve **${args.points} pontos**, em conformidade com a ${LEGAL_MIN_POINTS_TEXT}; `
      : `e obteve **${args.points} pontos**; `

    const effectsText =
      decision === "APPROVED"
        ? `, com efeitos financeiros a contar de **${formatCalendarDate(args.financialEffectsAt ?? args.intersticeEnd)}**`
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
    const process = await this.repository.findProcessWithUserAndTable(processId)

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

    assertScoredCareerProcess(process)

    const scoringTableId = process.scoringTableId

    const { nodes, items, scores, nodeScores } =
      await this.repository.findEvaluationData(processId, scoringTableId, true)

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
