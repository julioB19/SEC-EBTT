import "dotenv/config"
import type {} from "multer"
import { ClassLevel, PersonType, PrismaClient, RoleName } from "@prisma/client"
import path from "path"
import fs from "fs/promises"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { credentials, ensurePersonForUser, ensureUserRoles, seedBase, upsertSeedUser } from "./seed-base"
import { prisma as applicationPrisma } from "../src/infra/prismaClient"
import { ProcessoService } from "../src/service/processoService"
import { ProcessRepository } from "../src/repository/processoRepository"
import { ScoringTableRepository } from "../src/repository/scoringTableRepository"
import { UserRepository } from "../src/repository/userRepository"
import { ProcessScoreService } from "../src/service/processScoreService"
import { ProcessScoreRepository } from "../src/repository/processScoreRepository"
import { EvidenceFileRepository } from "../src/repository/evidenceFileRepository"
import { ProcessNodeScoreRepository } from "../src/repository/processNodeScoreRepository"
import { SpecialCommissionService } from "../src/service/specialCommissionService"
import { CaseComplianceService } from "../src/service/caseComplianceService"
import { ProcessEvaluationService } from "../src/service/processEvaluationService"
import { ProcessEvaluationRepository } from "../src/repository/processEvaluationRepository"
import { addMonthsClamped } from "../src/util/careerDates"

export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo@123456"
export const DEMO_VERSION = "orientador-v1"
export const kinds = ["PROGRESSION", "PROMOTION", "RSC", "FULL_PROFESSOR"] as const
const labels = { PROGRESSION: "Progressão", PROMOTION: "Promoção", RSC: "RSC", FULL_PROFESSOR: "Classe Titular" }
const stages = ["Rascunho", "Enviado à CPPD", "Avaliação pendente"]

export function demoCpf(index: number): string {
  let digits = String(910000000 + index)
  for (let length = 9; length <= 10; length++) {
    const sum = [...digits].reduce((total, digit, position) => total + Number(digit) * (length + 1 - position), 0)
    const rest = sum * 10 % 11
    digits += rest === 10 ? "0" : String(rest)
  }
  return digits
}

export function assertDemoTarget(value = process.env.DATABASE_URL) {
  if (!value) throw new Error("DATABASE_URL não configurada")
  const url = new URL(value)
  if (url.protocol !== "mysql:") throw new Error("A demonstração exige MySQL")
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && process.env.DEMO_SEED_ENABLED !== "true") {
    throw new Error("Para uma base hospedada exclusiva de demonstração, configure DEMO_SEED_ENABLED=true")
  }
  return url
}

export function services() {
  const processes = new ProcessRepository(), tables = new ScoringTableRepository(), scores = new ProcessScoreRepository()
  return {
    processes: new ProcessoService(processes, tables, new UserRepository()),
    scores: new ProcessScoreService(processes, tables, scores, new EvidenceFileRepository(), new ProcessNodeScoreRepository()),
    commissions: new SpecialCommissionService(),
    compliance: new CaseComplianceService(),
    evaluation: new ProcessEvaluationService(new ProcessEvaluationRepository())
  }
}

async function pdf(prisma: PrismaClient, userId: number, scenario: string, title: string) {
  const name = `${scenario}-${title.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`
  const dir = path.join(process.cwd(), "uploads", "demo", String(userId))
  await fs.mkdir(dir, { recursive: true })
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([595, 842])
  const lines = ["DEMONSTRACAO - SEM VALIDADE INSTITUCIONAL", title, `Cenario: ${scenario}`,
    "Documento ficticio para testes do SEC-EBTT.", "Nao representa diploma, portaria ou comprovante real.",
    "Os dados podem ser conferidos e substituidos durante o teste."]
  lines.forEach((line, index) => page.drawText(line, { x: 40, y: 780 - index * 32, size: index ? 12 : 15, font }))
  const bytes = await document.save()
  await fs.writeFile(path.join(dir, name), bytes, { flag: "wx" })
  return prisma.evidenceFile.create({ data: {
    userId, originalName: `DEMO-${title}.pdf`, storedName: name,
    url: `/uploads/demo/${userId}/${name}`, mimeType: "application/pdf", sizeBytes: BigInt(bytes.length), usageType: "TEACHER_DOCUMENT"
  } })
}

