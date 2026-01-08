import { prisma } from "../infra/prismaClient"

export class ProcessNodeScoreRepository {
  async upsertNodeScore(
    processId: number,
    nodeId: number,
    totalPoints: string
  ) {
    return prisma.processNodeScore.upsert({
      where: {
        processId_nodeId: {
          processId,
          nodeId
        }
      },
      create: {
        processId,
        nodeId,
        totalPoints
      },
      update: {
        totalPoints
      }
    })
  }

  async listByProcess(processId: number) {
    return prisma.processNodeScore.findMany({
      where: {
        processId,
        deletedDate: null
      }
    })
  }
}
