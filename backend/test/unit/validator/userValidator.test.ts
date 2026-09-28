import { describe, expect, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import {
  confirmInvitationSchema,
  createUserSchema,
  selectRoleSchema
} from "../../../src/validator/userValidator"

describe("userValidator", () => {
  test("permite criar avaliador externo sem CPF e senha", () => {
    const result = createUserSchema.validate({
      name: "Avaliador Externo",
      email: "avaliador@if.edu.br",
      roles: [RoleName.EXTERNAL_EVALUATOR],
      externalEvaluatorProfile: {
        title: "Doutor",
        institution: "Instituto Federal"
      }
    })

    expect(result.error).toBeUndefined()
  })

  test("mantém CPF e senha obrigatórios para os demais perfis", () => {
    const result = createUserSchema.validate({
      name: "Administrador",
      email: "admin@if.edu.br",
      roles: [RoleName.ADMIN]
    })

    expect(result.error?.message).toContain("CPF é obrigatório")
  })

  test("valida os dados necessários para aceitar o convite", () => {
    const result = confirmInvitationSchema.validate({
      email: "avaliador@if.edu.br",
      code: "1234567890123456",
      cpf: "529.982.247-25",
      newPassword: "NovaSenha123"
    })

    expect(result.error).toBeUndefined()
    expect(result.value.cpf).toBe("52998224725")
  })

  test("permite cadastrar e selecionar o perfil CPPD Central", () => {
    const createResult = createUserSchema.validate({
      name: "CPPD Central",
      email: "cppd.central@if.edu.br",
      cpf: "529.982.247-25",
      password: "Senha123",
      roles: [RoleName.CPPD_CENTRAL]
    })
    const selectResult = selectRoleSchema.validate({
      refreshToken: "token-valido",
      role: RoleName.CPPD_CENTRAL
    })

    expect(createResult.error).toBeUndefined()
    expect(selectResult.error).toBeUndefined()
  })
})
