import jwt from "jsonwebtoken"
import { RoleName } from "@prisma/client"

export function decodeRefreshToken(token: string): { userId: number; selectedRole: RoleName | null } {
  const payload = jwt.verify(token, String(process.env.JWT_REFRESH_SECRET)) as any

  const userId = payload?.userId
  if (typeof userId !== "number") {
    throw new Error("Invalid refresh payload: userId")
  }

  const sr = payload?.selectedRole ?? null
  const selectedRole: RoleName | null =
    sr === null ? null :
    sr === "DOCENTE" || sr === "CPPD_MEMBER" || sr === "ADMIN" ? (sr as RoleName) : null

  return { userId, selectedRole }
}
