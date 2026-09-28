"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

type Campus = {
  idCampus: number
  name: string
  acronym: string | null
  cppdEmail: string | null
  active: boolean
  _count?: {
    docentes: number
    processes: number
    cppdCommissions: number
  }
}

type MemberFunction = "PRESIDENT" | "SECRETARY" | "MEMBER"
type MembershipType = "PRIMARY" | "SUBSTITUTE"

type CommissionMember = {
  commissionId: number
  personId: number
  function: MemberFunction
  membershipType: MembershipType
  active: boolean
  person: {
    idPerson: number
    name: string
    email: string | null
    active: boolean
    users: Array<{ idUser: number }>
  }
}

type Commission = {
  idCppdCommission: number
  campusId: number | null
  ordinance: string | null
  mandateStart: string | null
  mandateEnd: string | null
  validityStart: string | null
  validityEnd: string | null
  campus: Pick<Campus, "idCampus" | "name" | "acronym" | "active"> | null
  members: CommissionMember[]
}

type Candidate = {
  idPerson: number
  name: string
  email: string | null
  users: Array<{ idUser: number }>
}

type CampusForm = {
  name: string
  acronym: string
  cppdEmail: string
  active: boolean
}

type CommissionForm = {
  campusId: string
  ordinance: string
  mandateStart: string
  mandateEnd: string
  validityStart: string
  validityEnd: string
}

const emptyCampus: CampusForm = { name: "", acronym: "", cppdEmail: "", active: true }
const emptyCommission: CommissionForm = {
  campusId: "",
  ordinance: "",
  mandateStart: "",
  mandateEnd: "",
  validityStart: "",
  validityEnd: ""
}

const inputClass =
  "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
const primaryButton =
  "rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50"
const secondaryButton =
  "rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)] disabled:opacity-50"

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : ""
}

