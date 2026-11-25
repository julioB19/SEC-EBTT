import { describe, expect, jest, test } from "@jest/globals"
import ExcelJS from "exceljs"
import { ProcessScoreService } from "../../../src/service/processScoreService"

describe("Exportação da planilha RSC", () => {
  test("mapeia o código oficial com IDs recriados e exporta somente identificação e pontuações", async () => {
    const processRepo: any = { findByIdForScoreSpreadsheet: async () => ({ idProcess: 1, userId: 8, scoringTableId: 99, externalNumber: "RSC-TESTE", campus: "Campus Santa Maria", table: { purpose: "RSC" }, user: { name: "Docente de Teste", docente: { siape: "1234567" } }, rscDetail: { targetLevel: "RSC_III" } }) }
    const tableRepo: any = { findItemsByTableId: async () => [{ idScoringItem: 90001, formulaKey: "RSC_001" }] }
    const scoreRepo: any = { listByProcess: async () => [{ itemId: 90001, quantity: 12, awardedPoints: 12 }] }
    const service = new ProcessScoreService(processRepo, tableRepo, scoreRepo, {} as any, {} as any)
    // A conversão externa fica na fronteira; verifica-se o conteúdo efetivo enviado ao conversor.
    jest.spyOn(service as any, "converterXlsxBufferParaPdfBuffer").mockImplementation(async (...args: unknown[]) => args[0])
    const output = await service.gerarPlanilhaPontuacao(1, 8)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(output.fileBuffer as any)
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Dados Pessoais", "RSC I", "RSC II", "RSC III"])
    expect(workbook.getWorksheet("Dados Pessoais")!.getCell("B4").text).toBe("1234567")
    expect(workbook.getWorksheet("Dados Pessoais")!.getCell("B5").text).toBe("RSC III")
    const sheet = workbook.getWorksheet("RSC I")!
    let quantity: unknown
    sheet.eachRow(row => { if (row.getCell(1).value === 1) quantity = row.getCell(7).value })
    expect(quantity).toBe(12)
    await expect(service.gerarPlanilhaPontuacao(1, 9)).rejects.toThrow("não encontrado")
  })
})

describe("Período avaliado da planilha de desempenho", () => {
  const service: any = new ProcessScoreService({} as any, {} as any, {} as any, {} as any, {} as any)
  test("Progressão/Promoção usa o interstício e a Classe Titular usa o período informado pelo docente", () => {
    const career = { processTypeConfig: { category: "CAREER" }, intersticeStart: new Date("2023-01-01"), intersticeEnd: new Date("2024-12-31") }
    expect(service.periodoAvaliado(career)).toBe("01/01/2023 a 31/12/2024")
    const titular = { processTypeConfig: { category: "FULL_PROFESSOR" }, intersticeStart: null, intersticeEnd: null, compliance: { titularPerformancePeriodStart: new Date("2024-11-01"), titularPerformancePeriodEnd: new Date("2026-10-31") } }
    expect(service.periodoAvaliado(titular)).toBe("01/11/2024 a 31/10/2026")
    expect(service.periodoAvaliado({ ...titular, compliance: null })).toBe("")
  })
})
