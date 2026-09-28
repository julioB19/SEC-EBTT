import { RoleName } from "@prisma/client";
import { Router } from "express";
import { ProcessConfigurationController } from "../controller/processConfigurationController";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireSelectedRole } from "../middleware/cppdAccessMiddleware";
import {
  ParamType,
  validatorMiddleware,
} from "../middleware/validatorMiddleware";
import {
  createProcessTypeSchema,
  createProcessTypeVersionSchema,
  processTypeIdParamSchema,
  updateProcessTypeStatusSchema,
} from "../validator/processConfigurationValidator";

export function processConfigurationRoute() {
  const router = Router();
  const controller = new ProcessConfigurationController();
  const adminAccess = requireSelectedRole(RoleName.ADMIN);

  router.get(
    "/management/process-types",
    authMiddleware,
    adminAccess,
    controller.listProcessTypes,
  );
  router.post(
    "/management/process-types",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.BODY, createProcessTypeSchema),
    controller.createProcessType,
  );
  router.post(
    "/management/process-types/:processTypeId/versions",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, processTypeIdParamSchema),
    validatorMiddleware(ParamType.BODY, createProcessTypeVersionSchema),
    controller.createVersion,
  );
  router.patch(
    "/management/process-types/:processTypeId/status",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, processTypeIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateProcessTypeStatusSchema),
    controller.updateStatus,
  );

  return router;
}
