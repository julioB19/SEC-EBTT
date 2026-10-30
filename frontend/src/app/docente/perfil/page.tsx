"use client"
import Link from "next/link"
import { primaryButtonClass, surfaceClass } from "@/components/ui/systemStyles"
import TeacherDegreesPanel from "@/components/TeacherDegreesPanel"

import { useEffect, useMemo, useState } from "react"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

type ApiResponse<T = any> = {
  status?: "success" | "error" | string
  message?: string
  data?: T | null
  details?: any
  _debug?: any
  raw?: any
}

type DocenteProfile = null | {
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

type ApiMe = {
  idUser: number
  name: string
  email: string
  phone: string | null
  city: string | null
  uf: string | null
  cpf: string
  active?: boolean
  createdAt?: string
  deletedDate?: string | null
  roles: Role[]
  selectedRole?: Role | null
  docenteProfile: DocenteProfile
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export default function DocentePerfilPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<ApiMe | null>(null)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const r = await fetch("/api/docente/me", { cache: "no-store" })
        const text = await r.text()
        const parsed = safeJsonParse(text)

        if (!alive) return

        const payload = (parsed ?? { raw: text }) as ApiResponse<ApiMe>

        if (!r.ok) {
          setMe(null)
          setError((payload as any)?.message ?? `Falha ao carregar perfil (${r.status})`)
          return
        }

        const data = (payload as any)?.data ?? (payload as any)
        setMe(data as ApiMe)
      } catch (e: any) {
        if (!alive) return
        setMe(null)
        setError(e?.message ?? "Erro desconhecido ao carregar perfil")
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    load()

    return () => {
      alive = false
    }
  }, [])

  const docente = useMemo(() => me?.docenteProfile ?? null, [me])

  const personal = me ? [
    ["Nome", me.name], ["E-mail", me.email], ["CPF", me.cpf],
    ["Telefone", me.phone], ["Cidade", me.city], ["UF", me.uf],
    ["Perfis de acesso", me.roles.map(role => ({ DOCENTE: "Docente", CPPD_MEMBER: "Membro da CPPD", CPPD_CENTRAL: "CPPD Central", ADMIN: "Administrador", EXTERNAL_EVALUATOR: "Avaliador externo" })[role]).join(", ")]
  ] : []
  const functional = docente ? [
    ["SIAPE", docente.siape], ["Nível", docente.classLevel],
    ["Início do interstício", docente.startInterstice ? new Date(docente.startInterstice).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null],
    ["Escolaridade", docente.educationLevel], ["Aperfeiçoamento", docente.improvement],
    ["Especialização", docente.specialization], ["Mestrado", docente.mastersDegree],
    ["Doutorado", docente.doctorate], ["Lotação", docente.assignment],
    ["Departamento", docente.department], ["Divisão", docente.division],
    ["Cargo/Função", docente.role], ["Chefia imediata", docente.immediateSupervisor]
  ] : []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Meu perfil</h1>
        <Link href="/docente" className={primaryButtonClass}>Voltar</Link>
      </header>
      {loading ? <p className="text-sm text-[var(--text-secondary)]">Carregando...</p> : error ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : !me ? <p className="text-sm text-[var(--text-secondary)]">Nenhum dado retornado.</p> : (
        <>
          <section className={`${surfaceClass} space-y-4 p-5`}>
            <h2 className="text-base font-semibold">Dados pessoais</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {personal.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[var(--text-secondary)]">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Não informado"}</dd></div>)}
            </dl>
          </section>
          <section className={`${surfaceClass} space-y-4 p-5`}>
            <h2 className="text-base font-semibold">Dados funcionais</h2>
            {!docente ? <p className="text-sm text-[var(--text-secondary)]">Sem perfil de docente.</p> : (
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {functional.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[var(--text-secondary)]">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Não informado"}</dd></div>)}
              </dl>
            )}
          </section>
          <TeacherDegreesPanel />
        </>
      )}
    </div>
  )
}
