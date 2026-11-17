"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { clientFetch as fetch } from "@/lib/clientFetch"

type Membership = {
  commissionId: number
  campus: string
  ordinance: string | null
  functionLabel: string
  membershipLabel: string
  status: "Vigente" | "Futura" | "Encerrada" | "Inativo"
  validity: string
}

type CommissionRow = {
  idCppdCommission: number
  ordinance: string | null
  validityStart: string | null
  validityEnd: string | null
  campus: { name: string; acronym: string | null } | null
  members: Array<{
    function: "PRESIDENT" | "SECRETARY" | "MEMBER"
    membershipType: "PRIMARY" | "SUBSTITUTE"
    active: boolean
    person: { users: Array<{ idUser: number }> }
  }>
}

const functionLabel = { PRESIDENT: "Presidente", SECRETARY: "Secretário(a)", MEMBER: "Membro" }
const membershipLabel = { PRIMARY: "Titular", SUBSTITUTE: "Suplente" }

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null
}

function status(row: CommissionRow, active: boolean): Membership["status"] {
  if (!active) return "Inativo"
  const now = new Date()
  if (row.validityStart && new Date(row.validityStart) > now) return "Futura"
  if (row.validityEnd && new Date(row.validityEnd) < now) return "Encerrada"
  return "Vigente"
}

/** Mostra em quais comissões CPPD locais a pessoa atua; é isso que define os campi que ela enxerga. */
export default function CppdMembershipsSection({ userId, manageHref, isCppdMember }: { userId: number; manageHref: string; isCppdMember: boolean }) {
  const [items, setItems] = useState<Membership[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let alive = true
    void fetch("/api/cppd-management/commissions", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload?.data)) throw new Error()
        const rows = payload.data as CommissionRow[]
        const found: Membership[] = []
        for (const row of rows) {
          for (const member of row.members) {
            if (!member.person.users.some(user => user.idUser === userId)) continue
            const start = date(row.validityStart), end = date(row.validityEnd)
            found.push({
              commissionId: row.idCppdCommission,
              campus: row.campus ? `${row.campus.name}${row.campus.acronym ? ` (${row.campus.acronym})` : ""}` : "Sem campus",
              ordinance: row.ordinance,
              functionLabel: functionLabel[member.function],
              membershipLabel: membershipLabel[member.membershipType],
              status: status(row, member.active),
              validity: start || end ? `${start ?? "sem início"} a ${end ?? "sem término"}` : "Sem vigência definida"
            })
          }
        }
        if (alive) setItems(found)
      })
      .catch(() => { if (alive) setUnavailable(true) })
    return () => { alive = false }
  }, [userId])

  if (unavailable) return null
  const current = items?.filter(item => item.status === "Vigente") ?? []

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Vínculos com a CPPD</h2>
        <Link href={manageHref} className="text-sm underline">Gerenciar em Campi e CPPD</Link>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Membros da CPPD local só veem processos e docentes dos campi em que têm vínculo vigente. A CPPD Central vê todos os campi.
      </p>
      {items === null && <p className="text-sm text-[var(--text-secondary)]">Carregando vínculos...</p>}
      {items && !items.length && (
        <p className={`rounded-xl p-3 text-sm ${isCppdMember ? "bg-amber-50 text-amber-900" : "bg-[var(--surface-bg-2)] text-[var(--text-secondary)]"}`}>
          {isCppdMember
            ? "Esta pessoa tem o perfil Membro da CPPD, mas não está em nenhuma comissão. Ela não verá processos até ser vinculada a um campus."
            : "Nenhum vínculo com comissões CPPD."}
        </p>
      )}
      {items && items.length > 0 && isCppdMember && !current.length && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nenhum vínculo está vigente hoje. Esta pessoa não verá processos de nenhum campus.</p>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.commissionId} className="rounded-xl border border-[var(--border-subtle)] p-3 text-sm">
              <strong className="block">{item.campus}</strong>
              <span className="text-[var(--text-secondary)]">
                {item.functionLabel} · {item.membershipLabel} · {item.status} · {item.validity}{item.ordinance ? ` · Portaria ${item.ordinance}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
