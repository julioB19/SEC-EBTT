import { UserRepository } from "./repository/userRepository"
import { UserService } from "./service/userService"
import { UserController } from "./controller/userController"
import { PasswordResetService } from "./service/passwordResetService"
import { PasswordResetController } from "./controller/passwordResetController"




export const userRepository = new UserRepository()
export const userService = new UserService(userRepository)
export const userController = new UserController(userService)
const passwordResetService = new PasswordResetService()
export const passwordResetController = new PasswordResetController(passwordResetService)



