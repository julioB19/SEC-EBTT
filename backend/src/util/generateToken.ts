import jwt, { type SignOptions } from "jsonwebtoken"
import { RoleName } from "@prisma/client"

const accessExpiresIn = process.env.JWT_ACCESS_EXPIRATION as SignOptions["expiresIn"]
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRATION as SignOptions["expiresIn"]

export function generateAccessToken(
  roles: RoleName[],
  userId: number,
  selectedRole: RoleName | null
) {
  const payload = { sub: userId, roles, selectedRole }

  return jwt.sign(payload, String(process.env.JWT_ACCESS_SECRET), {
    expiresIn: accessExpiresIn
  })
}

export function generateRefreshToken(
  userId: number,
  selectedRole: RoleName | null
) {
  const payload = { userId, selectedRole }

  return jwt.sign(payload, String(process.env.JWT_REFRESH_SECRET), {
    expiresIn: refreshExpiresIn
  })
}
