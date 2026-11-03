import { RoleName, ClassLevel } from "@prisma/client"
import Joi from "joi"
import { cpf as cpfValidator } from "cpf-cnpj-validator"

function onlyDigits(input: string): string {
  let out = ""
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") out += ch
  }
  return out
}

function validatePhone(v: string, helpers: Joi.CustomHelpers<string>) {
  if (typeof v !== "string") return helpers.error("any.invalid")
  const digits = onlyDigits(v)
  if (digits.length < 10 || digits.length > 11) return helpers.error("any.invalid")
  return v
}

const docenteProfileSchema = Joi.object({
  campusId: Joi.number().integer().positive().optional(),
  siape: Joi.string().trim().required(),
  classLevel: Joi.string()
    .valid(...Object.values(ClassLevel))
    .required(),
  startInterstice: Joi.date().required(),
  educationLevel: Joi.string().trim().required(),
  improvement: Joi.string().trim().optional().allow(null),
  specialization: Joi.string().trim().optional().allow(null),
  mastersDegree: Joi.string().trim().optional().allow(null),
  doctorate: Joi.string().trim().optional().allow(null),
  assignment: Joi.string().trim().optional().allow(null),
  department: Joi.string().trim().optional().allow(null),
  division: Joi.string().trim().optional().allow(null),
  role: Joi.string().trim().optional().allow(null),
  immediateSupervisor: Joi.string().trim().optional().allow(null)
})

const externalEvaluatorProfileSchema = Joi.object({
  title: Joi.string().trim().max(120).allow(null, "").optional(),
  institution: Joi.string().trim().max(180).allow(null, "").optional()
})

export const createUserSchema = Joi.object({
  campusId: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  cpf: Joi.alternatives()
    .try(
      Joi.string()
        .trim()
        .custom((value, helpers) => {
          const digits = onlyDigits(value)
          if (!cpfValidator.isValid(digits)) return helpers.error("any.invalid")
          return digits
        })
        .messages({ "any.invalid": "CPF inválido" }),
      Joi.valid(null, "")
    )
    .optional(),
  phone: Joi.string()
    .trim()
    .custom(validatePhone)
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .allow(null, "")
    .optional(),
  city: Joi.string().max(100).allow(null, "").optional(),
  uf: Joi.string().length(2).uppercase().allow(null, "").optional(),
  password: Joi.string().min(8).allow(null, "").optional(),
  roles: Joi.array()
    .items(Joi.string().valid(RoleName.ADMIN, RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL, RoleName.DOCENTE, RoleName.EXTERNAL_EVALUATOR))
    .min(1)
    .required(),
  docenteProfile: Joi.when("roles", {
    is: Joi.array().items(Joi.valid(RoleName.DOCENTE)).has(RoleName.DOCENTE),
    then: docenteProfileSchema.required(),
    otherwise: docenteProfileSchema.optional()
  }),
  externalEvaluatorProfile: externalEvaluatorProfileSchema.optional()
}).custom((value, helpers) => {
  const roles = Array.isArray(value.roles) ? value.roles : []
  const externalOnly = roles.length === 1 && roles.includes(RoleName.EXTERNAL_EVALUATOR)

  if (!externalOnly && !value.cpf) {
    return helpers.message({
      custom: "CPF é obrigatório para este tipo de usuário"
    })
  }
  if (!externalOnly && !value.password) {
    return helpers.message({
      custom: "Senha provisória é obrigatória para este tipo de usuário"
    })
  }
  return value
})

export const loginSchema = Joi.object({
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      const digits = onlyDigits(value)
      if (!cpfValidator.isValid(digits)) return helpers.error("any.invalid")
      return digits
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  password: Joi.string().required()
})

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required()
})

export const selectRoleSchema = Joi.object({
  refreshToken: Joi.string().trim().required(),
  role: Joi.string()
    .valid(RoleName.DOCENTE, RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL, RoleName.ADMIN, RoleName.EXTERNAL_EVALUATOR)
    .required()
})

export const logoutSchema = Joi.object({
  refreshToken: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
    .required()
})

