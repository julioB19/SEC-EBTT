import { RoleName } from "@prisma/client"
import { domainToASCII } from "node:url"
import { prisma } from "../infra/prismaClient"
import { AccessError, normalizedEmail } from "../util/accessPolicy"

export type CampusActor = { id: number; role: RoleName; campusIds?: number[] }
export function normalizeInstitutionalDomain(value: unknown) {
  if (typeof value !== "string") throw new AccessError("Informe o domínio, sem @ ou endereço de site")
  if (/[\s@/:*?#\\]/.test(value.trim())) throw new AccessError("Informe somente o domínio, sem @, caminho ou asterisco")
  const domain = domainToASCII(value.trim().toLowerCase())
  const labels = domain.split(".")
  if (domain.length > 253 || labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || !/^[a-z]{2,63}$/.test(labels.at(-1)!)) {
    throw new AccessError("Informe um domínio válido, como iffarroupilha.edu.br, sem @, caminho ou asterisco")
  }
  return domain
}
export function emailMatchesDomain(email: string, domain: string, includeSubdomains: boolean) {
  const actual = email.slice(email.lastIndexOf("@") + 1).toLowerCase()
  return actual === domain || (includeSubdomains && actual.endsWith(`.${domain}`))
}

export class CampusEmailPolicyService {
  constructor(private readonly db = prisma) {}

  async campus(value: unknown) {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) throw new AccessError("Selecione o campus")
    const campus = await this.db.campus.findUnique({ where: { idCampus: id } })
    if (!campus?.active || campus.deletedDate) throw new AccessError("Campus não encontrado ou inativo", 404)
    return campus
  }

  assertAccess(actor: CampusActor, campusId: number) {
    if (actor.role === RoleName.ADMIN || actor.role === RoleName.CPPD_CENTRAL) return
    if (actor.role !== RoleName.CPPD_MEMBER || !actor.campusIds?.includes(campusId)) {
      throw new AccessError("Você não administra este campus", 403)
    }
  }

  async campuses(actor?: CampusActor) {
    const restricted = actor && ![RoleName.ADMIN, RoleName.CPPD_CENTRAL].includes(actor.role as "ADMIN" | "CPPD_CENTRAL")
    return this.db.campus.findMany({ where: { active: true, ...(restricted ? { idCampus: { in: actor.campusIds ?? [] } } : {}) },
      select: { idCampus: true, name: true, acronym: true }, orderBy: { name: "asc" } })
  }

  async list(actor: CampusActor, campusId: number) {
    this.assertAccess(actor, campusId)
    await this.campus(campusId)
    return this.db.campusEmailDomain.findMany({ where: { campusId }, orderBy: { domain: "asc" } })
  }

  async add(actor: CampusActor, campusId: number, body: { domain?: unknown; includeSubdomains?: unknown }) {
    this.assertAccess(actor, campusId)
    await this.campus(campusId)
    const domain = normalizeInstitutionalDomain(body.domain)
    if (body.includeSubdomains !== undefined && typeof body.includeSubdomains !== "boolean") throw new AccessError("Opção de subdomínios inválida")
    const existing = await this.db.campusEmailDomain.findUnique({ where: { campusId_domain: { campusId, domain } } })
    if (existing) throw new AccessError("Este domínio já está cadastrado neste campus; altere sua situação na lista", 409)
    return this.db.campusEmailDomain.create({ data: { campusId, domain, includeSubdomains: body.includeSubdomains !== false,
      createdById: actor.id, updatedById: actor.id } })
  }

  async update(actor: CampusActor, campusId: number, id: string, body: { active?: unknown; includeSubdomains?: unknown }) {
    this.assertAccess(actor, campusId)
    await this.campus(campusId)
    const rule = await this.db.campusEmailDomain.findUnique({ where: { id } })
    if (!rule || rule.campusId !== campusId) throw new AccessError("Domínio não encontrado neste campus", 404)
    if ((body.active !== undefined && typeof body.active !== "boolean") ||
      (body.includeSubdomains !== undefined && typeof body.includeSubdomains !== "boolean") ||
      (body.active === undefined && body.includeSubdomains === undefined)) throw new AccessError("Informe a situação ou a opção de subdomínios")
    return this.db.campusEmailDomain.update({ where: { id }, data: { active: body.active as boolean | undefined,
      includeSubdomains: body.includeSubdomains as boolean | undefined, updatedById: actor.id } })
  }

  async accepts(email: string, campusId: number) {
    await this.campus(campusId)
    const rules = await this.db.campusEmailDomain.findMany({ where: { campusId, active: true } })
    return rules.some(rule => emailMatchesDomain(email, rule.domain, rule.includeSubdomains))
  }

  async resolveCampus(email: string, preferred?: unknown) {
    email = normalizedEmail(email)
    if (preferred !== undefined && preferred !== null && preferred !== "") return this.campus(preferred)
    const campuses = await this.campuses()
    const matches = []
    for (const campus of campuses) if (await this.accepts(email, campus.idCampus)) matches.push(campus)
    if (matches.length !== 1) throw new AccessError("Selecione o campus para validar seu e-mail institucional")
    return matches[0]
  }

  async requireAllowed(value: unknown, campusId?: unknown) {
    const email = normalizedEmail(value)
    const campus = await this.resolveCampus(email, campusId)
    if (!await this.accepts(email, campus.idCampus)) throw new AccessError("Este e-mail não é aceito pelo campus selecionado. Confira os domínios com a administração")
    return email
  }
}
