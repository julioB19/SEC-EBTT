import { describe, expect, test } from "@jest/globals"
import { addGeccInterestedSchema, saveGeccSchema, updateGeccStatusSchema } from "../../../src/validator/geccValidator"

describe("geccValidator", () => {
  test("valida detalhes e interessado", () => {
    expect(saveGeccSchema.validate({ externalNumber: "SIPAC-123" }).error).toBeUndefined()
    expect(
      addGeccInterestedSchema.validate({
        name: "Avaliador",
        email: "AVALIADOR@EXEMPLO.COM",
        type: "EXTERNAL_EVALUATOR"
      }).error
    ).toBeUndefined()
    expect(addGeccInterestedSchema.validate({ name: "A", email: "invalido", type: "OTHER" }).error).toBeDefined()
  })

  test("aceita somente avanços manuais previstos", () => {
    expect(updateGeccStatusSchema.validate({ status: "READY_TO_SEND" }).error).toBeUndefined()
    expect(updateGeccStatusSchema.validate({ status: "SENT_TO_CGP" }).error).toBeUndefined()
    expect(updateGeccStatusSchema.validate({ status: "COMPLETED" }).error).toBeUndefined()
    expect(updateGeccStatusSchema.validate({ status: "DRAFT" }).error).toBeDefined()
  })
})
