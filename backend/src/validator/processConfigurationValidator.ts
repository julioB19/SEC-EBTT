import Joi from "joi";
import { ProcessTypeCategory } from "@prisma/client";

const code = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z][A-Z0-9_]*$/)
  .max(60);
const nullableDate = Joi.date().iso().allow(null);

const requirementSchema = Joi.object({
  code: code.required(),
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(500).allow(null, "").optional(),
  required: Joi.boolean().optional(),
  allowsMultiple: Joi.boolean().optional(),
  acceptedFormats: Joi.string().trim().max(120).allow(null, "").optional(),
  maxSizeMb: Joi.number().integer().min(1).max(100).allow(null).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  active: Joi.boolean().optional(),
});

const versionFields = {
  name: Joi.string().trim().min(2).max(120).required(),
  category: Joi.string()
    .valid(...Object.values(ProcessTypeCategory))
    .required(),
  requiresScoring: Joi.boolean().optional(),
  requiresCommittee: Joi.boolean().optional(),
  requiresGecc: Joi.boolean().optional(),
  defaultDestination: Joi.string().trim().max(120).allow(null, "").optional(),
  validFrom: Joi.date().iso().optional(),
  validUntil: nullableDate.optional(),
  active: Joi.boolean().optional(),
  requirements: Joi.array()
    .items(requirementSchema)
    .max(100)
    .unique("code")
    .optional(),
};

export const processTypeIdParamSchema = Joi.object({
  processTypeId: Joi.number().integer().positive().required(),
});

export const createProcessTypeSchema = Joi.object({
  code: code.required(),
  ...versionFields,
});

export const createProcessTypeVersionSchema = Joi.object(versionFields);

export const updateProcessTypeStatusSchema = Joi.object({
  active: Joi.boolean().required(),
});
