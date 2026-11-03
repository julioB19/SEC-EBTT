import BackButton from "@/components/ui/BackButton"
import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ProfileMenu } from "@/components/ProfileMenu"
import { CppdNavLinks } from "@/components/CppdNavLinks"

async function ensureCppdRole() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value

  if (!access) {
    redirect("/login")
  }

  try {
    const payload = JSON.parse(Buffer.from(access.split(".")[1], "base64url").toString("utf8"))
    if (payload?.selectedRole === "CPPD_MEMBER" || payload?.selectedRole === "CPPD_CENTRAL") {
      return payload.selectedRole as "CPPD_MEMBER" | "CPPD_CENTRAL"
    }
  } catch {
    redirect("/login")
  }

  redirect("/forbidden")
}

export default async function CppdLayout({ children }: { children: ReactNode }) {
  const cppdRole = await ensureCppdRole()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--app-bg)]">
      {/* NAVBAR EM TODA A LARGURA */}
      <nav className="w-full bg-[var(--navbar-bg)] text-[var(--navbar-text)]">
        <div className="flex w-full items-center justify-between px-4 sm:px-6 py-3">
          {/* Branding do sistema */}
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wide">
              SEC-EBTT
            </span>
            <span className="text-[11px] text-[var(--navbar-text-muted)]">
              Módulo CPPD
            </span>
          </div>

          {/* Menu + perfil */}
          <div className="flex items-center gap-3">
            <CppdNavLinks canManageCommissions={cppdRole === "CPPD_CENTRAL"} />
            {/* ícone de perfil só no desktop */}
            <div className="hidden md:block">
              <ProfileMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* CONTEÚDO */}
      <main className="flex-1 w-full">
        <div className="w-full px-4 sm:px-6 py-6">
          <BackButton />
          {children}
        </div>
      </main>
    </div>
  )
}
