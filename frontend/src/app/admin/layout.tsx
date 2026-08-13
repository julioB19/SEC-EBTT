import type { ReactNode } from "react"
import { ProfileMenu } from "@/components/ProfileMenu"
import { AdminNavLinks } from "@/components/AdminNavLinks"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--app-bg)]">
      <nav className="w-full bg-[var(--navbar-bg)] text-[var(--navbar-text)]">
        <div className="flex w-full items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wide">
              SEC-EBTT
            </span>
            <span className="text-[11px] text-[var(--navbar-text-muted)]">
              Área Administrativa
            </span>
          </div>

          <div className="flex items-center gap-3">
            <AdminNavLinks />
            <ProfileMenu />
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full">
        <div className="w-full px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
