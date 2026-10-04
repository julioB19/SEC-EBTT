import Joi from "joi"

const scoreSchema = Joi.object({
  itemId: Joi.number().integer().positive().required(),
  recognizedQuantity: Joi.number().integer().min(0).max(99999999).required(),
  evaluatorComment: Joi.string().trim().allow(null, "").max(500).optional()
})

export const saveIndividualEvaluationSchema = Joi.object({
  result: Joi.string().valid("APPROVED", "REJECTED", "DEFERRED", "DENIED").allow(null).optional(),
  opinionText: Joi.string().trim().allow(null, "").max(20000).optional(),
  scores: Joi.array().items(scoreSchema).unique("itemId").max(1000).default([])
})
