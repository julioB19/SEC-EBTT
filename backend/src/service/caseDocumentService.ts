import { cwd } from "process"
import path from "path"
import fs from "fs/promises"
import { createHash } from "crypto"
import { prisma } from "../infra/prismaClient"
import { RoleName } from "@prisma/client"
import { CaseActor, CaseComplianceService, calculateTitularEffects } from "./caseComplianceService"
import { BusinessRuleError } from "./processoService"
import { textDocumentPdf } from "../util/processDocuments"
import { institutionalCivilDate } from "../util/proceduralDeadline"

const date = (value: Date | null | undefined) => value ? value.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Não registrado"
const result = (value: string | null | undefined) => ["APPROVED", "DEFERRED"].includes(value ?? "") ? "APROVADO" : "REPROVADO"

export class CaseDocumentService {
  constructor(private readonly access = new CaseComplianceService()) {}

  async generate(processId: number, actor: CaseActor, kind: string) {
    const process = await this.access.context(processId, actor)
    if (process.processTypeConfig?.category === "CAREER") throw new BusinessRuleError("Use os requerimentos, planilhas e pareceres da avaliação de carreira")
    const commission = process.specialCommissions.find(value => value.status !== "CANCELED")
    const detail = process.fullProfessorDetail
    const compliance = process.compliance
    const members = commission?.members ?? []
    const opinions = members.map(member => `${member.person.name}: ${result(member.individualEvaluations[0]?.result)}. ${member.individualEvaluations[0]?.opinionText ?? "Parecer ainda não enviado"}`)
    const favorable = members.filter(member => ["APPROVED", "DEFERRED"].includes(member.individualEvaluations[0]?.result ?? "")).length
    const decided = detail?.currentOutcome ?? (favorable >= 3 ? "APPROVED" : "REJECTED")
    const reference = process.externalNumber || `SEC-EBTT ${processId}`
    const common = [`Processo: ${reference}`, `Interessado(a): ${process.user.name}. SIAPE: ${process.user.docente?.siape ?? "Não registrado"}.`, `Campus: ${process.campus}. Local: ${process.cidadeUF}.`, `Data de emissão: ${date(new Date())}.`]
    const lines: string[] = [...common]
    let title: string
    switch (kind) {
      case "APPLICATION":
        if (detail && ["DRAFT", "RETURNED"].includes(process.status) &&
          (!compliance?.titularAdmissionDate || !compliance.titularWorkRegime || !compliance.titularCompetitionArea)) {
          throw new BusinessRuleError("Preencha a data de admissão, o regime de trabalho e a área de concurso antes de gerar o requerimento")
        }
        title = detail ? "REQUERIMENTO DE PROMOÇÃO À CLASSE TITULAR" : "REQUERIMENTO DE RECONHECIMENTO DE SABERES E COMPETÊNCIAS"
        lines.push("À Reitoria do Instituto Federal de Educação, Ciência e Tecnologia Farroupilha.", detail
          ? `Eu, ${process.user.name}, atualmente na Classe C, nível 04, requeiro a abertura dos procedimentos necessários à promoção à Classe de Professor Titular, mediante ${detail.evaluationMode === "THESIS" ? "defesa de tese acadêmica inédita" : "avaliação de memorial descritivo"}, nos termos da Resolução Consup/IFFar nº 11/2024, homologada pela Resolução nº 40/2024.`
          : `Eu, ${process.user.name}, requeiro a concessão do ${process.rscDetail?.targetLevel?.replace(/_/g, " ")}, conforme o Regulamento Consup/IFFar nº 7/2025. Apresento o memorial e os documentos comprobatórios das atividades realizadas entre ${date(process.rscDetail?.activityPeriodStart)} e ${date(process.rscDetail?.activityPeriodEnd)}.`, "Nestes termos, pede deferimento.", `Signatário: ${process.user.name}.`)
        if (detail) lines.splice(lines.length - 2, 0,
          `Data de admissão: ${date(compliance?.titularAdmissionDate)}.`,
          `Regime de trabalho: ${compliance?.titularWorkRegime ?? "Não registrado"}.`,
          `Área de concurso: ${compliance?.titularCompetitionArea ?? "Não registrada"}.`)
        break
      case "TITULAR_APPEAL":
        if (!(actor.role === RoleName.DOCENTE && actor.userId === process.userId) &&
          actor.role !== RoleName.CPPD_MEMBER && actor.role !== RoleName.CPPD_CENTRAL) {
          throw new BusinessRuleError("Somente o requerente e a CPPD podem acessar o requerimento de recurso")
        }
        if (!detail?.appealSubmittedAt || !detail.appealReason) throw new BusinessRuleError("Apresente o recurso antes de gerar o requerimento do Anexo X")
        title = "ANEXO X - REQUERIMENTO DE RECURSO"
        lines.push("À Comissão Permanente de Pessoal Docente do Instituto Federal Farroupilha.",
          `Eu, ${process.user.name}, SIAPE nº ${process.user.docente?.siape ?? "não registrado"}, venho interpor recurso contra o resultado da Comissão Especial no processo de promoção à Classe Titular indicado acima.`,
          `Fundamentos do recurso: ${detail.appealReason}`,
          "Nestes termos, pede deferimento.",
          `${process.cidadeUF}, ${date(new Date(institutionalCivilDate(detail.appealSubmittedAt)))}.`,
          "________________________________________",
          `Assinatura do(a) requerente: ${process.user.name}.`)
        break
      case "NOMINEES":
        if (!detail || process.nominees.length !== 7) throw new BusinessRuleError("Cadastre a lista completa de sete indicados")
        title = "LISTA DE INDICAÇÃO DE MEMBROS DA COMISSÃO ESPECIAL"
        lines.push(...process.nominees.map(value => `${value.name}; ${value.origin === "INTERNAL" ? "Interno" : "Externo"}; ${value.membership === "PRIMARY" ? "Titular" : "Suplente"}; ${value.doctorateTitle}; ${value.careerLevel}; ${value.institution}; área ${value.knowledgeArea}; ${value.email}; ${value.phone}; ciência em ${date(value.priorConsentAt)}.`))
        break
      case "CPPD_ELIGIBILITY_OPINION":
        if (!compliance?.performanceApprovedAt || !compliance.doctorateValidatedAt) throw new BusinessRuleError("Conclua a análise prévia de desempenho e doutorado")
        title = "PARECER CPPD SOBRE DESEMPENHO E TÍTULO DE DOUTOR"
        lines.push(`O título de doutor foi conferido administrativamente em ${date(compliance.doctorateValidatedAt)}. Conclusão do doutorado: ${date(detail?.doctorateDegree?.conclusionDate)}.`, `A avaliação de desempenho obteve ${Number(compliance.performancePoints).toFixed(2)} pontos, atendendo ao mínimo de 120. Data de cumprimento dos requisitos de desempenho: ${date(compliance.performanceRequirementsMetAt)}.`, compliance.performanceOpinion ?? "", "Encaminha-se para constituição da Comissão Especial e prosseguimento do rito.")
        break
      case "PRESIDENT_OPINION":
      case "CONSOLIDATED_OPINION": {
        if (members.length !== 4 || members.some(member => member.individualEvaluations[0]?.status !== "SUBMITTED")) throw new BusinessRuleError("São necessários os quatro pareceres enviados")
        const financialDate = process.financialEffectsAt ?? (detail?.initialOpinionAt && detail.currentOutcome === "APPROVED" ? await calculateTitularEffects(processId) : null)
        title = kind === "PRESIDENT_OPINION" ? "PARECER DO PRESIDENTE DA COMISSÃO ESPECIAL" : "PARECER CONSOLIDADO DA CPPD"
        lines.push(`Comissão instituída pela Portaria ${commission?.ordinance}, de ${date(commission?.ordinanceDate)}.`, ...opinions, `Pareceres favoráveis: ${favorable} de 4. Resultado do rito: ${result(decided)}.`, detail ? `Foram apreciados o doutorado, o desempenho acadêmico e ${detail.evaluationMode === "THESIS" ? "a tese acadêmica inédita" : "o memorial descritivo"}, conforme a Resolução Consup/IFFar nº 11/2024.` : "A decisão observa o Regulamento Consup/IFFar nº 7/2025 e o mínimo de três pareceres favoráveis.", `Efeitos financeiros, quando deferido: ${date(financialDate ?? detail?.finalReferenceDate)}.`, "Encaminha-se à Coordenação de Gestão de Pessoas para os trâmites cabíveis. É o parecer.")
        break
      }
      case "MEMORIAL_DEFENSE_MINUTES":
      case "THESIS_DEFENSE_MINUTES":
        if (!detail?.oralDefenseHeldAt || !detail.oralDefenseRecordingUrl) throw new BusinessRuleError("Registre a realização e a gravação da sessão antes de gerar a ata")
        title = kind === "THESIS_DEFENSE_MINUTES" ? "ATA DE DEFESA DE TESE ACADÊMICA INÉDITA" : "ATA DE REAVALIAÇÃO DO MEMORIAL DESCRITIVO"
        lines.push(`Em ${date(detail.oralDefenseHeldAt)}, realizou-se a sessão pública virtual do(a) docente ${process.user.name}, perante a Comissão Especial instituída pela Portaria ${commission?.ordinance}.`, `Membros: ${members.map(member => member.person.name).join("; ")}.`, `Interlocutor da CPPD: usuário ${compliance?.interlocutorUserId ?? "não registrado"}.`, detail.oralDefenseNotes ?? "", `Gravação: ${detail.oralDefenseRecordingUrl}.`, `Resultado: ${result(detail.currentOutcome)}.`, "A ata será assinada pelo presidente da Comissão, interlocutor da CPPD e docente avaliado, conforme a modalidade e o modelo institucional aplicável.")
        break
      case "THESIS_ORIGINALITY":
        if (!compliance?.thesisOriginalityDeclaredAt) throw new BusinessRuleError("Confirme a declaração de ineditismo antes de gerar o documento")
        title = "DECLARAÇÃO DE INEDITISMO DA TESE"
        lines.push(`Eu, ${process.user.name}, declaro, sob minha responsabilidade, que a tese acadêmica apresentada para promoção à Classe Titular é inédita, nos termos do Regulamento Consup/IFFar nº 11/2024.`, `Declaração registrada em ${date(compliance.thesisOriginalityDeclaredAt)}.`, `Signatário: ${process.user.name}.`)
        break
      default: throw new BusinessRuleError("Modelo de documento não disponível")
    }
    const configured = await prisma.documentTemplate.findFirst({ where: { code: kind, active: true, deletedDate: null } })
    const text = configured?.bodyText
    if (text) lines.push(text.replace(/\{\{nome\}\}/g, process.user.name).replace(/\{\{processo\}\}/g, reference))
    const bytes = await textDocumentPdf(title, lines)
    const directory = path.join(cwd(), "uploads", String(actor.userId), String(processId), "generated")
    await fs.mkdir(directory, { recursive: true })
    const storedName = `${kind}-${Date.now()}-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.pdf`
    await fs.writeFile(path.join(directory, storedName), bytes)
    await prisma.$transaction(async tx => {
      const file = await tx.evidenceFile.create({ data: { userId: actor.userId, originalName: `${kind}-${processId}.pdf`, storedName, mimeType: "application/pdf", sizeBytes: BigInt(bytes.length), url: `/uploads/${actor.userId}/${processId}/generated/${storedName}`, usageType: "GENERATED_DOCUMENT" } })
      await tx.documentProcess.create({ data: { processId, templateId: configured?.idDocumentTemplate, documentType: kind, nature: "OSTENSIVO", format: "PDF", evidenceFileId: file.idEvidenceFile, generatedById: actor.userId, purpose: "GENERATED_DOCUMENT" } })
      await tx.processAudit.create({ data: { processId, actorId: actor.userId, action: "DOCUMENT_GENERATED", details: { kind, templateId: configured?.idDocumentTemplate ?? null, templateVersion: configured?.version ?? "IFFar-2024-2025-v1", hash: createHash("sha256").update(bytes).digest("hex") } } })
    })
    return { bytes, name: `${kind}-${processId}.pdf` }
  }
}
