import express from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { authMiddleware } from "../middleware/authMiddleware"
import { userController } from "../appContainer"
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  updateMyProfileSchema,
  updateDocenteByCppdSchema,
  setUserRolesSchema
} from "../validator/userValidator"

const router = express.Router()

export function userRoute() {
  router.post(
    "/users",
    validatorMiddleware(ParamType.BODY, createUserSchema),
    async (req, res) => await userController.createUser(req, res)
  )

  router.get(
    "/users/active",
    authMiddleware,
    async (req, res) => await userController.getAllActiveUsers(req, res)
  )

  router.get(
    "/users/me",
    authMiddleware,
    async (req, res) => await userController.getMyProfile(req, res)
  )

  router.put(
    "/users/me",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, updateMyProfileSchema),
    async (req, res) => await userController.updateMyProfile(req, res)
  )

  router.get(
    "/users/:userId",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.getUserById(req, res)
  )

  router.put(
    "/users/:userId",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateUser(req, res)
  )

  router.delete(
    "/users/:userId",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteUser(req, res)
  )

  router.get(
    "/docentes",
    authMiddleware,
    async (req, res) => await userController.listDocentes(req, res)
  )

  router.put(
    "/docentes/:userId/cppd",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateDocenteByCppdSchema),
    async (req, res) => await userController.updateDocenteByCppd(req, res)
  )

  router.put(
    "/docentes/:userId/admin",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateDocenteByAdmin(req, res)
  )

  router.delete(
    "/docentes/:userId",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteDocenteByAdmin(req, res)
  )

  router.patch(
    "/users/:userId/roles",
    authMiddleware,
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, setUserRolesSchema),
    async (req, res) => await userController.setUserRolesByAdmin(req, res)
  )

  return router
}
