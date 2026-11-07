import { cwd } from "process"
import { createHash } from "crypto"
import { PDFDocument } from "pdf-lib"
import fs from "fs/promises"
import path from "path"
import { Prisma, RoleName } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { CppdAccessService } from "./cppdAccessService"
import { BusinessRuleError, NotFoundError } from "./processoService"
import { addBusinessDaysDeadline, addCalendarDaysDeadline } from "../util/proceduralDeadline"
import { addMonthsClamped, latestRequirementDate } from "../util/careerDates"

export type CaseActor = { userId: number; role: RoleName }
const cppd = new Set<RoleName>([RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL])
const finalStatuses = new Set(["APPROVED", "REJECTED", "FINALIZED"])
const signedKinds = new Set(["INDIVIDUAL_OPINION", "CONSOLIDATED_OPINION", "PRESIDENT_OPINION", "MEMORIAL_DEFENSE_MINUTES", "THESIS_DEFENSE_MINUTES", "THESIS_ORIGINALITY", "CPPD_ELIGIBILITY_OPINION", "CPRSC_DECISION"])

export function validateNominees(values: any[], applicantEmail?: string) {
  if (!Array.isArray(values) || values.length !== 7) throw new BusinessRuleError("Indique exatamente sete docentes: 3 externos titulares, 2 externos suplentes, 1 interno titular e 1 interno suplente")
  const seen = new Set<string>()
  const counts: Record<string, number> = {}
  return values.map(value => {
    const email = String(value.email ?? "").trim().toLowerCase()
    const origin = value.origin
    const membership = value.membership
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email) || email === applicantEmail?.toLowerCase()) throw new BusinessRuleError("Os indicados devem ter e-mails válidos, distintos e diferentes do requerente")
    seen.add(email)
    if (!["INTERNAL", "EXTERNAL"].includes(origin) || !["PRIMARY", "SUBSTITUTE"].includes(membership)) throw new BusinessRuleError("Origem ou titularidade inválida")
    counts[`${origin}_${membership}`] = (counts[`${origin}_${membership}`] ?? 0) + 1
    if (!value.doctorateTitle || value.federalInstitution !== true || !["C4", "D1", "EQUIVALENT_TITULAR"].includes(value.careerLevel)) throw new BusinessRuleError("Cada indicado deve ser doutor, vinculado a instituição federal e ocupar nível elegível da carreira")
    if (!value.knowledgeArea?.trim() || (value.sameKnowledgeArea !== true && !value.relatedAreaJustification?.trim())) throw new BusinessRuleError("Informe a área de conhecimento e justifique eventual área afim")
    const priorConsentAt = new Date(value.priorConsentAt)
    if (!Number.isFinite(priorConsentAt.getTime()) || priorConsentAt > new Date()) throw new BusinessRuleError("Registre a ciência prévia de todos os indicados")
    for (const key of ["name", "phone", "institution"]) if (!String(value[key] ?? "").trim()) throw new BusinessRuleError("Informe nome, telefone e instituição de todos os indicados")
    return { name: String(value.name).trim(), email, phone: String(value.phone).trim(), origin, membership, doctorateTitle: String(value.doctorateTitle).trim(), institution: String(value.institution).trim(), federalInstitution: true, careerLevel: value.careerLevel, knowledgeArea: String(value.knowledgeArea).trim(), relatedAreaJustification: value.sameKnowledgeArea === true ? null : String(value.relatedAreaJustification).trim(), priorConsentAt }
  }).filter((value, index, values) => {
    if (index === values.length - 1 && (counts.EXTERNAL_PRIMARY !== 3 || counts.EXTERNAL_SUBSTITUTE !== 2 || counts.INTERNAL_PRIMARY !== 1 || counts.INTERNAL_SUBSTITUTE !== 1)) throw new BusinessRuleError("A composição dos sete indicados deve respeitar 3+2+1+1")
    return Boolean(value)
  })
}

