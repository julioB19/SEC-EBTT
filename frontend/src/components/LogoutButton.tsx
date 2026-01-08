"use client"

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
    <button
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
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  )
}
