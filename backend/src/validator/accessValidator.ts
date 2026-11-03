import Joi from "joi"
import { ClassLevel } from "@prisma/client"
import { cpf } from "cpf-cnpj-validator"

export const completionSchema = Joi.object({
  cpf: Joi.string().custom((value, helpers) => {
    const digits = value.replace(/\D/g, "")
    return cpf.isValid(digits) ? digits : helpers.error("any.invalid")
  }).required().messages({ "any.invalid": "CPF inválido" }),
  name: Joi.string().trim().max(120).required(),
  password: Joi.string().min(8).max(100).optional(),
  siape: Joi.string().trim().max(30),
  evaluationCity: Joi.string().trim().max(120),
  qualification: Joi.string().trim().max(120),
  institution: Joi.string().trim().max(180),
  workUnit: Joi.string().trim().max(180),
  docenteProfile: Joi.object({
    siape: Joi.string().trim().max(30).required(),
    classLevel: Joi.string().valid(...Object.values(ClassLevel)).required(),
    startInterstice: Joi.date().iso().required(),
    educationLevel: Joi.string().trim().max(120).required()
  })
}).unknown(false)

export type AccessCompletion = {
  cpf: string; name: string; password?: string; siape?: string; evaluationCity?: string
  qualification?: string; institution?: string; workUnit?: string
  docenteProfile?: { siape: string; classLevel: ClassLevel; startInterstice: Date; educationLevel: string }
}
