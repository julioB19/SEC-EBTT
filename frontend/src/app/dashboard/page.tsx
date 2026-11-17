// src/app/dashboard/page.tsx
// Rota de compatibilidade: várias telas usam /dashboard como destino padrão.
// Encaminha para a página inicial do perfil ativo, em vez de mostrar uma página vazia.
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

const homeByRole: Record<string, string> = {
  ADMIN: "/admin",
  CPPD_MEMBER: "/cppd",
  CPPD_CENTRAL: "/cppd",
  DOCENTE: "/docente",
  EXTERNAL_EVALUATOR: "/avaliador"
}

function decodeJwtPayload(token: string): { roles?: unknown; selectedRole?: unknown } | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) redirect("/login")

  const payload = decodeJwtPayload(access)
  const selected = typeof payload?.selectedRole === "string" ? homeByRole[payload.selectedRole] : undefined
  if (selected) redirect(selected)

  const roles = Array.isArray(payload?.roles) ? payload.roles.filter((role): role is string => typeof role === "string" && role in homeByRole) : []
  if (roles.length === 1) redirect(homeByRole[roles[0]])
  redirect("/select-role")
}
