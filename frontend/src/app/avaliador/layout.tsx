import BackButton from "@/components/ui/BackButton"
import type { ReactNode } from "react"
import Link from "next/link"
import { ProfileMenu } from "@/components/ProfileMenu"
import DocenteLayout from "@/app/docente/layout"
import { getAccessTokenFromCookies } from "@/lib/auth"

export default async function ExternalEvaluatorLayout({ children }: { children: ReactNode }) {
  const accessToken = await getAccessTokenFromCookies()
  let isDocente = false

  try {
    const payload = JSON.parse(Buffer.from(accessToken?.split(".")[1] ?? "", "base64url").toString("utf8"))
    // O middleware e a API validam o acesso; aqui o perfil só determina a navegação.
    isDocente = payload.selectedRole === "DOCENTE" && Array.isArray(payload.roles) && payload.roles.includes("DOCENTE")
  } catch {
    isDocente = false
  }

  if (isDocente) return <DocenteLayout>{children}</DocenteLayout>

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)]">
      <nav className="w-full bg-[var(--navbar-bg)] text-[var(--navbar-text)]">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wide">SEC-EBTT</span>
            <span className="text-[11px] text-[var(--navbar-text-muted)]">Módulo de Avaliações</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/avaliador" className="text-sm hover:underline">
              Avaliações
            </Link>
            <ProfileMenu />
          </div>
        </div>
      </nav>

      <main className="flex-1 px-4 py-6 sm:px-6"><BackButton />{children}</main>
    </div>
  )
}
