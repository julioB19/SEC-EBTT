"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function inputClass() {
  return "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
}

export default function AdminNovoUsuarioPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

  const [roles, setRoles] = useState<Role[]>(["CPPD_MEMBER"])
  const [sendInvite, setSendInvite] = useState(true)

  const needsDocenteProfile = useMemo(() => roles.includes("DOCENTE"), [roles])

  const [siape, setSiape] = useState("")
  const [classLevel, setClassLevel] = useState("")
  const [startInterstice, setStartInterstice] = useState("")
  const [educationLevel, setEducationLevel] = useState("")

  function toggleRole(r: Role) {
    setRoles(prev => {
      const has = prev.includes(r)
      if (has) return prev.filter(x => x !== r)
      return [...prev, r]
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    setOk(null)

    const payload: any = {
      name,
      email,
      cpf,
      phone: phone || null,
      city: city || null,
      uf: uf || null,
      roles,
      sendInvite
    }

    if (needsDocenteProfile) {
      payload.docenteProfile = {
        siape,
        classLevel,
        startInterstice: startInterstice ? new Date(startInterstice).toISOString() : null,
        educationLevel
      }
    }

    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const res = (await r.json().catch(() => null)) as ApiResponse<any> | null
      if (!res || !r.ok || res.status === "error") {
        setErr(res?.message || "Falha ao criar usuário")
        return
      }

      setOk("Usuário criado com sucesso")
      setTimeout(() => router.push("/admin/usuarios"), 400)
    } catch (e: any) {
      setErr(e?.message || "Erro ao criar usuário")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Novo usuário</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Crie usuários externos e opcionalmente envie convite para definir senha.
          </p>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {ok}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Nome
                </label>
                <input className={inputClass()} value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Email
                </label>
                <input className={inputClass()} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  CPF
                </label>
                <input className={inputClass()} value={cpf} onChange={e => setCpf(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Telefone
                </label>
                <input className={inputClass()} value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Cidade
                </label>
                <input className={inputClass()} value={city} onChange={e => setCity(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  UF
                </label>
                <input className={inputClass()} value={uf} onChange={e => setUf(e.target.value.toUpperCase())} maxLength={2} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Permissões</h2>

            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={roles.includes("DOCENTE")} onChange={() => toggleRole("DOCENTE")} />
                DOCENTE
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={roles.includes("CPPD_MEMBER")} onChange={() => toggleRole("CPPD_MEMBER")} />
                CPPD_MEMBER
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={roles.includes("ADMIN")} onChange={() => toggleRole("ADMIN")} />
                ADMIN
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} />
              Enviar convite por e-mail para definir senha
            </label>
          </section>

          {needsDocenteProfile && (
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil docente</h2>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">SIAPE</label>
                  <input className={inputClass()} value={siape} onChange={e => setSiape(e.target.value)} required />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Classe/Nível</label>
                  <input className={inputClass()} value={classLevel} onChange={e => setClassLevel(e.target.value)} required />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Início do interstício</label>
                  <input className={inputClass()} type="date" value={startInterstice} onChange={e => setStartInterstice(e.target.value)} required />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nível de formação</label>
                  <input className={inputClass()} value={educationLevel} onChange={e => setEducationLevel(e.target.value)} required />
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:underline"
            >
              Voltar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
