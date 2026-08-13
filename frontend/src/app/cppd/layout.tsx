import type { ReactNode } from "react"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { ProfileMenu } from "@/components/ProfileMenu"
import { CppdNavLinks } from "@/components/CppdNavLinks"

async function resolveBaseUrl() {
  const h = await headers()

  const host = h.get("x-forwarded-host") || h.get("host")
  const proto = h.get("x-forwarded-proto") || "http"

  if (!host) return null

  return `${proto}://${host}`
}

async function ensureCppdRole() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value

  if (!access) {
    redirect("/login")
  }

  const baseUrl = await resolveBaseUrl()
  if (!baseUrl) {
    redirect("/login")
  }

  const res = await fetch(`${baseUrl}/api/auth/select-role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jar.toString()
    },
    body: JSON.stringify({ role: "CPPD_MEMBER" }),
    cache: "no-store"
  })

  if (!res.ok) {
    redirect("/login")
  }
}

export default async function CppdLayout({ children }: { children: ReactNode }) {
  await ensureCppdRole()

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
            <CppdNavLinks />
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
          {children}
        </div>
      </main>
    </div>
  )
}
