import { CaseDocumentService } from "../../../src/service/caseDocumentService"
import { textDocumentPdf } from "../../../src/util/processDocuments"
import { prisma } from "../../../src/infra/prismaClient"
import { RoleName } from "@prisma/client"

jest.mock("../../../src/service/caseComplianceService", () => ({
  CaseComplianceService: jest.fn(), calculateTitularEffects: jest.fn(),
}))
jest.mock("../../../src/service/processoService", () => ({ BusinessRuleError: class extends Error {} }))
jest.mock("../../../src/infra/prismaClient", () => ({ prisma: {
  documentTemplate: { findFirst: jest.fn() }, $transaction: jest.fn(),
} }))
jest.mock("../../../src/util/processDocuments", () => ({ textDocumentPdf: jest.fn() }))
jest.mock("fs/promises", () => ({ __esModule: true, default: { mkdir: jest.fn(), writeFile: jest.fn() } }))

describe("Documentos de Classe Titular", () => {
  const actor = { userId: 2, role: RoleName.CPPD_CENTRAL }
  const fixture = (mode: string, outcome: string | null = "APPROVED") => ({
    userId: 1, user: { name: "Docente de teste", docente: { siape: "123" } },
    processTypeConfig: { category: "FULL_PROFESSOR" }, status: "UNDER_REVIEW",
    campus: "Campus de teste", cidadeUF: "Alegrete/RS", specialCommissions: [],
    fullProfessorDetail: { evaluationMode: mode, oralDefenseHeldAt: new Date("2026-11-09T15:00:00Z"), oralDefenseRecordingUrl: "registro-de-teste", currentOutcome: outcome },
  })
  const service = (process: ReturnType<typeof fixture>) => new CaseDocumentService({ context: jest.fn().mockResolvedValue(process) } as any)

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-11T01:30:00Z"))
    ;(prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(null)
    ;(textDocumentPdf as jest.Mock).mockResolvedValue(Buffer.from("PDF de teste"))
    ;(prisma.$transaction as jest.Mock).mockImplementation(async action => action({
      evidenceFile: { create: jest.fn().mockResolvedValue({ idEvidenceFile: 1 }) },
      documentProcess: { create: jest.fn() }, processAudit: { create: jest.fn() },
    }))
  })
  afterEach(() => jest.useRealTimers())

  it.each([
    ["MEMORIAL", "THESIS_DEFENSE_MINUTES"],
    ["THESIS", "MEMORIAL_DEFENSE_MINUTES"],
  ])("recusa ata incompatível com a modalidade %s", async (mode, kind) => {
    await expect(service(fixture(mode)).generate(1, actor, kind)).rejects.toThrow(/modalidade/i)
    expect(textDocumentPdf).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    ["MEMORIAL", "MEMORIAL_DEFENSE_MINUTES"],
    ["THESIS", "THESIS_DEFENSE_MINUTES"],
  ])("permite a ata correspondente à modalidade %s", async (mode, kind) => {
    await expect(service(fixture(mode)).generate(1, actor, kind)).resolves.toHaveProperty("name", `${kind}-1.pdf`)
  })

  it("emite o documento com a data civil institucional, mesmo após meia-noite UTC", async () => {
    await service(fixture("MEMORIAL")).generate(1, actor, "MEMORIAL_DEFENSE_MINUTES")
    expect((textDocumentPdf as jest.Mock).mock.calls[0][1]).toContain("Data de emissão: 10/11/2026.")
  })

  it("não transforma resultado ainda ausente em reprovação", async () => {
    await service(fixture("THESIS", null)).generate(1, actor, "THESIS_DEFENSE_MINUTES")
    expect((textDocumentPdf as jest.Mock).mock.calls[0][1]).toContain("Resultado: NÃO REGISTRADO.")
  })

  it("registra na ata a data local de uma defesa realizada à noite", async () => {
    const process = fixture("THESIS")
    process.fullProfessorDetail.oralDefenseHeldAt = new Date("2026-11-10T01:30:00Z")
    await service(process).generate(1, actor, "THESIS_DEFENSE_MINUTES")
    expect((textDocumentPdf as jest.Mock).mock.calls[0][1].join("\n")).toContain("Em 09/11/2026, realizou-se")
  })

  it("preserva a reprovação explicitamente registrada", async () => {
    await service(fixture("THESIS", "REJECTED")).generate(1, actor, "THESIS_DEFENSE_MINUTES")
    expect((textDocumentPdf as jest.Mock).mock.calls[0][1]).toContain("Resultado: REPROVADO.")
  })
})
