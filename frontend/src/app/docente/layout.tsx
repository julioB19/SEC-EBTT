import type { ReactNode } from "react"
import { ProfileMenu } from "@/components/ProfileMenu"
import { DocenteNavLinks } from "@/components/DocenteNavLinks"

export default function DocenteLayout({ children }: { children: ReactNode }) {
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
              Módulo Docente
            </span>
          </div>

          {/* Menu + perfil */}
          <div className="flex items-center gap-3">
            <DocenteNavLinks />
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
