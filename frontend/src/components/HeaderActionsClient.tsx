"use client"

import { useMemo, useState, useCallback } from "react"
import RoleDropdown from "@/components/ui/RoleDropdown"
import ConfirmModal from "@/components/ui/ConfirmModal"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function pathForRole(role: Role | null | undefined) {
  if (role === "DOCENTE") return "/docente"
  if (role === "CPPD_MEMBER") return "/cppd"
  if (role === "ADMIN") return "/dashboard"
  return "/dashboard"
}

const ROLE_LABEL: Record<Role, string> = {
  DOCENTE: "Docente",
  CPPD_MEMBER: "CPPD",
  ADMIN: "Admin"
}

export default function HeaderActionsClient(props: { roles: Role[]; selectedRole: Role | null }) {
  const { roles, selectedRole } = props

  const [value, setValue] = useState<Role | "">((selectedRole ?? "") as any)

  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [loggingOut, setLoggingOut] = useState(false)

  const options = useMemo(() => {
    const filtered = roles.filter(
      (r): r is Exclude<Role, "ADMIN"> => r === "DOCENTE" || r === "CPPD_MEMBER"
    )
    const unique = Array.from(new Set(filtered)) as Role[]
    return unique.map(r => ({ value: r, label: ROLE_LABEL[r] }))
  }, [roles])

  const onDropdownChange = useCallback(
    (val: string) => {
      const next = val as Role
      if (next === selectedRole) {
        setValue(next)
        return
      }
      setValue(next)
      setPendingRole(next)
      setErr(null)
      setModalOpen(true)
    },
    [selectedRole]
  )

  const confirmSwitch = useCallback(async () => {
    if (!pendingRole) return
    setSwitching(true)
    setErr(null)
    try {
      const r = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: pendingRole }),
        cache: "no-store"
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErr(j?.message ?? "Não foi possível alternar o papel agora.")
        setValue((selectedRole ?? "") as any)
        return
      }
      window.location.href = pathForRole(pendingRole)
    } catch {
      setErr("Falha de conexão ao alternar papel.")
      setValue((selectedRole ?? "") as any)
    } finally {
      setSwitching(false)
      setModalOpen(false)
      setPendingRole(null)
    }
  }, [pendingRole, selectedRole])

  const cancelSwitch = useCallback(() => {
    setValue((selectedRole ?? "") as any)
    setPendingRole(null)
    setModalOpen(false)
  }, [selectedRole])

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      })
      sessionStorage.clear()
      window.location.href = "/login"
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {options.length >= 2 && (
          <div className="inline-flex flex-col">
            <div className="inline-flex items-center gap-2">
              <label
                htmlFor="role-switcher"
                className="text-sm text-[var(--navbar-text-muted)]"
              >
                Módulo:
              </label>
              <RoleDropdown
                id="role-switcher"
                value={(value as string) || null}
                options={options}
                disabled={switching}
                onChange={onDropdownChange}
              />
            </div>
            {err && <span className="mt-1 text-xs text-red-400">{err}</span>}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="
            px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide
            bg-[var(--btn-primary-bg)]
            text-[var(--btn-primary-text)]
            hover:bg-[var(--btn-primary-hover-bg)]
            disabled:opacity-60
          "
          title="Sair"
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>

      <ConfirmModal
        open={modalOpen}
        title="Confirmar troca de módulo"
        description={
          pendingRole
            ? `Você deseja alternar para o módulo ${ROLE_LABEL[pendingRole]}?`
            : ""
        }
        confirmText="Trocar"
        cancelText="Cancelar"
        loading={switching}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </>
  )
}
