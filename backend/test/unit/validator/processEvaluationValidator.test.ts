import { describe, expect, test } from "@jest/globals"
import {
  finalizeEvaluationSchema,
  generateParecerSchema,
  updateItemScoreSchema
} from "../../../src/validator/processEvaluationValidator"

describe("processEvaluationValidator", () => {
  test.each(["APPROVED", "REJECTED"])("aceita decisão %s", decision => {
    expect(finalizeEvaluationSchema.validate({ decision }).error).toBeUndefined()
  })

  test("recusa devolução para correção e decisão desconhecida", () => {
    expect(finalizeEvaluationSchema.validate({ decision: "RETURNED" }).error).toBeDefined()
    expect(finalizeEvaluationSchema.validate({ decision: "OTHER" }).error).toBeDefined()
  })

  test("valida notas decimais com ponto ou vírgula", () => {
    for (const value of ["10", "10.25", "10,25", "", null]) {
      expect(updateItemScoreSchema.validate({
        scores: [{ itemId: 1, evaluatorAwardedPoints: value }]
      }).error).toBeUndefined()
    }
    expect(updateItemScoreSchema.validate({
      scores: [{ itemId: 1, evaluatorAwardedPoints: "abc" }]
    }).error).toBeDefined()
  })

  test("parecer aceita somente campos previstos", () => {
    expect(generateParecerSchema.validate({ overrideOpinion: null, evaluatorUserIds: [1, 2] }).error)
      .toBeUndefined()
    expect(generateParecerSchema.validate({ evaluatorUserIds: [0] }).error).toBeDefined()
  })
})
