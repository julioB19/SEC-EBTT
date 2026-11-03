"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import ConfirmModal from "@/components/ConfirmModal"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import { useEffect, useMemo, useState, use } from "react"
import { useRouter } from "next/navigation"

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
  classLevel?: string | null
  startInterstice?: string | null
  educationLevel?: string | null
  improvement?: string | null
  specialization?: string | null
  mastersDegree?: string | null
  doctorate?: string | null
  assignment?: string | null
  department?: string | null
  division?: string | null
  role?: string | null
  immediateSupervisor?: string | null
}

type UserDetail = {
  idUser: number
  name: string
  email: string
  cpf: string
  phone?: string | null
  city?: string | null
  uf?: string | null
  active?: boolean
  roles?: Role[]
  docenteProfile: DocenteProfile | null
}

function inputClass(disabled?: boolean) {
  const base =
    "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
  return disabled ? `${base} opacity-60` : base
}

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

function formatDateBR(value: any) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""

  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()

  return `${day}/${month}/${year}`
}

function roleLabel(r: Role) {
  if (r === "CPPD_MEMBER") return "MEMBRO DA CPPD"
  if (r === "CPPD_CENTRAL") return "CPPD CENTRAL"
  if (r === "EXTERNAL_EVALUATOR") return "AVALIADOR EXTERNO"
  return r
}

