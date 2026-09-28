import { RoleName } from "@prisma/client"
import { Router } from "express"
import { CppdManagementController } from "../controller/cppdManagementController"
import { authMiddleware } from "../middleware/authMiddleware"
import { requireSelectedRole } from "../middleware/cppdAccessMiddleware"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import {
  addCppdCommissionMemberSchema,
  createCampusSchema,
  createCppdCommissionSchema,
  idParamSchema,
  listCommissionsQuerySchema,
  updateCampusSchema,
  updateCppdCommissionMemberSchema,
  updateCppdCommissionSchema
} from "../validator/cppdManagementValidator"

export function cppdManagementRoute() {
  const router = Router()
  const controller = new CppdManagementController()
  const managementAccess = requireSelectedRole(RoleName.ADMIN, RoleName.CPPD_CENTRAL)

  router.get("/management/campuses", authMiddleware, managementAccess, controller.listCampuses)
  router.post(
    "/management/campuses",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.BODY, createCampusSchema),
    controller.createCampus
  )
  router.patch(
    "/management/campuses/:campusId",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.PARAMS, idParamSchema),
    validatorMiddleware(ParamType.BODY, updateCampusSchema),
    controller.updateCampus
  )

  router.get(
    "/management/commissions",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.QUERY, listCommissionsQuerySchema),
    controller.listCommissions
  )
  router.post(
    "/management/commissions",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.BODY, createCppdCommissionSchema),
    controller.createCommission
  )
  router.patch(
    "/management/commissions/:commissionId",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.PARAMS, idParamSchema),
    validatorMiddleware(ParamType.BODY, updateCppdCommissionSchema),
    controller.updateCommission
  )

  router.get(
    "/management/candidates",
    authMiddleware,
    managementAccess,
    controller.listMemberCandidates
  )
  router.post(
    "/management/commissions/:commissionId/members",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.PARAMS, idParamSchema),
    validatorMiddleware(ParamType.BODY, addCppdCommissionMemberSchema),
    controller.addMember
  )
  router.patch(
    "/management/commissions/:commissionId/members/:personId",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.PARAMS, idParamSchema),
    validatorMiddleware(ParamType.BODY, updateCppdCommissionMemberSchema),
    controller.updateMember
  )
  router.delete(
    "/management/commissions/:commissionId/members/:personId",
    authMiddleware,
    managementAccess,
    validatorMiddleware(ParamType.PARAMS, idParamSchema),
    controller.removeMember
  )

  return router
}
