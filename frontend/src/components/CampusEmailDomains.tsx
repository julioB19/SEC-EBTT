"use client"
import { FormSelect } from "@/components/ui/FormControls"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"
import { FormEvent, useEffect, useState } from "react"

type Campus = { idCampus: number; name: string }
type Domain = { id: string; domain: string; active: boolean; includeSubdomains: boolean }
const input = "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm"
const button = "rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm disabled:opacity-50"
export function CampusEmailDomains() {
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [campusId, setCampusId] = useState("")
  const [domains, setDomains] = useState<Domain[]>([])
  const [domain, setDomain] = useState("")
  const [includeSubdomains, setIncludeSubdomains] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useFeedbackState<string>("", "error")
  const [message, setMessage] = useFeedbackState<string>("", "auto")
  async function read(url: string) { const response = await fetch(url, { cache: "no-store" }); const json = await response.json(); if (!response.ok) throw new Error(json.message || "Não foi possível consultar"); return json.data }
  useEffect(() => { void read("/api/acesso/campus-policy/campuses").then((rows: Campus[]) => { setCampuses(rows); if (rows.length === 1) setCampusId(String(rows[0].idCampus)) }).catch(reason => setError(reason.message)) }, [])
  useEffect(() => { setDomains([]); if (campusId) void read(`/api/acesso/campus-policy/${campusId}/domains`).then(setDomains).catch(reason => setError(reason.message)) }, [campusId])
  async function save(path: string, body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("")
    try { const response = await fetch(`/api/acesso/campus-policy/${campusId}/domains${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const json = await response.json(); if (!response.ok) throw new Error(json.message || "Não foi possível salvar"); setDomains(await read(`/api/acesso/campus-policy/${campusId}/domains`)); setMessage("Configuração salva para este campus."); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na comunicação"); return false } finally { setBusy(false) }
  }
  async function add(event: FormEvent) { event.preventDefault(); if (await save("", { domain, includeSubdomains })) setDomain("") }
  return <div className="mx-auto max-w-4xl space-y-5 text-[var(--text-primary)]">
    <header><h1 className="text-2xl font-semibold">E-mails institucionais por campus</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">Defina os domínios aceitos para cadastro e acesso neste campus. O mesmo domínio pode ser cadastrado por mais de um campus.</p></header>
    {error && null}{message && null}
    <label className="block text-sm">Campus<FormSelect aria-label="Campus" className={input} value={campusId} onChange={event => { setCampusId(event.target.value); setError(""); setMessage("") }}><option value="">Selecione o campus</option>{campuses.map(campus => <option key={campus.idCampus} value={campus.idCampus}>{campus.name}</option>)}</FormSelect></label>
    {campusId && <><form className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-white p-5" onSubmit={add}><h2 className="font-semibold">Adicionar domínio</h2>
      <label className="block text-sm">Domínio, sem @<FormInput className={input} value={domain} onChange={event => setDomain(event.target.value)} required placeholder="iffarroupilha.edu.br" maxLength={253}  aria-label="Domínio, sem @" /></label>
      <label className="flex items-center gap-2 text-sm"><FormInput type="checkbox" checked={includeSubdomains} onChange={event => setIncludeSubdomains(event.target.checked)}  aria-label="Aceitar também subdomínios" />Aceitar também subdomínios</label>
      <p className="text-xs text-[var(--text-secondary)]">Por exemplo, cadastrar iffar.edu.br com subdomínios também permite aluno.iffar.edu.br. Não permite iffar.edu.br.outro.com.</p>
      <ActionButton className={button} disabled={busy} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Adicionar domínio</ActionButton></form>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Domínios deste campus</h2>{!domains.length && <p className="rounded-xl bg-amber-50 p-3 text-sm">Nenhum domínio configurado. Cadastre ao menos um para liberar novos cadastros institucionais deste campus.</p>}
      {domains.map(rule => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-4"><div><strong className="break-all text-sm">{rule.domain}</strong><p className="text-xs text-[var(--text-secondary)]">{rule.active ? "Ativo" : "Inativo"} · {rule.includeSubdomains ? "Inclui subdomínios" : "Somente este domínio"}</p></div><div className="flex flex-wrap gap-2"><ActionButton className={button} disabled={busy} onClick={() => void save(`/${rule.id}`, { includeSubdomains: !rule.includeSubdomains })} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{rule.includeSubdomains ? "Usar somente domínio exato" : "Permitir subdomínios"}</ActionButton><ActionButton className={button} disabled={busy} onClick={() => void save(`/${rule.id}`, { active: !rule.active })} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{rule.active ? "Inativar" : "Ativar"}</ActionButton></div></div>)}</section>
      <p className="text-sm text-[var(--text-secondary)]">O domínio não identifica sozinho o campus nem concede perfis de CPPD ou administração. Avaliadores externos de outras instituições continuam dependendo de convite individual. Inativar uma regra bloqueia novos cadastros e novos acessos Google por ela; o login existente por CPF e senha é preservado.</p></>}
  </div>
}
