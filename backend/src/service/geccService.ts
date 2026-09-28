import fs from "fs"
import path from "path"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { GeccInterestedType, GeccStatus, ProcessStatus } from "@prisma/client"
import { GeccRepository } from "../repository/geccRepository"
import { AddGeccInterestedDto, SaveGeccDto, UpdateGeccStatusDto } from "../type/dto/geccDto"
import { BusinessRuleError, NotFoundError } from "./processoService"

function mapFile(file: any) {
  if (!file || file.deletedDate) return null
  return {
    idEvidenceFile: file.idEvidenceFile,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes === null || file.sizeBytes === undefined ? null : Number(file.sizeBytes)
  }
}

function safePdfText(value: unknown) {
  return String(value ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
}

export class GeccService {
  constructor(private readonly repository = new GeccRepository()) {}

  async getForProcess(processId: number) {
    const process = await this.getEligibleProcess(processId)
    return this.mapResult(process)
  }

  async save(processId: number, dto: SaveGeccDto) {
    const process = await this.getEditableProcess(processId)
    const gecc = process.geccProcesses[0]
    await this.repository.updateDetails(gecc.idProcessGecc, dto.externalNumber?.trim() || null)
    return this.getForProcess(processId)
  }

  async addInterested(processId: number, dto: AddGeccInterestedDto) {
    const process = await this.getEditableProcess(processId)
    await this.repository.addInterested({
      processGeccId: process.geccProcesses[0].idProcessGecc,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      type: dto.type
    })
    return this.getForProcess(processId)
  }

  async removeInterested(processId: number, personId: number, type: GeccInterestedType) {
    const process = await this.getEditableProcess(processId)
    if (!Object.values(GeccInterestedType).includes(type)) {
      throw new BusinessRuleError("Tipo de interessado inválido")
    }
    const removed = await this.repository.removeInterested(
      process.geccProcesses[0].idProcessGecc,
      personId,
      type
    )
    if (!removed.count) throw new NotFoundError("Interessado do GECC não encontrado")
    return this.getForProcess(processId)
  }

  async addDocument(params: {
    processId: number
    userId: number
    documentType: string
    personId: number | null
    originalName: string
    storedName: string
    url: string
    mimeType: string | null
    sizeBytes: number | null
  }) {
    const process = await this.getEditableProcess(params.processId)
    const processGeccId = process.geccProcesses[0].idProcessGecc
    const documentType = params.documentType.trim()
    if (!documentType || documentType.length > 80) {
      throw new BusinessRuleError("Informe um tipo de documento com até 80 caracteres")
    }
    if (params.personId) {
      const interested = await this.repository.findInterested(processGeccId, params.personId)
      if (!interested) throw new BusinessRuleError("O interessado selecionado não pertence a este GECC")
    }

    await this.repository.addDocument({
      processGeccId,
      personId: params.personId,
      documentType,
      userId: params.userId,
      originalName: params.originalName,
      storedName: params.storedName,
      url: params.url,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes
    })
    return this.getForProcess(params.processId)
  }

  async removeDocument(processId: number, documentId: number) {
    const processRecord = await this.getEditableProcess(processId)
    const processGeccId = processRecord.geccProcesses[0].idProcessGecc
    const document = await this.repository.findDocument(processGeccId, documentId)
    if (!document) throw new NotFoundError("Documento do GECC não encontrado")
    await this.repository.removeDocument(processGeccId, documentId)

    if (document.evidenceFile?.url?.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "uploads", document.evidenceFile.url.replace("/uploads/", ""))
      await fs.promises.unlink(filePath).catch(() => undefined)
    }
    return this.getForProcess(processId)
  }

  async generateChecklist(processId: number, userId: number) {
    const processRecord = await this.getEditableProcess(processId)
    const gecc = processRecord.geccProcesses[0]
    const previousChecklistUrl = gecc.checklistDocument?.evidenceFile?.url ?? null
    const pdfBytes = await this.buildChecklistPdf(processRecord, gecc)
    const storedName = `gecc-checklist-${processId}-${Date.now()}.pdf`
    const directory = path.join(process.cwd(), "uploads", String(userId), String(processId))
    await fs.promises.mkdir(directory, { recursive: true })
    const filePath = path.join(directory, storedName)
    await fs.promises.writeFile(filePath, pdfBytes)

    try {
      await this.repository.saveChecklist({
        processId,
        processGeccId: gecc.idProcessGecc,
        userId,
        originalName: `Checklist GECC - processo ${processId}.pdf`,
        storedName,
        url: `/uploads/${userId}/${processId}/${storedName}`,
        sizeBytes: pdfBytes.length
      })
      if (previousChecklistUrl?.startsWith("/uploads/")) {
        const previousFilePath = path.join(
          process.cwd(),
          "uploads",
          previousChecklistUrl.replace("/uploads/", "")
        )
        await fs.promises.unlink(previousFilePath).catch(() => undefined)
      }
    } catch (error) {
      await fs.promises.unlink(filePath).catch(() => undefined)
      throw error
    }
    return this.getForProcess(processId)
  }

  async updateStatus(processId: number, currentUserId: number, dto: UpdateGeccStatusDto) {
    const process = await this.getEligibleProcess(processId)
    const gecc = process.geccProcesses[0]

    if (dto.status === GeccStatus.READY_TO_SEND) {
      if (gecc.status !== GeccStatus.DRAFT && gecc.status !== GeccStatus.PENDING_DOCUMENTS) {
        throw new BusinessRuleError("O GECC não está em preparação")
      }
      if (!gecc.interestedPeople.length) throw new BusinessRuleError("Adicione ao menos um interessado")
      if (!gecc.documents.length) throw new BusinessRuleError("Anexe ao menos um documento")
      if (!gecc.checklistDocument?.evidenceFile) throw new BusinessRuleError("Gere o checklist antes de finalizar a organização")
    } else if (dto.status === GeccStatus.SENT_TO_CGP) {
      if (gecc.status !== GeccStatus.READY_TO_SEND) {
        throw new BusinessRuleError("Marque o GECC como pronto antes de registrar o envio")
      }
    } else if (dto.status === GeccStatus.COMPLETED) {
      if (gecc.status !== GeccStatus.SENT_TO_CGP) {
        throw new BusinessRuleError("Registre o envio à CGP antes de concluir o GECC")
      }
    }

    await this.repository.updateStatus({
      processId,
      processGeccId: gecc.idProcessGecc,
      status: dto.status,
      changedById: currentUserId
    })
    return this.getForProcess(processId)
  }

  async getDocumentContent(processId: number, evidenceFileId: number) {
    const processRecord = await this.getEligibleProcess(processId)
    const gecc = processRecord.geccProcesses[0]
    const files = [
      gecc.checklistDocument?.evidenceFile,
      ...gecc.documents.map((document: any) => document.evidenceFile)
    ].filter(Boolean)
    const file = files.find((candidate: any) => candidate.idEvidenceFile === evidenceFileId)
    if (!file || file.deletedDate) throw new NotFoundError("Documento do GECC não encontrado")
    if (!file.url?.startsWith("/uploads/")) throw new BusinessRuleError("Caminho do documento inválido")
    const filePath = path.join(process.cwd(), "uploads", file.url.replace("/uploads/", ""))
    if (!fs.existsSync(filePath)) throw new NotFoundError("Documento não encontrado no servidor")
    return { filePath, originalName: file.originalName, mimeType: file.mimeType ?? "application/pdf" }
  }

  private async getEligibleProcess(processId: number) {
    const process = await this.repository.findProcess(processId)
    if (!process) throw new NotFoundError("Processo não encontrado")
    if (!process.processTypeConfig?.requiresGecc) {
      throw new BusinessRuleError("Este tipo de processo não utiliza GECC")
    }
    if (!process.geccProcesses[0]) throw new NotFoundError("Organizador GECC não encontrado")
    if (process.status !== ProcessStatus.AWAITING_GECC && process.status !== ProcessStatus.FINALIZED) {
      throw new BusinessRuleError("O processo não está na etapa do GECC")
    }
    return process
  }

  private async getEditableProcess(processId: number) {
    const process = await this.getEligibleProcess(processId)
    const status = process.geccProcesses[0].status
    if (status !== GeccStatus.DRAFT && status !== GeccStatus.PENDING_DOCUMENTS) {
      throw new BusinessRuleError("A documentação não pode mais ser alterada nesta etapa")
    }
    return process
  }

  private mapResult(process: any) {
    const gecc = process.geccProcesses[0]
    return {
      process: {
        idProcess: process.idProcess,
        status: process.status,
        processTypeName: process.processTypeConfig?.name ?? process.type,
        teacherName: process.user.name,
        teacherSiape: process.user.docente?.siape ?? null,
        campus: process.campus,
        cityState: process.cidadeUF
      },
      gecc: {
        idProcessGecc: gecc.idProcessGecc,
        externalNumber: gecc.externalNumber,
        status: gecc.status,
        sentToCgpAt: gecc.sentToCgpAt,
        checklistFile: mapFile(gecc.checklistDocument?.evidenceFile),
        interestedPeople: gecc.interestedPeople.map((interested: any) => ({
          personId: interested.personId,
          type: interested.type,
          informedEmail: interested.informedEmail,
          name: interested.person.name,
          email: interested.person.email
        })),
        documents: gecc.documents.map((document: any) => ({
          idGeccDocument: document.idGeccDocument,
          personId: document.personId,
          personName: document.person?.name ?? null,
          documentType: document.documentType,
          receivedAt: document.receivedAt,
          file: mapFile(document.evidenceFile)
        }))
      }
    }
  }

  private async buildChecklistPdf(process: any, gecc: any) {
    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const pageWidth = 595.28
    const pageHeight = 841.89
    const margin = 48
    const contentWidth = pageWidth - margin * 2
    let page = pdf.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    const addLine = (text: string, options: { size?: number; bold?: boolean; gap?: number } = {}) => {
      const size = options.size ?? 10
      const font = options.bold ? bold : regular
      const words = safePdfText(text).split(/\s+/)
      const lines: string[] = []
      let current = ""
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(candidate, size) <= contentWidth) current = candidate
        else {
          if (current) lines.push(current)
          current = word
        }
      }
      if (current) lines.push(current)

      for (const line of lines.length ? lines : [""]) {
        if (y < margin + 24) {
          page = pdf.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) })
        y -= size + 5
      }
      y -= options.gap ?? 2
    }

    addLine("CHECKLIST DE ORGANIZAÇÃO DOCUMENTAL - GECC", { size: 15, bold: true, gap: 12 })
    addLine(`Processo SEC-EBTT: ${process.idProcess}`, { bold: true })
    addLine(`Número externo: ${gecc.externalNumber || "Não informado"}`)
    addLine(`Docente: ${process.user.name}`)
    addLine(`SIAPE: ${process.user.docente?.siape || "Não informado"}`)
    addLine(`Campus: ${process.campus} - ${process.cidadeUF}`, { gap: 12 })

    addLine("INTERESSADOS", { size: 12, bold: true, gap: 5 })
    if (!gecc.interestedPeople.length) addLine("Nenhum interessado cadastrado.")
    for (const interested of gecc.interestedPeople) {
      addLine(`- ${interested.person.name} | ${interested.informedEmail || interested.person.email || "sem e-mail"} | ${interested.type}`)
    }
    y -= 8

    addLine("DOCUMENTOS RECEBIDOS", { size: 12, bold: true, gap: 5 })
    if (!gecc.documents.length) addLine("Nenhum documento anexado.")
    for (const document of gecc.documents) {
      const received = document.receivedAt
        ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(document.receivedAt)
        : "data não informada"
      addLine(`- ${document.documentType} | ${document.person?.name || "Documento geral"} | ${received} | ${document.evidenceFile?.originalName || "sem arquivo"}`)
    }
    y -= 14
    addLine("Documento gerado para apoio à organização interna. O registro nos sistemas externos deve ser realizado pelo usuário responsável.", { size: 9 })

    return pdf.save()
  }
}
