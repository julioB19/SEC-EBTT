"use client"
import { FormSelect } from "@/components/ui/FormControls"

import BackButton from "@/components/ui/BackButton"
import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import Link from "next/link"
import Script from "next/script"
import { FormEvent, useCallback, useEffect, useRef, useState } from "react"

type Role = "DOCENTE" | "ADMIN" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "EXTERNAL_EVALUATOR"
type Profile = { name: string; cpf: string; siape: string; evaluationCity: string; qualification: string; institution: string; workUnit: string;
  docenteProfile: { siape: string; classLevel: string; startInterstice: string; educationLevel: string } }
type Campus = { idCampus: number; name: string }
type Access = { campusId?: number; campusName?: string; stage?: string; email: string; nonce?: string; clientId?: string; googleEnabled?: boolean;
  googleVerified?: boolean; emailVerified?: boolean; roles?: Role[]; selectedRole?: Role; needsProfileSelection?: boolean;
  name?: string; profile?: Partial<Profile> }
type GoogleAPI = { accounts: { id: { initialize(options: Record<string, unknown>): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void } } }
const blank: Profile = { name: "", cpf: "", siape: "", evaluationCity: "", qualification: "", institution: "", workUnit: "",
  docenteProfile: { siape: "", classLevel: "", startInterstice: "", educationLevel: "" } }
const inputClass = "w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm text-[var(--text-primary)]"
const primary = "rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] disabled:opacity-50"

