import { describe, expect, test } from "@jest/globals"
import { updateMyProfileSchema, updateUserSchema, publicDocenteRegisterSchema } from "../../../src/validator/userValidator"

describe("Telefone opcional e máscaras nos perfis", () => {
  test.each([updateMyProfileSchema, updateUserSchema])("permite manter ou retirar telefone opcional sem rejeitar null", schema => {
    expect(schema.validate({ phone: null }).error).toBeUndefined()
    expect(schema.validate({}).error).toBeUndefined()
    expect(schema.validate({ phone: "(55) 99999-9999" }).error).toBeUndefined()
    expect(schema.validate({ phone: "123" }).error?.message).toContain("Telefone inválido")
  })
  test("cadastro público continua exigindo telefone preenchido", () => {
    const result = publicDocenteRegisterSchema.validate({ phone: null }, { abortEarly: false })
    expect(result.error?.details.some(detail => detail.path[0] === "phone")).toBe(true)
  })
})
