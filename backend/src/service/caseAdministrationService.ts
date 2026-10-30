import path from "path"
import fs from "fs/promises"
import { PDFDocument } from "pdf-lib"
import { prisma } from "../infra/prismaClient"
import { CaseActor, CaseComplianceService } from "./caseComplianceService"
import { BusinessRuleError } from "./processoService"

export class CaseAdministrationService {
  private admin(actor: CaseActor) { if (!["ADMIN", "CPPD_CENTRAL"].includes(actor.role)) throw new BusinessRuleError("Selecione Administrador ou CPPD Central") }
  async configuration(actor: CaseActor) {
    this.admin(actor)
    return { calendar: await prisma.academicCalendarPeriod.findMany({ where: { deletedAt: null }, orderBy: { startsOn: "asc" } }), templates: await prisma.documentTemplate.findMany({ orderBy: { createdAt: "desc" } }), processTypes: await prisma.processTypeConfig.findMany({ where: { active: true, code: { in: ["PROGRESSION", "PROMOTION", "RSC", "FULL_PROFESSOR"] } }, include: { documentRequirements: true } }), campuses: await prisma.campus.findMany({ where: { active: true } }) }
  }
  async configure(actor: CaseActor, input: any) {
    this.admin(actor)
    const access = new CaseComplianceService()
    if (input.action === "SAVE_CALENDAR") {
      const startsOn = new Date(input.startsOn), endsOn = new Date(input.endsOn)
      if (![startsOn, endsOn].every(value => Number.isFinite(value.getTime())) || startsOn > endsOn || (endsOn.getTime() - startsOn.getTime()) > 366 * 86400000) throw new BusinessRuleError("Informe um intervalo de calendário válido, de até um ano")
      if (!["HOLIDAY", "VACATION", "RECESS"].includes(input.kind)) throw new BusinessRuleError("Tipo de período inválido")
      const campusId = input.campusId ? Number(input.campusId) : null
      if (campusId && !await prisma.campus.findUnique({ where: { idCampus: campusId } })) throw new BusinessRuleError("Campus não encontrado")
      await prisma.academicCalendarPeriod.create({ data: { campusId, startsOn, endsOn, kind: input.kind, description: access.requiredText(input.description, 180, "descrição e fonte do calendário"), createdById: actor.userId } })
    } else if (input.action === "REMOVE_CALENDAR") {
      await prisma.academicCalendarPeriod.update({ where: { idPeriod: Number(input.idPeriod) }, data: { deletedAt: new Date() } })
    } else if (input.action === "SAVE_TEMPLATE") {
      const code = access.requiredText(input.code, 60, "código do documento")
      const name = access.requiredText(input.name, 120, "nome do modelo")
      const version = access.requiredText(input.version, 30, "versão")
      const text = access.requiredText(input.text, 20000, "texto do modelo")
      await prisma.$transaction(async tx => {
        const previous = await tx.documentTemplate.findFirst({ where: { code, deletedDate: null } })
        if (previous) {
          if (previous.version === version) throw new BusinessRuleError("Informe uma nova versão para alterar um modelo")
          await tx.documentTemplate.update({ where: { idDocumentTemplate: previous.idDocumentTemplate }, data: { code: `${code.slice(0, 40)}_v${previous.idDocumentTemplate}`, active: false } })
        }
        await tx.documentTemplate.create({ data: { code, name, version, bodyText: text, createdById: actor.userId, active: true } })
      }, { isolationLevel: "Serializable" })
    } else if (input.action === "SAVE_REQUIREMENT") {
      const processType = await prisma.processTypeConfig.findUnique({ where: { idProcessType: Number(input.processTypeId) } })
      if (!processType || !["PROGRESSION", "PROMOTION", "RSC", "FULL_PROFESSOR"].includes(processType.code)) throw new BusinessRuleError("Selecione um dos quatro tipos de processo")
      const code = access.requiredText(input.code, 60, "código do documento").toUpperCase()
      if (!/^[A-Z][A-Z0-9_]*$/.test(code)) throw new BusinessRuleError("Código de documento inválido")
      if (await prisma.careerProcess.count({ where: { processTypeId: processType.idProcessType } })) throw new BusinessRuleError("Crie uma nova versão do tipo de processo para alterar seus documentos sem afetar os processos existentes")
      await prisma.processTypeDocumentRequirement.upsert({ where: { processTypeId_code: { processTypeId: processType.idProcessType, code } }, create: { processTypeId: processType.idProcessType, code, name: access.requiredText(input.name, 120, "nome do documento"), required: input.required !== false, acceptedFormats: "PDF", maxSizeMb: 20 }, update: { name: access.requiredText(input.name, 120, "nome do documento"), required: input.required !== false } })
    } else if (input.action === "VERSION_PROCESS_TYPE") {
      const type = await prisma.processTypeConfig.findUnique({ where: { idProcessType: Number(input.processTypeId) }, include: { documentRequirements: true } })
      if (!type) throw new BusinessRuleError("Tipo de processo não encontrado")
      await prisma.$transaction(async tx => {
        const latest = await tx.processTypeConfig.findFirst({ where: { code: type.code }, orderBy: { version: "desc" } })
        await tx.processTypeConfig.update({ where: { idProcessType: type.idProcessType }, data: { active: false, validUntil: new Date() } })
        await tx.processTypeConfig.create({ data: { code: type.code, name: type.name, category: type.category, version: (latest?.version ?? 0) + 1, requiresScoring: type.requiresScoring, requiresCommittee: type.requiresCommittee, defaultDestination: type.defaultDestination, opinionTemplateId: type.opinionTemplateId, documentRequirements: { create: type.documentRequirements.map(value => ({ code: value.code, name: value.name, description: value.description, required: value.required, allowsMultiple: value.allowsMultiple, acceptedFormats: value.acceptedFormats, maxSizeMb: value.maxSizeMb, sortOrder: value.sortOrder })) } } })
      }, { isolationLevel: "Serializable" })
    } else throw new BusinessRuleError("Ação administrativa inválida")
    return this.configuration(actor)
  }