export async function seedDemo(prisma: PrismaClient) {
  assertDemoTarget()
  const base = await seedBase(prisma, { preserveExisting: true })
  const api = services(), now = new Date()
  const intersticeStart = addMonthsClamped(now, -26), intersticeEnd = addMonthsClamped(intersticeStart, 24)
  const accountRows: { name: string; cpf: string; password: string; role: string; id: number }[] = []
  for (const [key, user, role] of [
    ["admin", base.admin, "ADMIN"], ["cppd", base.cppd, "CPPD_MEMBER"], ["cppdCentral", base.cppdCentral, "CPPD_CENTRAL"]
  ] as const) accountRows.push({ name: user.name, id: user.idUser, role, ...credentials[key] })

  const evaluators = []
  for (let index = 0; index < 7; index++) {
    const internal = index < 2
    const cpf = index === 2 ? credentials.externalEvaluator.cpf : demoCpf(100 + index)
    const password = index === 2 ? credentials.externalEvaluator.password : DEMO_PASSWORD
    const user = await upsertSeedUser({ cpf, password, name: `DEMO Avaliador ${internal ? "interno" : "externo"} ${internal ? index + 1 : index - 1}`,
      email: `demo.avaliador.${index + 1}@example.org`, phone: "55999990000", city: "Santa Maria", uf: "RS" })
    await ensureUserRoles(user.idUser, [internal ? RoleName.DOCENTE : RoleName.EXTERNAL_EVALUATOR])
    const person = await ensurePersonForUser(user, internal ? PersonType.TEACHER : PersonType.EXTERNAL_EVALUATOR, cpf)
    if (internal) await prisma.docenteProfile.upsert({ where: { userId: user.idUser }, update: {}, create: {
      userId: user.idUser, campusId: base.campus.idCampus, siape: `DEMO-INT-${index + 1}`, classLevel: ClassLevel.D1,
      start_interstice: intersticeStart, educationLevel: "Doutorado", doctorate: "Doutorado em Educação - DEMO", assignment: base.campus.name
    } })
    else await prisma.externalEvaluatorProfile.upsert({ where: { userId: user.idUser }, update: {}, create: {
      userId: user.idUser, title: "Doutor - DEMONSTRAÇÃO", institution: "Instituição Federal - DEMONSTRAÇÃO", siape: `DEMO-EXT-${index}`, evaluationCity: "Santa Maria", workUnit: "Ensino - DEMO"
    } })
    evaluators.push({ user, person, internal })
    accountRows.push({ name: user.name, cpf, password, role: internal ? "DOCENTE / avaliador interno" : "EXTERNAL_EVALUATOR", id: user.idUser })
  }

  const scenarioRows = []
  for (const [kindIndex, kind] of kinds.entries()) {
    for (let stage = 0; stage < 3; stage++) {
      const index = kindIndex * 3 + stage
      const key = `DEMO-${kind}-${stage + 1}`
      const cpf = index === 0 ? credentials.docente.cpf : demoCpf(index + 1)
      const password = index === 0 ? credentials.docente.password : DEMO_PASSWORD
      const user = await upsertSeedUser({ cpf, password, name: `DEMO ${labels[kind]} - ${stages[stage]}`,
        email: `demo.docente.${index + 1}@example.org`, phone: "55999990000", city: "Santa Maria", uf: "RS" })
      await ensureUserRoles(user.idUser, [RoleName.DOCENTE])
      await ensurePersonForUser(user, PersonType.TEACHER, cpf)
      accountRows.push({ id: user.idUser, name: user.name, cpf, password, role: "DOCENTE" })
      const existing = await prisma.careerProcess.findFirst({ where: { userId: user.idUser, externalNumber: key }, include: { audits: { where: { action: "DEMO_SEED_READY" } } } })
      if (existing) {
        if (!existing.audits.length) throw new Error(`${key} está incompleto. Use db:reset:demo para restaurar a base inicial; nenhum andamento foi sobrescrito.`)
        scenarioRows.push({ key, kind, stage, processId: existing.idProcess, userId: user.idUser, status: existing.status })
        continue
      }
      const classLevel = kind === "FULL_PROFESSOR" ? ClassLevel.C4 : kind === "PROMOTION" ? ClassLevel.B4 : ClassLevel.B1
      const profileData = { campusId: base.campus.idCampus, siape: `DEMO-DOC-${index + 1}`, classLevel, start_interstice: intersticeStart,
        educationLevel: kind === "FULL_PROFESSOR" ? "Doutorado" : "Mestrado", mastersDegree: "Mestrado em Educação - DEMO",
        doctorate: kind === "FULL_PROFESSOR" ? "Doutorado em Educação - DEMO" : null, assignment: base.campus.name,
        department: "Ensino - DEMO", division: "Direção de Ensino - DEMO", role: "Professor EBTT", immediate_supervisor: "Chefia - DEMONSTRAÇÃO" }
      // Apenas o docente da seed básica é reaproveitado; perfis de cenários existentes nunca são regravados.
      const teacher = await prisma.docenteProfile.upsert({ where: { userId: user.idUser }, create: { userId: user.idUser, ...profileData }, update: profileData })
      const degreeFile = await pdf(prisma, user.idUser, key, "Diploma demonstrativo")
      const degree = await prisma.teacherDegree.create({ data: { teacherId: teacher.idDocente, degreeType: kind === "FULL_PROFESSOR" ? "DOCTORATE" : "MASTERS",
        course: "Educação - DEMONSTRAÇÃO", institution: "Instituição Federal - DEMONSTRAÇÃO", conclusionDate: addMonthsClamped(now, -48), evidenceFileId: degreeFile.idEvidenceFile } })
      const opened = await api.processes.abrirComAtualizacao(user.idUser, null, {
        processTypeCode: kind, campus: base.campus.name, cidadeUF: "Santa Maria/RS", externalNumber: key,
        ...(kind === "PROGRESSION" || kind === "PROMOTION" ? {
          intersticioInicioISO: intersticeStart.toISOString(), intersticioFimISO: intersticeEnd.toISOString(),
          classeOrigem: "B", nivelOrigem: kind === "PROMOTION" ? "4" : "1", classeDestino: kind === "PROMOTION" ? "C" : "B", nivelDestino: kind === "PROMOTION" ? "1" : "2"
        } : {}),
        ...(kind === "RSC" ? { rscDetails: { targetLevel: ["RSC_I", "RSC_II", "RSC_III"][stage], careerEntryDateISO: addMonthsClamped(now, -120).toISOString(),
          activityPeriodStartISO: addMonthsClamped(now, -60).toISOString(), activityPeriodEndISO: new Date(now.getTime() - 86400000).toISOString(), truthDeclarationAccepted: true } } : {}),
        ...(kind === "FULL_PROFESSOR" ? { fullProfessorDetails: { evaluationMode: "MEMORIAL", doctorateDegreeId: degree.idTeacherDegree } } : {})
      })
      const processId: number = opened.processId
      if (kind === "FULL_PROFESSOR" || kind === "RSC") {
        const memorial = await pdf(prisma, user.idUser, key, "Memorial demonstrativo")
        if (kind === "RSC") await prisma.rscProcessDetail.update({ where: { processId }, data: { reportFileId: memorial.idEvidenceFile } })
        else await prisma.fullProfessorProcessDetail.update({ where: { processId }, data: { memorialFileId: memorial.idEvidenceFile } })
      }
      if (kind === "FULL_PROFESSOR") {
        const performance = await pdf(prisma, user.idUser, key, "Desempenho demonstrativo 158 pontos")
        const actor = { userId: user.idUser, role: RoleName.DOCENTE }
        await api.compliance.save(processId, actor, { action: "SAVE_TITULAR_APPLICATION", admissionDate: addMonthsClamped(now, -180).toISOString().slice(0, 10), workRegime: "Dedicação exclusiva", competitionArea: "Educação - DEMONSTRAÇÃO" })
        await api.compliance.save(processId, actor, { action: "SET_PERFORMANCE_CLAIM", points: 158, evidenceFileId: performance.idEvidenceFile })
        await api.compliance.save(processId, actor, { action: "SAVE_NOMINEES", nominees: evaluators.map((evaluator, position) => ({
          name: evaluator.user.name, email: evaluator.user.email, phone: "55999990000", institution: "Instituição Federal - DEMONSTRAÇÃO", doctorateTitle: "Doutorado em Educação - DEMO",
          federalInstitution: true, careerLevel: "D1", knowledgeArea: "Educação", sameKnowledgeArea: true, priorConsentAt: now.toISOString(),
          origin: evaluator.internal ? "INTERNAL" : "EXTERNAL", membership: position === 1 || position >= 5 ? "SUBSTITUTE" : "PRIMARY"
        })) })
      } else {
        const tableId = kind === "RSC" ? base.rscTable.idScoringTable : base.careerTable.idScoringTable
        const items = await prisma.scoringItem.findMany({ where: { scoringTableId: tableId, active: true, deletedDate: null }, include: { node: { include: { parent: true } } }, orderBy: { idScoringItem: "asc" } })
        const selected = kind === "RSC"
          ? items.filter(item => item.node.parent?.code === ["RSC_I", "RSC_II", "RSC_III"][stage]).filter((item, position, all) => all.findIndex(other => other.nodeId === item.nodeId) === position)
          : items.filter(item => ["MNP", "MND", "NT", "NSI", "QUALIS_CURRENT_A1"].includes(item.formulaKey ?? "") || item.description.includes("modalidade PROEJA"))
        for (const item of selected) {
          const evidence = await pdf(prisma, user.idUser, key, `Comprovante item ${item.idScoringItem}`)
          await prisma.processScore.create({ data: { processId, itemId: item.idScoringItem, quantity: 0, awardedPoints: "0", evidenceFileId: evidence.idEvidenceFile } })
          const quantities: Record<string, number> = { MNP: 12, MND: 3, NT: 4, NSI: 4, QUALIS_CURRENT_A1: 2 }
          await api.scores.salvarPontuacaoItem(processId, user.idUser, item.idScoringItem, { quantity: kind === "RSC" ? item.maxQuantity ?? 1 : quantities[item.formulaKey ?? ""] ?? 2, awardedPoints: "0" })
        }
      }
      const config = await prisma.processTypeConfig.findUniqueOrThrow({ where: { idProcessType: opened.processTypeId! }, include: { documentRequirements: { where: { active: true, required: true, deletedDate: null } } } })
      if (config.documentRequirements.length) throw new Error(`${key}: há exigências adicionais neste banco. Use uma base demonstrativa limpa para não alterar suas configurações.`)
      if (stage > 0) await api.processes.enviarParaAvaliacao(processId, user.idUser)
      if (stage === 2 && kind !== "RSC" && kind !== "FULL_PROFESSOR") {
        await new ProcessRepository().updateStatus(processId, "UNDER_REVIEW", base.cppd.idUser, "DEMONSTRAÇÃO: análise iniciada pela CPPD")
        const score = await prisma.processScore.findFirstOrThrow({ where: { processId, quantity: { gt: 0 } } })
        await api.evaluation.updateItemScores(processId, [{ itemId: score.itemId, evaluatorAwardedPoints: score.awardedPoints.toString(), evaluatorComment: "DEMONSTRAÇÃO: comprovante conferido; demais itens pendentes." }])
      }
      if (stage === 2 && (kind === "RSC" || kind === "FULL_PROFESSOR")) {
        if (kind === "FULL_PROFESSOR") {
          const reviewer = { userId: base.cppd.idUser, role: RoleName.CPPD_MEMBER }
          await api.compliance.save(processId, reviewer, { action: "REVIEW_ELIGIBILITY", points: 158, requirementsMetAt: intersticeEnd.toISOString(), opinion: "DEMONSTRAÇÃO: desempenho e doutorado conferidos para teste.", doctorateApproved: true })
          await api.compliance.save(processId, reviewer, { action: "REVIEW_NOMINEES", confirmed: true })
        }
        await api.commissions.save(processId, { ordinance: `DEMO-SEM-VALIDADE-${key}`, ordinanceDate: now.toISOString().slice(0, 10) })
        for (const evaluator of evaluators.filter((_, position) => [0, 2, 3, 4].includes(position))) {
          await api.commissions.addExternalMember(processId, base.cppd.idUser, { email: evaluator.user.email, origin: evaluator.internal ? "INTERNAL" : "EXTERNAL", role: evaluator.internal ? "PRESIDENT" : "MEMBER" })
        }
        const commission = await prisma.specialCommission.findFirstOrThrow({ where: { processId }, include: { members: true } })
        for (const member of commission.members) {
          const evaluator = evaluators.find(candidate => candidate.person.idPerson === member.personId)!
          await api.commissions.respond(evaluator.user.idUser, member.idSpecialCommissionMember, { response: "ACCEPTED", absenceOfConflictDeclared: true })
        }
        await api.commissions.updateStatus(processId, base.cppd.idUser, { status: "ACTIVE" })
      }
      await prisma.processAudit.create({ data: { processId, actorId: base.admin.idUser, action: "DEMO_SEED_READY", details: { version: DEMO_VERSION, scenario: key, generatedAt: now.toISOString() } } })
      const result = await prisma.careerProcess.findUniqueOrThrow({ where: { idProcess: processId } })
      scenarioRows.push({ key, kind, stage, processId, userId: user.idUser, status: result.status })
    }
  }
  const lines = ["# Guia de demonstração do SEC-EBTT", "", "Manual ilustrado completo: [PDF](../../../docs/manual-uso/Manual_de_Uso_SEC_EBTT.pdf) e [versão editável](../../../docs/manual-uso/Manual_de_Uso_SEC_EBTT.md). Inclui os quatro tipos de processo, avaliações, recursos e as credenciais desta base.", "", "Dados fictícios, sem validade institucional. Acesso por CPF e senha.", "",
    "As senhas abaixo são as da carga inicial. Se forem alteradas durante o teste, a seed não as redefine.", "", "## Contas", "", "| Nome | CPF | Senha inicial | Perfil |", "|---|---|---|---|"]
  for (const account of accountRows) lines.push(`| ${account.name} | ${account.cpf} | ${account.password} | ${account.role} |`)
  lines.push("", "## Processos", "", "| Referência | Processo | CPF docente | Etapa inicial | Estado atual | Próxima ação |", "|---|---|---|---|---|---|")
  for (const row of scenarioRows) {
    const account = accountRows.find(value => value.id === row.userId)!
    const next = row.stage === 0 ? "Docente: conferir anexos e pontuação/desempenho e enviar à CPPD" : row.stage === 1 ? "CPPD: conferir documentação e iniciar análise/comissão" : row.kind === "RSC" || row.kind === "FULL_PROFESSOR" ? "Avaliadores: abrir tarefas, salvar parecer e enviar avaliação" : "CPPD: continuar conferência dos itens e preparar parecer"
    lines.push(`| ${row.key} | ${row.processId} | ${account.cpf} | ${stages[row.stage]} | ${row.status} | ${next} |`)
  }
  lines.push("", "## Roteiro", "", "1. Entre como docente e abra o processo indicado; os anexos podem ser baixados pelas telas autenticadas.", "2. Use a conta CPPD local para os processos do Campus Santa Maria, ou a CPPD Central para a visão geral.", "3. Para avaliar RSC/Classe Titular, use o avaliador interno 1 e os três primeiros externos. O interno acessa suas tarefas no perfil Docente.", "4. Pareceres e decisões finais estão pendentes. Assinaturas e conferências posteriores seguem o procedimento normal do sistema.", "5. O catálogo de carreira é o recorte existente na seed; o RSC contém os 82 critérios oficiais.", "", "Para repetir a demonstração sem perder andamento: npm run seed:demo. Para voltar ao início: npm run db:reset:demo.", "O reset cria e verifica um novo backup. O guia não é publicado na tela de login.")
  const dir = path.join(process.cwd(), "tmp", "demo")
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, "GUIA-ORIENTADOR.md"), lines.join("\n") + "\n")
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ version: DEMO_VERSION, scenarios: scenarioRows }, null, 2))
  console.log(`Demonstração pronta: ${scenarioRows.length} processos. Guia: ${path.join(dir, "GUIA-ORIENTADOR.md")}`)
  return { accounts: accountRows, scenarios: scenarioRows }
}

export async function disconnectDemo() { await applicationPrisma.$disconnect() }