export default function AccessPage() {
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [campusId, setCampusId] = useState("")
  const [email, setEmail] = useState("")
  const [access, setAccess] = useState<Access | null>(null)
  const [profile, setProfile] = useState<Profile>(blank)
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useFeedbackState<string>("", "error")
  const [message, setMessage] = useFeedbackState<string>("", "auto")
  const [scriptReady, setScriptReady] = useState(false)
  const [passwordMode, setPasswordMode] = useState(false)
  const initialized = useRef(false)
  const googleButton = useRef<HTMLDivElement>(null)

  const receive = useCallback((data: Access) => {
    if (data.stage === "AUTHENTICATED") {
      if (data.needsProfileSelection) {
        sessionStorage.setItem("roles", JSON.stringify(data.roles ?? []))
        window.location.replace("/select-role")
      } else {
        window.location.replace(({ DOCENTE: "/docente", ADMIN: "/admin", CPPD_MEMBER: "/cppd", CPPD_CENTRAL: "/cppd", EXTERNAL_EVALUATOR: "/avaliador" })[data.selectedRole!] || "/dashboard")
      }
      return
    }
    setAccess(old => ({ ...old, ...data }))
    if (data.campusId) setCampusId(String(data.campusId))
    if (data.profile || data.name) setProfile(old => ({ ...old, ...data.profile,
      name: data.profile?.name || data.name || old.name,
      docenteProfile: { ...old.docenteProfile, ...data.profile?.docenteProfile } }))
  }, [])

  const call = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch(`/api/acesso/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.message || "Não foi possível continuar")
      receive(json.data)
      return json.data as Access
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na comunicação") }
    finally { setBusy(false) }
  }, [receive])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void fetch("/api/acesso/campuses", { cache: "no-store" }).then(response => response.json()).then(json => { if (Array.isArray(json.data)) { setCampuses(json.data); if (json.data.length === 1) setCampusId(String(json.data[0].idCampus)) } }).catch(() => {})
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const invitationToken = fragment.get("convite")
    if (invitationToken) {
      history.replaceState(null, "", "/acesso")
      void call("start", { invitationToken }).then(result => { if (result) { setEmail(result.email); void call("status") } })
    } else {
      // Retoma somente uma tentativa válida; abrir esta tela sem convite é normal.
      void fetch("/api/acesso/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(async response => { if (response.ok) { const json = await response.json(); receive(json.data) } }).catch(() => {})
    }
  }, [call, receive])

  useEffect(() => {
    const google = (window as Window & { google?: GoogleAPI }).google
    if (!scriptReady || !google || !googleButton.current || !access?.clientId || !access.nonce || access.googleVerified) return
    googleButton.current.replaceChildren()
    google.accounts.id.initialize({ client_id: access.clientId, nonce: access.nonce, login_hint: access.email,
      auto_select: false, callback: (response: { credential: string }) => { void call("google", { credential: response.credential }) } })
    google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", text: "continue_with", locale: "pt-BR" })
  }, [scriptReady, access?.clientId, access?.nonce, access?.email, access?.googleVerified, call])

  async function begin(event: FormEvent) {
    event.preventDefault(); setPasswordMode(false); setPassword(""); setCode("")
    const result = await call("start", { email, campusId: Number(campusId) })
    if (result) await call("status")
  }
  async function save(event: FormEvent, pending: boolean) {
    event.preventDefault()
    const payload: Record<string, unknown> = { name: profile.name, cpf: profile.cpf }
    if (password) payload.password = password
    if (access?.roles?.includes("EXTERNAL_EVALUATOR")) {
      for (const key of ["siape", "evaluationCity", "qualification", "institution", "workUnit"] as const) payload[key] = profile[key]
    }
    if (access?.roles?.includes("DOCENTE") && profile.docenteProfile.siape) payload.docenteProfile = profile.docenteProfile
    const result = await call(pending ? "update-pending" : "complete", { profile: payload })
    if (result && pending) setMessage("Dados atualizados para a revisão da CPPD.")
  }
  const field = (key: keyof Omit<Profile, "docenteProfile">, label: string) => <label className="block text-sm" key={key}>
    {label}<FormInput className={`${inputClass} mt-1`} value={profile[key]} required maxLength={key === "cpf" ? 14 : key === "siape" ? 30 : key === "institution" || key === "workUnit" ? 180 : 120}
      onChange={event => setProfile(old => ({ ...old, [key]: event.target.value }))}  fieldKind={String(key) === "cpf" ? "cpf" : String(key) === "siape" ? "siape" : String(key) === "phone" ? "phone" : String(key) === "email" ? "email" : undefined} /></label>
  const pending = access?.stage === "REVIEW" && access.emailVerified
  const registering = access?.stage === "REGISTER" && access.emailVerified

  return <main className="min-h-screen bg-[var(--surface-muted)] px-4 py-10 text-[var(--text-primary)]">
    {access?.googleEnabled && access.clientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)}
      onError={() => setError("O Google não carregou. Tente novamente ou use CPF e senha.")} />}
    <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-[var(--border-subtle)] bg-white p-6 shadow-sm">
      <header><p className="text-sm font-semibold text-[var(--brand)]">SEC-EBTT</p><h1 className="mt-2 text-2xl font-semibold">Acesso autorizado</h1>
<BackButton />
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Use o e-mail do seu cadastro ou convite. O campus define os domínios institucionais aceitos. Avaliadores de outras instituições precisam de convite da CPPD.</p></header>
      {error && null}
      {message && null}
      {!access ? <form onSubmit={begin} className="space-y-4">
        <label className="block text-sm">Campus<FormSelect aria-label="Campus" className={`${inputClass} mt-1`} value={campusId} onChange={event => setCampusId(event.target.value)} required><option value="">Selecione o campus</option>{campuses.map(campus => <option key={campus.idCampus} value={campus.idCampus}>{campus.name}</option>)}</FormSelect></label>
        <label className="block text-sm">E-mail institucional<FormInput className={`${inputClass} mt-1`} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={180}  fieldKind={"email"}  aria-label="E-mail institucional" /></label>
        <ActionButton className={primary} disabled={busy} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{busy ? "Conferindo..." : "Verificar autorização"}</ActionButton>
      </form> : <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] p-3 text-sm"><span className="break-all">{access.email}</span>
          <ActionButton type="button" disabled={busy} className="text-[var(--brand)] underline" onClick={() => { setAccess(null); setError(""); setPassword(""); setCode(""); setPasswordMode(false) }} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Usar outro e-mail</ActionButton></div>
        {pending ? <section className="space-y-3"><h2 className="text-lg font-semibold">Aguardando revisão da CPPD</h2>
          <p className="text-sm">Seu cadastro foi recebido. A CPPD precisa conferir os dados profissionais antes de liberar sua seleção para avaliações.</p>
          <ActionButton type="button" className={primary} disabled={busy} onClick={() => void call("status")} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Consultar situação</ActionButton>
        </section> : <>
          {!access.googleVerified && access.googleEnabled && <section className="space-y-2"><p className="text-sm">No Google, escolha a conta <strong>{access.email}</strong>.</p><div ref={googleButton} aria-label="Continuar com Google" /></section>}
          {access.googleVerified && <p className="text-sm text-emerald-800">Conta Google confirmada.</p>}
          {!access.googleEnabled && <p className="text-sm text-[var(--text-secondary)]">A entrada pelo Google ainda não está habilitada. Você pode concluir o convite com uma senha.</p>}
          {!access.googleVerified && <ActionButton type="button" disabled={busy} className="text-sm text-[var(--brand)] underline" onClick={() => setPasswordMode(true)} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Prefiro usar CPF e senha</ActionButton>}
          {!access.emailVerified && (access.googleVerified || passwordMode) && <section className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
            <h2 className="font-semibold">Confirme seu e-mail</h2><p className="text-sm">Na primeira vinculação, precisamos confirmar também sua caixa de e-mail.</p>
            <ActionButton type="button" disabled={busy} className="text-sm text-[var(--brand)] underline" onClick={() => void call("send-code").then(result => { if (result) setMessage("Código enviado. Confira sua caixa de entrada.") })} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Enviar ou reenviar código</ActionButton>
            <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void call("verify-email", { code }) }}>
              <FormInput className={`${inputClass} max-w-44`} aria-label="Código de seis dígitos" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos"  fieldKind={"code"} />
              <ActionButton className={primary} disabled={busy} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Confirmar</ActionButton>
            </form>
          </section>}
          {access.stage === "READY" && access.emailVerified && !access.googleVerified && passwordMode && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void call("password", { password }) }}>
            <label className="block text-sm">Sua senha<FormInput className={`${inputClass} mt-1`} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required  aria-label="Sua senha" /></label>
            <ActionButton className={primary} disabled={busy} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Entrar</ActionButton>
          </form>}
        </>}
        {(registering || pending) && (access.googleVerified || passwordMode || pending) && <form className="space-y-4 border-t border-[var(--border-subtle)] pt-4" onSubmit={event => void save(event, !!pending)}>
          <h2 className="text-lg font-semibold">{pending ? "Conferir ou corrigir meus dados" : "Concluir cadastro"}</h2>
          {field("name", "Nome completo")}{field("cpf", "CPF")}
          {access.roles?.includes("EXTERNAL_EVALUATOR") && <div className="grid gap-4 sm:grid-cols-2">{field("siape", "SIAPE")}{field("qualification", "Titulação")}{field("institution", "Instituição")}{field("workUnit", "Lotação")}{field("evaluationCity", "Cidade da avaliação")}</div>}
          {access.roles?.includes("DOCENTE") && <fieldset className="space-y-3"><legend className="font-medium">Dados funcionais</legend>
            {([ ["siape", "SIAPE"], ["educationLevel", "Formação"], ["startInterstice", "Início do interstício"] ] as const).map(([key, label]) => <label className="block text-sm" key={key}>{label}
              <FormInput className={`${inputClass} mt-1`} required type={key === "startInterstice" ? "date" : "text"} value={profile.docenteProfile[key]} onChange={event => setProfile(old => ({ ...old, docenteProfile: { ...old.docenteProfile, [key]: event.target.value } }))} /></label>)}
            <label className="block text-sm">Classe e nível<FormSelect className={`${inputClass} mt-1`} required value={profile.docenteProfile.classLevel} onChange={event => setProfile(old => ({ ...old, docenteProfile: { ...old.docenteProfile, classLevel: event.target.value } }))} aria-label="Classe e nível" ><option value="">Selecione</option>{["A1", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1"].map(level => <option key={level}>{level}</option>)}</FormSelect></label>
          </fieldset>}
          {!pending && <label className="block text-sm">{access.googleVerified ? "Senha para CPF e senha (opcional)" : "Defina sua senha"}<FormInput className={`${inputClass} mt-1`} type="password" autoComplete="new-password" required={!access.googleVerified} minLength={8} maxLength={100} value={password} onChange={event => setPassword(event.target.value)} /><span className="mt-1 block text-xs text-[var(--text-secondary)]">Mínimo de oito caracteres.</span></label>}
          <ActionButton className={primary} disabled={busy} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{busy ? "Salvando..." : pending ? "Salvar correções" : "Concluir cadastro"}</ActionButton>
        </form>}
      </>}
      <footer className="border-t border-[var(--border-subtle)] pt-4"><></></footer>
    </div>
  </main>
}
