"use client"

import { useState } from "react"
import Link from "next/link"
import { logoutAction } from "@/utils/logoutAction"

const desktopLinkClass =
  "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide " +
  "text-[var(--navbar-text)] hover:bg-[var(--navbar-item-hover-bg)] transition-[background]"

export function DocenteNavLinks() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex items-center">
      <div className="hidden md:flex items-center gap-2">
        <Link href="/docente" className={desktopLinkClass}>
          Início
        </Link>

        <Link href="/docente/processos" className={desktopLinkClass}>
          Consultar processos
        </Link>

        <Link href="/avaliador" className={desktopLinkClass}>Minhas avaliações</Link>

        <Link
          href="/docente/processos/abrir"
          className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide
                     bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                     hover:bg-[var(--btn-primary-hover-bg)] transition-[background]"
        >
          Abrir processo
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="md:hidden flex h-9 w-9 flex-col items-center justify-center gap-[3px]
                   rounded-md bg-[var(--navbar-chip-bg)] text-[var(--navbar-text)]
                   hover:bg-[var(--navbar-chip-hover-bg)] transition"
        aria-label="Abrir menu"
      >
        <span className="block h-[2px] w-5 rounded bg-[var(--navbar-text)]" />
        <span className="block h-[2px] w-5 rounded bg-[var(--navbar-text)]" />
        <span className="block h-[2px] w-5 rounded bg-[var(--navbar-text)]" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-60 rounded-xl
                     bg-[var(--surface-contrast-bg)] text-[var(--navbar-text)]
                     shadow-xl border border-[var(--border-subtle)] md:hidden overflow-hidden"
        >
          <Link
            href="/docente"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Início
          </Link>

          <Link
            href="/docente/processos"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Consultar processos
          </Link>

          <Link href="/avaliador" className="block px-4 py-2.5 text-sm" onClick={() => setOpen(false)}>Minhas avaliações</Link>

          <Link
            href="/docente/processos/abrir"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Abrir processo
          </Link>

          <div className="my-1 h-px bg-[var(--border-subtle)]" />

          <Link
            href="/perfil"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Meu perfil
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logoutAction()
            }}
            className="w-full text-left px-4 py-2.5 text-sm
                       text-[var(--state-danger-text)]
                       hover:bg-[var(--navbar-item-hover-bg)]"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
