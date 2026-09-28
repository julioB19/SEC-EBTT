"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

type ApiResponse<T = any> = {
  status?: "success" | "error" | string
  message?: string
  data?: T | null
  details?: any
}

type ApiMe = {
  idUser: number
  name: string
  email: string
  phone: string | null
  city: string | null
  uf: string | null
  cpf: string | null
  roles: Role[]
  selectedRole?: Role | null
  docenteProfile: null | {
    idDocente: number
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
}

function inputClass(disabled?: boolean) {
  return [
    "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]",
    "focus:outline-none focus:border-[var(--border-strong)]",
    disabled ? "opacity-70 cursor-not-allowed" : ""
  ].join(" ")
}

function looksLikeMe(payload: any) {
  return Boolean(payload && typeof payload === "object" && payload.idUser && payload.email)
}

function extractMe(payload: any): {
  me: ApiMe | null
  errorMessage: string | null
} {
  if (!payload) return { me: null, errorMessage: "Resposta vazia do servidor" }

  if (looksLikeMe(payload)) {
    return { me: payload as ApiMe, errorMessage: null }
  }

  if (payload && typeof payload === "object") {
    const maybe = payload as ApiResponse<ApiMe>

    if (maybe.data && looksLikeMe(maybe.data)) {
      return { me: maybe.data as ApiMe, errorMessage: null }
    }

    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return { me: null, errorMessage: maybe.message }
    }
  }

  return {
    me: null,
    errorMessage: "Formato de resposta inesperado em /api/me"
  }
}

export default function PerfilPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [me, setMe] = useState<ApiMe | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

  const [cpf, setCpf] = useState("")

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
  const [role, setRole] = useState("")
  const [immediateSupervisor, setImmediateSupervisor] = useState("")

  const hasDocenteRole = useMemo(() => {
    return Boolean(me?.roles?.includes("DOCENTE"))
  }, [me])

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      setErr(null)
      setOk(null)

      try {
        const r = await fetch("/api/me", {
          method: "GET",
          credentials: "include"
        })
        const data = await r.json().catch(() => null)

        console.log("[/api/me] status:", r.status, "payload:", data)

        if (!alive) return

        if (r.status === 401 || r.status === 403) {
          router.push(`/login?next=${encodeURIComponent("/perfil")}`)
          return
        }

        const { me: extracted, errorMessage } = extractMe(data)

        if (!r.ok || !extracted) {
          setErr(errorMessage || "Falha ao carregar perfil")
          setMe(null)
          return
        }

        setMe(extracted)

        setName(extracted.name ?? "")
        setEmail(extracted.email ?? "")
        setPhone(extracted.phone ?? "")
        setCity(extracted.city ?? "")
        setUf(extracted.uf ?? "")
        setCpf(extracted.cpf ?? "")

        if (extracted.roles?.includes("DOCENTE") && extracted.docenteProfile) {
          setSiape(extracted.docenteProfile.siape ?? "")
          setClassLevel(extracted.docenteProfile.classLevel ?? "")
          setStartInterstice(
            extracted.docenteProfile.startInterstice
              ? String(extracted.docenteProfile.startInterstice).slice(0, 10)
              : ""
          )
          setEducationLevel(extracted.docenteProfile.educationLevel ?? "")
          setImprovement(extracted.docenteProfile.improvement ?? "")
          setSpecialization(extracted.docenteProfile.specialization ?? "")
          setMastersDegree(extracted.docenteProfile.mastersDegree ?? "")
          setDoctorate(extracted.docenteProfile.doctorate ?? "")
          setAssignment(extracted.docenteProfile.assignment ?? "")
          setDepartment(extracted.docenteProfile.department ?? "")
          setDivision(extracted.docenteProfile.division ?? "")
          setRole(extracted.docenteProfile.role ?? "")
          setImmediateSupervisor(extracted.docenteProfile.immediateSupervisor ?? "")
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
          setRole("")
          setImmediateSupervisor("")
        }
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || "Erro ao carregar perfil")
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [router])

  async function onSave() {
    if (!me) return

    setSaving(true)
    setErr(null)
    setOk(null)

    const payload: any = {
      name: String(name ?? "").trim(),
      email: String(email ?? "").trim(),
      phone: String(phone ?? "").trim() ? String(phone).trim() : null,
      city: String(city ?? "").trim() ? String(city).trim() : null,
      uf: String(uf ?? "").trim() ? String(uf).trim().toUpperCase() : null
    }

    if (hasDocenteRole) {
      payload.docenteProfile = {
        siape: String(siape ?? "").trim() ? String(siape).trim() : undefined,
        classLevel: String(classLevel ?? "").trim() ? String(classLevel).trim() : undefined,
        startInterstice: startInterstice ? new Date(`${startInterstice}T00:00:00.000Z`).toISOString() : undefined,
        educationLevel: String(educationLevel ?? "").trim() ? String(educationLevel).trim() : undefined,
        improvement: String(improvement ?? "").trim() ? String(improvement).trim() : null,
        specialization: String(specialization ?? "").trim() ? String(specialization).trim() : null,
        mastersDegree: String(mastersDegree ?? "").trim() ? String(mastersDegree).trim() : null,
        doctorate: String(doctorate ?? "").trim() ? String(doctorate).trim() : null,
        assignment: String(assignment ?? "").trim() ? String(assignment).trim() : null,
        department: String(department ?? "").trim() ? String(department).trim() : null,
        division: String(division ?? "").trim() ? String(division).trim() : null,
        role: String(role ?? "").trim() ? String(role).trim() : null,
        immediateSupervisor: String(immediateSupervisor ?? "").trim() ? String(immediateSupervisor).trim() : null
      }
    }

    try {
      const r = await fetch("/api/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await r.json().catch(() => null)

      if (r.status === 401 || r.status === 403) {
        router.push(`/login?next=${encodeURIComponent("/perfil")}`)
        return
      }

      if (!r.ok) {
        const msg = (typeof data?.message === "string" && data.message) || "Falha ao salvar"
        setErr(msg)
        return
      }

      setOk("Perfil atualizado com sucesso")

      const { me: extracted } = extractMe(data)
      if (extracted) setMe(extracted)
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="max-w-2xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-2xl mx-auto space-y-6 px-4 md:px-6 lg:px-8 py-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Editar perfil</h1>
          <p className="text-sm text-[var(--text-secondary)]">Atualize seus dados. CPF não pode ser alterado.</p>
        </header>

        {err && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}
        {ok && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{ok}</div>
        )}

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados básicos</h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">CPF</label>
              <input className={inputClass(true)} value={cpf} disabled />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
              <input className={inputClass()} value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                E-mail
              </label>
              <input className={inputClass()} value={email} onChange={e => setEmail(e.target.value)} />
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

        {hasDocenteRole && (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil docente</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  SIAPE
                </label>
                <input className={inputClass()} value={siape} onChange={e => setSiape(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Classe/Nível
                </label>
                <input className={inputClass()} value={classLevel} onChange={e => setClassLevel(e.target.value)} />
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
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Aperfeiçoamento
                </label>
                <input className={inputClass()} value={improvement} onChange={e => setImprovement(e.target.value)} />
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
                <input className={inputClass()} value={role} onChange={e => setRole(e.target.value)} />
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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                       bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                       hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </main>
  )
}