const updateDocenteSchema = Joi.object({
  siape: Joi.string().trim().optional(),
  classLevel: Joi.string()
    .valid(...Object.values(ClassLevel))
    .optional(),
  startInterstice: Joi.date().optional(),
  educationLevel: Joi.string().trim().optional(),
  improvement: Joi.string().trim().allow(null).optional(),
  specialization: Joi.string().trim().allow(null).optional(),
  mastersDegree: Joi.string().trim().allow(null).optional(),
  doctorate: Joi.string().trim().allow(null).optional(),
  assignment: Joi.string().trim().allow(null).optional(),
  department: Joi.string().trim().allow(null).optional(),
  division: Joi.string().trim().allow(null).optional(),
  role: Joi.string().trim().allow(null).optional(),
  immediateSupervisor: Joi.string().trim().allow(null).optional()
})

export const updateUserSchema = Joi.object({
  campusId: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().optional(),
  email: Joi.string().email().optional(),
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (value === undefined) return value
      const digits = onlyDigits(value)
      return !cpfValidator.isValid(digits) ? helpers.error("any.invalid") : digits
    })
    .messages({ "any.invalid": "CPF inválido" })
    .optional(),
  phone: Joi.string()
    .trim()
    .custom((v, h) => (v === undefined ? v : validatePhone(v, h)))
    .allow(null, "")
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .optional(),
  city: Joi.string().max(100).allow(null, "").optional(),
  uf: Joi.string().length(2).uppercase().allow(null, "").optional(),
  active: Joi.boolean().optional(),
  roles: Joi.array()
    .items(Joi.string().valid(RoleName.ADMIN, RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL, RoleName.DOCENTE, RoleName.EXTERNAL_EVALUATOR))
    .optional(),
  docenteProfile: updateDocenteSchema.optional(),
  externalEvaluatorProfile: externalEvaluatorProfileSchema.optional()
})

export const userIdParamSchema = Joi.object({
  userId: Joi.number().integer().positive().required()
})

export const userIdQuerySchema = Joi.object({
  id: Joi.number().integer().positive().required()
})

export const publicDocenteRegisterSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().trim().lowercase().email().required(),
  cpf: Joi.string()
    .trim()
    .custom((v, h) => {
      const digits = onlyDigits(v)
      return !cpfValidator.isValid(digits) ? h.error("any.invalid") : digits
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  phone: Joi.string()
    .trim()
    .custom(validatePhone)
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .required(),
  city: Joi.string().max(100).allow(null, ""),
  uf: Joi.string().length(2).uppercase().allow(null, ""),
  password: Joi.string().min(8).required(),
  docenteProfile: docenteProfileSchema.keys({ campusId: Joi.number().integer().positive().required() }).required(),
  roles: Joi.forbidden()
})

export const requestPasswordResetSchema = Joi.object({
  cpf: Joi.string().required()
})

export const confirmPasswordResetSchema = Joi.object({
  cpf: Joi.string().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).max(100).required()
})

export const updateMyProfileSchema = Joi.object({
  name: Joi.string().trim().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string()
    .trim()
    .custom((v, h) => (v === undefined ? v : validatePhone(v, h)))
    .allow(null, "")
    .messages({ "any.invalid": "Telefone inválido (use 10 ou 11 dígitos)" })
    .optional(),
  city: Joi.string().max(100).allow(null, "").optional(),
  uf: Joi.string().length(2).uppercase().allow(null, "").optional(),
  docenteProfile: updateDocenteSchema.optional(),
  cpf: Joi.forbidden(),
  roles: Joi.forbidden(),
  active: Joi.forbidden()
})

export const updateDocenteByCppdSchema = Joi.object({
  email: Joi.string().email().optional(),
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (value === undefined) return value
      const digits = onlyDigits(value)
      return !cpfValidator.isValid(digits) ? helpers.error("any.invalid") : digits
    })
    .messages({ "any.invalid": "CPF inválido" })
    .optional(),
  siape: Joi.string().trim().optional()
}).unknown(false)

export const setUserRolesSchema = Joi.object({
  roles: Joi.array()
    .items(Joi.string().valid(RoleName.ADMIN, RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL, RoleName.DOCENTE, RoleName.EXTERNAL_EVALUATOR))
    .min(1)
    .required()
})

export const inviteFirstAccessSchema = Joi.object({
  cpf: Joi.string().trim().optional(),
  email: Joi.string().email().optional()
}).or("cpf", "email")

export const confirmInvitationSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().min(16).max(200).required(),
  cpf: Joi.string()
    .trim()
    .custom((value, helpers) => {
      const digits = onlyDigits(value)
      if (!cpfValidator.isValid(digits)) return helpers.error("any.invalid")
      return digits
    })
    .messages({ "any.invalid": "CPF inválido" })
    .required(),
  newPassword: Joi.string().min(8).max(100).required()
})
