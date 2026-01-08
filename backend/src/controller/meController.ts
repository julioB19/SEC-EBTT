import type { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { UserService } from "../service/userService"
import { HttpResponse } from "../util/httpResponse"

export class MeController {
  constructor(private readonly userService: UserService) {}

  get = async (req: Request, res: Response) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        return HttpResponse.unauthorized(res)
      }

      const user = await this.userService.getUserById(userId)
      return HttpResponse.ok(res, "OK", user)
    } catch {
      return HttpResponse.unauthorized(res)
    }
  }
}
