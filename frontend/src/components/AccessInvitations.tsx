"use client"
import { FormSelect } from "@/components/ui/FormControls"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"
import { FormEvent, useEffect, useState } from "react"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"
type Campus = { idCampus: number; name: string }
type Invitation = { campusId?: number; campus?: { name: string } | null; id: string; name: string; email: string; roles: Role[]; status: "PENDING" | "REVIEW" | "ACCEPTED" | "CANCELLED"; deliveryError: string | null; expiresAt: string }
type Details = { name: string; siape: string; evaluationCity: string; qualification: string; institution: string; workUnit: string }
const labels: Record<Role, string> = { DOCENTE: "Docente", CPPD_MEMBER: "Membro da CPPD", CPPD_CENTRAL: "CPPD Central", ADMIN: "Administrador", EXTERNAL_EVALUATOR: "Avaliador externo" }
const statuses = { PENDING: "Aguardando cadastro", REVIEW: "Aguardando revisão da CPPD", ACCEPTED: "Acesso liberado", CANCELLED: "Cancelado" }
const input = "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm"
const button = "rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm disabled:opacity-50 hover:bg-[var(--surface-muted)]"

export function AccessInvitations({ administrator = false }: { administrator?: boolean }) {
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [campusId, setCampusId] = useState("")
  const [items, setItems] = useState<Invitation[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [roles, setRoles] = useState<Role[]>(["EXTERNAL_EVALUATOR"])
  const [institutionalExternal, setInstitutionalExternal] = useState(false)
  const [details, setDetails] = useState<Record<string, Details>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useFeedbackState<string>("", "error")
  const [message, setMessage] = useFeedbackState<string>("", "auto")
  async function load() {
    const response = await fetch("/api/acesso/invitations", { cache: "no-store" })
    const json = await response.json()
    if (!response.ok) throw new Error(json.message || "Não foi possível consultar os convites")
    setItems(json.data)
    const campusResponse = await fetch("/api/acesso/campus-policy/campuses", { cache: "no-store" })
    const campusJson = await campusResponse.json()
    if (!campusResponse.ok) throw new Error(campusJson.message || "Não foi possível consultar os campi")
    setCampuses(campusJson.data)
    if (campusJson.data.length === 1) setCampusId(String(campusJson.data[0].idCampus))
  }
  useEffect(() => { void load().catch(reason => setError(reason.message)) }, [])
  async function action(path: string, body: Record<string, unknown> = {}) {
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch(`/api/acesso/invitations${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.message || "Não foi possível concluir")
      setMessage(json.data?.delivered === false ? "Convite registrado, mas o e-mail não foi enviado. Confira a configuração e use Reenviar." : path.endsWith("approve") ? "Cadastro aprovado. O avaliador já pode ser selecionado para uma comissão." : path.endsWith("cancel") ? "Convite cancelado." : "Convite enviado.")
      await load(); return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na comunicação"); return false }
    finally { setBusy(false) }
  }
  async function invite(event: FormEvent) {
    event.preventDefault()
    if (await action("", { name, email, roles, institutionalExternal, campusId: Number(campusId) })) { setName(""); setEmail(""); setInstitutionalExternal(false) }
  }
  async function review(id: string) {
    setBusy(true); setError("")
    try {
      const response = await fetch(`/api/acesso/invitations/${id}/review`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok || !json.data) throw new Error(json.message || "Dados profissionais indisponíveis")
      setDetails(old => ({ ...old, [id]: json.data }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na consulta") }
    finally { setBusy(false) }
  }
  const external = roles.length === 1 && roles[0] === "EXTERNAL_EVALUATOR"
  return <main className="mx-auto max-w-5xl space-y-6 py-4 text-[var(--text-primary)]">
    <header><h1 className="text-2xl font-semibold">Convites de acesso</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{administrator ? "Autorize o primeiro acesso e acompanhe os cadastros." : "Convide avaliadores externos e confira os dados profissionais antes de liberar o acesso."}</p></header>
    {error && null}
    {message && null}
    <form onSubmit={invite} className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
      <h2 className="text-lg font-semibold">Novo convite</h2>
      <label className="block text-sm">Campus do convite<FormSelect aria-label="Campus do convite" className={input} value={campusId} onChange={event => setCampusId(event.target.value)} required><option value="">Selecione o campus</option>{campuses.map(campus => <option key={campus.idCampus} value={campus.idCampus}>{campus.name}</option>)}</FormSelect></label><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Nome completo<FormInput className={input} required maxLength={120} value={name} onChange={event => setName(event.target.value)}  aria-label="Nome completo" /></label>
        <label className="text-sm">E-mail institucional<FormInput className={input} type="email" required maxLength={180} value={email} onChange={event => setEmail(event.target.value)}  fieldKind={"email"}  aria-label="E-mail institucional" /></label></div>
      {administrator && <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Perfis autorizados</legend>{(Object.keys(labels) as Role[]).map(role => <label key={role} className="flex items-center gap-2 text-sm"><FormInput type="checkbox" checked={roles.includes(role)} onChange={event => setRoles(old => event.target.checked ? [...old, role] : old.filter(item => item !== role))} />{labels[role]}</label>)}</fieldset>}
      {external && <label className="flex items-start gap-2 text-sm"><FormInput type="checkbox" checked={institutionalExternal} onChange={event => setInstitutionalExternal(event.target.checked)} className="mt-1"  aria-label="Conferi que o e-mail pertence à instituição do avaliador. Obrigatório quando o endereço não pertence aos domínios aceitos pelo campus selecionado." />Conferi que o e-mail pertence à instituição do avaliador. Obrigatório quando o endereço não pertence aos domínios aceitos pelo campus selecionado.</label>}
      <p className="text-xs text-[var(--text-secondary)]">O convite vale por sete dias. Reenviar invalida o link anterior. Externos precisam de revisão antes de participar de avaliações.</p>
      <ActionButton disabled={busy || !roles.length} className="rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] disabled:opacity-50" disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : (!roles.length) ? "Selecione pelo menos um perfil autorizado para o convite." : "Este controle está indisponível na etapa atual."} >{busy ? "Aguarde..." : "Enviar convite"}</ActionButton>
    </form>
    <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Cadastros e convites</h2><ActionButton className={button} disabled={busy} onClick={() => void load().catch(reason => setError(reason.message))} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Atualizar</ActionButton></div>
      {!items.length && <p className="text-sm text-[var(--text-secondary)]">Nenhum convite registrado.</p>}
      {items.map(item => <article key={item.id} className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
        <div><h3 className="font-semibold">{item.name}</h3><p className="break-all text-sm">{item.email}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{item.campus?.name || "Campus não informado"} · {item.roles.map(role => labels[role]).join(" · ")} · {statuses[item.status]}</p></div>
        {item.status === "PENDING" && <p className="text-xs">{new Date(item.expiresAt) <= new Date() ? "Convite expirado. Reenvie para renovar." : `Válido até ${new Date(item.expiresAt).toLocaleDateString("pt-BR")}`}</p>}
        {item.deliveryError && <p className="text-sm text-red-700">{item.deliveryError}</p>}
        <div className="flex flex-wrap gap-2">{item.status === "PENDING" && <><ActionButton disabled={busy} className={button} onClick={() => void action(`/${item.id}/resend`)} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Reenviar</ActionButton><ActionButton disabled={busy} className={button} onClick={() => void action(`/${item.id}/cancel`)} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Cancelar convite</ActionButton></>}{item.status === "REVIEW" && <ActionButton disabled={busy} className={button} onClick={() => void review(item.id)} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Conferir dados profissionais</ActionButton>}</div>
        {item.status === "REVIEW" && details[item.id] && <div className="space-y-3 rounded-xl bg-[var(--surface-muted)] p-4"><dl className="grid gap-3 text-sm sm:grid-cols-2">{([ ["name", "Nome"], ["siape", "SIAPE"], ["qualification", "Titulação"], ["institution", "Instituição"], ["workUnit", "Lotação"], ["evaluationCity", "Cidade da avaliação"] ] as const).map(([key, label]) => <div key={key}><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd>{details[item.id][key]}</dd></div>)}</dl>
          <p className="text-xs">Ao liberar, você confirma a conferência dos dados. O sistema registra o responsável e a data.</p><ActionButton disabled={busy} className={button} onClick={() => void action(`/${item.id}/approve`)} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Aprovar cadastro e liberar avaliador</ActionButton></div>}
      </article>)}
    </section>
  </main>
}
