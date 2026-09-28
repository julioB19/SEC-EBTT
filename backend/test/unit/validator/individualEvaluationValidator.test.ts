import { describe, expect, test } from "@jest/globals"
import { saveIndividualEvaluationSchema } from "../../../src/validator/individualEvaluationValidator"

describe("individualEvaluationValidator", () => {
  test("aceita rascunho vazio e avaliação completa", () => {
    expect(saveIndividualEvaluationSchema.validate({}).error).toBeUndefined()
    expect(
      saveIndividualEvaluationSchema.validate({
        result: "DEFERRED",
        opinionText: "Parecer fundamentado",
        scores: [{ itemId: 1, awardedPoints: 10.5, evaluatorComment: "Comprovado" }]
      }).error
    ).toBeUndefined()
  })

  test("rejeita resultado, pontuação e itens duplicados inválidos", () => {
    expect(saveIndividualEvaluationSchema.validate({ result: "PENDING" }).error).toBeDefined()
    expect(
      saveIndividualEvaluationSchema.validate({ scores: [{ itemId: 1, awardedPoints: -1 }] }).error
    ).toBeDefined()
    expect(
      saveIndividualEvaluationSchema.validate({
        scores: [
          { itemId: 1, awardedPoints: 1 },
          { itemId: 1, awardedPoints: 2 }
        ]
      }).error
    ).toBeDefined()
  })
})
