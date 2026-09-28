import { GeccInterestedType, GeccStatus, PersonType, ProcessStatus } from "@prisma/client"
import { prisma } from "../infra/prismaClient"

const geccInclude = {
  checklistDocument: { include: { evidenceFile: true } },
  interestedPeople: {
    where: { deletedDate: null },
    orderBy: { createdAt: "asc" as const },
    include: { person: true }
  },
  documents: {
    where: { deletedDate: null },
    orderBy: { createdAt: "asc" as const },
    include: { person: true, evidenceFile: true }
  }
}

export class GeccRepository {
  async findProcess(processId: number) {
    return prisma.careerProcess.findFirst({
      where: { idProcess: processId, deletedDate: null },
      include: {
        user: { include: { docente: true } },
        processTypeConfig: true,
        geccProcesses: {
          where: { deletedDate: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: geccInclude
        }
      }
    })
  }

  async updateDetails(idProcessGecc: number, externalNumber: string | null) {
    return prisma.processGecc.update({
      where: { idProcessGecc },
      data: { externalNumber },
      include: geccInclude
    })
  }

  async addInterested(params: {
    processGeccId: number
    name: string
    email: string
    type: GeccInterestedType
  }) {
    return prisma.$transaction(async tx => {
      const existingPerson = await tx.person.findUnique({ where: { email: params.email } })
      const person = existingPerson
        ? await tx.person.update({
            where: { idPerson: existingPerson.idPerson },
            data: { active: true, deletedDate: null }
          })
        : await tx.person.create({
            data: {
              name: params.name,
              email: params.email,
              type: PersonType.GECC_INTERESTED
            }
          })

      await tx.geccInterested.upsert({
        where: {
          processGeccId_personId_type: {
            processGeccId: params.processGeccId,
            personId: person.idPerson,
            type: params.type
          }
        },
        create: {
          processGeccId: params.processGeccId,
          personId: person.idPerson,
          type: params.type,
          informedEmail: params.email
        },
        update: { informedEmail: params.email, deletedDate: null }
      })

      await tx.processGecc.updateMany({
        where: { idProcessGecc: params.processGeccId, status: GeccStatus.DRAFT },
        data: { status: GeccStatus.PENDING_DOCUMENTS }
      })
    })
  }

  async removeInterested(processGeccId: number, personId: number, type: GeccInterestedType) {
    return prisma.geccInterested.updateMany({
      where: { processGeccId, personId, type, deletedDate: null },
      data: { deletedDate: new Date() }
    })
  }

  async findInterested(processGeccId: number, personId: number) {
    return prisma.geccInterested.findFirst({
      where: { processGeccId, personId, deletedDate: null }
    })
  }

  async addDocument(params: {
    processGeccId: number
    personId: number | null
    documentType: string
    userId: number
    originalName: string
    storedName: string
    url: string
    mimeType: string | null
    sizeBytes: number | null
  }) {
    return prisma.$transaction(async tx => {
      const evidence = await tx.evidenceFile.create({
        data: {
          userId: params.userId,
          usageType: "GECC_DOCUMENT",
          originalName: params.originalName,
          storedName: params.storedName,
          url: params.url,
          mimeType: params.mimeType,
          sizeBytes: params.sizeBytes === null ? null : BigInt(params.sizeBytes)
        }
      })
      const document = await tx.geccDocument.create({
        data: {
          processGeccId: params.processGeccId,
          personId: params.personId,
          documentType: params.documentType,
          evidenceFileId: evidence.idEvidenceFile,
          receivedAt: new Date()
        }
      })
      await tx.processGecc.updateMany({
        where: { idProcessGecc: params.processGeccId, status: GeccStatus.DRAFT },
        data: { status: GeccStatus.PENDING_DOCUMENTS }
      })
      return document
    })
  }

  async findDocument(processGeccId: number, documentId: number) {
    return prisma.geccDocument.findFirst({
      where: { idGeccDocument: documentId, processGeccId, deletedDate: null },
      include: { evidenceFile: true }
    })
  }

  async removeDocument(processGeccId: number, documentId: number) {
    return prisma.$transaction(async tx => {
      const document = await tx.geccDocument.findFirst({
        where: { idGeccDocument: documentId, processGeccId, deletedDate: null }
      })
      if (!document) return null
      await tx.geccDocument.update({
        where: { idGeccDocument: documentId },
        data: { deletedDate: new Date() }
      })
      if (document.evidenceFileId) {
        await tx.evidenceFile.update({
          where: { idEvidenceFile: document.evidenceFileId },
          data: { deletedDate: new Date() }
        })
      }
      return document
    })
  }

  async saveChecklist(params: {
    processId: number
    processGeccId: number
    userId: number
    originalName: string
    storedName: string
    url: string
    sizeBytes: number
  }) {
    return prisma.$transaction(async tx => {
      const current = await tx.processGecc.findUnique({
        where: { idProcessGecc: params.processGeccId },
        include: { checklistDocument: true }
      })
      if (current?.checklistDocument) {
        await tx.documentProcess.update({
          where: { idDocumentProcess: current.checklistDocument.idDocumentProcess },
          data: { deletedDate: new Date() }
        })
        if (current.checklistDocument.evidenceFileId) {
          await tx.evidenceFile.update({
            where: { idEvidenceFile: current.checklistDocument.evidenceFileId },
            data: { deletedDate: new Date() }
          })
        }
      }

      const evidence = await tx.evidenceFile.create({
        data: {
          userId: params.userId,
          usageType: "GECC_CHECKLIST",
          originalName: params.originalName,
          storedName: params.storedName,
          url: params.url,
          mimeType: "application/pdf",
          sizeBytes: BigInt(params.sizeBytes)
        }
      })
      const document = await tx.documentProcess.create({
        data: {
          processId: params.processId,
          documentType: "GECC_CHECKLIST",
          nature: "CHECKLIST",
          format: "PDF",
          checked: true,
          evidenceFileId: evidence.idEvidenceFile,
          generatedById: params.userId,
          purpose: "GECC document organization"
        }
      })
      return tx.processGecc.update({
        where: { idProcessGecc: params.processGeccId },
        data: { checklistDocumentId: document.idDocumentProcess },
        include: geccInclude
      })
    })
  }

  async updateStatus(params: {
    processId: number
    processGeccId: number
    status: GeccStatus
    changedById: number
  }) {
    return prisma.$transaction(async tx => {
      const gecc = await tx.processGecc.update({
        where: { idProcessGecc: params.processGeccId },
        data: {
          status: params.status,
          sentToCgpAt: params.status === GeccStatus.SENT_TO_CGP ? new Date() : undefined
        }
      })

      if (params.status === GeccStatus.COMPLETED) {
        const process = await tx.careerProcess.findUnique({ where: { idProcess: params.processId } })
        if (process && process.status !== ProcessStatus.FINALIZED) {
          await tx.careerProcess.update({
            where: { idProcess: params.processId },
            data: { status: ProcessStatus.FINALIZED }
          })
          await tx.processStatusHistory.create({
            data: {
              processId: params.processId,
              fromStatus: process.status,
              toStatus: ProcessStatus.FINALIZED,
              changedById: params.changedById,
              note: "GECC documentation flow completed"
            }
          })
        }
      }
      return gecc
    })
  }
}
