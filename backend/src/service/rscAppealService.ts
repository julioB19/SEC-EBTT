import { Prisma } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { CaseActor, CaseComplianceService } from "./caseComplianceService"
import { BusinessRuleError } from "./processoService"
import { addCalendarDaysDeadline, deadlineExpired } from "../util/proceduralDeadline"

export class RscAppealService {
  constructor(private readonly access = new CaseComplianceService()) {}
  async submit(processId: number, actor: CaseActor, input: any) {
    const process = await this.access.context(processId, actor)
    if (actor.role !== "DOCENTE" || process.userId !== actor.userId || process.processTypeConfig?.category !== "RSC" || process.status !== "REJECTED") throw new BusinessRuleError("Somente o docente pode recorrer de seu processo RSC indeferido")
    if (process.rscAppeals.some(appeal => appeal.status === "SUBMITTED")) throw new BusinessRuleError("Já existe um recurso em andamento")
    const first = process.rscAppeals.find(appeal => appeal.stage === "CPPD")
    const stage = first ? "CPRSC" : "CPPD"
    if (input.stage !== stage) throw new BusinessRuleError(`O próximo recurso cabível é dirigido à ${stage}`)
    if (first && (first.decision !== "REJECTED" || !first.decidedAt)) throw new BusinessRuleError("O recurso final depende do indeferimento do recurso pela CPPD")
    const denial = await prisma.processStatusHistory.findFirst({ where: { processId, toStatus: "REJECTED" }, orderBy: { createdAt: "desc" } })
    const periods = await prisma.academicCalendarPeriod.findMany({ where: { deletedAt: null, OR: [{ campusId: null }, { campusId: process.campusId }] } })
    const base = stage === "CPRSC" ? first!.decidedAt! : denial?.createdAt ?? process.updatedAt
    const deadline = addCalendarDaysDeadline(base, stage === "CPPD" ? 45 : 10, periods)
    if (deadlineExpired(deadline, new Date())) throw new BusinessRuleError(`O prazo de recurso à ${stage} terminou`)
    const reason = this.access.requiredText(input.reason, 20000, "fundamentos do recurso, sem novas provas")
    const scores = await prisma.processScore.findMany({ where: { processId }, orderBy: { itemId: "asc" }, select: { itemId: true, quantity: true, awardedPoints: true, evidenceFileId: true } })
    const snapshot: Prisma.InputJsonValue = { reportFileId: process.rscDetail?.reportFileId ?? null, scores: scores.map(value => ({ ...value, awardedPoints: String(value.awardedPoints) })) }
    await prisma.$transaction(async tx => {
      const current = await tx.careerProcess.findUniqueOrThrow({ where: { idProcess: processId } })
      if (current.status !== "REJECTED") throw new BusinessRuleError("O processo mudou; recarregue antes de apresentar o recurso")
      const original = process.specialCommissions.find(value => value.status === "COMPLETED")
      const commission = stage === "CPPD" ? await tx.specialCommission.create({ data: { processId, type: "RSC", status: "DRAFT" } }) : null
      const appeal = await tx.rscAppeal.create({ data: { processId, stage, submittedById: actor.userId, reason, deadlineAt: deadline, originalCommissionId: original?.idSpecialCommission, newCommissionId: commission?.idSpecialCommission, evidenceSnapshot: snapshot } })
      if (commission) {
        await tx.careerProcess.update({ where: { idProcess: processId }, data: { status: "SUBMITTED" } })
        await tx.processStatusHistory.create({ data: { processId, fromStatus: "REJECTED", toStatus: "SUBMITTED", changedById: actor.userId, note: "Recurso RSC: nova comissão, sem alteração dos documentos comprobatórios" } })
      }
      await tx.processAudit.create({ data: { processId, actorId: actor.userId, action: "RSC_APPEAL_SUBMITTED", details: { appealId: appeal.idAppeal, stage, snapshot } } })
    }, { isolationLevel: "Serializable" })
    return this.access.get(processId, actor)
  }

  async recordExternalDecision(processId: number, appealId: number, actor: CaseActor, input: any) {
    const process = await this.access.context(processId, actor)
    if (actor.role !== "CPPD_CENTRAL") throw new BusinessRuleError("A decisão externa da CPRSC deve ser registrada pela CPPD Central")
    const appeal = process.rscAppeals.find(value => value.idAppeal === appealId && value.stage === "CPRSC" && value.status === "SUBMITTED")
    if (!appeal) throw new BusinessRuleError("Recurso final em andamento não encontrado")
    if (!["APPROVED", "REJECTED"].includes(input.decision)) throw new BusinessRuleError("Informe a decisão da CPRSC")
    const decisionText = this.access.requiredText(input.decisionText, 20000, "decisão fundamentada da CPRSC")
    const externalReference = this.access.requiredText(input.externalReference, 180, "referência do ato externo")
    const signed = process.signedArtifacts.find(value => value.documentKind === "CPRSC_DECISION" && value.uploadedAt >= appeal.submittedAt)
    if (!signed?.validatedAt || signed.rejectedAt) throw new BusinessRuleError("Anexe e valide o PDF da decisão oficial da CPRSC")
    await prisma.$transaction(async tx => {
      await tx.rscAppeal.update({ where: { idAppeal: appealId }, data: { status: "DECIDED", decision: input.decision, decisionText, decidedAt: new Date(), decidedById: actor.userId, externalReference } })
      await tx.careerProcess.update({ where: { idProcess: processId }, data: { status: input.decision, evaluationOpinion: decisionText } })
      await tx.rscProcessDetail.update({ where: { processId }, data: { finalResult: input.decision } })
      await tx.processStatusHistory.create({ data: { processId, fromStatus: process.status, toStatus: input.decision, changedById: actor.userId, note: `Decisão externa CPRSC: ${externalReference}` } })
      await tx.processAudit.create({ data: { processId, actorId: actor.userId, action: "CPRSC_DECISION_RECORDED", details: { appealId, decision: input.decision, externalReference, artifactId: signed.idArtifact } } })
    }, { isolationLevel: "Serializable" })
    return this.access.get(processId, actor)
  }
}
