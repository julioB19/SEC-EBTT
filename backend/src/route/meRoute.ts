import { Router } from "express"
import { MeController } from "../controller/meController"
import { UserService } from "../service/userService"
import { UserRepository } from "../repository/userRepository"

export function meRoute() {
  const router = Router()

  const userService = new UserService(new UserRepository())
  const controller = new MeController(userService)

  router.get("/me", controller.get)

  return router
}