  async degrees(actor: CaseActor) {
    if (actor.role !== "DOCENTE") throw new BusinessRuleError("Selecione o perfil Docente")
    return prisma.teacherDegree.findMany({ where: { teacher: { userId: actor.userId } }, include: { evidenceFile: { select: { idEvidenceFile: true, originalName: true } }, recognitionFile: { select: { idEvidenceFile: true, originalName: true } } }, orderBy: { conclusionDate: "desc" } })
  }
  async addDegree(actor: CaseActor, input: any) {
    if (actor.role !== "DOCENTE") throw new BusinessRuleError("Selecione o perfil Docente")
    const access = new CaseComplianceService()
    const teacher = await prisma.docenteProfile.findUnique({ where: { userId: actor.userId } })
    if (!teacher) throw new BusinessRuleError("Perfil docente não encontrado")
    const type = String(input.degreeType).toUpperCase()
    if (!["GRADUATION", "SPECIALIZATION", "MASTERS", "DOCTORATE"].includes(type)) throw new BusinessRuleError("Tipo de titulação inválido")
    const file = await access.ownedPdf(Number(input.evidenceFileId), actor.userId)
    const countryCode = String(input.countryCode ?? "BR").toUpperCase()
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new BusinessRuleError("Use o código de duas letras do país")
    const recognition = input.recognitionFileId ? await access.ownedPdf(Number(input.recognitionFileId), actor.userId) : null
    if (countryCode !== "BR" && !recognition) throw new BusinessRuleError("Diploma estrangeiro exige documento de reconhecimento nacional")
    await prisma.teacherDegree.create({ data: { teacherId: teacher.idDocente, degreeType: type, course: access.requiredText(input.course, 180, "curso"), institution: access.requiredText(input.institution, 180, "instituição"), conclusionDate: access.pastDate(input.conclusionDate, "Conclusão da titulação"), evidenceFileId: file.idEvidenceFile, countryCode, recognitionFileId: recognition?.idEvidenceFile } })
    return this.degrees(actor)
  }
  async uploadEvidence(actor: CaseActor, file: Express.Multer.File) {
    if (actor.role !== "DOCENTE") throw new BusinessRuleError("Selecione o perfil Docente")
    const bytes = await fs.readFile(file.path)
    if (bytes.length > 20 * 1024 * 1024 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new BusinessRuleError("Envie PDF de até 20 MB")
    try { await PDFDocument.load(bytes) } catch { throw new BusinessRuleError("PDF inválido") }
    return prisma.evidenceFile.create({ data: { userId: actor.userId, originalName: file.originalname, storedName: file.filename, url: `/uploads/${path.relative(path.join(process.cwd(), "uploads"), file.path).split(path.sep).join("/")}`, mimeType: "application/pdf", sizeBytes: BigInt(bytes.length), usageType: "TEACHER_DOCUMENT" } })
  }
}
