import { describe, expect, test } from "@jest/globals"
import {
  addSpecialCommissionMemberSchema,
  finalizeSpecialCommissionDecisionSchema,
  respondSpecialCommissionInvitationSchema,
  saveSpecialCommissionSchema,
  updateSpecialCommissionStatusSchema
} from "../../../src/validator/specialCommissionValidator"

describe("specialCommissionValidator", () => {
  test("normaliza o e-mail e aplica a função padrão", () => {
    const { error, value } = addSpecialCommissionMemberSchema.validate({
      email: " Avaliador@Exemplo.COM "
    })
    expect(error).toBeUndefined()
    expect(value).toEqual({ email: "avaliador@exemplo.com", role: "MEMBER" })
  })

  test("rejeita e-mail e função inválidos", () => {
    expect(addSpecialCommissionMemberSchema.validate({ email: "invalido" }).error).toBeDefined()
    expect(addSpecialCommissionMemberSchema.validate({ email: "a@b.com", role: "OWNER" }).error).toBeDefined()
  })

  test("aceita ativação, conclusão ou cancelamento da comissão", () => {
    expect(updateSpecialCommissionStatusSchema.validate({ status: "ACTIVE" }).error).toBeUndefined()
    expect(updateSpecialCommissionStatusSchema.validate({ status: "COMPLETED" }).error).toBeUndefined()
    expect(updateSpecialCommissionStatusSchema.validate({ status: "DRAFT" }).error).toBeDefined()
  })

  test("aceita apenas resposta definitiva ao convite", () => {
    expect(respondSpecialCommissionInvitationSchema.validate({ response: "ACCEPTED" }).error).toBeUndefined()
    expect(respondSpecialCommissionInvitationSchema.validate({ response: "PENDING" }).error).toBeDefined()
  })

  test("valida os dados opcionais da portaria", () => {
    expect(
      saveSpecialCommissionSchema.validate({ ordinance: "Portaria 12/2026", ordinanceDate: "2026-09-13" }).error
    ).toBeUndefined()
    expect(saveSpecialCommissionSchema.validate({ ordinanceDate: "ontem" }).error).toBeDefined()
  })

  test("exige decisão e parecer consolidado", () => {
    expect(
      finalizeSpecialCommissionDecisionSchema.validate({
        decision: "APPROVED",
        opinionText: "Parecer consolidado favorável."
      }).error
    ).toBeUndefined()
    expect(
      finalizeSpecialCommissionDecisionSchema.validate({ decision: "APPROVED", opinionText: "" }).error
    ).toBeDefined()
    expect(
      finalizeSpecialCommissionDecisionSchema.validate({ decision: "RETURNED", opinionText: "Parecer" }).error
    ).toBeDefined()
  })
})
