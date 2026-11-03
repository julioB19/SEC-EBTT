"use client"

import { clientFetch as fetch } from "@/lib/clientFetch"
import { useEffect, useState } from "react"
import Link from "next/link"

export function GoogleEntry() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    fetch("/api/acesso/config", { cache: "no-store" }).then(r => r.json())
      .then(json => setEnabled(json.data?.googleEnabled === true)).catch(() => {})
  }, [])
  return <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4 text-center text-sm">
    {enabled && <Link className="block rounded-xl border border-[var(--border-subtle)] px-4 py-2 font-medium hover:bg-[var(--surface-muted)]" href="/acesso">Entrar com Google</Link>}
    <Link className="text-[var(--brand)] hover:underline" href="/acesso">Recebi um convite / acompanhar meu cadastro</Link>
  </div>
}
