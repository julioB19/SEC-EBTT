"use client"

import { useEffect, useMemo, useState, use } from "react"
import { useRouter } from "next/navigation"
import ConfirmModal from "@/components/ui/ConfirmModal"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

type DocenteProfile = {
  idDocente?: number
  siape: string
  classLevel: string
  startInterstice: string
  educationLevel: string
  improvement: string | null
  specialization: string | null
  mastersDegree: string | null
  doctorate: string | null
  assignment: string | null
  department: string | null
  division: string | null
  role: string | null
  immediateSupervisor: string | null
}

type UserDetail = {
  idUser: number
  name: string
  email: string
  phone: string | null
  city: string | null
  uf: string | null
  cpf: string | null
  active: boolean
  roles: Role[]
  docenteProfile: DocenteProfile | null
  externalEvaluatorProfile: null | {
    idExternalEvaluator: number
    title: string | null
    institution: string | null
    active: boolean
  }
}

function inputClass() {
  return "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

function roleLabel(r: Role) {
  if (r === "CPPD_MEMBER") return "MEMBRO DA CPPD"
  if (r === "CPPD_CENTRAL") return "CPPD CENTRAL"
  if (r === "EXTERNAL_EVALUATOR") return "AVALIADOR EXTERNO"
  return r
}

export default function AdminEditUsuarioPage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter()

  const resolvedParams = use(params)
  const userId = Number(resolvedParams.userId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [user, setUser] = useState<UserDetail | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

  const [roles, setRoles] = useState<Role[]>([])
  const hasDocente = useMemo(() => roles.includes("DOCENTE"), [roles])
  const hasExternalEvaluator = useMemo(() => roles.includes("EXTERNAL_EVALUATOR"), [roles])

  const [siape, setSiape] = useState("")
  const [classLevel, setClassLevel] = useState("")
  const [startInterstice, setStartInterstice] = useState("")
  const [educationLevel, setEducationLevel] = useState("")
  const [improvement, setImprovement] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [mastersDegree, setMastersDegree] = useState("")
  const [doctorate, setDoctorate] = useState("")
  const [assignment, setAssignment] = useState("")
  const [department, setDepartment] = useState("")
  const [division, setDivision] = useState("")
  const [roleText, setRoleText] = useState("")
  const [immediateSupervisor, setImmediateSupervisor] = useState("")
  const [evaluatorTitle, setEvaluatorTitle] = useState("")
  const [evaluatorInstitution, setEvaluatorInstitution] = useState("")

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  function toggleRole(r: Role) {
    setRoles(prev => {
      const has = prev.includes(r)
      const next = has ? prev.filter(x => x !== r) : [...prev, r]
      return [...next].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)))
    })
  }

  async function load() {
    setLoading(true)
    setErr(null)
    setOk(null)

    try {
      const r = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "GET",
        credentials: "include"
      })
      const payload = (await r.json().catch(() => null)) as ApiResponse<UserDetail> | null

      if (!payload || !r.ok || payload.status === "error" || !payload.data) {
        setErr(payload?.message || "Falha ao carregar usuário")
        setUser(null)
        return
      }

      const u = payload.data
      setUser(u)

      setName(u.name ?? "")
      setEmail(u.email ?? "")
      setCpf(u.cpf ?? "")
      setPhone(u.phone ?? "")
      setCity(u.city ?? "")
      setUf(u.uf ?? "")
      setRoles([...(u.roles ?? [])].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b))) as Role[])
      setEvaluatorTitle(u.externalEvaluatorProfile?.title ?? "")
      setEvaluatorInstitution(u.externalEvaluatorProfile?.institution ?? "")

      if (u.docenteProfile) {
        setSiape(u.docenteProfile.siape ?? "")
        setClassLevel(u.docenteProfile.classLevel ?? "")
        setStartInterstice(toDateInput(u.docenteProfile.startInterstice))
        setEducationLevel(u.docenteProfile.educationLevel ?? "")
        setImprovement(u.docenteProfile.improvement ?? "")
        setSpecialization(u.docenteProfile.specialization ?? "")
        setMastersDegree(u.docenteProfile.mastersDegree ?? "")
        setDoctorate(u.docenteProfile.doctorate ?? "")
        setAssignment(u.docenteProfile.assignment ?? "")
        setDepartment(u.docenteProfile.department ?? "")
        setDivision(u.docenteProfile.division ?? "")
        setRoleText(u.docenteProfile.role ?? "")
        setImmediateSupervisor(u.docenteProfile.immediateSupervisor ?? "")
      } else {
        setSiape("")
        setClassLevel("")
        setStartInterstice("")
        setEducationLevel("")
        setImprovement("")
        setSpecialization("")
        setMastersDegree("")
        setDoctorate("")
        setAssignment("")
        setDepartment("")
        setDivision("")
        setRoleText("")
        setImmediateSupervisor("")
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar usuário")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setLoading(false)
      setErr("ID inválido")
      return
    }

    load()
  }, [userId])

  async function onSave() {
    setSaving(true)
    setErr(null)
    setOk(null)

    const payload: any = {
      name,
      email,
      phone: phone || null,
      city: city || null,
      uf: uf || null,
      roles
    }

    if (cpf.trim()) payload.cpf = cpf

    if (hasDocente) {
      payload.docenteProfile = {
        siape,
        classLevel,
        startInterstice: startInterstice ? new Date(startInterstice).toISOString() : null,
        educationLevel,
        improvement: improvement || null,
        specialization: specialization || null,
        mastersDegree: mastersDegree || null,
        doctorate: doctorate || null,
        assignment: assignment || null,
        department: department || null,
        division: division || null,
        role: roleText || null,
        immediateSupervisor: immediateSupervisor || null
      }
    }

    if (hasExternalEvaluator) {
      payload.externalEvaluatorProfile = {
        title: evaluatorTitle || null,
        institution: evaluatorInstitution || null
      }
    }

    try {
      const r = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const res = (await r.json().catch(() => null)) as ApiResponse<any> | null
      if (!res || !r.ok || res.status === "error") {
        setErr(res?.message || "Falha ao salvar")
        return
      }

      setOk("Atualizado com sucesso")
      await load()
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  async function onResendInvite() {
    setInviting(true)
    setErr(null)
    setOk(null)

    const cleanCpf = onlyDigits(cpf)

    try {
      const r = await fetch("/api/admin/usuarios/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanCpf ? { cpf: cleanCpf } : { email })
      })

      const res = (await r.json().catch(() => null)) as ApiResponse<any> | null

      if (!res || !r.ok || res.status === "error") {
        const details = res?.details ? ` (${String(res.details).slice(0, 300)})` : ""
        setErr((res?.message || "Falha ao enviar link de redefinição de senha") + details)
        return
      }

      setOk(res.message || "Link de redefinição de senha enviado para o e-mail cadastrado")
    } catch (e: any) {
      setErr(e?.message || "Erro ao enviar link de redefinição de senha")
    } finally {
      setInviting(false)
    }
  }

  async function onDeleteUser() {
    setDeleting(true)
    setErr(null)
    setOk(null)

    try {
      const r = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "DELETE",
        credentials: "include"
      })
      const res = (await r.json().catch(() => null)) as ApiResponse<any> | null

      if (!res || !r.ok || res.status === "error") {
        setErr(res?.message || "Falha ao excluir usuário")
        return
      }

      setConfirmDeleteOpen(false)
      router.push("/admin/usuarios")
    } catch (e: any) {
      setErr(e?.message || "Erro ao excluir usuário")
    } finally {
      setDeleting(false)
    }
  }

  const needsRequiredDocenteFields = useMemo(() => {
    if (!hasDocente) return false
    return !(siape && classLevel && startInterstice && educationLevel)
  }, [hasDocente, siape, classLevel, startInterstice, educationLevel])

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Editar usuário</h1>

          <button
            type="button"
            onClick={() => router.push("/admin/usuarios")}
            className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                               bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                               hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
          >
            Voltar
          </button>
        </header>

        {loading && <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>}

        {err && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}
        {ok && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{ok}</div>
        )}

        {!loading && user && (
          <>
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Nome
                  </label>
                  <input className={inputClass()} value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Email
                  </label>
                  <input className={inputClass()} value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    CPF
                  </label>
                  <input className={inputClass()} value={cpf} onChange={e => setCpf(e.target.value)} />
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
                  <input
                    className={inputClass()}
                    value={uf}
                    onChange={e => setUf(e.target.value.toUpperCase())}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onResendInvite}
                  disabled={inviting}
                  className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                               border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition disabled:opacity-60"
                >
                  {inviting ? "Enviando link..." : cpf.trim() ? "Redefinir senha" : "Reenviar convite"}
                </button>

                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || (hasDocente && needsRequiredDocenteFields)}
                  className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                               bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                               hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
                  title={
                    hasDocente && needsRequiredDocenteFields
                      ? "Preencha SIAPE, Classe/Nível, Início do interstício e Nível de formação"
                      : ""
                  }
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Tipo de usuário</h2>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={roles.includes("ADMIN")} onChange={() => toggleRole("ADMIN")} />
                  ADMIN
                </label>

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
                  <input
                    type="checkbox"
                    checked={roles.includes("CPPD_CENTRAL")}
                    onChange={() => toggleRole("CPPD_CENTRAL")}
                  />
                  CPPD CENTRAL
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.includes("EXTERNAL_EVALUATOR")}
                    onChange={() => toggleRole("EXTERNAL_EVALUATOR")}
                  />
                  AVALIADOR EXTERNO
                </label>
              </div>
            </section>

            {hasExternalEvaluator && (
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil do avaliador externo</h2>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Titulação
                    </label>
                    <input
                      className={inputClass()}
                      value={evaluatorTitle}
                      onChange={e => setEvaluatorTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Instituição
                    </label>
                    <input
                      className={inputClass()}
                      value={evaluatorInstitution}
                      onChange={e => setEvaluatorInstitution(e.target.value)}
                    />
                  </div>
                </div>
              </section>
            )}

            {hasDocente && (
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil docente</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Se o usuário era externo, marcar DOCENTE aqui cria o perfil (campos mínimos obrigatórios).
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      SIAPE *
                    </label>
                    <input className={inputClass()} value={siape} onChange={e => setSiape(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Classe/Nível *
                    </label>
                    <input className={inputClass()} value={classLevel} onChange={e => setClassLevel(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Início do interstício *
                    </label>
                    <input
                      className={inputClass()}
                      type="date"
                      value={startInterstice}
                      onChange={e => setStartInterstice(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Nível de formação *
                    </label>
                    <input
                      className={inputClass()}
                      value={educationLevel}
                      onChange={e => setEducationLevel(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Aperfeiçoamento
                    </label>
                    <input
                      className={inputClass()}
                      value={improvement}
                      onChange={e => setImprovement(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Especialização
                    </label>
                    <input
                      className={inputClass()}
                      value={specialization}
                      onChange={e => setSpecialization(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Mestrado
                    </label>
                    <input
                      className={inputClass()}
                      value={mastersDegree}
                      onChange={e => setMastersDegree(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Doutorado
                    </label>
                    <input className={inputClass()} value={doctorate} onChange={e => setDoctorate(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Lotação
                    </label>
                    <input className={inputClass()} value={assignment} onChange={e => setAssignment(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Departamento
                    </label>
                    <input className={inputClass()} value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Divisão
                    </label>
                    <input className={inputClass()} value={division} onChange={e => setDivision(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Cargo/Função
                    </label>
                    <input className={inputClass()} value={roleText} onChange={e => setRoleText(e.target.value)} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Chefia imediata
                    </label>
                    <input
                      className={inputClass()}
                      value={immediateSupervisor}
                      onChange={e => setImmediateSupervisor(e.target.value)}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-red-700">ATENÇÃO</h2>
                <p className="text-xs text-red-700/80">
                  A exclusão de um usuário é permanente e não pode ser desfeita.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                  className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                             border border-red-200 bg-white text-red-700
                             hover:bg-red-100 transition disabled:opacity-60"
                >
                  {deleting ? "Excluindo..." : "Deletar usuário"}
                </button>
              </div>
            </section>

            <ConfirmModal
              open={confirmDeleteOpen}
              title="Deletar usuário"
              description="Tem certeza que deseja deletar este usuário? Após a exclusão não é possível recuperar o cadastro."
              confirmText={deleting ? "Excluindo..." : "Confirmar"}
              cancelText="Cancelar"
              loading={deleting}
              onCancel={() => {
                if (!deleting) setConfirmDeleteOpen(false)
              }}
              onConfirm={onDeleteUser}
            />
          </>
        )}
      </div>
    </main>
  )
}
