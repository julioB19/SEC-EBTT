import { RoleName } from "@prisma/client"
import Joi from "joi"

export class AccessError extends Error {
  constructor(message: string, public readonly status = 400) { super(message) }
}

export function normalizedEmail(value: unknown): string {
  const { error, value: email } = Joi.string().trim().lowercase().email().max(180).required().validate(value)
  if (error) throw new AccessError("Informe um e-mail válido")
  return email
}

export function invitationRoles(value: unknown): RoleName[] {
  if (!Array.isArray(value) || !value.length || value.some(role => !Object.values(RoleName).includes(role))) {
    throw new AccessError("Informe perfis válidos para o convite")
  }
  return [...new Set(value)]
}

type SessionUser = {
  active: boolean
  deletedDate?: Date | null
  roles?: { deletedDate?: Date | null; role: { name: RoleName; deletedDate?: Date | null } | null }[]
  externalEvaluator?: { active: boolean; deletedDate: Date | null } | null
}

export function activeRoles(user: SessionUser): RoleName[] {
  if (!user.active || user.deletedDate) return []
  return (user.roles ?? []).filter(link => !link.deletedDate && link.role && !link.role.deletedDate)
    .map(link => link.role!.name)
    .filter(role => role !== RoleName.EXTERNAL_EVALUATOR ||
      (user.externalEvaluator?.active && !user.externalEvaluator.deletedDate))
}
