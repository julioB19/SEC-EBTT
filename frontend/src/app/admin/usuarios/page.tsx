"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

type UserRow = {
  idUser: number
  name: string
  email: string
  cpf: string
  active: boolean
  roles: Role[]
  docenteProfile: null | { siape: string }
}

function roleLabel(role: Role) {
  if (role === "CPPD_MEMBER") return "MEMBRO DA CPPD"
  return role
}

function badge(role: Role) {
  if (role === "ADMIN") return "bg-amber-50 text-amber-700 border-amber-100"
  if (role === "CPPD_MEMBER") return "bg-sky-50 text-sky-700 border-sky-100"
  return "bg-emerald-50 text-emerald-700 border-emerald-100"
}

export default function AdminUsuariosPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState<"" | Role>("")

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return rows.filter(r => {
      const matchText =
        !qq ||
        r.name?.toLowerCase().includes(qq) ||
        r.email?.toLowerCase().includes(qq) ||
        String(r.cpf || "").includes(qq) ||
        String(r.docenteProfile?.siape || "").includes(qq)

      const matchRole = !roleFilter || r.roles.includes(roleFilter)
      return matchText && matchRole
    })
  }, [rows, q, roleFilter])

  async function load() {
    setLoading(true)
    setErr(null)

    try {
      const r = await fetch("/api/admin/usuarios", { method: "GET", credentials: "include" })
      const payload = (await r.json().catch(() => null)) as ApiResponse<UserRow[]> | null

      if (!payload || !r.ok || payload.status === "error" || !payload.data) {
        setErr(payload?.message || "Falha ao carregar usuários")
        setRows([])
        return
      }

      setRows(payload.data)
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar usuários")
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="space-y-3">
          {/* TÍTULO */}
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Usuários
          </h1>

          {/* AÇÕES */}
          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background]"
            >
              Voltar
            </Link>

            <Link
              href="/admin/usuarios/novo"
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background]"
            >
              Novo usuário
            </Link>
          </div>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
              placeholder="Buscar por nome, email, cpf, siape..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />

            <select
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
            >
              <option value="">Todos os usuários</option>
              <option value="ADMIN">ADMIN</option>
              <option value="DOCENTE">DOCENTE</option>
              <option value="CPPD_MEMBER">MEMBRO DA CPPD</option>
            </select>

            <button
              type="button"
              onClick={load}
              className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-bg-2)]"
            >
              Recarregar
            </button>
          </div>
        </section>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-bg-2)]">
                <tr className="text-left">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">SIAPE</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(u => (
                  <tr key={u.idUser} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.cpf}</td>
                    <td className="px-4 py-3">{u.docenteProfile?.siape ?? "—"}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[...u.roles]
                          .sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)))
                          .map(r => (
                            <span
                              key={r}
                              className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs ${badge(r)}`}
                            >
                              {roleLabel(r)}
                            </span>
                          ))}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/usuarios/${u.idUser}`}
                        className="text-xs font-semibold uppercase tracking-wide text-[var(--btn-primary-bg)] hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                      Nenhum resultado
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
