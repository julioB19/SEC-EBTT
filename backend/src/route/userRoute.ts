import express from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { userController } from "../appContainer"
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  updateMyDocenteProfileSchema,
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
    async (req, res) => await userController.getAllActiveUsers(req, res)
  )

  router.get(
    "/users/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.getUserById(req, res)
  )

  router.put(
    "/users/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateUser(req, res)
  )

  router.delete(
    "/users/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteUser(req, res)
  )


  router.put(
    "/users/me/docente",
    validatorMiddleware(ParamType.BODY, updateMyDocenteProfileSchema),
    async (req, res) => await userController.updateMyDocenteProfile(req, res)
  )

  router.get(
    "/docentes",
    async (req, res) => await userController.listDocentes(req, res)
  )

  router.put(
    "/docentes/:userId/cppd",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateDocenteByCppdSchema),
    async (req, res) => await userController.updateDocenteByCppd(req, res)
  )

  router.put(
    "/docentes/:userId/admin",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, updateUserSchema),
    async (req, res) => await userController.updateDocenteByAdmin(req, res)
  )

  router.delete(
    "/docentes/:userId",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    async (req, res) => await userController.deleteDocenteByAdmin(req, res)
  )

  router.patch(
    "/users/:userId/roles",
    validatorMiddleware(ParamType.PARAMS, userIdParamSchema),
    validatorMiddleware(ParamType.BODY, setUserRolesSchema),
    async (req, res) => await userController.setUserRolesByAdmin(req, res)
  )

  return router
}
