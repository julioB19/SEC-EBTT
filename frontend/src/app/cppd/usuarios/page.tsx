"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

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

function inputClass() {
  return "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
}

export default function CppdUsuariosPage() {
  const [rows, setRows] = useState<DocenteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useFeedbackState<string | null>(null, "error")
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return rows

    return rows.filter(r => {
      return (
        r.name?.toLowerCase().includes(qq) ||
        r.email?.toLowerCase().includes(qq) ||
        String(r.cpf || "").includes(qq) ||
        String(r.docenteProfile?.siape || "").includes(qq)
      )
    })
  }, [rows, q])

  async function load() {
    setLoading(true)
    setErr(null)

    try {
      const r = await fetch("/api/cppd/usuarios", { method: "GET", credentials: "include" })
      const payload = (await r.json().catch(() => null)) as ApiResponse<DocenteRow[]> | null

      if (!payload || !r.ok || payload.status === "error" || !payload.data) {
        setErr(payload?.message || "Falha ao carregar docentes")
        setRows([])
        return
      }

      setRows(payload.data)
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar docentes")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">

        {/* HEADER */}
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Docentes
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Consulta e gerenciamento básico dos docentes cadastrados.
            </p>
          </div>

          <></>
        </header>

        {/* ERRO */}
        {err && (
          <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-2xl p-6">

          </div>
        )}

        {/* BUSCA */}
        <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm space-y-2">
          <FormInput
            className={inputClass()}
            placeholder="Buscar por nome, email, CPF ou SIAPE..."
            value={q}
            onChange={e => setQ(e.target.value)}
           type="search" aria-label="Buscar usuários por nome, e-mail, CPF ou SIAPE" />
        </section>

        {/* CONTEÚDO */}
        {loading ? (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando docentes...
            </p>
          </section>
        ) : filtered.length === 0 ? (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm text-sm text-[var(--text-secondary)]">
            Nenhum docente encontrado.
          </section>
        ) : (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-bg-2)]">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">CPF</th>
                  <th className="px-4 py-3 font-medium">SIAPE</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(u => (
                  <tr
                    key={u.idUser}
                    className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-muted-bg)] transition"
                  >
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.cpf}</td>
                    <td className="px-4 py-3">{u.docenteProfile?.siape ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cppd/usuarios/${u.idUser}`}
                        className="text-xs font-semibold uppercase tracking-wide
                                   text-[var(--btn-primary-bg)] hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  )
}
