import { prisma } from "../infra/prismaClient"

export class ProcessScoreRepository {
  async findByProcessAndItem(processId: number, itemId: number) {
    return prisma.processScore.findUnique({
      where: {
        processId_itemId: {
          processId,
          itemId
        }
      },
      include: {
        evidenceFile: true,
        item: true
      }
    })
  }

  async upsertScore(
    processId: number,
    itemId: number,
    quantity: number,
    awardedPoints: string,
    evidenceFileId?: number | null
  ) {
    return prisma.processScore.upsert({
      where: {
        processId_itemId: {
          processId,
          itemId
        }
      },
      create: {
        processId,
        itemId,
        quantity,
        awardedPoints,
        evidenceFileId: evidenceFileId ?? null
      },
      update: {
        quantity,
        awardedPoints,
        evidenceFileId: evidenceFileId ?? undefined
      },
      include: {
        evidenceFile: true,
        item: true
      }
    })
  }

  async listByProcess(processId: number) {
    return prisma.processScore.findMany({
      where: {
        processId,
        deletedDate: null
      },
      include: {
        evidenceFile: true,
        item: {
          include: {
            node: true
          }
        }
      },
      orderBy: {
        idProcessScore: "asc"
      }
    })
  }

  async listByProcessAndNode(processId: number, nodeId: number) {
    return prisma.processScore.findMany({
      where: {
        processId,
        deletedDate: null,
        item: {
          nodeId
        }
      },
      include: {
        item: true,
        evidenceFile: true
      },
      orderBy: {
        idProcessScore: "asc"
      }
    })
  }

  async updateEvidence(
    processId: number,
    itemId: number,
    evidenceFileId: number | null
  ) {
    return prisma.processScore.update({
      where: {
        processId_itemId: {
          processId,
          itemId
        }
      },
      data: {
        evidenceFileId
      },
      include: {
        evidenceFile: true,
        item: true
      }
    })
  }

  async sumTotalAwardedPointsByProcess(processId: number): Promise<number> {
    const result = await prisma.processScore.aggregate({
      where: {
        processId,
        deletedDate: null
      },
      _sum: {
        awardedPoints: true
      }
    })

    const raw = result._sum.awardedPoints

    if (raw === null || raw === undefined) {
      return 0
    }

    if (typeof raw === "object" && typeof (raw as any).toNumber === "function") {
      return (raw as any).toNumber()
    }

    const num = Number(raw)
    return Number.isNaN(num) ? 0 : num
  }

  async findBlocksWithScoresByProcess(processId: number) {
    const process = await prisma.careerProcess.findUnique({
      where: {
        idProcess: processId,
        deletedDate: null
      },
      select: {
        scoringTableId: true
      }
    })

    if (!process) {
      return []
    }

    const nodes = await prisma.scoringNode.findMany({
      where: {
        scoringTableId: process.scoringTableId,
        deletedDate: null
      },
      include: {
        items: {
          where: {
            deletedDate: null
          },
          include: {
            ProcessScore: {
              where: {
                processId,
                deletedDate: null
              }
            }
          }
        }
      },
      orderBy: {
        sortOrder: "asc"
      }
    })

    return nodes.map(node => ({
      nodeId: node.idScoringNode,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      hasFormula: node.hasFormula,
      formulaExpression: node.formulaExpression,
      items: node.items.map(item => {
        const score = item.ProcessScore[0] ?? null

        return {
          itemId: item.idScoringItem,
          points: Number(item.points),
          hasMaxPoints: item.hasMaxPoints,
          maxPoints:
            item.maxPoints !== null && item.maxPoints !== undefined
              ? Number(item.maxPoints)
              : null,
          formulaKey: item.formulaKey,
          currentScore: score
            ? {
                quantity: score.quantity,
                awardedPoints: Number(score.awardedPoints)
              }
            : null
        }
      })
    }))
  }
}
