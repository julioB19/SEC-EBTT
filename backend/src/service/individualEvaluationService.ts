import fs from "fs"
import path from "path"
import {
  AcceptanceStatus,
  CommissionStatus,
  IndividualEvaluationStatus,
  ProcessStatus,
  SpecialCommissionType
} from "@prisma/client"
import { IndividualEvaluationRepository } from "../repository/individualEvaluationRepository"
import { SaveIndividualEvaluationDto } from "../type/dto/individualEvaluationDto"
import { BusinessRuleError, NotFoundError } from "./processoService"
import { calculateRscItemPoints, capScore } from "../util/rscScoring"
import { generateIndividualEvaluationPdf } from "../util/individualEvaluationPdf"

function decimalToNumber(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber()
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function mapFile(file: any) {
  if (!file || file.deletedDate) return null
  return {
    idEvidenceFile: file.idEvidenceFile,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes === null || file.sizeBytes === undefined ? null : Number(file.sizeBytes)
  }
}

export class IndividualEvaluationService {
  constructor(private readonly repository = new IndividualEvaluationRepository()) {}

  async getEvaluation(userId: number, memberId: number) {
    const assignment = await this.getAuthorizedAssignment(userId, memberId)
    return this.mapEvaluation(assignment)
  }

  async saveDraft(userId: number, memberId: number, dto: SaveIndividualEvaluationDto) {
    const assignment = await this.getEditableAssignment(userId, memberId)
    const normalized = this.normalizeInput(assignment, dto, false)
    await this.repository.saveEvaluation({
      ...normalized,
      status: IndividualEvaluationStatus.DRAFT
    })
    return this.getEvaluation(userId, memberId)
  }

  async submit(userId: number, memberId: number, dto: SaveIndividualEvaluationDto) {
    const assignment = await this.getEditableAssignment(userId, memberId)
    const normalized = this.normalizeInput(assignment, dto, true)
    await this.repository.saveEvaluation({
      ...normalized,
      status: IndividualEvaluationStatus.SUBMITTED
    })
    return this.getEvaluation(userId, memberId)
  }

  async getEvidenceContent(userId: number, memberId: number, evidenceFileId: number) {
    const assignment = await this.getAuthorizedAssignment(userId, memberId)
    const processRecord = assignment.specialCommission.process
    const files = [
      ...processRecord.scores.map((score: any) => score.evidenceFile),
      processRecord.rscDetail?.reportFile,
      processRecord.fullProfessorDetail?.memorialFile,
      processRecord.fullProfessorDetail?.thesisFile,
      processRecord.fullProfessorDetail?.doctorateDegree?.evidenceFile
    ].filter(Boolean)
    const file = files.find((candidate: any) => candidate.idEvidenceFile === evidenceFileId)

    if (!file || file.deletedDate) {
      throw new NotFoundError("Documento não encontrado nesta avaliação")
    }
    if (!file.url || !file.url.startsWith("/uploads/")) {
      throw new BusinessRuleError("Caminho do documento inválido")
    }

    const filePath = path.join(process.cwd(), "uploads", file.url.replace("/uploads/", ""))
    if (!fs.existsSync(filePath)) throw new NotFoundError("Documento não encontrado no servidor")

    return {
      filePath,
      originalName: file.originalName,
      mimeType: file.mimeType ?? "application/pdf"
    }
  }

  async generateOpinionPdf(userId: number, memberId: number) {
    const assignment = await this.getAuthorizedAssignment(userId, memberId)
    const evaluation = assignment.individualEvaluations[0]
    if (evaluation.status !== IndividualEvaluationStatus.SUBMITTED || !evaluation.submittedAt) {
      throw new BusinessRuleError("O parecer PDF só pode ser gerado após o envio da avaliação")
    }
    const process = assignment.specialCommission.process
    const scoreByItem = new Map<number, any>(
      evaluation.scores.map((score: any) => [score.itemId, score])
    )
    const scores = process.scores
      .map((claim: any) => ({ claim, score: scoreByItem.get(claim.itemId) }))
      .filter(({ score }: any) => Boolean(score))
      .map(({ claim, score }: any) => ({
        description: claim.item.description,
        recognizedQuantity: Number(score.quantity),
        awardedPoints: decimalToNumber(score.awardedPoints),
        evaluatorComment: score.evaluatorComment
      }))
    const buffer = await generateIndividualEvaluationPdf({
      processId: process.idProcess,
      externalNumber: process.externalNumber,
      processTypeName: process.processTypeConfig?.name ?? String(process.type ?? "Processo"),
      teacherName: process.user.name,
      teacherSiape: process.user.docente?.siape,
      campus: process.campus,
      cityState: process.cidadeUF,
      targetLevel: process.rscDetail?.targetLevel,
      evaluatorName: assignment.person.name,
      submittedAt: evaluation.submittedAt,
      result: String(evaluation.result ?? "NÃO INFORMADO"),
      recognizedPoints:
        evaluation.recognizedPoints === null ? null : decimalToNumber(evaluation.recognizedPoints),
      opinionText: evaluation.opinionText ?? "",
      scores
    })
    return {
      buffer,
      filename: `parecer-processo-${process.idProcess}-avaliador-${memberId}.pdf`
    }
  }

  private async getAuthorizedAssignment(userId: number, memberId: number) {
    const assignment = await this.repository.findAssignmentForUser(memberId, userId)
    if (!assignment) throw new NotFoundError("Avaliação não encontrada")
    if (assignment.acceptanceStatus !== AcceptanceStatus.ACCEPTED) {
      throw new BusinessRuleError("Aceite o convite antes de acessar a avaliação")
    }
    if (
      assignment.specialCommission.status !== CommissionStatus.ACTIVE &&
      assignment.specialCommission.status !== CommissionStatus.COMPLETED
    ) {
      throw new BusinessRuleError("A avaliação ainda não foi liberada pela CPPD")
    }
    if (!assignment.individualEvaluations[0]) {
      throw new NotFoundError("Registro de avaliação individual não encontrado")
    }
    return assignment
  }

  private async getEditableAssignment(userId: number, memberId: number) {
    const assignment = await this.getAuthorizedAssignment(userId, memberId)
    if (assignment.specialCommission.status !== CommissionStatus.ACTIVE) {
      throw new BusinessRuleError("Esta comissão já foi concluída")
    }
    if (assignment.specialCommission.process.status !== ProcessStatus.IN_EVALUATION) {
      throw new BusinessRuleError("O processo não está em avaliação")
    }
    const evaluation = assignment.individualEvaluations[0]
    if (
      evaluation.status !== IndividualEvaluationStatus.DRAFT &&
      evaluation.status !== IndividualEvaluationStatus.RETURNED
    ) {
      throw new BusinessRuleError("A avaliação enviada não pode mais ser alterada")
    }
    return assignment
  }

  private normalizeInput(assignment: any, dto: SaveIndividualEvaluationDto, submitting: boolean) {
    const evaluation = assignment.individualEvaluations[0]
    const process = assignment.specialCommission.process
    const opinionText = dto.opinionText?.trim() || null
    let result = dto.result ?? null

    if (submitting && !opinionText) throw new BusinessRuleError("Informe o parecer individual")

    if (assignment.specialCommission.type === SpecialCommissionType.FULL_PROFESSOR) {
      if (submitting && !result) throw new BusinessRuleError("Informe o resultado da avaliação")
      if (dto.scores?.length) {
        throw new BusinessRuleError("Este tipo de processo não utiliza pontuação por item")
      }
      return {
        evaluationId: evaluation.idIndividualEvaluation,
        result,
        opinionText,
        recognizedPoints: null,
        scores: []
      }
    }

    if (!process.scoringTableId || !process.table) {
      throw new BusinessRuleError("A tabela de pontuação do RSC não está vinculada ao processo")
    }

    const claimedByItem = new Map<number, any>(
      process.scores.map((score: any) => [score.itemId, score])
    )
    const normalizedScores = (dto.scores ?? []).map(score => {
      const claim = claimedByItem.get(Number(score.itemId))
      if (!claim) throw new BusinessRuleError("Foi informada pontuação para um item não declarado pelo docente")
      const recognizedQuantity = Number(score.recognizedQuantity)
      if (
        !Number.isInteger(recognizedQuantity) ||
        recognizedQuantity < 0 ||
        recognizedQuantity > Number(claim.quantity)
      ) {
        throw new BusinessRuleError(
          `A quantidade reconhecida para "${claim.item.description}" deve ficar entre 0 e ${claim.quantity}`
        )
      }
      let awardedPoints: number
      try {
        awardedPoints = calculateRscItemPoints({
          quantity: recognizedQuantity,
          basePoints: decimalToNumber(claim.item.points),
          factor: claim.item.factor == null ? null : decimalToNumber(claim.item.factor),
          weight: claim.item.weight == null ? null : decimalToNumber(claim.item.weight),
          maxQuantity: claim.item.maxQuantity
        })
      } catch (error) {
        throw new BusinessRuleError(
          error instanceof Error ? error.message : "Pontuação RSC inválida"
        )
      }
      return {
        itemId: Number(score.itemId),
        quantity: recognizedQuantity,
        awardedPoints,
        evaluatorComment: score.evaluatorComment?.trim() || null
      }
    })

    if (submitting) {
      const requiredItemIds = process.scores
        .filter((score: any) => score.quantity > 0 || decimalToNumber(score.awardedPoints) > 0)
        .map((score: any) => score.itemId)
      const evaluatedItemIds = new Set(normalizedScores.map(score => score.itemId))
      if (requiredItemIds.some((itemId: number) => !evaluatedItemIds.has(itemId))) {
        throw new BusinessRuleError("Avalie todos os itens pontuados pelo docente antes de enviar")
      }
    }

    const totals = this.calculateRecognizedTotals(process, normalizedScores)
    const recognizedPoints = totals.total.toFixed(2)

    const minRequiredPoints =
      process.table.minRequiredPoints === null || process.table.minRequiredPoints === undefined
        ? 60
        : decimalToNumber(process.table.minRequiredPoints)
    if (assignment.specialCommission.type === SpecialCommissionType.RSC && submitting) {
      const targetLevel = process.rscDetail?.targetLevel
      if (!targetLevel) {
        throw new BusinessRuleError("O nível pretendido do RSC não foi informado")
      }
      const targetLevelPoints = totals.byRscLevel[targetLevel] ?? 0
      result =
        totals.total >= minRequiredPoints && targetLevelPoints >= 36
          ? "DEFERRED"
          : "DENIED"
    }

    return {
      evaluationId: evaluation.idIndividualEvaluation,
      result,
      opinionText,
      recognizedPoints,
      scores: normalizedScores
    }
  }

  private calculateRecognizedTotals(
    process: any,
    scores: Array<{ itemId: number; awardedPoints: number }>
  ) {
    const nodes = process.table?.nodes ?? []
    const nodeById = new Map<number, any>(nodes.map((node: any) => [node.idScoringNode, node]))
    const childrenByParent = new Map<number | null, number[]>()
    for (const node of nodes) {
      const parentId = node.parentId ?? null
      childrenByParent.set(parentId, [
        ...(childrenByParent.get(parentId) ?? []),
        node.idScoringNode
      ])
    }

    const pointsByNode = new Map<number, number>()
    const claimByItem = new Map<number, any>(
      process.scores.map((claim: any) => [claim.itemId, claim])
    )
    for (const score of scores) {
      const claim = claimByItem.get(score.itemId)
      if (!claim) continue
      const nodeId = claim.item.nodeId
      pointsByNode.set(nodeId, (pointsByNode.get(nodeId) ?? 0) + score.awardedPoints)
    }

    const nodeTotals = new Map<number, number>()
    const calculateNode = (nodeId: number): number => {
      const cached = nodeTotals.get(nodeId)
      if (cached !== undefined) return cached
      const childTotal = (childrenByParent.get(nodeId) ?? [])
        .reduce((total, childId) => total + calculateNode(childId), 0)
      const node = nodeById.get(nodeId)
      const total = capScore(
        (pointsByNode.get(nodeId) ?? 0) + childTotal,
        node?.maxPoints === null || node?.maxPoints === undefined
          ? null
          : decimalToNumber(node.maxPoints)
      )
      nodeTotals.set(nodeId, total)
      return total
    }

    const byRscLevel: Record<string, number> = {}
    let total = 0
    for (const rootId of childrenByParent.get(null) ?? []) {
      const root = nodeById.get(rootId)
      const rootTotal = calculateNode(rootId)
      total += rootTotal
      const level = this.identifyRscLevel(root?.code, root?.name)
      if (level) byRscLevel[level] = rootTotal
    }
    return { total, byRscLevel }
  }

  private mapEvaluation(assignment: any) {
    const process = assignment.specialCommission.process
    const evaluation = assignment.individualEvaluations[0]
    const currentScores = evaluation.scores.map((score: any) => ({
      itemId: score.itemId,
      quantity: score.quantity,
      recognizedQuantity: score.quantity,
      awardedPoints: decimalToNumber(score.awardedPoints),
      evaluatorComment: score.evaluatorComment
    }))

    return {
      memberId: assignment.idSpecialCommissionMember,
      memberRole: assignment.role,
      commission: {
        type: assignment.specialCommission.type,
        status: assignment.specialCommission.status,
        ordinance: assignment.specialCommission.ordinance,
        ordinanceDate: assignment.specialCommission.ordinanceDate
      },
      process: {
        idProcess: process.idProcess,
        status: process.status,
        processTypeCode: process.processTypeConfig?.code ?? process.type,
        processTypeName: process.processTypeConfig?.name ?? process.type,
        processTypeCategory: process.processTypeConfig?.category ?? null,
        teacherName: process.user.name,
        teacherSiape: process.user.docente?.siape ?? null,
        campus: process.campus,
        cityState: process.cidadeUF,
        externalNumber: process.externalNumber,
        rscDetails: process.rscDetail
          ? {
              targetLevel: process.rscDetail.targetLevel,
              reportFile: mapFile(process.rscDetail.reportFile)
            }
          : null,
        fullProfessorDetails: process.fullProfessorDetail
          ? {
              evaluationMode: process.fullProfessorDetail.evaluationMode,
              finalReferenceDate: process.fullProfessorDetail.finalReferenceDate,
              memorialFile: mapFile(process.fullProfessorDetail.memorialFile),
              thesisFile: mapFile(process.fullProfessorDetail.thesisFile),
              doctorateDegree: process.fullProfessorDetail.doctorateDegree
                ? {
                    course: process.fullProfessorDetail.doctorateDegree.course,
                    institution: process.fullProfessorDetail.doctorateDegree.institution,
                    conclusionDate: process.fullProfessorDetail.doctorateDegree.conclusionDate,
                    evidenceFile: mapFile(process.fullProfessorDetail.doctorateDegree.evidenceFile)
                  }
                : null
            }
          : null
      },
      scoringTable: process.table
        ? {
            idScoringTable: process.table.idScoringTable,
            name: process.table.name,
            minRequiredPoints:
              process.table.minRequiredPoints === null ? null : decimalToNumber(process.table.minRequiredPoints),
            nodes: process.table.nodes.map((node: any) => ({
              idScoringNode: node.idScoringNode,
              parentId: node.parentId,
              name: node.name,
              code: node.code,
              sortOrder: node.sortOrder,
              maxPoints: node.maxPoints === null ? null : decimalToNumber(node.maxPoints)
            })),
            items: process.scores.map((score: any) => ({
              idScoringItem: score.itemId,
              nodeId: score.item.nodeId,
              description: score.item.description,
              unit: score.item.unit,
              basePoints: decimalToNumber(score.item.points),
              factor: score.item.factor === null ? null : decimalToNumber(score.item.factor),
              weight: score.item.weight === null ? null : decimalToNumber(score.item.weight),
              maxQuantity: score.item.maxQuantity,
              claimedQuantity: score.quantity,
              claimedPoints: decimalToNumber(score.awardedPoints),
              evidenceFile: mapFile(score.evidenceFile)
            }))
          }
        : null,
      evaluation: {
        idIndividualEvaluation: evaluation.idIndividualEvaluation,
        status: evaluation.status,
        result: evaluation.result,
        recognizedPoints:
          evaluation.recognizedPoints === null ? null : decimalToNumber(evaluation.recognizedPoints),
        opinionText: evaluation.opinionText,
        submittedAt: evaluation.submittedAt,
        scores: currentScores
      }
    }
  }

  private mapRscLevelByNode(nodes: any[]): Map<number, string> {
    const nodeById = new Map(nodes.map(node => [node.idScoringNode, node]))
    const result = new Map<number, string>()

    const resolve = (nodeId: number): string | null => {
      const cached = result.get(nodeId)
      if (cached) return cached

      let current = nodeById.get(nodeId)
      const visited = new Set<number>()
      while (current && !visited.has(current.idScoringNode)) {
        visited.add(current.idScoringNode)
        const level = this.identifyRscLevel(current.code, current.name)
        if (level) {
          visited.forEach(id => result.set(id, level))
          return level
        }
        current = current.parentId ? nodeById.get(current.parentId) : null
      }
      return null
    }

    nodes.forEach(node => resolve(node.idScoringNode))
    return result
  }

  private identifyRscLevel(code?: string | null, name?: string | null): string | null {
    const normalized = `${code ?? ""} ${name ?? ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")

    if (/(^|_)RSC_?III($|_)/.test(normalized)) return "RSC_III"
    if (/(^|_)RSC_?II($|_)/.test(normalized)) return "RSC_II"
    if (/(^|_)RSC_?I($|_)/.test(normalized)) return "RSC_I"
    return null
  }
}