function dateLabel(value: string | null) {
  if (!value) return "Não informado"
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

function commissionStatus(commission: Commission) {
  const now = new Date()
  const start = commission.validityStart ? new Date(commission.validityStart) : null
  const end = commission.validityEnd ? new Date(commission.validityEnd) : null
  if (start && start > now) return "Futura"
  if (end && end < now) return "Encerrada"
  return "Vigente"
}


export default function CppdCommissionManagement({ backHref }: { backHref: string }) {
  const [tab, setTab] = useState<"campuses" | "commissions">("commissions")
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCommissionId, setSelectedCommissionId] = useState<number | null>(null)
  const [campusForm, setCampusForm] = useState<CampusForm>(emptyCampus)
  const [editingCampusId, setEditingCampusId] = useState<number | null>(null)
  const [commissionForm, setCommissionForm] = useState<CommissionForm>(emptyCommission)
  const [editingCommissionId, setEditingCommissionId] = useState<number | null>(null)
  const [newMemberId, setNewMemberId] = useState("")
  const [newMemberFunction, setNewMemberFunction] = useState<MemberFunction>("MEMBER")
  const [newMembershipType, setNewMembershipType] = useState<MembershipType>("PRIMARY")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedCommission = useMemo(
    () => commissions.find(item => item.idCppdCommission === selectedCommissionId) ?? null,
    [commissions, selectedCommissionId]
  )

  const availableCandidates = useMemo(() => {
    const memberIds = new Set(selectedCommission?.members.map(member => member.personId) ?? [])
    return candidates.filter(candidate => !memberIds.has(candidate.idPerson))
  }, [candidates, selectedCommission])

  async function request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`/api/cppd-management/${path}`, {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    })
    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
    if (!response.ok || !payload?.data) {
      throw new Error(payload?.message || "Não foi possível concluir a operação")
    }
    return payload.data
  }

  async function load(preferredCommissionId?: number | null) {
    setLoading(true)
    setError(null)
    try {
      const [campusData, commissionData, candidateData] = await Promise.all([
        request<Campus[]>("campuses"),
        request<Commission[]>("commissions"),
        request<Candidate[]>("candidates")
      ])
      setCampuses(campusData)
      setCommissions(commissionData)
      setCandidates(candidateData)
      setSelectedCommissionId(current => {
        const preferred = preferredCommissionId ?? current
        if (preferred && commissionData.some(item => item.idCppdCommission === preferred)) {
          return preferred
        }
        return commissionData[0]?.idCppdCommission ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar os dados")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function beginCampusEdit(campus?: Campus) {
    if (!campus) {
      setEditingCampusId(null)
      setCampusForm(emptyCampus)
      return
    }
    setEditingCampusId(campus.idCampus)
    setCampusForm({
      name: campus.name,
      acronym: campus.acronym ?? "",
      cppdEmail: campus.cppdEmail ?? "",
      active: campus.active
    })
  }

  async function saveCampus(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await request<Campus>(editingCampusId ? `campuses/${editingCampusId}` : "campuses", {
        method: editingCampusId ? "PATCH" : "POST",
        body: JSON.stringify(campusForm)
      })
      setNotice(editingCampusId ? "Campus atualizado." : "Campus criado.")
      beginCampusEdit()
      await load(selectedCommissionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o campus")
    } finally {
      setSaving(false)
    }
  }

  function beginCommissionEdit(commission?: Commission) {
    if (!commission) {
      setEditingCommissionId(null)
      setSelectedCommissionId(null)
      setCommissionForm({
        ...emptyCommission,
        campusId: campuses.find(campus => campus.active)?.idCampus.toString() ?? ""
      })
      return
    }
    setEditingCommissionId(commission.idCppdCommission)
    setSelectedCommissionId(commission.idCppdCommission)
    setCommissionForm({
      campusId: commission.campusId?.toString() ?? "",
      ordinance: commission.ordinance ?? "",
      mandateStart: dateInput(commission.mandateStart),
      mandateEnd: dateInput(commission.mandateEnd),
      validityStart: dateInput(commission.validityStart),
      validityEnd: dateInput(commission.validityEnd)
    })
  }

  async function saveCommission(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const data = await request<Commission>(
        editingCommissionId ? `commissions/${editingCommissionId}` : "commissions",
        {
          method: editingCommissionId ? "PATCH" : "POST",
          body: JSON.stringify({
            campusId: Number(commissionForm.campusId),
            ordinance: commissionForm.ordinance || null,
            mandateStart: commissionForm.mandateStart || null,
            mandateEnd: commissionForm.mandateEnd || null,
            validityStart: commissionForm.validityStart || null,
            validityEnd: commissionForm.validityEnd || null
          })
        }
      )
      setNotice(editingCommissionId ? "Comissão atualizada." : "Comissão criada.")
      beginCommissionEdit()
      await load(data.idCppdCommission)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a comissão")
    } finally {
      setSaving(false)
    }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault()
    if (!selectedCommission || !newMemberId) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await request<Commission>(`commissions/${selectedCommission.idCppdCommission}/members`, {
        method: "POST",
        body: JSON.stringify({
          personId: Number(newMemberId),
          function: newMemberFunction,
          membershipType: newMembershipType
        })
      })
      setNewMemberId("")
      setNewMemberFunction("MEMBER")
      setNewMembershipType("PRIMARY")
      setNotice("Membro vinculado à comissão.")
      await load(selectedCommission.idCppdCommission)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao vincular o membro")
    } finally {
      setSaving(false)
    }
  }

  async function updateMember(member: CommissionMember, changes: Partial<CommissionMember>) {
    if (!selectedCommission) return
    setSaving(true)
    setError(null)
    try {
      await request<Commission>(
        `commissions/${selectedCommission.idCppdCommission}/members/${member.personId}`,
        { method: "PATCH", body: JSON.stringify(changes) }
      )
      await load(selectedCommission.idCppdCommission)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar o vínculo")
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(member: CommissionMember) {
    if (!selectedCommission || !window.confirm(`Remover ${member.person.name} desta comissão?`)) return
    setSaving(true)
    setError(null)
    try {
      await request<Commission>(
        `commissions/${selectedCommission.idCppdCommission}/members/${member.personId}`,
        { method: "DELETE" }
      )
      setNotice("Membro removido da comissão.")
      await load(selectedCommission.idCppdCommission)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover o membro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Campi e comissões CPPD</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Gerencie os vínculos que determinam o acesso local aos processos.
          </p>
        </div>
        <Link href={backHref} className={secondaryButton}>Voltar</Link>
      </header>

      <div className="inline-flex rounded-md border border-[var(--border-subtle)] p-1" role="tablist">
        <button
          type="button"
          className={`rounded px-4 py-2 text-sm ${tab === "commissions" ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]" : "text-[var(--text-secondary)]"}`}
          onClick={() => setTab("commissions")}
        >
          Comissões
        </button>
        <button
          type="button"
          className={`rounded px-4 py-2 text-sm ${tab === "campuses" ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]" : "text-[var(--text-secondary)]"}`}
          onClick={() => setTab("campuses")}
        >
          Campi
        </button>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
      ) : tab === "campuses" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-[var(--surface-bg-2)] text-left">
                <tr>
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">E-mail CPPD</th>
                  <th className="px-4 py-3">Docentes</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {campuses.map(campus => (
                  <tr key={campus.idCampus} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-3 font-medium">{campus.name} ({campus.acronym})</td>
                    <td className="px-4 py-3">{campus.cppdEmail || "Não informado"}</td>
                    <td className="px-4 py-3">{campus._count?.docentes ?? 0}</td>
                    <td className="px-4 py-3">{campus.active ? "Ativo" : "Inativo"}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="font-semibold text-[var(--brand)]" onClick={() => beginCampusEdit(campus)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <form onSubmit={saveCampus} className="space-y-4 rounded-md border border-[var(--border-subtle)] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{editingCampusId ? "Editar campus" : "Novo campus"}</h2>
              {editingCampusId && <button type="button" className="text-sm text-[var(--brand)]" onClick={() => beginCampusEdit()}>Cancelar</button>}
            </div>
            <label className="block text-sm">Nome<input required className={`${inputClass} mt-1`} value={campusForm.name} onChange={event => setCampusForm(value => ({ ...value, name: event.target.value }))} /></label>
            <label className="block text-sm">Sigla<input required className={`${inputClass} mt-1`} value={campusForm.acronym} onChange={event => setCampusForm(value => ({ ...value, acronym: event.target.value }))} /></label>
            <label className="block text-sm">E-mail da CPPD<input type="email" className={`${inputClass} mt-1`} value={campusForm.cppdEmail} onChange={event => setCampusForm(value => ({ ...value, cppdEmail: event.target.value }))} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={campusForm.active} onChange={event => setCampusForm(value => ({ ...value, active: event.target.checked }))} /> Campus ativo</label>
            <button disabled={saving} className={primaryButton}>{saving ? "Salvando..." : "Salvar campus"}</button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]">{commissions.length} comissão(ões) cadastrada(s)</p>
            <button type="button" className={primaryButton} onClick={() => beginCommissionEdit()}>Nova comissão</button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="space-y-2" aria-label="Comissões cadastradas">
              {commissions.map(commission => (
                <button
                  type="button"
                  key={commission.idCppdCommission}
                  onClick={() => setSelectedCommissionId(commission.idCppdCommission)}
                  className={`w-full rounded-md border p-3 text-left ${selectedCommissionId === commission.idCppdCommission ? "border-[var(--brand)] bg-[var(--surface-bg-2)]" : "border-[var(--border-subtle)]"}`}
                >
                  <span className="block text-sm font-semibold">{commission.campus?.name ?? "Campus não informado"}</span>
                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">{commission.ordinance || "Sem portaria"}</span>
                  <span className="mt-2 block text-xs">{commissionStatus(commission)} · {commission.members.filter(member => member.active).length} membro(s)</span>
                </button>
              ))}
              {!commissions.length && <p className="rounded-md border border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">Nenhuma comissão cadastrada.</p>}
            </section>

            <div className="space-y-5">
              <form onSubmit={saveCommission} className="space-y-4 rounded-md border border-[var(--border-subtle)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{editingCommissionId ? "Editar comissão" : "Dados da comissão"}</h2>
                  <div className="flex gap-3">
                    {selectedCommission && !editingCommissionId && <button type="button" className="text-sm font-semibold text-[var(--brand)]" onClick={() => beginCommissionEdit(selectedCommission)}>Editar</button>}
                    {editingCommissionId && <button type="button" className="text-sm text-[var(--brand)]" onClick={() => setEditingCommissionId(null)}>Cancelar</button>}
                  </div>
                </div>

                {editingCommissionId || !selectedCommission ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm">Campus<select required className={`${inputClass} mt-1`} value={commissionForm.campusId} onChange={event => setCommissionForm(value => ({ ...value, campusId: event.target.value }))}><option value="">Selecione</option>{campuses.filter(campus => campus.active).map(campus => <option key={campus.idCampus} value={campus.idCampus}>{campus.name}</option>)}</select></label>
                      <label className="block text-sm">Portaria<input className={`${inputClass} mt-1`} value={commissionForm.ordinance} onChange={event => setCommissionForm(value => ({ ...value, ordinance: event.target.value }))} /></label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm">Início do mandato<input type="date" className={`${inputClass} mt-1`} value={commissionForm.mandateStart} onChange={event => setCommissionForm(value => ({ ...value, mandateStart: event.target.value }))} /></label>
                      <label className="block text-sm">Fim do mandato<input type="date" className={`${inputClass} mt-1`} value={commissionForm.mandateEnd} onChange={event => setCommissionForm(value => ({ ...value, mandateEnd: event.target.value }))} /></label>
                      <label className="block text-sm">Início da vigência<input type="date" className={`${inputClass} mt-1`} value={commissionForm.validityStart} onChange={event => setCommissionForm(value => ({ ...value, validityStart: event.target.value }))} /></label>
                      <label className="block text-sm">Fim da vigência<input type="date" className={`${inputClass} mt-1`} value={commissionForm.validityEnd} onChange={event => setCommissionForm(value => ({ ...value, validityEnd: event.target.value }))} /></label>
                    </div>
                    <button disabled={saving} className={primaryButton}>{saving ? "Salvando..." : "Salvar comissão"}</button>
                  </>
                ) : (
                  <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <div><dt className="text-[var(--text-secondary)]">Campus</dt><dd className="font-medium">{selectedCommission.campus?.name}</dd></div>
                    <div><dt className="text-[var(--text-secondary)]">Portaria</dt><dd className="font-medium">{selectedCommission.ordinance || "Não informada"}</dd></div>
                    <div><dt className="text-[var(--text-secondary)]">Mandato</dt><dd>{dateLabel(selectedCommission.mandateStart)} a {dateLabel(selectedCommission.mandateEnd)}</dd></div>
                    <div><dt className="text-[var(--text-secondary)]">Vigência</dt><dd>{dateLabel(selectedCommission.validityStart)} a {dateLabel(selectedCommission.validityEnd)}</dd></div>
                  </dl>
                )}
              </form>

              {selectedCommission && !editingCommissionId && (
                <section className="space-y-4 rounded-md border border-[var(--border-subtle)] p-4">
                  <h2 className="text-base font-semibold">Membros</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-[var(--surface-bg-2)] text-left"><tr><th className="px-3 py-2">Pessoa</th><th className="px-3 py-2">Função</th><th className="px-3 py-2">Vínculo</th><th className="px-3 py-2">Ativo</th><th className="px-3 py-2">Ação</th></tr></thead>
                      <tbody>
                        {selectedCommission.members.map(member => (
                          <tr key={member.personId} className="border-t border-[var(--border-subtle)]">
                            <td className="px-3 py-2"><span className="block font-medium">{member.person.name}</span><span className="text-xs text-[var(--text-secondary)]">{member.person.email}</span></td>
                            <td className="px-3 py-2"><select disabled={saving} className={inputClass} value={member.function} onChange={event => updateMember(member, { function: event.target.value as MemberFunction })}><option value="PRESIDENT">Presidente</option><option value="SECRETARY">Secretário(a)</option><option value="MEMBER">Membro</option></select></td>
                            <td className="px-3 py-2"><select disabled={saving} className={inputClass} value={member.membershipType} onChange={event => updateMember(member, { membershipType: event.target.value as MembershipType })}><option value="PRIMARY">Titular</option><option value="SUBSTITUTE">Suplente</option></select></td>
                            <td className="px-3 py-2"><label className="flex items-center gap-2"><input type="checkbox" disabled={saving} checked={member.active} onChange={event => updateMember(member, { active: event.target.checked })} /> {member.active ? "Sim" : "Não"}</label></td>
                            <td className="px-3 py-2"><button type="button" disabled={saving} className="font-semibold text-red-700" onClick={() => removeMember(member)}>Remover</button></td>
                          </tr>
                        ))}
                        {!selectedCommission.members.length && <tr><td colSpan={5} className="px-3 py-5 text-center text-[var(--text-secondary)]">Nenhum membro vinculado.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  <form onSubmit={addMember} className="grid gap-3 border-t border-[var(--border-subtle)] pt-4 md:grid-cols-[minmax(220px,1fr)_180px_160px_auto] md:items-end">
                    <label className="block text-sm">Novo membro<select required className={`${inputClass} mt-1`} value={newMemberId} onChange={event => setNewMemberId(event.target.value)}><option value="">Selecione</option>{availableCandidates.map(candidate => <option key={candidate.idPerson} value={candidate.idPerson}>{candidate.name} · {candidate.email}</option>)}</select></label>
                    <label className="block text-sm">Função<select className={`${inputClass} mt-1`} value={newMemberFunction} onChange={event => setNewMemberFunction(event.target.value as MemberFunction)}><option value="PRESIDENT">Presidente</option><option value="SECRETARY">Secretário(a)</option><option value="MEMBER">Membro</option></select></label>
                    <label className="block text-sm">Vínculo<select className={`${inputClass} mt-1`} value={newMembershipType} onChange={event => setNewMembershipType(event.target.value as MembershipType)}><option value="PRIMARY">Titular</option><option value="SUBSTITUTE">Suplente</option></select></label>
                    <button disabled={saving || !availableCandidates.length} className={primaryButton}>Adicionar</button>
                  </form>
                  {!availableCandidates.length && <p className="text-xs text-[var(--text-secondary)]">Todos os usuários locais da CPPD já estão vinculados a esta comissão.</p>}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
