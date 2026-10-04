import { RoleName } from "@prisma/client"
import { Router } from "express"
import { FullProfessorProcedureController } from "../controller/fullProfessorProcedureController"
import {
  requireCppdAccess,
  requireCppdProcessAccess,
  requireSelectedRole
} from "../middleware/cppdAccessMiddleware"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { fullProfessorProcedureActionSchema } from "../validator/fullProfessorProcedureValidator"

export function fullProfessorProcedureRoute() {
  const router = Router()
  const controller = new FullProfessorProcedureController()

  router.get(
    "/processes/:id/full-professor-procedure",
    requireCppdAccess,
    requireCppdProcessAccess(),
    controller.get
  )
  router.post(
    "/processes/:id/full-professor-procedure/actions",
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, fullProfessorProcedureActionSchema),
    controller.execute
  )
  router.get(
    "/processos/:id/classe-titular/rito",
    requireSelectedRole(RoleName.DOCENTE),
    controller.get
  )
  router.post(
    "/processos/:id/classe-titular/rito/acoes",
    requireSelectedRole(RoleName.DOCENTE),
    validatorMiddleware(ParamType.BODY, fullProfessorProcedureActionSchema),
    controller.execute
  )

  return router
}
