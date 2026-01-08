import { prisma } from "../infra/prismaClient"

type TableStatus = "DRAFT" | "ACTIVE" | "INACTIVE"

export class ScoringTableRepository {
  async findVigente(referenceDate: Date) {
    return prisma.scoringTable.findFirst({
      where: {
        deletedDate: null,
        status: "ACTIVE",
        AND: [
          { OR: [{ startsOn: null }, { startsOn: { lte: referenceDate } }] },
          { OR: [{ endsOn: null }, { endsOn: { gte: referenceDate } }] }
        ]
      },
      orderBy: { startsOn: "desc" }
    })
  }

  async findById(scoringTableId: number) {
    return prisma.scoringTable.findFirst({
      where: {
        idScoringTable: scoringTableId,
        deletedDate: null
      }
    })
  }

  async findByIdWithStructure(scoringTableId: number) {
    const table = await prisma.scoringTable.findFirst({
      where: {
        idScoringTable: scoringTableId,
        deletedDate: null
      }
    })

    if (!table) return null

    const [nodes, items] = await Promise.all([
      prisma.scoringNode.findMany({
        where: { scoringTableId, deletedDate: null, active: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }, { idScoringNode: "asc" }]
      }),
      prisma.scoringItem.findMany({
        where: { scoringTableId, deletedDate: null, active: true },
        orderBy: { idScoringItem: "asc" }
      })
    ])

