import express from "express";
import { RoleName } from "@prisma/client";
import {
  ParamType,
  validatorMiddleware,
} from "../middleware/validatorMiddleware";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  requireCppdAccess,
  requireCppdTeacherAccess,
  requireSelectedRole,
} from "../middleware/cppdAccessMiddleware";
import { userController } from "../appContainer";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  updateMyProfileSchema,
  updateDocenteByCppdSchema,
  setUserRolesSchema,
} from "../validator/userValidator";

const router = express.Router();
const adminAccess = requireSelectedRole(RoleName.ADMIN);

export function userRoute() {
  router.post(
    "/users",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.BODY, createUserSchema),
    async (req, res) => await userController.createUser(req, res),
  );

  router.get(
    "/users/active",
    authMiddleware,
    adminAccess,
    async (req, res) => await userController.getAllActiveUsers(req, res),
  );

  router.get(
    "/users/me",
    authMiddleware,
    async (req, res) => await userController.getMyProfile(req, res),
  );

  router.put(
    "/users/me",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, updateMyProfileSchema),
    async (req, res) => await userController.updateMyProfile(req, res),
  );

  router.get(
    "/users/:userId",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.getUserById(req, res),
  );

  router.put(
    "/users/:userId",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateUser(req, res),
  );

  router.delete(
    "/users/:userId",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteUser(req, res),
  );

  router.get(
    "/docentes",
    authMiddleware,
    requireCppdAccess,
    async (req, res) => await userController.listDocentes(req, res),
  );

  router.put(
    "/docentes/:userId/cppd",
    authMiddleware,
    requireCppdAccess,
    requireCppdTeacherAccess(),
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateDocenteByCppdSchema),
    async (req, res) => await userController.updateDocenteByCppd(req, res),
  );

  router.get(
    "/docentes/:userId/cppd",
    authMiddleware,
    requireCppdAccess,
    requireCppdTeacherAccess(),
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.getUserById(req, res),
  );

  router.put(
    "/docentes/:userId/admin",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateDocenteByAdmin(req, res),
  );

  router.delete(
    "/docentes/:userId",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteDocenteByAdmin(req, res),
  );

  router.patch(
    "/users/:userId/roles",
    authMiddleware,
    adminAccess,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, setUserRolesSchema),
    async (req, res) => await userController.setUserRolesByAdmin(req, res),
  );

  return router;
}
