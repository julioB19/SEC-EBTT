import Joi from "joi";

export const updateItemScoreSchema = Joi.object({
  scores: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.number().integer().positive().required(),
        evaluatorAwardedPoints: Joi.alternatives()
          .try(
            Joi.string()
              .allow("")
              .pattern(/^\d+([.,]\d+)?$/),
            Joi.valid(null),
          )
          .required(),
        evaluatorComment: Joi.string().allow(null, "").max(500).optional(),
      }),
    )
    .required(),
});

export const finalizeEvaluationSchema = Joi.object({
  decision: Joi.string().valid("APPROVED", "REJECTED").required(),
  evaluatorUserIds: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
  overrideOpinion: Joi.string().allow(null, "").optional(),
});

export const setEvaluatorsSchema = Joi.object({
  evaluatorUserIds: Joi.array()
    .items(Joi.number().integer().positive())
    .required(),
});

export const generateParecerSchema = Joi.object({
  evaluatorUserIds: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
  overrideOpinion: Joi.string().allow(null, "").optional(),
});
