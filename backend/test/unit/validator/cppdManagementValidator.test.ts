import { describe, expect, test } from "@jest/globals"
import {
  addCppdCommissionMemberSchema,
  createCampusSchema,
  createCppdCommissionSchema
} from "../../../src/validator/cppdManagementValidator"

describe("cppdManagementValidator", () => {
  test("valida cadastro de campus", () => {
    const result = createCampusSchema.validate({
      name: "Campus Alegrete",
      acronym: "AL",
      cppdEmail: "cppd.al@if.edu.br"
    })
    expect(result.error).toBeUndefined()
  })

  test("converte datas ISO da comissão", () => {
    const result = createCppdCommissionSchema.validate({
      campusId: 1,
      ordinance: "Portaria 10/2026",
      validityStart: "2026-01-01",
      validityEnd: "2027-12-31"
    })
    expect(result.error).toBeUndefined()
    expect(result.value.validityStart).toBeInstanceOf(Date)
  })

  test("rejeita função de membro desconhecida", () => {
    const result = addCppdCommissionMemberSchema.validate({
      personId: 2,
      function: "COORDINATOR"
    })
    expect(result.error).toBeDefined()
  })
})