export class CaseComplianceService {
  async context(processId: number, actor: CaseActor) {
    const process = await prisma.careerProcess.findFirst({ where: { idProcess: processId, deletedDate: null }, include: {
      user: { include: { docente: true } }, processTypeConfig: true, compliance: true, nominees: { where: { deletedDate: null } },
      fullProfessorDetail: { include: { doctorateDegree: { include: { evidenceFile: true, recognitionFile: true } } } }, rscDetail: true,
      signedArtifacts: { orderBy: { version: "desc" }, include: { evidenceFile: true } },
      audits: { orderBy: { occurredAt: "desc" }, take: 100 }, rscAppeals: { orderBy: { submittedAt: "asc" } },
      specialCommissions: { where: { deletedDate: null }, orderBy: { createdAt: "desc" }, include: { members: { where: { deletedDate: null }, include: { person: { include: { users: true } }, individualEvaluations: { where: { deletedDate: null }, orderBy: { createdAt: "desc" }, take: 1 } } } } }
    } })
    if (!process) throw new NotFoundError("Processo não encontrado")
    if (cppd.has(actor.role)) {
      const service = new CppdAccessService()
      const scope = await service.resolveScope(actor.userId, actor.role)
      await service.assertProcessAccess(scope, processId)
    } else if (!(actor.role === RoleName.DOCENTE && process.userId === actor.userId)) {
      const assignment = process.specialCommissions.filter(commission => ["ACTIVE", "COMPLETED"].includes(commission.status)).flatMap(commission => commission.members).find(member => member.acceptanceStatus === "ACCEPTED" && member.person.users.some(user => user.idUser === actor.userId && user.active && !user.deletedDate))
      if (!assignment || actor.role === RoleName.ADMIN) throw new BusinessRuleError("O perfil selecionado não possui acesso a este processo")
    }
    return process
  }

  async get(processId: number, actor: CaseActor) {
    const process = await this.context(processId, actor)
    const reviewer = cppd.has(actor.role)
    const applicant = actor.role === RoleName.DOCENTE && process.userId === actor.userId
    const auditEvents = applicant || reviewer ? process.audits : []
    const actorIds = [...new Set(auditEvents.map(event => event.actorId))]
    const auditActors = actorIds.length ? await prisma.user.findMany({ where: { idUser: { in: actorIds } }, select: { idUser: true, name: true } }) : []
    const actorsById = new Map(auditActors.map(user => [user.idUser, user]))
    return {
      processId, category: process.processTypeConfig?.category, status: process.status,
      evaluationMode: process.fullProfessorDetail?.evaluationMode, financialEffectsAt: process.financialEffectsAt, compliance: process.compliance,
      members: process.specialCommissions.filter(value => value.status !== "CANCELED").slice(0, 1).flatMap(value => value.members.map(member => ({ id: member.idSpecialCommissionMember, name: member.person.name, result: member.individualEvaluations[0]?.result, evaluationStatus: member.individualEvaluations[0]?.status ?? null }))),
      doctorate: process.fullProfessorDetail?.doctorateDegree ? { id: process.fullProfessorDetail.doctorateDegree.idTeacherDegree, course: process.fullProfessorDetail.doctorateDegree.course, countryCode: process.fullProfessorDetail.doctorateDegree.countryCode } : null,
      nominees: applicant || reviewer ? process.nominees : [],
      signatures: process.signedArtifacts.map(({ evidenceFile, ...artifact }) => ({ ...artifact, fileName: evidenceFile.originalName })),
      appeals: applicant || reviewer ? process.rscAppeals : [], audits: auditEvents.map(event => ({ ...event, actor: actorsById.get(event.actorId) ?? null })),
      canEdit: applicant && ["DRAFT", "RETURNED"].includes(process.status), canReview: reviewer && !finalStatuses.has(process.status),
      documents: process.processTypeConfig?.category === "CAREER" ? [] : process.processTypeConfig?.category === "FULL_PROFESSOR"
        ? ["APPLICATION", "PERFORMANCE", "NOMINEES", "CPPD_ELIGIBILITY_OPINION", "PRESIDENT_OPINION", "MEMORIAL_DEFENSE_MINUTES", "THESIS_DEFENSE_MINUTES", "CONSOLIDATED_OPINION", "THESIS_ORIGINALITY",
          ...((applicant || reviewer) && process.fullProfessorDetail?.appealSubmittedAt ? ["TITULAR_APPEAL"] : [])]
        : ["APPLICATION", "PERFORMANCE", "CONSOLIDATED_OPINION"]
    }
  }

