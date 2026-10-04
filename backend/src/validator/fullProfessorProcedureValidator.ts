import Joi from "joi"

export const fullProfessorProcedureActionSchema = Joi.object({
  action: Joi.string().valid(
    "REQUEST_REASSESSMENT",
    "SCHEDULE_ORAL_DEFENSE",
    "RECORD_ORAL_DEFENSE",
    "SUBMIT_APPEAL",
    "DECIDE_APPEAL",
    "CLOSE_EXPIRED_PERIOD"
  ).required(),
  reason: Joi.string().trim().max(20000).optional(),
  scheduledAt: Joi.date().iso().optional(),
  accessUrl: Joi.string().trim().uri().max(500).optional(),
  heldAt: Joi.date().iso().optional(),
  recordingUrl: Joi.string().trim().uri().max(500).optional(),
  notes: Joi.string().trim().max(20000).optional(),
  outcome: Joi.string().valid("APPROVED", "REJECTED").optional(),
  decisionText: Joi.string().trim().max(20000).optional()
})
