import Joi from "joi"

export const saveGeccSchema = Joi.object({
  externalNumber: Joi.string().trim().allow(null, "").max(120).optional()
})

export const addGeccInterestedSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().lowercase().email().max(180).required(),
  type: Joi.string()
    .valid("INTERNAL_EVALUATOR", "EXTERNAL_EVALUATOR", "CPPD_UNIT", "OTHER")
    .required()
})

export const updateGeccStatusSchema = Joi.object({
  status: Joi.string().valid("READY_TO_SEND", "SENT_TO_CGP", "COMPLETED").required()
})