    return { table, nodes, items }
  }

  async createTable(params: { name: string; startsOn: Date | null; endsOn: Date | null }) {
    return prisma.scoringTable.create({
      data: {
        name: params.name,
        startsOn: params.startsOn,
        endsOn: params.endsOn
      }
    })
  }

  async updateTable(scoringTableId: number, data: {
    name?: string
    startsOn?: Date | null
    endsOn?: Date | null
    status?: TableStatus
  }) {
    return prisma.scoringTable.update({
      where: { idScoringTable: scoringTableId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.startsOn !== undefined ? { startsOn: data.startsOn } : {}),
        ...(data.endsOn !== undefined ? { endsOn: data.endsOn } : {}),
        ...(data.status !== undefined ? { status: data.status } : {})
      }
    })
  }

  async findManyAdmin(params: {
    q?: string | null
    status?: TableStatus | null
    startsOnFrom?: Date | null
    startsOnTo?: Date | null
    endsOnFrom?: Date | null
    endsOnTo?: Date | null
  }) {
    const where: any = { deletedDate: null }

    if (params.q) {
      where.name = { contains: params.q, mode: "insensitive" }
    }

    if (params.status) {
      where.status = params.status
    }

    if (params.startsOnFrom || params.startsOnTo) {
      where.startsOn = {}
      if (params.startsOnFrom) where.startsOn.gte = params.startsOnFrom
      if (params.startsOnTo) where.startsOn.lte = params.startsOnTo
    }

    if (params.endsOnFrom || params.endsOnTo) {
      where.endsOn = {}
      if (params.endsOnFrom) where.endsOn.gte = params.endsOnFrom
      if (params.endsOnTo) where.endsOn.lte = params.endsOnTo
    }

    return prisma.scoringTable.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { startsOn: "desc" },
        { createdAt: "desc" }
      ]
    })
  }

  async createNode(params: {
    scoringTableId: number
    name: string
    code?: string | null
    sortOrder?: number
    parentId?: number | null
    hasFormula?: boolean
    formulaExpression?: string | null
  }) {
    return prisma.scoringNode.create({
      data: {
        scoringTableId: params.scoringTableId,
        parentId: params.parentId ?? null,
        name: params.name,
        code: params.code ?? null,
        sortOrder: params.sortOrder ?? 0,
        active: true,
        hasFormula: params.hasFormula ?? false,
        formulaExpression: (params.hasFormula ?? false)
          ? params.formulaExpression ?? null
          : null
      }
    })
  }

  async updateNodeParent(nodeId: number, parentId: number | null) {
    return prisma.scoringNode.update({
      where: { idScoringNode: nodeId },
      data: { parentId }
    })
  }

  async createItem(params: {
    scoringTableId: number
    nodeId: number
    description: string
    unit?: string | null
    points: string
    hasMaxPoints?: boolean
    maxPoints?: string | null
    formulaKey?: string | null
  }) {
    return prisma.scoringItem.create({
      data: {
        scoringTableId: params.scoringTableId,
        nodeId: params.nodeId,
        description: params.description,
        unit: params.unit ?? null,
        points: params.points,
        hasMaxPoints: params.hasMaxPoints ?? false,
        maxPoints: (params.hasMaxPoints ?? false) ? params.maxPoints ?? null : null,
        active: true,
        formulaKey: params.formulaKey ?? null
      }
    })
  }

  async findNodeById(nodeId: number) {
    return prisma.scoringNode.findFirst({
      where: {
        idScoringNode: nodeId,
        deletedDate: null
      }
    })
  }

  async saveBlockTransactional(params: {
    scoringTableId: number
    nodes: Array<{
      draftId: string
      name: string
      code: string
      parentDraftId: string | null
      sortOrder: number
      hasFormula: boolean
      formulaExpression: string | null
      items: Array<{
        description: string
        unit: string | null
        points: string
        hasMaxPoints: boolean
        maxPoints: string | null
        formulaKey: string | null
      }>
    }>
  }) {
    return prisma.$transaction(async tx => {
      const draftToDbId = new Map<string, number>()

      for (const n of params.nodes) {
        const created = await tx.scoringNode.create({
          data: {
            scoringTableId: params.scoringTableId,
            parentId: null,
            name: n.name,
            code: n.code,
            sortOrder: n.sortOrder,
            active: true,
            hasFormula: n.hasFormula,
            formulaExpression: n.hasFormula ? n.formulaExpression : null
          }
        })

        draftToDbId.set(n.draftId, created.idScoringNode)
      }

      for (const n of params.nodes) {
        if (!n.parentDraftId) continue

        const nodeId = draftToDbId.get(n.draftId)
        const parentId = draftToDbId.get(n.parentDraftId)

        if (!nodeId || !parentId) continue

        await tx.scoringNode.update({
          where: { idScoringNode: nodeId },
          data: { parentId }
        })
      }

      for (const n of params.nodes) {
        const nodeId = draftToDbId.get(n.draftId)
        if (!nodeId) continue

        for (const item of n.items) {
          await tx.scoringItem.create({
            data: {
              scoringTableId: params.scoringTableId,
              nodeId,
              description: item.description,
              unit: item.unit,
              points: item.points,
              hasMaxPoints: item.hasMaxPoints,
              maxPoints: item.hasMaxPoints ? item.maxPoints : null,
              formulaKey: item.formulaKey,
              active: true
            }
          })
        }
      }

      return {
        nodeMap: Array.from(draftToDbId.entries()).map(([draftId, idScoringNode]) => ({
          draftId,
          idScoringNode
        }))
      }
    })
  }

  async findItemsByTableId(scoringTableId: number) {
    return prisma.scoringItem.findMany({
      where: {
        scoringTableId,
        deletedDate: null,
        active: true
      },
      orderBy: {
        idScoringItem: "asc"
      }
    })
  }

  async findNodesByTableId(scoringTableId: number) {
    return prisma.scoringNode.findMany({
      where: {
        scoringTableId,
        deletedDate: null,
        active: true
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }, { idScoringNode: "asc" }]
    })
  }

  async findItemById(itemId: number) {
    return prisma.scoringItem.findUnique({
      where: {
        idScoringItem: itemId
      },
      include: {
        table: true
      }
    })
  }

  async updateNode(nodeId: number, data: {
    name?: string
    code?: string | null
    sortOrder?: number
    parentId?: number | null
    hasFormula?: boolean
    formulaExpression?: string | null
  }) {
    return prisma.scoringNode.update({
      where: { idScoringNode: nodeId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
        ...(data.hasFormula !== undefined ? { hasFormula: data.hasFormula } : {}),
        ...(data.formulaExpression !== undefined
          ? { formulaExpression: data.hasFormula ? data.formulaExpression : null }
          : {})
      }
    })
  }

  async updateItem(itemId: number, data: {
    description?: string
    unit?: string | null
    points?: string
    hasMaxPoints?: boolean
    maxPoints?: string | null
    formulaKey?: string | null
  }) {
    return prisma.scoringItem.update({
      where: { idScoringItem: itemId },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.points !== undefined ? { points: data.points } : {}),
        ...(data.hasMaxPoints !== undefined ? { hasMaxPoints: data.hasMaxPoints } : {}),
        ...(data.maxPoints !== undefined ? { maxPoints: data.hasMaxPoints ? data.maxPoints : null } : {}),
        ...(data.formulaKey !== undefined ? { formulaKey: data.formulaKey } : {})
      }
    })
  }

  // ---------------- ADMIN: vínculos e ações ----------------

  async countProcessesByTableId(scoringTableId: number) {
    return prisma.careerProcess.count({
      where: {
        scoringTableId,
        deletedDate: null
      }
    })
  }

  async softDeleteTable(scoringTableId: number, when: Date) {
    return prisma.scoringTable.update({
      where: { idScoringTable: scoringTableId },
      data: { deletedDate: when }
    })
  }
}