  async save(processId: number, actor: CaseActor, input: any) {
    const process = await this.context(processId, actor)
    if (finalStatuses.has(process.status)) throw new BusinessRuleError("Processo concluído não pode ser alterado; utilize o recurso cabível")
    const reviewer = cppd.has(actor.role)
    const applicant = actor.role === RoleName.DOCENTE && process.userId === actor.userId
    const editing = applicant && ["DRAFT", "RETURNED"].includes(process.status)
    const changes: Prisma.ProcessComplianceUncheckedUpdateInput = {}
    let nominees: ReturnType<typeof validateNominees> | undefined
    let selectedDoctorate: number | undefined
    switch (input.action) {
      case "SAVE_TITULAR_APPLICATION": {
        if (!editing || !process.fullProfessorDetail) throw new BusinessRuleError("Os dados do requerimento só podem ser alterados pelo docente enquanto o processo estiver editável")
        const raw = input.admissionDate
        if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BusinessRuleError("Informe uma data de admissão válida")
        const admissionDate = this.pastDate(raw, "Data de admissão")
        if (admissionDate.toISOString().slice(0, 10) !== raw) throw new BusinessRuleError("Informe uma data de admissão válida")
        changes.titularAdmissionDate = admissionDate
        if (typeof input.workRegime !== "string" || typeof input.competitionArea !== "string") throw new BusinessRuleError("Informe o regime de trabalho e a área de concurso")
        changes.titularWorkRegime = this.requiredText(input.workRegime, 120, "o regime de trabalho")
        changes.titularCompetitionArea = this.requiredText(input.competitionArea, 180, "a área de concurso")
        break
      }
      case "SELECT_DOCTORATE": {
        if (!editing || !process.fullProfessorDetail) throw new BusinessRuleError("Selecione o diploma no rascunho de Classe Titular")
        const degree = await prisma.teacherDegree.findFirst({ where: { idTeacherDegree: Number(input.degreeId), teacher: { userId: actor.userId }, degreeType: { in: ["DOCTORATE", "DOUTORADO"] } } })
        if (!degree?.evidenceFileId) throw new BusinessRuleError("Doutorado comprovado do docente não encontrado")
        selectedDoctorate = degree.idTeacherDegree
        changes.doctorateValidatedAt = null
        break
      }
      case "SAVE_NOMINEES":
        if (!editing || process.processTypeConfig?.category !== "FULL_PROFESSOR") throw new BusinessRuleError("A lista de indicados só pode ser alterada pelo docente no rascunho")
        nominees = validateNominees(input.nominees, process.user.email)
        changes.nomineesValidatedAt = null
        break
      case "DECLARE_ORIGINALITY":
        if (!editing || process.fullProfessorDetail?.evaluationMode !== "THESIS" || input.accepted !== true) throw new BusinessRuleError("Confirme a declaração de ineditismo da tese no rascunho")
        changes.thesisOriginalityDeclaredAt = new Date()
        break
      case "SET_PERFORMANCE_CLAIM": {
        if (!editing || process.processTypeConfig?.category !== "FULL_PROFESSOR") throw new BusinessRuleError("Informe o desempenho no rascunho da Classe Titular")
        const points = Number(input.points)
        if (!Number.isFinite(points) || points < 120) throw new BusinessRuleError("A avaliação de desempenho exige pelo menos 120 pontos")
        const file = await this.ownedPdf(Number(input.evidenceFileId), actor.userId)
        changes.claimedPerformancePoints = points
        changes.performanceFileId = file.idEvidenceFile
        changes.performanceApprovedAt = null
        break
      }
      case "REVIEW_ELIGIBILITY": {
        if (!reviewer || process.processTypeConfig?.category !== "FULL_PROFESSOR" || !["SUBMITTED", "UNDER_REVIEW", "AWAITING_EVALUATOR_ACCEPTANCE", "AWAITING_ORDINANCE"].includes(process.status)) throw new BusinessRuleError("A análise prévia deve ser registrada pela CPPD antes da ativação da comissão")
        const points = Number(input.points)
        const date = this.pastDate(input.requirementsMetAt, "Data de cumprimento dos requisitos de desempenho")
        if (!process.compliance?.performanceFileId || !Number.isFinite(points) || points < 120 || !input.opinion?.trim()) throw new BusinessRuleError("Analise o documento de desempenho, registre ao menos 120 pontos e emita o parecer")
        const degree = process.fullProfessorDetail?.doctorateDegree
        if (!degree?.evidenceFileId || !degree.conclusionDate || (degree.countryCode !== "BR" && !degree.recognitionFileId)) throw new BusinessRuleError("Valide o diploma e, quando estrangeiro, seu reconhecimento nacional")
        if (input.doctorateApproved !== true) throw new BusinessRuleError("A CPPD precisa aprovar o título de doutor")
        changes.performancePoints = points
        changes.performanceApprovedAt = new Date()
        changes.performanceRequirementsMetAt = date
        changes.performanceOpinion = String(input.opinion).trim()
        changes.doctorateValidatedAt = new Date()
        changes.validatedById = actor.userId
        changes.interlocutorUserId = actor.userId
        break
      }
      case "REVIEW_NOMINEES":
        if (!reviewer || process.processTypeConfig?.category !== "FULL_PROFESSOR") throw new BusinessRuleError("Somente a CPPD pode validar os indicados")
        validateNominees(process.nominees.map(value => ({ ...value, sameKnowledgeArea: !value.relatedAreaJustification })), process.user.email)
        if (input.confirmed !== true) throw new BusinessRuleError("Confirme a verificação dos títulos, carreira, instituição, área e ciência dos sete indicados")
        changes.nomineesValidatedAt = new Date()
        changes.validatedById = actor.userId
        break
      case "SAVE_REFERENCES":
        if (!editing && !reviewer) throw new BusinessRuleError("A referência não pode ser alterada nesta etapa")
        changes.simecReference = this.optionalText(input.simecReference, 120)
        changes.simecSelectionReference = this.optionalText(input.simecSelectionReference, 500)
        break
      default: throw new BusinessRuleError("Ação de conformidade inválida")
    }
    await prisma.$transaction(async tx => {
      const current = await tx.careerProcess.findUniqueOrThrow({ where: { idProcess: processId } })
      if (current.status !== process.status || current.updatedAt.getTime() !== process.updatedAt.getTime()) throw new BusinessRuleError("O processo mudou; recarregue antes de salvar")
      if (selectedDoctorate) await tx.fullProfessorProcessDetail.update({ where: { processId }, data: { doctorateDegreeId: selectedDoctorate } })
      if (nominees) {
        await tx.$executeRaw`DELETE FROM process_nominee WHERE processId = ${processId}`
        await tx.processNominee.createMany({ data: nominees.map(value => ({ ...value, processId })) })
      }
      await tx.processCompliance.upsert({ where: { processId }, create: { processId, ...changes } as Prisma.ProcessComplianceUncheckedCreateInput, update: changes })
      await tx.processAudit.create({ data: { processId, actorId: actor.userId, action: input.action, details: { previousCompliance: process.compliance ? JSON.parse(JSON.stringify(process.compliance)) : null, previousNominees: nominees ? JSON.parse(JSON.stringify(process.nominees)) : undefined, ...input } } })
      await tx.careerProcess.update({ where: { idProcess: processId }, data: { updatedAt: new Date() } })
    }, { isolationLevel: "Serializable" })
    return this.get(processId, actor)
  }

