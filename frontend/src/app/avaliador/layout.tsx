import type { ReactNode } from "react"
import Link from "next/link"
import { ProfileMenu } from "@/components/ProfileMenu"

export default function ExternalEvaluatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)]">
      <nav className="w-full bg-[var(--navbar-bg)] text-[var(--navbar-text)]">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wide">SEC-EBTT</span>
            <span className="text-[11px] text-[var(--navbar-text-muted)]">Módulo Avaliador Externo</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/avaliador" className="text-sm hover:underline">
              Avaliações
            </Link>
            <ProfileMenu />
          </div>
        </div>
      </nav>

      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
