import Joi from "joi"
import { CommissionMembershipType, CppdMemberFunction } from "@prisma/client"

const nullableDate = Joi.date().iso().allow(null)

export const idParamSchema = Joi.object({
  campusId: Joi.number().integer().positive(),
  commissionId: Joi.number().integer().positive(),
  personId: Joi.number().integer().positive()
}).min(1)

export const listCommissionsQuerySchema = Joi.object({
  campusId: Joi.number().integer().positive().optional()
})

export const createCampusSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  acronym: Joi.string().trim().min(1).max(20).required(),
  cppdEmail: Joi.string().trim().email().max(180).allow(null, "").optional(),
  active: Joi.boolean().optional()
})

export const updateCampusSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  acronym: Joi.string().trim().min(1).max(20),
  cppdEmail: Joi.string().trim().email().max(180).allow(null, ""),
  active: Joi.boolean()
}).min(1)

export const createCppdCommissionSchema = Joi.object({
  campusId: Joi.number().integer().positive().required(),
  ordinance: Joi.string().trim().max(120).allow(null, "").optional(),
  mandateStart: nullableDate.optional(),
  mandateEnd: nullableDate.optional(),
  validityStart: nullableDate.optional(),
  validityEnd: nullableDate.optional()
})

export const updateCppdCommissionSchema = Joi.object({
  campusId: Joi.number().integer().positive(),
  ordinance: Joi.string().trim().max(120).allow(null, ""),
  mandateStart: nullableDate,
  mandateEnd: nullableDate,
  validityStart: nullableDate,
  validityEnd: nullableDate
}).min(1)

export const addCppdCommissionMemberSchema = Joi.object({
  personId: Joi.number().integer().positive().required(),
  function: Joi.string()
    .valid(...Object.values(CppdMemberFunction))
    .optional(),
  membershipType: Joi.string()
    .valid(...Object.values(CommissionMembershipType))
    .optional(),
  active: Joi.boolean().optional()
})

export const updateCppdCommissionMemberSchema = Joi.object({
  function: Joi.string().valid(...Object.values(CppdMemberFunction)),
  membershipType: Joi.string().valid(...Object.values(CommissionMembershipType)),
  active: Joi.boolean()
}).min(1)
