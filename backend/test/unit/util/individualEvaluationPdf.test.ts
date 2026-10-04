import { describe, expect, test } from "@jest/globals"
import { generateIndividualEvaluationPdf } from "../../../src/util/individualEvaluationPdf"

describe("generateIndividualEvaluationPdf", () => {
  test("gera um PDF com parecer, resultado e itens reconhecidos", async () => {
    const pdf = await generateIndividualEvaluationPdf({
      processId: 15,
      externalNumber: "TESTE-RSC",
      processTypeName: "Reconhecimento de Saberes e Competências",
      teacherName: "Docente Teste",
      teacherSiape: "7654321",
      campus: "Campus Santa Maria",
      cityState: "Santa Maria/RS",
      targetLevel: "RSC_I",
      evaluatorName: "Avaliador Teste",
      submittedAt: new Date("2026-09-30T12:00:00Z"),
      result: "DEFERRED",
      recognizedPoints: 60,
      opinionText: "Parecer favorável com fundamentação suficiente.",
      scores: [{
        description: "Atividade reconhecida",
        recognizedQuantity: 2,
        awardedPoints: 10,
        evaluatorComment: "Comprovante válido"
      }]
    })

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF")
    expect(pdf.length).toBeGreaterThan(500)
  })
})
