import { cookies } from "next/headers"
import { LogoutButton } from "@/components/LogoutButton"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function mapRoleToPath(role: Role | null | undefined) {
  if (role === "DOCENTE") return "/docente"
  if (role === "CPPD_MEMBER") return "/cppd"
  if (role === "ADMIN") return "/dashboard"
  return "/dashboard"
}

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

export default async function ForbiddenPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value ?? ""

  let backPath = "/dashboard"

  if (access) {
    const payload = decodeJwtPayloadServer(access)
    const selected: Role | null | undefined = payload?.selectedRole ?? null
    const roles: Role[] = Array.isArray(payload?.roles) ? payload.roles : []

    if (selected) {
      backPath = mapRoleToPath(selected)
    } else if (roles.length) {
      if (roles.includes("DOCENTE")) backPath = "/docente"
      else if (roles.includes("CPPD_MEMBER")) backPath = "/cppd"
      else if (roles.includes("ADMIN")) backPath = "/dashboard"
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 
                     bg-[var(--surface-muted)]">
      <div className="
        bg-[var(--surface-card)]
        border border-[var(--border-subtle)]
        rounded-2xl shadow-sm p-8 max-w-md w-full text-center
      ">
        <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">
          Acesso negado
        </h1>

        <p className="text-[var(--text-secondary)] mb-6">
          Você não tem permissão para acessar esta página.
        </p>

        <div className="flex gap-3 justify-center">
          <a
            href={backPath}
            className="
              px-4 py-2 rounded-xl text-sm
              border border-[var(--border-subtle)]
              text-[var(--text-primary)]
              hover:bg-[var(--surface-muted)]
            "
          >
            Voltar
          </a>

          <LogoutButton />
        </div>
      </div>
    </main>
  )
}
