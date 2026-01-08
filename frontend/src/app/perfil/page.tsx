"use client"

import { useEffect, useMemo, useState } from "react"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

type ApiMe = {
  idUser: number
  name: string
  email: string
  phone: string | null
  city: string | null
  uf: string | null
  cpf: string
  roles: Role[]
  selectedRole: Role | null
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

function inputClass() {
  return "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
}

export default function PerfilPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [me, setMe] = useState<ApiMe | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

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

  const isDocente = useMemo(() => {
    return Boolean(me?.roles?.includes("DOCENTE") && (me?.selectedRole === "DOCENTE" || me?.selectedRole == null))
  }, [me])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch("/api/me", { method: "GET", credentials: "include" })
        const data = (await r.json().catch(() => null)) as any
        if (!alive) return

        if (!r.ok) {
          setErr(data?.message || "Falha ao carregar perfil")
          setMe(null)
          return
        }

        const m: ApiMe = data
        setMe(m)

        setName(m.name ?? "")
        setPhone(m.phone ?? "")
        setCity(m.city ?? "")
        setUf(m.uf ?? "")

        if (m.docenteProfile) {
          setSiape(m.docenteProfile.siape ?? "")
          setClassLevel(m.docenteProfile.classLevel ?? "")
          setStartInterstice(m.docenteProfile.startInterstice ? String(m.docenteProfile.startInterstice).slice(0, 10) : "")
          setEducationLevel(m.docenteProfile.educationLevel ?? "")
          setImprovement(m.docenteProfile.improvement ?? "")
          setSpecialization(m.docenteProfile.specialization ?? "")
          setMastersDegree(m.docenteProfile.mastersDegree ?? "")
          setDoctorate(m.docenteProfile.doctorate ?? "")
          setAssignment(m.docenteProfile.assignment ?? "")
          setDepartment(m.docenteProfile.department ?? "")
          setDivision(m.docenteProfile.division ?? "")
          setRole(m.docenteProfile.role ?? "")
          setImmediateSupervisor(m.docenteProfile.immediateSupervisor ?? "")
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
  }, [])

  async function onSave() {
    if (!me) return
    setSaving(true)
    setErr(null)
    setOk(null)

    const payload: any = {
      name,
      phone: phone || null,
      city: city || null,
      uf: uf || null
    }

    if (isDocente) {
      payload.docenteProfile = {
        siape: siape || undefined,
        classLevel: classLevel || undefined,
        startInterstice: startInterstice ? new Date(startInterstice).toISOString() : undefined,
        educationLevel: educationLevel || undefined,
        improvement: improvement || null,
        specialization: specialization || null,
        mastersDegree: mastersDegree || null,
        doctorate: doctorate || null,
        assignment: assignment || null,
        department: department || null,
        division: division || null,
        role: role || null,
        immediateSupervisor: immediateSupervisor || null
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
      if (!r.ok) {
        setErr(data?.message || "Falha ao salvar")
        return
      }

      setOk("Perfil atualizado com sucesso")
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Editar perfil</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Atualize seus dados. CPF/ID/roles não são editáveis por aqui.
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

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Dados básicos</h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
              <input className={inputClass()} value={name} onChange={e => setName(e.target.value)} />
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
              <input className={inputClass()} value={uf} onChange={e => setUf(e.target.value.toUpperCase())} maxLength={2} />
            </div>
          </div>
        </section>

        {isDocente && (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Perfil docente</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">SIAPE</label>
                <input className={inputClass()} value={siape} onChange={e => setSiape(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Classe/Nível</label>
                <input className={inputClass()} value={classLevel} onChange={e => setClassLevel(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Início do interstício</label>
                <input className={inputClass()} type="date" value={startInterstice} onChange={e => setStartInterstice(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nível de formação</label>
                <input className={inputClass()} value={educationLevel} onChange={e => setEducationLevel(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Aperfeiçoamento</label>
                <input className={inputClass()} value={improvement} onChange={e => setImprovement(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Especialização</label>
                <input className={inputClass()} value={specialization} onChange={e => setSpecialization(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Mestrado</label>
                <input className={inputClass()} value={mastersDegree} onChange={e => setMastersDegree(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Doutorado</label>
                <input className={inputClass()} value={doctorate} onChange={e => setDoctorate(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Lotação</label>
                <input className={inputClass()} value={assignment} onChange={e => setAssignment(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Departamento</label>
                <input className={inputClass()} value={department} onChange={e => setDepartment(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Divisão</label>
                <input className={inputClass()} value={division} onChange={e => setDivision(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Cargo/Função</label>
                <input className={inputClass()} value={role} onChange={e => setRole(e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Chefia imediata</label>
                <input className={inputClass()} value={immediateSupervisor} onChange={e => setImmediateSupervisor(e.target.value)} />
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
