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
    const result = dto.result ?? null

    if (submitting && !result) throw new BusinessRuleError("Informe o resultado da avaliação")
    if (submitting && !opinionText) throw new BusinessRuleError("Informe o parecer individual")

    if (assignment.specialCommission.type === SpecialCommissionType.FULL_PROFESSOR) {
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
      const awardedPoints = Number(score.awardedPoints)
      const claimedPoints = decimalToNumber(claim.awardedPoints)
      if (!Number.isFinite(awardedPoints) || awardedPoints < 0 || awardedPoints > claimedPoints) {
        throw new BusinessRuleError(
          `A pontuação reconhecida para "${claim.item.description}" deve ficar entre 0 e ${claimedPoints.toFixed(2)}`
        )
      }
      return {
        itemId: Number(score.itemId),
        quantity: claim.quantity,
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

    const recognizedPoints = normalizedScores
      .reduce((total, score) => total + score.awardedPoints, 0)
      .toFixed(2)

    const minRequiredPoints =
      process.table.minRequiredPoints === null || process.table.minRequiredPoints === undefined
        ? 60
        : decimalToNumber(process.table.minRequiredPoints)
    if (
      submitting &&
      (result === "DEFERRED" || result === "APPROVED") &&
      Number(recognizedPoints) < minRequiredPoints
    ) {
      throw new BusinessRuleError(
        `O resultado favorável exige ao menos ${minRequiredPoints.toFixed(2)} pontos reconhecidos`
      )
    }

    return {
      evaluationId: evaluation.idIndividualEvaluation,
      result,
      opinionText,
      recognizedPoints,
      scores: normalizedScores
    }
  }

  private mapEvaluation(assignment: any) {
    const process = assignment.specialCommission.process
    const evaluation = assignment.individualEvaluations[0]
    const currentScores = evaluation.scores.map((score: any) => ({
      itemId: score.itemId,
      quantity: score.quantity,
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
              simecReference: process.rscDetail.simecReference,
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
              sortOrder: node.sortOrder
            })),
            items: process.scores.map((score: any) => ({
              idScoringItem: score.itemId,
              nodeId: score.item.nodeId,
              description: score.item.description,
              unit: score.item.unit,
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
}
