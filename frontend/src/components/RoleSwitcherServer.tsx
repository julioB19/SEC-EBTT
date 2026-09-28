import { cookies } from "next/headers"
import RoleSwitcherClient from "./RoleSwitcherClient"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

function decodeJwtPayloadServer(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const json = Buffer.from(parts[1], "base64url").toString("utf8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default async function RoleSwitcherServer() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) return null

  const payload = decodeJwtPayloadServer(access)

  const roles: Role[] = Array.isArray(payload?.roles)
    ? payload.roles.filter(
        (r: any) =>
          r === "DOCENTE" ||
          r === "CPPD_MEMBER" ||
          r === "CPPD_CENTRAL" ||
          r === "ADMIN" ||
          r === "EXTERNAL_EVALUATOR"
      )
    : []

  const selectedRole: Role | null =
    payload?.selectedRole === "DOCENTE" ||
    payload?.selectedRole === "CPPD_MEMBER" ||
    payload?.selectedRole === "CPPD_CENTRAL" ||
    payload?.selectedRole === "ADMIN" ||
    payload?.selectedRole === "EXTERNAL_EVALUATOR"
      ? payload.selectedRole
      : null

  if (roles.length < 2) return null

  return (
    <div className="mt-1 px-4 pt-2 border-t border-[var(--gray-800)] text-xs">
      <p className="mb-2 font-semibold uppercase tracking-wide text-[var(--navbar-text-muted)]">Alternar módulo</p>

      <RoleSwitcherClient roles={roles} selectedRole={selectedRole} />
    </div>
  )
}
