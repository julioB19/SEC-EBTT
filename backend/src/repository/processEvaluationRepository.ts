import { ClassLevel, ProcessStatus } from "@prisma/client"
import { prisma } from "../infra/prismaClient"

export class MissingProcessScoreError extends Error {}
export class MissingDocenteProfileError extends Error {}

export class ProcessEvaluationRepository {
  async findProcess(processId: number) {
    return prisma.careerProcess.findUnique({ where: { idProcess: processId } })
  }

  async findProcessWithUserAndTable(processId: number) {
    return prisma.careerProcess.findUnique({
      where: { idProcess: processId },
      include: { user: { include: { docente: true } }, table: true }
    })
  }

  async findEvaluationData(
    processId: number,
    scoringTableId: number,
    includeEvidence = false
  ): Promise<{ nodes: any[]; items: any[]; scores: any[]; nodeScores: any[] }> {
    const [nodes, items, scores, nodeScores] = await Promise.all([
      prisma.scoringNode.findMany({
        where: { scoringTableId, deletedDate: null, active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          idScoringNode: true, parentId: true, name: true, code: true, sortOrder: true,
          hasFormula: true, formulaExpression: true
        }
      }),
      prisma.scoringItem.findMany({ where: { scoringTableId, deletedDate: null, active: true } }),
      prisma.processScore.findMany({
        where: { processId, deletedDate: null },
        ...(includeEvidence ? { include: { item: true, evidenceFile: true } } : {}),
        orderBy: { idProcessScore: "asc" }
      }),
      prisma.processNodeScore.findMany({ where: { processId, deletedDate: null } })
    ])
    return { nodes, items, scores, nodeScores }
  }

  async updateItemScores(processId: number, updates: Array<{
    itemId: number
    evaluatorAwardedPoints: string | null
    evaluatorComment: string | null
  }>) {
    return prisma.$transaction(async tx => {
      for (const update of updates) {
        const existing = await tx.processScore.findUnique({
          where: { processId_itemId: { processId, itemId: update.itemId } }
        })
        if (!existing || existing.deletedDate) throw new MissingProcessScoreError()
        await tx.processScore.update({
          where: { processId_itemId: { processId, itemId: update.itemId } },
          data: {
            evaluatorAwardedPoints: update.evaluatorAwardedPoints,
            evaluatorComment: update.evaluatorComment
          }
        })
      }
    })
  }

  async setEvaluators(processId: number, evaluatorUserIds: number[]) {
    return prisma.careerProcess.update({
      where: { idProcess: processId }, data: { evaluatorUserIds }
    })
  }

  async upsertNodeTotals(processId: number, nodeId: number, docente: string, cppd: string | null) {
    return prisma.processNodeScore.upsert({
      where: { processId_nodeId: { processId, nodeId } },
      create: { processId, nodeId, totalPoints: docente, evaluatorTotalPoints: cppd },
      update: { totalPoints: docente, evaluatorTotalPoints: cppd }
    })
  }

  async updateFinalPoints(processId: number, finalPoints: string) {
    return prisma.careerProcess.update({ where: { idProcess: processId }, data: { finalPoints } })
  }

  async finalizeEvaluation(params: {
    processId: number
    userId: number
    fromStatus: ProcessStatus
    toStatus: ProcessStatus
    finalPoints: string
    evaluationOpinion: string
    evaluatorUserIds: number[]
    changedById: number
    targetLevel: ClassLevel | null
    intersticeEnd: Date
  }) {
    return prisma.$transaction(async tx => {
      const updated = await tx.careerProcess.update({
        where: { idProcess: params.processId },
        data: {
          status: params.toStatus,
          finalPoints: params.finalPoints,
          evaluationOpinion: params.evaluationOpinion,
          evaluatorUserIds: params.evaluatorUserIds
        }
      })
      await tx.processStatusHistory.create({
        data: {
          processId: params.processId,
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          changedById: params.changedById,
          note: null
        }
      })
      if (params.targetLevel !== null) {
        const docente = await tx.docenteProfile.findUnique({ where: { userId: params.userId } })
        if (!docente || docente.deletedDate) throw new MissingDocenteProfileError()
        await tx.docenteProfile.update({
          where: { userId: params.userId },
          data: { classLevel: params.targetLevel, start_interstice: params.intersticeEnd }
        })
      }
      return updated
    })
  }

  async findScoresWithItems(processId: number) {
    return prisma.processScore.findMany({
      where: { processId, deletedDate: null }, include: { item: true },
      orderBy: { idProcessScore: "asc" }
    })
  }

  async findEvidenceLinkedToProcess(processId: number, evidenceFileId: number) {
    const process = await prisma.careerProcess.findFirst({
      where: { idProcess: processId, deletedDate: null },
      select: { idProcess: true }
    })
    if (!process) return { process: null, file: null, linked: false }

    const [file, score] = await Promise.all([
      prisma.evidenceFile.findFirst({
        where: { idEvidenceFile: evidenceFileId, deletedDate: null }
      }),
      prisma.processScore.findFirst({
        where: { processId, evidenceFileId, deletedDate: null },
        select: { idProcessScore: true }
      })
    ])

    return { process, file, linked: Boolean(score) }
  }
}
