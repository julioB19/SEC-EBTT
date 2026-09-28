import Joi from "joi"
import {
  AdminListScoringTablesQueryDto,
  CreateScoringItemDto,
  CreateScoringNodeDto,
  CreateScoringTableDto,
  SaveScoringBlockDto,
  UpdateScoringItemDto,
  UpdateScoringNodeDto,
  UpdateScoringNodeParentDto,
  UpdateScoringTableDto
} from "../type/dto/scoringTableDto"

export const createScoringTableSchema = Joi.object<CreateScoringTableDto>({
  name: Joi.string().max(120).required(),
  purpose: Joi.string()
    .valid("PROGRESSION_PROMOTION", "RSC", "FULL_PROFESSOR_EVALUATION", "OTHER")
    .default("PROGRESSION_PROMOTION"),
  minRequiredPoints: Joi.alternatives()
    .try(Joi.number().min(0), Joi.string().pattern(/^\d+([.,]\d{1,2})?$/))
    .allow(null, ""),
  startsOn: Joi.string().isoDate().allow(null, ""),
  endsOn: Joi.string().isoDate().allow(null, "")
})

export const updateScoringTableSchema = Joi.object<UpdateScoringTableDto>({
  name: Joi.string().max(120),
  startsOn: Joi.string().isoDate().allow(null, ""),
  endsOn: Joi.string().isoDate().allow(null, ""),
  purpose: Joi.string().valid(
    "PROGRESSION_PROMOTION",
    "RSC",
    "FULL_PROFESSOR_EVALUATION",
    "OTHER"
  ),
  minRequiredPoints: Joi.alternatives()
    .try(Joi.number().min(0), Joi.string().pattern(/^\d+([.,]\d{1,2})?$/))
    .allow(null, ""),
  status: Joi.string().valid("DRAFT", "ACTIVE", "INACTIVE")
}).min(1)

export const adminListScoringTablesQuerySchema = Joi.object<AdminListScoringTablesQueryDto>({
  q: Joi.string().max(120).allow(null, ""),
  status: Joi.string().valid("DRAFT", "ACTIVE", "INACTIVE").allow(null, ""),
  startsOnFrom: Joi.string().isoDate().allow(null, ""),
  startsOnTo: Joi.string().isoDate().allow(null, ""),
  endsOnFrom: Joi.string().isoDate().allow(null, ""),
  endsOnTo: Joi.string().isoDate().allow(null, "")
})

export const createScoringNodeSchema = Joi.object<CreateScoringNodeDto>({
  name: Joi.string().max(150).required(),
  code: Joi.string().max(50).allow(null, ""),
  sortOrder: Joi.number().integer().min(0).default(0),
  parentId: Joi.number().integer().min(1).allow(null),
  hasFormula: Joi.boolean().default(false),
  formulaExpression: Joi.string()
    .max(255)
    .allow(null, "")
    .when("hasFormula", { is: true, then: Joi.required() })
})

export const updateScoringNodeParentSchema =
  Joi.object<UpdateScoringNodeParentDto>({
    parentId: Joi.number().integer().min(1).allow(null)
  })

export const createScoringItemSchema = Joi.object<CreateScoringItemDto>({
  description: Joi.string().max(255).required(),
  unit: Joi.string().max(30).allow(null, ""),
  points: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  hasMaxPoints: Joi.boolean().default(false),
  maxPoints: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .allow(null, "")
    .when("hasMaxPoints", { is: true, then: Joi.required() }),
  formulaKey: Joi.string()
    .max(30)
    .pattern(/^[A-Z][A-Z0-9_]*$/)
    .allow(null, "")
})

const saveBlockItemSchema = Joi.object({
  description: Joi.string().max(255).required(),
  unit: Joi.string().max(30).allow(null, ""),
  points: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  hasMaxPoints: Joi.boolean().default(false),
  maxPoints: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .allow(null, "")
    .when("hasMaxPoints", { is: true, then: Joi.required() }),
  formulaKey: Joi.string()
    .max(30)
    .pattern(/^[A-Z][A-Z0-9_]*$/)
    .allow(null, "")
})

const saveBlockNodeSchema = Joi.object({
  draftId: Joi.string().min(1).required(),
  name: Joi.string().max(150).required(),
  code: Joi.string().max(50).required(),
  parentDraftId: Joi.string().allow(null, ""),
  sortOrder: Joi.number().integer().min(0).default(0),
  hasFormula: Joi.boolean().default(false),
  formulaExpression: Joi.string()
    .max(255)
    .allow(null, "")
    .when("hasFormula", { is: true, then: Joi.required() }),
  items: Joi.array().items(saveBlockItemSchema).default([])
})

export const saveScoringBlockSchema = Joi.object<SaveScoringBlockDto>({
  blockName: Joi.string().max(150).required(),
  nodes: Joi.array().items(saveBlockNodeSchema).min(1).required()
})

export const updateScoringNodeSchema = Joi.object<UpdateScoringNodeDto>({
  name: Joi.string().max(150),
  code: Joi.string().max(50).allow(null, ""),
  sortOrder: Joi.number().integer().min(0),
  parentId: Joi.number().integer().min(1).allow(null),
  hasFormula: Joi.boolean(),
  formulaExpression: Joi.string().max(255).allow(null, "")
}).min(1)

export const updateScoringItemSchema = Joi.object<UpdateScoringItemDto>({
  description: Joi.string().max(255),
  unit: Joi.string().max(30).allow(null, ""),
  points: Joi.alternatives().try(Joi.number(), Joi.string()),
  hasMaxPoints: Joi.boolean(),
  maxPoints: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ""),
  formulaKey: Joi.string()
    .max(30)
    .pattern(/^[A-Z][A-Z0-9_]*$/)
    .allow(null, "")
}).min(1)