export default function CppdEditDocentePage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter()

  const resolvedParams = use(params)
  const userId = Number(resolvedParams.userId)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)

  const [err, setErr] = useFeedbackState<string | null>(null, "error")
  const [ok, setOk] = useFeedbackState<string | null>(null, "success")

  const [user, setUser] = useState<UserDetail | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")
  const [active, setActive] = useState<boolean | null>(null)
  const [roles, setRoles] = useState<Role[]>([])

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

  const cleanCpf = useMemo(() => onlyDigits(cpf), [cpf])

  async function load() {
    setLoading(true)
    setErr(null)
    setOk(null)

    try {
      const r = await fetch(`/api/cppd/usuarios/${userId}`, { method: "GET", credentials: "include" })
      const payload = (await r.json().catch(() => null)) as ApiResponse<UserDetail> | null

      if (!payload || !r.ok || payload.status === "error" || !payload.data) {
        setErr(payload?.message || "Falha ao carregar docente")
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
      setActive(typeof u.active === "boolean" ? u.active : null)
      setRoles([...(u.roles ?? [])].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b))) as Role[])

      if (u.docenteProfile) {
        setSiape(u.docenteProfile.siape ?? "")
        setClassLevel(String(u.docenteProfile.classLevel ?? ""))
        setStartInterstice(formatDateBR(u.docenteProfile.startInterstice))
        setEducationLevel(String(u.docenteProfile.educationLevel ?? ""))
        setImprovement(String(u.docenteProfile.improvement ?? ""))
        setSpecialization(String(u.docenteProfile.specialization ?? ""))
        setMastersDegree(String(u.docenteProfile.mastersDegree ?? ""))
        setDoctorate(String(u.docenteProfile.doctorate ?? ""))
        setAssignment(String(u.docenteProfile.assignment ?? ""))
        setDepartment(String(u.docenteProfile.department ?? ""))
        setDivision(String(u.docenteProfile.division ?? ""))
        setRoleText(String(u.docenteProfile.role ?? ""))
        setImmediateSupervisor(String(u.docenteProfile.immediateSupervisor ?? ""))
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar docente")
      setUser(null)
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

    const payload: any = { email }

    try {
      const r = await fetch(`/api/cppd/usuarios/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const res = (await r.json().catch(() => null)) as ApiResponse<any> | null
      if (!res || !r.ok || res.status === "error") {
        const details = res?.details ? ` (${String(res.details).slice(0, 500)})` : ""
        setErr((res?.message || "Falha ao salvar") + details)
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

  async function onInviteResetPassword() {
    setErr(null)
    setOk(null)

    const cpfDigits = cleanCpf
    if (!cpfDigits) {
      setErr("CPF indisponível para enviar a recuperação de acesso")
      return
    }


    setInviting(true)

    try {
      const r = await fetch("/api/auth/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits })
      })

      const res = (await r.json().catch(() => null)) as ApiResponse<any> | null
      if (!res || !r.ok || res.status === "error") {
        const details = res?.details ? ` (${String(res.details).slice(0, 500)})` : ""
        setErr((res?.message || "Falha ao enviar a recuperação de acesso") + details)
        return
      }

      setOk("Link de redefinição de senha enviado com sucesso")
    } catch (e: any) {
      setErr(e?.message || "Erro ao enviar a recuperação de acesso")
    } finally {
      setInviting(false)
    }
  }

  return (
    <main className="min-h-[60vh]">
      <ConfirmModal open={resetConfirmOpen} title="Enviar recuperação de acesso?" description="O usuário receberá um link ou código para redefinir a própria senha." loading={inviting} onCancel={() => setResetConfirmOpen(false)} onConfirm={async () => { await onInviteResetPassword(); setResetConfirmOpen(false) }} />
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Editar docente
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Visualize os dados do usuário e do perfil docente. Apenas o email é editável.
            </p>
          </div>


        </header>

        {loading && (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
          </section>
        )}

        {err && (
          <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-2xl p-6">

          </div>
        )}

        {ok && (
          null
        )}

        {!loading && user && (
          <>
            <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados do usuário</h2>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Nome (somente leitura)
                  </label>
                  <FormInput className={inputClass(true)} value={name} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Nome (somente leitura)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Email (editável)
                  </label>
                  <FormInput className={inputClass()} value={email} onChange={e => setEmail(e.target.value)}  fieldKind={"email"}  aria-label="Email (editável)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    CPF (somente leitura)
                  </label>
                  <FormInput className={inputClass(true)} value={cpf} disabled  fieldKind={"cpf"} disabledReason={"O CPF identifica a conta e não pode ser alterado."}  aria-label="CPF (somente leitura)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Telefone (somente leitura)
                  </label>
                  <FormInput className={inputClass(true)} value={phone} disabled  fieldKind={"phone"} disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Telefone (somente leitura)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Cidade (somente leitura)
                  </label>
                  <FormInput className={inputClass(true)} value={city} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Cidade (somente leitura)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    UF (somente leitura)
                  </label>
                  <FormInput className={inputClass(true)} value={uf} disabled  fieldKind={"uf"} disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="UF (somente leitura)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Status (somente leitura)
                  </label>
                  <FormInput
                    className={inputClass(true)}
                    value={active === null ? "—" : active ? "Ativo" : "Inativo"}
                    disabled
                   disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Status (somente leitura)" />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Roles (somente leitura)
                  </label>
                  <FormInput
                    className={inputClass(true)}
                    value={roles.length ? roles.map(roleLabel).join(", ") : "—"}
                    disabled
                   disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Roles (somente leitura)" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <ActionButton
                  type="button"
                  onClick={() => setResetConfirmOpen(true)}
                  disabled={inviting || loading || !cleanCpf}
                  className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                             border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)]
                             hover:bg-[var(--surface-hover-bg)] transition-[background] disabled:opacity-60"
                  title={!cleanCpf ? "CPF não disponível" : "Enviar invite para redefinir senha"}
                 disabledReason={(inviting) ? "Aguarde a operação em andamento terminar." : (loading) ? "Aguarde a operação em andamento terminar." : (!cleanCpf) ? "O CPF não está disponível para enviar o link de acesso." : "Este controle está indisponível na etapa atual."} >
                  {inviting ? "Enviando invite..." : "Redefinir senha"}
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                             bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                             hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
                 disabledReason={(saving) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                  {saving ? "Salvando..." : "Salvar"}
                </ActionButton>
              </div>
            </section>

            <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil docente</h2>

              {!user.docenteProfile ? (
                <p className="text-sm text-[var(--text-secondary)]">Este usuário não possui perfil docente.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      SIAPE (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={siape} disabled  fieldKind={"siape"} disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="SIAPE (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Classe/Nível (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={classLevel} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Classe/Nível (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Início do interstício (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={startInterstice} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Início do interstício (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Nível de formação (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={educationLevel} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Nível de formação (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Aperfeiçoamento (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={improvement} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Aperfeiçoamento (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Especialização (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={specialization} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Especialização (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Mestrado (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={mastersDegree} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Mestrado (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Doutorado (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={doctorate} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Doutorado (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Lotação (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={assignment} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Lotação (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Departamento (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={department} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Departamento (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Divisão (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={division} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Divisão (somente leitura)" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Cargo/Função (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={roleText} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Cargo/Função (somente leitura)" />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Chefia imediata (somente leitura)
                    </label>
                    <FormInput className={inputClass(true)} value={immediateSupervisor} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Chefia imediata (somente leitura)" />
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
