"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

type Docente = {
  idUser: number
  name: string
  email: string
  cpf: string
  docenteProfile: null | { siape: string }
}

function inputClass() {
  return "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
}

export default function CppdEditDocentePage({ params }: any) {
  const router = useRouter()
  const userId = Number(params.userId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [docente, setDocente] = useState<Docente | null>(null)
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [siape, setSiape] = useState("")

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch(`/api/cppd/docentes/${userId}`, { method: "GET", credentials: "include" })
        const payload = (await r.json().catch(() => null)) as ApiResponse<Docente> | null

        if (!alive) return

        if (!payload || !r.ok || payload.status === "error" || !payload.data) {
          setErr(payload?.message || "Falha ao carregar docente")
          setDocente(null)
          return
        }

        setDocente(payload.data)
        setEmail(payload.data.email ?? "")
        setCpf(payload.data.cpf ?? "")
        setSiape(payload.data.docenteProfile?.siape ?? "")
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || "Erro ao carregar docente")
      } finally {
        if (alive) setLoading(false)
      }
    }

    if (Number.isFinite(userId) && userId > 0) load()
    else setLoading(false)

    return () => {
      alive = false
    }
  }, [userId])

  async function onSave() {
    setSaving(true)
    setErr(null)
    setOk(null)

    try {
      const r = await fetch(`/api/cppd/docentes/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cpf, siape })
      })

      const payload = (await r.json().catch(() => null)) as ApiResponse<any> | null
      if (!payload || !r.ok || payload.status === "error") {
        setErr(payload?.message || "Falha ao salvar")
        return
      }

      setOk("Atualizado com sucesso")
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Editar docente</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            CPPD pode editar apenas <b>email</b>, <b>CPF</b> e <b>SIAPE</b>.
          </p>
        </header>

        {loading && <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>}
        {err && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}
        {ok && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{ok}</div>}

        {!loading && docente && (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nome (somente leitura)</label>
              <input className={inputClass()} value={docente.name} disabled />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Email</label>
                <input className={inputClass()} value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">CPF</label>
                <input className={inputClass()} value={cpf} onChange={e => setCpf(e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">SIAPE</label>
                <input className={inputClass()} value={siape} onChange={e => setSiape(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:underline"
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={onSave}
                className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                           bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                           hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
