import express from "express"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { userController } from "../appContainer"
import { publicDocenteRegisterSchema } from "../validator/userValidator"

const router = express.Router()

export function publicRegistrationRoute() {
  router.post(
    "/register/docente",
    validatorMiddleware(ParamType.BODY, publicDocenteRegisterSchema),
    async (req, res) => await userController.registerDocente(req, res)
  )
  return router
}