  async uploadSignature(processId: number, actor: CaseActor, input: any, file: Express.Multer.File) {
    const process = await this.context(processId, actor)
    if (finalStatuses.has(process.status) && !(input.documentKind === "CPRSC_DECISION" && process.rscAppeals.some(value => value.stage === "CPRSC" && value.status === "SUBMITTED"))) throw new BusinessRuleError("Os documentos de um processo concluído são preservados")
    if (!signedKinds.has(input.documentKind)) throw new BusinessRuleError("Tipo de documento assinado inválido")
    const memberId = input.documentKind === "INDIVIDUAL_OPINION" ? Number(input.memberId) || null : null
    if (input.documentKind === "INDIVIDUAL_OPINION") {
      const member = process.specialCommissions.filter(commission => commission.status !== "CANCELED").flatMap(commission => commission.members).find(candidate => candidate.idSpecialCommissionMember === memberId)
      if (!member || member.individualEvaluations[0]?.status !== "SUBMITTED" || (!cppd.has(actor.role) && !member.person.users.some(user => user.idUser === actor.userId))) throw new BusinessRuleError("O parecer assinado deve pertencer a uma avaliação enviada pelo avaliador")
    } else if (input.documentKind === "THESIS_ORIGINALITY") {
      if (process.userId !== actor.userId && !cppd.has(actor.role)) throw new BusinessRuleError("A declaração pertence ao docente requerente")
    } else if (!cppd.has(actor.role)) throw new BusinessRuleError("Este documento deve ser registrado pela CPPD")
    const bytes = await fs.readFile(file.path)
    if (bytes.length > 20 * 1024 * 1024 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new BusinessRuleError("Envie um PDF assinado de até 20 MB")
    try { await PDFDocument.load(bytes) } catch { throw new BusinessRuleError("O arquivo PDF não pôde ser lido") }
    const signedAt = this.pastDate(input.signedAt, "Data da assinatura")
    const signer = this.requiredText(input.signer, 180, "signatário")
    const provider = this.requiredText(input.provider, 80, "provedor de assinatura")
    const artifact = await prisma.$transaction(async tx => {
      const last = await tx.signedProcessArtifact.findFirst({ where: { processId, documentKind: input.documentKind, memberId }, orderBy: { version: "desc" } })
      const evidence = await tx.evidenceFile.create({ data: { userId: actor.userId, originalName: file.originalname, storedName: file.filename, mimeType: "application/pdf", sizeBytes: BigInt(bytes.length), url: `/uploads/${path.relative(path.join(cwd(), "uploads"), file.path).split(path.sep).join("/")}`, usageType: "SIGNED_DOCUMENT" } })
      const saved = await tx.signedProcessArtifact.create({ data: { processId, memberId, documentKind: input.documentKind, version: (last?.version ?? 0) + 1, evidenceFileId: evidence.idEvidenceFile, signer, provider, signedAt, contentSha256: createHash("sha256").update(bytes).digest("hex"), uploadedById: actor.userId } })
      await tx.processAudit.create({ data: { processId, actorId: actor.userId, action: "SIGNED_DOCUMENT_UPLOADED", details: { artifactId: saved.idArtifact, documentKind: saved.documentKind, version: saved.version, contentSha256: saved.contentSha256 } } })
      return saved
    }, { isolationLevel: "Serializable" })
    return artifact
  }

  async validateSignature(processId: number, actor: CaseActor, artifactId: number, input: any) {
    const process = await this.context(processId, actor)
    if (!cppd.has(actor.role) || (finalStatuses.has(process.status) && !process.rscAppeals.some(value => value.stage === "CPRSC" && value.status === "SUBMITTED"))) throw new BusinessRuleError("Somente a CPPD pode validar assinaturas antes da decisão final")
    const artifact = process.signedArtifacts.find(value => value.idArtifact === artifactId)
    if (!artifact) throw new NotFoundError("Documento assinado não encontrado")
    if (artifact.validatedAt || artifact.rejectedAt) throw new BusinessRuleError("A validação já foi registrada; envie uma nova versão para corrigir")
    const bytes = await fs.readFile(this.resolvePrivatePath(artifact.evidenceFile.url))
    if (createHash("sha256").update(bytes).digest("hex") !== artifact.contentSha256) throw new BusinessRuleError("A integridade do arquivo não confere com o hash registrado")
    const note = this.requiredText(input.note, 4000, "resultado da conferência administrativa da assinatura")
    if (typeof input.approved !== "boolean") throw new BusinessRuleError("Informe o resultado da validação")
    await prisma.$transaction(async tx => {
      await tx.signedProcessArtifact.update({ where: { idArtifact: artifactId }, data: { validatedById: actor.userId, validatedAt: input.approved ? new Date() : null, rejectedAt: input.approved ? null : new Date(), validationNote: note } })
      if (input.approved && artifact.documentKind === "PRESIDENT_OPINION" && process.fullProfessorDetail?.initialOpinionAt && !process.fullProfessorDetail.reassessmentRequestedAt && !process.fullProfessorDetail.appealSubmittedAt) {
        const periods = await tx.academicCalendarPeriod.findMany({ where: { deletedAt: null, OR: [{ campusId: null }, { campusId: process.campusId }] } })
        await tx.fullProfessorProcessDetail.update({ where: { processId }, data: { initialOpinionAt: artifact.signedAt,
          reassessmentDeadlineAt: process.fullProfessorDetail.reassessmentDeadlineAt ? addBusinessDaysDeadline(artifact.signedAt, 2, periods) : null, oralDefenseDeadlineAt: process.fullProfessorDetail.oralDefenseDeadlineAt ? addCalendarDaysDeadline(artifact.signedAt, 30, periods) : null, appealDeadlineAt: process.fullProfessorDetail.appealDeadlineAt ? addBusinessDaysDeadline(artifact.signedAt, 2, periods) : null } })
      }
      await tx.processAudit.create({ data: { processId, actorId: actor.userId, action: "SIGNATURE_REVIEWED", details: { artifactId, approved: input.approved, note } } })
    })
    return this.get(processId, actor)
  }

  async linkedFile(processId: number, actor: CaseActor, fileId: number) {
    const current = await this.context(processId, actor)
    const degree = current.fullProfessorDetail?.doctorateDegree
    const allowed = [current.compliance?.performanceFileId, current.rscDetail?.reportFileId, current.fullProfessorDetail?.memorialFileId, current.fullProfessorDetail?.thesisFileId, degree?.evidenceFileId, degree?.recognitionFileId]
    const score = await prisma.processScore.findFirst({ where: { processId, evidenceFileId: fileId } })
    const document = await prisma.documentProcess.findFirst({ where: { processId, evidenceFileId: fileId } })
    if (!allowed.includes(fileId) && !score && !document) throw new NotFoundError("Documento não vinculado ao processo")
    const file = await prisma.evidenceFile.findUnique({ where: { idEvidenceFile: fileId } })
    if (!file) throw new NotFoundError("Documento não encontrado")
    return { bytes: await fs.readFile(this.resolvePrivatePath(file.url)), name: file.originalName }
  }

  async signedFile(processId: number, actor: CaseActor, artifactId: number) {
    const process = await this.context(processId, actor)
    const artifact = process.signedArtifacts.find(value => value.idArtifact === artifactId)
    if (!artifact) throw new NotFoundError("Documento assinado não encontrado")
    const bytes = await fs.readFile(this.resolvePrivatePath(artifact.evidenceFile.url))
    if (createHash("sha256").update(bytes).digest("hex") !== artifact.contentSha256) throw new BusinessRuleError("A integridade do documento não confere")
    return { bytes, name: artifact.evidenceFile.originalName }
  }

  async ownedPdf(fileId: number, userId: number) {
    const file = await prisma.evidenceFile.findFirst({ where: { idEvidenceFile: fileId, userId, deletedDate: null } })
    if (!file || file.mimeType !== "application/pdf") throw new BusinessRuleError("Selecione um PDF do próprio docente")
    const bytes = await fs.readFile(this.resolvePrivatePath(file.url))
    try { await PDFDocument.load(bytes) } catch { throw new BusinessRuleError("O PDF informado é inválido") }
    return file
  }

  resolvePrivatePath(url: string) {
    const root = path.resolve(cwd(), "uploads")
    const file = path.resolve(root, url.replace(/^\/uploads\//, ""))
    if (!url.startsWith("/uploads/") || !file.startsWith(root + path.sep)) throw new BusinessRuleError("Caminho de documento inválido")
    return file
  }

  pastDate(value: unknown, label: string) {
    const date = new Date(String(value ?? ""))
    if (!Number.isFinite(date.getTime()) || date > new Date()) throw new BusinessRuleError(`${label} deve ser uma data válida que já ocorreu`)
    return date
  }
  requiredText(value: unknown, limit: number, label: string) {
    const text = String(value ?? "").trim()
    if (!text || text.length > limit) throw new BusinessRuleError(`Informe ${label} com até ${limit} caracteres`)
    return text
  }
  optionalText(value: unknown, limit: number) { return value ? this.requiredText(value, limit, "a referência") : null }
}

export async function assertTitularReady(processId: number, phase: "SUBMIT" | "ACTIVATE" | "DECIDE") {
  const process = await prisma.careerProcess.findUnique({ where: { idProcess: processId }, include: { compliance: true, nominees: { where: { deletedDate: null } }, user: { include: { docente: true } }, fullProfessorDetail: { include: { doctorateDegree: true } }, signedArtifacts: true } })
  if (!process?.fullProfessorDetail) throw new BusinessRuleError("Processo de Classe Titular incompleto")
  const compliance = process.compliance
  if (!compliance?.performanceFileId || Number(compliance.claimedPerformancePoints) < 120) throw new BusinessRuleError("Anexe a avaliação de desempenho com pelo menos 120 pontos antes do envio")
  if (phase === "SUBMIT" && (!compliance.titularAdmissionDate || !compliance.titularWorkRegime || !compliance.titularCompetitionArea)) {
    throw new BusinessRuleError("Preencha os dados do requerimento: data de admissão, regime de trabalho e área de concurso")
  }
  validateNominees(process.nominees.map(value => ({ ...value, sameKnowledgeArea: !value.relatedAreaJustification })), process.user.email)
  const degree = process.fullProfessorDetail.doctorateDegree
  if (!degree?.evidenceFileId || degree.teacherId !== process.user.docente?.idDocente || !["DOCTORATE", "DOUTORADO"].includes(degree.degreeType)) throw new BusinessRuleError("Selecione o doutorado comprovado do próprio docente")
  if (degree?.countryCode !== "BR" && !degree?.recognitionFileId) throw new BusinessRuleError("Anexe o reconhecimento nacional do diploma estrangeiro")
  if (process.fullProfessorDetail.evaluationMode === "THESIS" && !compliance.thesisOriginalityDeclaredAt) throw new BusinessRuleError("Registre a declaração de ineditismo da tese")
  if (phase !== "SUBMIT" && (!compliance.performanceApprovedAt || Number(compliance.performancePoints) < 120 || !compliance.doctorateValidatedAt || !compliance.nomineesValidatedAt)) throw new BusinessRuleError("A CPPD deve aprovar o desempenho, o doutorado e os sete indicados antes da comissão")
  return process
}

export async function calculateTitularEffects(processId: number) {
  const process = await assertTitularReady(processId, "DECIDE")
  const detail = process.fullProfessorDetail!
  if (!process.user.docente?.start_interstice || !detail.doctorateDegree?.conclusionDate || !detail.initialOpinionAt) throw new BusinessRuleError("Faltam datas oficiais para calcular os efeitos financeiros")
  return latestRequirementDate([addMonthsClamped(process.user.docente.start_interstice, 24), detail.doctorateDegree.conclusionDate, process.compliance?.performanceRequirementsMetAt, detail.oralDefenseHeldAt ?? detail.initialOpinionAt, detail.appealDecidedAt])
}

export async function assertSignedDecisionDocuments(processId: number, category: string, commission: any) {
  const artifacts = await prisma.signedProcessArtifact.findMany({ where: { processId }, orderBy: { version: "desc" } })
  const valid = (kind: string, memberId: number | null = null) => {
    const latest = artifacts.find(value => value.documentKind === kind && value.memberId === memberId && (!commission.createdAt || ["CPPD_ELIGIBILITY_OPINION", "THESIS_ORIGINALITY"].includes(kind) || value.uploadedAt >= commission.createdAt))
    return Boolean(latest?.validatedAt && !latest.rejectedAt)
  }
  if (commission.members.some((member: any) => !valid("INDIVIDUAL_OPINION", member.idSpecialCommissionMember)) || !valid("CONSOLIDATED_OPINION")) throw new BusinessRuleError("Registre e valide os quatro pareceres individuais assinados e o parecer consolidado")
  if (category === "FULL_PROFESSOR" && !valid("PRESIDENT_OPINION")) throw new BusinessRuleError("Registre e valide o parecer assinado do presidente da comissão")
  if (category === "FULL_PROFESSOR") {
    const current = await prisma.careerProcess.findUnique({ where: { idProcess: processId }, include: { fullProfessorDetail: true, compliance: true } })
    const detail = current?.fullProfessorDetail
    const eligibility = artifacts.find(value => value.documentKind === "CPPD_ELIGIBILITY_OPINION" && value.memberId === null)
    const originality = artifacts.find(value => value.documentKind === "THESIS_ORIGINALITY" && value.memberId === null)
    if (!valid("CPPD_ELIGIBILITY_OPINION") || (current?.compliance?.performanceApprovedAt && eligibility!.uploadedAt < current.compliance.performanceApprovedAt)) throw new BusinessRuleError("Valide o parecer assinado de desempenho e doutorado")
    if (detail?.evaluationMode === "THESIS" && (!valid("THESIS_ORIGINALITY") || !valid("THESIS_DEFENSE_MINUTES") || (current?.compliance?.thesisOriginalityDeclaredAt && originality!.uploadedAt < current.compliance.thesisOriginalityDeclaredAt))) throw new BusinessRuleError("Valide a declaração de ineditismo e a ata assinada da defesa de tese")
    if (detail?.evaluationMode === "MEMORIAL" && detail.oralDefenseHeldAt && !valid("MEMORIAL_DEFENSE_MINUTES")) throw new BusinessRuleError("Valide a ata assinada da reavaliação do memorial")
  }
}
