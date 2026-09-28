"use client"

import { useMemo, useState } from "react"
import RoleDropdown from "@/components/ui/RoleDropdown"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

type Props = {
  roles: Role[]
  selectedRole: Role | null
}

const ROLE_LABEL: Record<Role, string> = {
  DOCENTE: "Docente",
  CPPD_MEMBER: "Membro da CPPD",
  CPPD_CENTRAL: "CPPD Central",
  ADMIN: "Administrador",
  EXTERNAL_EVALUATOR: "Avaliador externo"
}

export default function RoleSwitcherClient({ roles, selectedRole }: Props) {
  const [value, setValue] = useState<Role | null>(selectedRole)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(
    () =>
      roles
        .filter(
          r =>
            r === "DOCENTE" ||
            r === "CPPD_MEMBER" ||
            r === "CPPD_CENTRAL" ||
            r === "ADMIN" ||
            r === "EXTERNAL_EVALUATOR"
        )
        .map(r => ({ value: r, label: ROLE_LABEL[r] })),
    [roles]
  )

  async function switchTo(role: Role | null) {
    if (!role) return

    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ role })
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Não foi possível trocar de módulo.")
      }

      const data = await res.json().catch(() => null)
      const nextRole = (data?.selectedRole as Role | null) ?? role

      if (nextRole === "DOCENTE") {
        window.location.href = "/docente"
      } else if (nextRole === "CPPD_MEMBER" || nextRole === "CPPD_CENTRAL") {
        window.location.href = "/cppd"
      } else if (nextRole === "EXTERNAL_EVALUATOR") {
        window.location.href = "/avaliador"
      } else {
        window.location.href = "/admin"
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao trocar de módulo.")
    } finally {
      setLoading(false)
    }
  }

  if (options.length < 2) return null

  return (
    <div className="flex flex-col gap-1 text-xs text-[var(--navbar-text)]">
      <RoleDropdown
        value={value}
        options={options}
        disabled={loading}
        placeholder="Selecionar módulo"
        onChange={val => {
          const r = val as Role
          setValue(r)
          switchTo(r)
        }}
      />
      {error && <span className="mt-1 text-[11px] text-[var(--danger-text)]">{error}</span>}
    </div>
  )
}
