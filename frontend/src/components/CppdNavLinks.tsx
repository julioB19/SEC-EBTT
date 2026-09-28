"use client"

import { useState } from "react"
import Link from "next/link"
import { logoutAction } from "@/utils/logoutAction"

const desktopLinkClass =
  "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide " +
  "text-[var(--navbar-text)] hover:bg-[var(--navbar-item-hover-bg)] transition-[background]"

export function CppdNavLinks({ canManageCommissions = false }: { canManageCommissions?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex items-center">
      {/* DESKTOP */}
      <div className="hidden md:flex items-center gap-2">
        <Link href="/cppd" className={desktopLinkClass}>
          Início
        </Link>

        <Link href="/cppd/processos" className={desktopLinkClass}>
          Processos
        </Link>

        <Link href="/cppd/tabelas" className={desktopLinkClass}>
          Tabela de Pontuação
        </Link>

        {/* 🔹 NOVO LINK */}
        <Link href="/cppd/usuarios" className={desktopLinkClass}>
          Docentes
        </Link>

        {canManageCommissions && (
          <Link href="/cppd/comissoes" className={desktopLinkClass}>
            Campi e comissões
          </Link>
        )}
      </div>

      {/* BOTÃO MOBILE */}
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

      {/* MENU MOBILE */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-60 rounded-xl
                     bg-[var(--surface-contrast-bg)] text-[var(--navbar-text)]
                     shadow-xl border border-[var(--border-subtle)] md:hidden overflow-hidden"
        >
          <Link
            href="/cppd"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Início
          </Link>

          <Link
            href="/cppd/processos"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Processos
          </Link>

          <Link
            href="/cppd/tabelas"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Tabelas de Pontuação
          </Link>

          {/* 🔹 NOVO LINK */}
          <Link
            href="/cppd/usuarios"
            className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
            onClick={() => setOpen(false)}
          >
            Docentes
          </Link>

          {canManageCommissions && (
            <Link
              href="/cppd/comissoes"
              className="block px-4 py-2.5 text-sm hover:bg-[var(--navbar-item-hover-bg)]"
              onClick={() => setOpen(false)}
            >
              Campi e comissões
            </Link>
          )}

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
