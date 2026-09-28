import Joi from "joi"

export const saveSpecialCommissionSchema = Joi.object({
  ordinance: Joi.string().trim().allow(null, "").max(120).optional(),
  ordinanceDate: Joi.date().iso().allow(null, "").optional()
})

export const addSpecialCommissionMemberSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(180).required(),
  role: Joi.string().valid("PRESIDENT", "MEMBER", "PRIMARY", "SUBSTITUTE").default("MEMBER")
})

export const updateSpecialCommissionStatusSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "COMPLETED", "CANCELED").required()
})

export const respondSpecialCommissionInvitationSchema = Joi.object({
  response: Joi.string().valid("ACCEPTED", "DECLINED").required()
})

export const finalizeSpecialCommissionDecisionSchema = Joi.object({
  decision: Joi.string().valid("APPROVED", "REJECTED").required(),
  opinionText: Joi.string().trim().min(1).max(20000).required()
})
