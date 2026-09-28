"use client"

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
  const [debug, setDebug] = useState<any>(null)

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
          setDebug((payload as any)?._debug ?? payload)
          setError((payload as any)?.message ?? `Falha ao carregar perfil (${r.status})`)
          return
        }

        const data = (payload as any)?.data ?? (payload as any)
        setMe(data as ApiMe)
        setDebug((payload as any)?._debug ?? null)
      } catch (e: any) {
        if (!alive) return
        setMe(null)
        setDebug(e)
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

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Meu perfil</h1>
        <p>Carregando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Meu perfil</h1>
        <p style={{ marginTop: 8 }}><strong>Erro:</strong> {error}</p>

        {debug ? (
          <pre style={{ marginTop: 12, padding: 12, background: "#f5f5f5", overflow: "auto" }}>
            {JSON.stringify(debug, null, 2)}
          </pre>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Meu perfil</h1>

      {!me ? (
        <p>Nenhum dado retornado</p>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <p><strong>Nome:</strong> {me.name}</p>
            <p><strong>Email:</strong> {me.email}</p>
            <p><strong>CPF:</strong> {me.cpf}</p>
            <p><strong>Telefone:</strong> {me.phone ?? "-"}</p>
            <p><strong>Cidade:</strong> {me.city ?? "-"}</p>
            <p><strong>UF:</strong> {me.uf ?? "-"}</p>
            <p><strong>Roles:</strong> {Array.isArray(me.roles) ? me.roles.join(", ") : "-"}</p>
          </div>

          <div style={{ marginTop: 16 }}>
            <h2 style={{ marginBottom: 8 }}>Docente</h2>

            {!docente ? (
              <p>Sem perfil de docente</p>
            ) : (
              <div>
                <p><strong>SIAPE:</strong> {docente.siape}</p>
                <p><strong>Nível:</strong> {docente.classLevel}</p>
                <p><strong>Início do interstício:</strong> {docente.startInterstice}</p>
                <p><strong>Escolaridade:</strong> {docente.educationLevel}</p>
                <p><strong>Aperfeiçoamento:</strong> {docente.improvement ?? "-"}</p>
                <p><strong>Especialização:</strong> {docente.specialization ?? "-"}</p>
                <p><strong>Mestrado:</strong> {docente.mastersDegree ?? "-"}</p>
                <p><strong>Doutorado:</strong> {docente.doctorate ?? "-"}</p>
                <p><strong>Lotação:</strong> {docente.assignment ?? "-"}</p>
                <p><strong>Departamento:</strong> {docente.department ?? "-"}</p>
                <p><strong>Divisão:</strong> {docente.division ?? "-"}</p>
                <p><strong>Cargo/Função:</strong> {docente.role ?? "-"}</p>
                <p><strong>Chefia imediata:</strong> {docente.immediateSupervisor ?? "-"}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
