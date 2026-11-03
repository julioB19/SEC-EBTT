"use client"

import { clientFetch as fetch } from "@/lib/clientFetch"
import ActionButton from "@/components/ui/ActionButton"

import { useState } from "react"

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function onClick() {
    try {
      setLoading(true)
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      })
      sessionStorage.clear()
      window.location.href = "/login"
    } finally {
      setLoading(false)
    }
  }

  return (
    <ActionButton
      type="button"
      onClick={onClick}
      disabled={loading}
      className="
        px-3 py-1.5 rounded-full text-xs font-medium
        border border-[var(--border-subtle)]
        text-[var(--state-danger-text)]
        hover:bg-[var(--surface-hover)]
        disabled:opacity-60
        transition
      "
      title="Sair"
     disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
      {loading ? "Saindo..." : "Sair"}
    </ActionButton>
  )
}
