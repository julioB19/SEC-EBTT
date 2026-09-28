"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

export default function SelectRolePage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("roles")
      const parsed = raw ? JSON.parse(raw) : []
      const valid = Array.isArray(parsed)
        ? parsed.filter((r: string) =>
            ["DOCENTE", "CPPD_MEMBER", "CPPD_CENTRAL", "ADMIN", "EXTERNAL_EVALUATOR"].includes(r)
          )
        : []

      if (!valid.length) {
        router.replace("/login")
        return
      }

      setRoles(valid as Role[])
    } catch {
      router.replace("/login")
    }
  }, [router])

  const label = useMemo(
    () =>
      ({
        DOCENTE: "Docente",
        CPPD_MEMBER: "Membro da CPPD",
        CPPD_CENTRAL: "CPPD Central",
        ADMIN: "Administrador",
        EXTERNAL_EVALUATOR: "Avaliador externo"
      }) as Record<Role, string>,
    []
  )

  async function select(role: Role) {
    setLoading(true)
    setError(null)

    const r = await fetch("/api/auth/select-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role })
    })

    const json = await r.json().catch(() => ({}) as any)
    setLoading(false)

    if (!r.ok) {
      setError(json?.message ?? "Não foi possível selecionar o papel")
      return
    }

    try {
      sessionStorage.setItem("selectedRole", role)
    } catch {}

    if (role === "DOCENTE") {
      router.replace("/docente")
    } else if (role === "CPPD_MEMBER" || role === "CPPD_CENTRAL") {
      router.replace("/cppd")
    } else if (role === "EXTERNAL_EVALUATOR") {
      router.replace("/avaliador")
    } else {
      router.replace("/admin")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)] p-4">
      <div
        className="
          w-full max-w-md
          bg-[var(--surface-card)]
          border border-[var(--border-subtle)]
          rounded-2xl shadow-sm
          p-6
        "
      >
        <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">Escolha o módulo</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-4">Selecione com qual papel você quer entrar agora.</p>

        {error && (
          <p className="text-sm mb-3 text-[var(--danger-text-strong)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid gap-3">
          {roles.map(r => (
            <button
              key={r}
              disabled={loading}
              onClick={() => select(r)}
              className="
                rounded-xl border border-[var(--border-subtle)]
                px-4 py-3 text-left
                bg-[var(--surface-card)]
                text-[var(--text-primary)]
                hover:bg-[var(--surface-muted)]
                disabled:opacity-50
                transition
              "
            >
              <div className="font-medium">{label[r]}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
