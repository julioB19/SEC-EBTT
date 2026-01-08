import { prisma } from "../infra/prismaClient"

export class EvidenceFileRepository {
  async create(params: {
    userId: number
    originalName: string
    storedName: string
    url: string
    mimeType?: string | null
    sizeBytes?: number | null
  }) {
    return prisma.evidenceFile.create({
      data: {
        userId: params.userId,
        originalName: params.originalName,
        storedName: params.storedName,
        url: params.url,
        mimeType: params.mimeType ?? null,
        sizeBytes:
          params.sizeBytes !== undefined && params.sizeBytes !== null
            ? BigInt(params.sizeBytes)
            : null
      }
    })
  }

  async listByUser(userId: number) {
    return prisma.evidenceFile.findMany({
      where: {
        userId,
        deletedDate: null
      },
      orderBy: {
        uploadedAt: "desc"
      }
    })
  }

  async findById(idEvidenceFile: number) {
    return prisma.evidenceFile.findUnique({
      where: {
        idEvidenceFile
      }
    })
  }
}
