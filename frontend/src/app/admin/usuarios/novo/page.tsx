"use client"
import { FormSelect } from "@/components/ui/FormControls"

import Modal from "@/components/Modal"
import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

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

function InfoModal({ open, title, description, onConfirm }: InfoModalProps) {
  return <Modal open={open} title={title} message={description ?? ""} variant="success" onClose={onConfirm} />
}


export default function AdminNovoUsuarioPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useFeedbackState<string | null>(null, "error")

  const [doneOpen, setDoneOpen] = useState(false)
  const [doneTitle, setDoneTitle] = useState("Usuário criado")
  const [doneMessage, setDoneMessage] = useState("")

  const [campusId, setCampusId] = useState("")
  const [campuses, setCampuses] = useState<{ idCampus: number; name: string }[]>([])
  useEffect(() => { void fetch("/api/acesso/campuses", { cache: "no-store" }).then(response => response.json()).then(json => { if (Array.isArray(json.data)) { setCampuses(json.data); if (json.data.length === 1) setCampusId(String(json.data[0].idCampus)) } }).catch(() => {}) }, [])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

  const [roles, setRoles] = useState<Role[]>(["CPPD_MEMBER"])

  const needsDocenteProfile = useMemo(() => roles.includes("DOCENTE"), [roles])
  const hasExternalEvaluatorProfile = useMemo(() => roles.includes("EXTERNAL_EVALUATOR"), [roles])
  const isExternalEvaluatorOnly = roles.length === 1 && hasExternalEvaluatorProfile

  const [siape, setSiape] = useState("")
  const [classLevel, setClassLevel] = useState("")
  const [startInterstice, setStartInterstice] = useState("")
  const [educationLevel, setEducationLevel] = useState("")
  const [evaluatorTitle, setEvaluatorTitle] = useState("")
  const [evaluatorInstitution, setEvaluatorInstitution] = useState("")

  function toggleRole(r: Role) {
    setRoles(prev => {
      const has = prev.includes(r)
      if (has) return prev.filter(x => x !== r)
      return [...prev, r]
    })
  }

  function goToUsers() {
    router.push("/admin/usuarios")
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (hasExternalEvaluatorProfile) { router.push("/admin/convites"); return }

    setSaving(true)
    setErr(null)

    const payload: any = {
      campusId: Number(campusId),
      name,
      email,
      phone: phone || null,
      city: city || null,
      uf: uf || null,
      roles
    }

    if (!isExternalEvaluatorOnly) {
      payload.cpf = cpf
      payload.password = generateStrongPassword(24)
    }

    if (needsDocenteProfile) {
      payload.docenteProfile = {
        siape,
        classLevel,
        startInterstice: startInterstice ? new Date(startInterstice).toISOString() : null,
        educationLevel
      }
    }

    if (hasExternalEvaluatorProfile) {
      payload.externalEvaluatorProfile = {
        title: evaluatorTitle || null,
        institution: evaluatorInstitution || null
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
        body: JSON.stringify(isExternalEvaluatorOnly ? { email } : { cpf })
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
          <a href="/admin/convites" className="mt-2 inline-block text-sm text-[var(--brand)] underline">Convidar por e-mail, inclusive avaliadores externos</a>
          <p className="text-sm text-[var(--text-secondary)]">
            Crie usuários externos. Um link de acesso será enviado por e-mail automaticamente.
          </p>
        </header>

        {err && null}

        <form onSubmit={onSubmit} className="space-y-6">
          <label className="block text-sm">Campus<FormSelect aria-label="Campus" className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm" value={campusId} onChange={event => setCampusId(event.target.value)} required><option value="">Selecione o campus</option>{campuses.map(campus => <option key={campus.idCampus} value={campus.idCampus}>{campus.name}</option>)}</FormSelect></label>
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Nome
                </label>
                <FormInput className={inputClass()} value={name} onChange={e => setName(e.target.value)} required  aria-label="Nome" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Email
                </label>
                <FormInput className={inputClass()} value={email} onChange={e => setEmail(e.target.value)} required  fieldKind={"email"}  aria-label="Email" />
              </div>

              {!isExternalEvaluatorOnly && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    CPF
                  </label>
                  <FormInput className={inputClass()} value={cpf} onChange={e => setCpf(e.target.value)} required  fieldKind={"cpf"}  aria-label="CPF" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Telefone
                </label>
                <FormInput className={inputClass()} value={phone} onChange={e => setPhone(e.target.value)}  fieldKind={"phone"}  aria-label="Telefone" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Cidade
                </label>
                <FormInput className={inputClass()} value={city} onChange={e => setCity(e.target.value)}  aria-label="Cidade" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">UF</label>
                <FormInput
                  className={inputClass()}
                  value={uf}
                  onChange={e => setUf(e.target.value.toUpperCase())}
                  maxLength={2}
                 fieldKind={"uf"}  aria-label="UF" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Permissões</h2>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2">
                <FormInput type="checkbox" checked={roles.includes("DOCENTE")} onChange={() => toggleRole("DOCENTE")}  aria-label="DOCENTE" />
                DOCENTE
              </label>

              <label className="flex items-center gap-2">
                <FormInput
                  type="checkbox"
                  checked={roles.includes("CPPD_MEMBER")}
                  onChange={() => toggleRole("CPPD_MEMBER")}
                 aria-label="MEMBRO DA CPPD" />
                MEMBRO DA CPPD
              </label>

              <label className="flex items-center gap-2">
                <FormInput
                  type="checkbox"
                  checked={roles.includes("CPPD_CENTRAL")}
                  onChange={() => toggleRole("CPPD_CENTRAL")}
                 aria-label="CPPD CENTRAL" />
                CPPD CENTRAL
              </label>

              <label className="flex items-center gap-2">
                <FormInput type="checkbox" checked={roles.includes("ADMIN")} onChange={() => toggleRole("ADMIN")}  aria-label="ADMIN" />
                ADMIN
              </label>

              <label className="flex items-center gap-2">
                <FormInput
                  type="checkbox"
                  checked={roles.includes("EXTERNAL_EVALUATOR")}
                  onChange={() => toggleRole("EXTERNAL_EVALUATOR")}
                 aria-label="AVALIADOR EXTERNO" />
                AVALIADOR EXTERNO
              </label>
            </div>
          </section>

          {hasExternalEvaluatorProfile && (
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil do avaliador externo</h2>
                {isExternalEvaluatorOnly && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    O CPF e a senha serão informados pelo avaliador ao aceitar o convite recebido por e-mail.
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Titulação
                  </label>
                  <FormInput
                    className={inputClass()}
                    value={evaluatorTitle}
                    onChange={e => setEvaluatorTitle(e.target.value)}
                   aria-label="Titulação" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Instituição
                  </label>
                  <FormInput
                    className={inputClass()}
                    value={evaluatorInstitution}
                    onChange={e => setEvaluatorInstitution(e.target.value)}
                   aria-label="Instituição" />
                </div>
              </div>
            </section>
          )}

          {needsDocenteProfile && (
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil docente</h2>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    SIAPE
                  </label>
                  <FormInput className={inputClass()} value={siape} onChange={e => setSiape(e.target.value)} required  fieldKind={"siape"}  aria-label="SIAPE" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Classe/Nível
                  </label>
                  <FormInput
                    className={inputClass()}
                    value={classLevel}
                    onChange={e => setClassLevel(e.target.value)}
                    required
                   aria-label="Classe/Nível" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Início do interstício
                  </label>
                  <FormInput
                    className={inputClass()}
                    type="date"
                    value={startInterstice}
                    onChange={e => setStartInterstice(e.target.value)}
                    required
                   aria-label="Início do interstício" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Nível de formação
                  </label>
                  <FormInput
                    className={inputClass()}
                    value={educationLevel}
                    onChange={e => setEducationLevel(e.target.value)}
                    required
                   aria-label="Nível de formação" />
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between">


            <ActionButton
              type="submit"
              disabled={saving}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
             disabledReason={(saving) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              {saving ? "Salvando..." : hasExternalEvaluatorProfile ? "Continuar em convites de acesso" : "Criar"}
            </ActionButton>
          </div>
        </form>
      </div>

      <InfoModal open={doneOpen} title={doneTitle} description={doneMessage} confirmText="Ok" onConfirm={goToUsers} />
    </main>
  )
}
