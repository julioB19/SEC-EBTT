import { beforeEach, describe, expect, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import { CampusEmailPolicyService, emailMatchesDomain, normalizeInstitutionalDomain } from "../../../src/service/campusEmailPolicyService"
import { accessDatabase } from "../../support/accessDatabase"

describe("Domínios institucionais por campus", () => {
  let db: ReturnType<typeof accessDatabase>
  let service: CampusEmailPolicyService
  const frederico = { id: 8, role: RoleName.CPPD_MEMBER, campusIds: [1] }
  const admin = { id: 1, role: RoleName.ADMIN }
  beforeEach(async () => {
    db = accessDatabase(); service = new CampusEmailPolicyService(db)
    await db.campus.create({ data: { idCampus: 1, name: "Frederico Westphalen", active: true } })
    await db.campus.create({ data: { idCampus: 2, name: "Panambi", active: true } })
  })
  test("campus configura seu domínio e aceita subdomínios quando permitido", async () => {
    await service.add(frederico, 1, { domain: " IFFARROUPILHA.EDU.BR ", includeSubdomains: true })
    expect(await service.requireAllowed("Pessoa@iffarroupilha.edu.br", 1)).toBe("pessoa@iffarroupilha.edu.br")
    expect(await service.requireAllowed("pessoa@aluno.iffarroupilha.edu.br", 1)).toBe("pessoa@aluno.iffarroupilha.edu.br")
  })
  test("subdomínio aluno.iffar.edu.br exige regra correspondente, não é subdomínio de iffarroupilha", async () => {
    await service.add(frederico, 1, { domain: "iffarroupilha.edu.br" })
    expect(await service.accepts("pessoa@aluno.iffar.edu.br", 1)).toBe(false)
    await service.add(frederico, 1, { domain: "iffar.edu.br", includeSubdomains: true })
    expect(await service.accepts("pessoa@aluno.iffar.edu.br", 1)).toBe(true)
  })
  test("domínios com prefixos semelhantes ou sufixos adicionais são recusados", () => {
    for (const email of ["pessoa@falsoiffar.edu.br", "pessoa@iffar.edu.br.outro.com", "pessoa@aluno.iffar.edu.br.outro.com"]) expect(emailMatchesDomain(email, "iffar.edu.br", true)).toBe(false)
  })
  test("cada campus controla suas regras, mesmo quando os domínios são iguais", async () => {
    const rule = await service.add(frederico, 1, { domain: "iffarroupilha.edu.br" })
    expect(await service.accepts("pessoa@iffarroupilha.edu.br", 2)).toBe(false)
    await service.add(admin, 2, { domain: "iffarroupilha.edu.br", includeSubdomains: false })
    expect(await service.accepts("pessoa@aluno.iffarroupilha.edu.br", 1)).toBe(true)
    expect(await service.accepts("pessoa@aluno.iffarroupilha.edu.br", 2)).toBe(false)
    await expect(service.list(frederico, 2)).rejects.toMatchObject({ status: 403 })
    await expect(service.add(frederico, 2, { domain: "outro.edu.br" })).rejects.toMatchObject({ status: 403 })
    await expect(service.update(frederico, 2, rule.id, { active: false })).rejects.toMatchObject({ status: 403 })
    await expect(service.resolveCampus("pessoa@iffarroupilha.edu.br")).rejects.toThrow("Selecione o campus")
  })
  test("inativação vale apenas para o campus escolhido", async () => {
    const rule = await service.add(frederico, 1, { domain: "iffarroupilha.edu.br" })
    await service.add(admin, 2, { domain: "iffarroupilha.edu.br" })
    await service.update(frederico, 1, rule.id, { active: false })
    expect(await service.accepts("pessoa@iffarroupilha.edu.br", 1)).toBe(false)
    expect(await service.accepts("pessoa@iffarroupilha.edu.br", 2)).toBe(true)
  })
  test("campus sem regra e domínio malformado não são aceitos", async () => {
    await expect(service.requireAllowed("pessoa@iffarroupilha.edu.br", 1)).rejects.toThrow("não é aceito")
    for (const domain of ["@iffarroupilha.edu.br", "https://iffarroupilha.edu.br", "*.edu.br", "iffarroupilha.edu.br/caminho", "iffar..edu.br"]) expect(() => normalizeInstitutionalDomain(domain)).toThrow()
  })
  test("a listagem administrativa local não expõe campi sem vínculo", async () => {
    expect((await service.campuses(frederico)).map(campus => campus.idCampus)).toEqual([1])
    expect(await service.campuses(admin)).toHaveLength(2)
    await expect(service.add({ id: 10, role: RoleName.DOCENTE, campusIds: [1] }, 1, { domain: "iffarroupilha.edu.br" })).rejects.toMatchObject({ status: 403 })
  })
})
