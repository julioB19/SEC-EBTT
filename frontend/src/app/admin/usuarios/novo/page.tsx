"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

function generateStrongPassword(length = 24) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnopqrstuvwxyz"
  const digits = "23456789"
  const symbols = "!@#$%&*_-+?"
  const all = upper + lower + digits + symbols

  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]

  let pwd = ""
  pwd += pick(upper)
  pwd += pick(lower)
  pwd += pick(digits)
  pwd += pick(symbols)

  while (pwd.length < length) pwd += pick(all)

  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")
}

type InfoModalProps = {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  onConfirm: () => void
}

function InfoModal({
  open,
  title,
  description,
  confirmText = "Ok",
  onConfirm
}: InfoModalProps) {
  const okRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => okRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === "Escape" || e.key === "Enter") onConfirm()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onConfirm])

  if (!open) return null

  return (
    <div
      className="
        fixed inset-0 z-[70]
        flex items-center justify-center
        p-4
        bg-black/40
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-title"
      onClick={onConfirm}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="
          w-full max-w-md
          rounded-2xl
          bg-white
          bg-[var(--surface-card)]
          border border-[var(--border-subtle)]
          shadow-xl
          p-6
        "
      >
        <h2 id="info-title" className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>

        {description && (
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {description}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={okRef}
            type="button"
            className="
              px-4 py-2 rounded-xl text-sm font-medium
              bg-[var(--btn-primary-bg)]
              text-[var(--btn-primary-text)]
              hover:bg-[var(--btn-primary-hover-bg)]
              disabled:opacity-60
            "
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminNovoUsuarioPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [doneOpen, setDoneOpen] = useState(false)
  const [doneTitle, setDoneTitle] = useState("Usuário criado")
  const [doneMessage, setDoneMessage] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

  const [roles, setRoles] = useState<Role[]>(["CPPD_MEMBER"])

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

  function goToUsers() {
    window.location.href = "http://localhost:3001/admin/usuarios"
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setErr(null)

    const payload: any = {
      name,
      email,
      cpf,
      phone: phone || null,
      city: city || null,
      uf: uf || null,
      roles,
      password: generateStrongPassword(24)
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

      const inviteRes = await fetch("/api/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf })
      })

      const inviteJson = (await inviteRes.json().catch(() => null)) as ApiResponse<any> | null
      if (!inviteJson || !inviteRes.ok || inviteJson.status === "error") {
        setDoneTitle("Usuário criado")
        setDoneMessage("O usuário foi criado, mas não foi possível enviar o link de acesso por e-mail.")
        setDoneOpen(true)
        return
      }

      setDoneTitle("Usuário criado")
      setDoneMessage("Foi enviado um link de acesso para o e-mail cadastrado.")
      setDoneOpen(true)
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
            Crie usuários externos. Um link de acesso será enviado por e-mail automaticamente.
          </p>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
                <input className={inputClass()} value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Email</label>
                <input className={inputClass()} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">CPF</label>
                <input className={inputClass()} value={cpf} onChange={e => setCpf(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Telefone</label>
                <input className={inputClass()} value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Cidade</label>
                <input className={inputClass()} value={city} onChange={e => setCity(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">UF</label>
                <input
                  className={inputClass()}
                  value={uf}
                  onChange={e => setUf(e.target.value.toUpperCase())}
                  maxLength={2}
                />
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
                <input
                  type="checkbox"
                  checked={roles.includes("CPPD_MEMBER")}
                  onChange={() => toggleRole("CPPD_MEMBER")}
                />
                MEMBRO DA CPPD
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={roles.includes("ADMIN")} onChange={() => toggleRole("ADMIN")} />
                ADMIN
              </label>
            </div>
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
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Classe/Nível
                  </label>
                  <input
                    className={inputClass()}
                    value={classLevel}
                    onChange={e => setClassLevel(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Início do interstício
                  </label>
                  <input
                    className={inputClass()}
                    type="date"
                    value={startInterstice}
                    onChange={e => setStartInterstice(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Nível de formação
                  </label>
                  <input
                    className={inputClass()}
                    value={educationLevel}
                    onChange={e => setEducationLevel(e.target.value)}
                    required
                  />
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

      <InfoModal
        open={doneOpen}
        title={doneTitle}
        description={doneMessage}
        confirmText="Ok"
        onConfirm={goToUsers}
      />
    </main>
  )
}
