"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

type DocenteRow = {
  idUser: number
  name: string
  email: string
  cpf: string
  docenteProfile: null | { siape: string }
}

export default function CppdDocentesPage() {
  const [rows, setRows] = useState<DocenteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch("/api/cppd/docentes", { method: "GET", credentials: "include" })
        const payload = (await r.json().catch(() => null)) as ApiResponse<DocenteRow[]> | null

        if (!alive) return

        if (!payload || !r.ok || payload.status === "error" || !payload.data) {
          setErr(payload?.message || "Falha ao carregar docentes")
          setRows([])
          return
        }

        setRows(payload.data)
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || "Erro ao carregar docentes")
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Docentes</h1>
            <p className="text-sm text-[var(--text-secondary)]">Visualize e edite dados permitidos (CPPD).</p>
          </div>
        </header>

        {loading && <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>}
        {err && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}

        {!loading && !err && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-bg-2)]">
                <tr className="text-left">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">SIAPE</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.idUser} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3">{r.cpf}</td>
                    <td className="px-4 py-3">{r.docenteProfile?.siape ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cppd/docentes/${r.idUser}`}
                        className="text-xs font-semibold uppercase tracking-wide text-[var(--btn-primary-bg)] hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                      Nenhum docente encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
