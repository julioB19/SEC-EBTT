import express from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { loginSchema, refreshTokenSchema, selectRoleSchema, logoutSchema } from "../validator/userValidator"
import { userController, passwordResetController } from "../appContainer"
import { requestPasswordResetSchema, confirmPasswordResetSchema, inviteFirstAccessSchema } from "../validator/userValidator"

const router = express.Router()

export function authRoute() {
  router.post(
    "/login",
    validatorMiddleware(ParamType.BODY, loginSchema),
    async (req, res) => await userController.login(req, res)
  )

  router.post(
    "/refresh-token",
    validatorMiddleware(ParamType.BODY, refreshTokenSchema),
    async (req, res) => await userController.refreshToken(req, res)
  )

  router.post(
    "/logout",
    validatorMiddleware(ParamType.BODY, logoutSchema),
    async (req, res) => await userController.logout(req, res)
  )

  router.post(
    "/select-role",
    validatorMiddleware(ParamType.BODY, selectRoleSchema),
    async (req, res) => await userController.selectRole(req, res)
  )

  router.post(
    "/forgot-password",
    validatorMiddleware(ParamType.BODY, requestPasswordResetSchema),
    async (req, res) => await passwordResetController.request(req, res)
  )

  router.post(
    "/reset-password",
    validatorMiddleware(ParamType.BODY, confirmPasswordResetSchema),
    async (req, res) => await passwordResetController.confirm(req, res)
  )

  router.post(
  "/invite",
  validatorMiddleware(ParamType.BODY, inviteFirstAccessSchema),
  async (req, res) => await passwordResetController.invite(req, res)
 )

  return router
}
