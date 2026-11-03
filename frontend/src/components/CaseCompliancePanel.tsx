"use client"
import { FormTextarea } from "@/components/ui/FormControls"
import { FormSelect } from "@/components/ui/FormControls"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/systemStyles"
import { useCallback, useEffect, useState, FormEvent } from "react"

type Nominee = { name: string; email: string; phone: string; origin: string; membership: string; doctorateTitle: string; institution: string; federalInstitution: boolean; careerLevel: string; knowledgeArea: string; sameKnowledgeArea: boolean; relatedAreaJustification: string; priorConsentAt: string }
type Data = { evaluationMode?: string; category: string; status: string; financialEffectsAt: string | null; compliance: { performanceFileId?: number; claimedPerformancePoints?: string; performancePoints?: string; performanceApprovedAt?: string; doctorateValidatedAt?: string; nomineesValidatedAt?: string; thesisOriginalityDeclaredAt?: string; simecReference?: string; simecSelectionReference?: string } | null; nominees: Nominee[]; signatures: { idArtifact: number; documentKind: string; memberId: number | null; version: number; signer: string; provider: string; signedAt: string; validatedAt: string | null; rejectedAt: string | null; contentSha256: string }[]; members: { id: number; name: string; result: string; evaluationStatus?: string | null }[]; appeals: { idAppeal: number; stage: string; status: string; decision: string | null; reason: string; submittedAt: string; deadlineAt: string }[]; audits: { idAudit: number; action: string; occurredAt: string; actor?: { idUser: number; name: string } | null }[]; canEdit: boolean; canReview: boolean; documents: string[]; doctorate: { id: number; course: string; countryCode: string } | null }
const labels: Record<string, string> = { APPLICATION: "Requerimento", NOMINEES: "Lista dos sete indicados", CPPD_ELIGIBILITY_OPINION: "Parecer sobre desempenho e doutorado", PRESIDENT_OPINION: "Parecer do presidente", MEMORIAL_DEFENSE_MINUTES: "Ata de reavaliação do memorial", THESIS_DEFENSE_MINUTES: "Ata de defesa da tese", CONSOLIDATED_OPINION: "Parecer consolidado", THESIS_ORIGINALITY: "Declaração de ineditismo", INDIVIDUAL_OPINION: "Parecer individual", CPRSC_DECISION: "Decisão externa da CPRSC" }
const auditLabels: Record<string, string> = { SELECT_DOCTORATE: "Doutorado selecionado", SAVE_NOMINEES: "Lista de indicados registrada", DECLARE_ORIGINALITY: "Ineditismo declarado", SET_PERFORMANCE_CLAIM: "Desempenho apresentado", REVIEW_ELIGIBILITY: "Desempenho e doutorado conferidos", REVIEW_NOMINEES: "Indicados conferidos", SAVE_REFERENCES: "Referências externas registradas", SIGNED_DOCUMENT_UPLOADED: "Nova versão de documento assinado", SIGNATURE_REVIEWED: "Assinatura conferida", DOCUMENT_GENERATED: "Documento gerado", DOCUMENT_VERSION_CREATED: "Nova versão de documento anexado", DOCUMENT_REMOVED: "Documento retirado", SPECIFIC_DOCUMENT_CHANGED: "Documento substituído", DOCTORATE_VERSION_CREATED: "Nova versão de diploma", RSC_APPEAL_SUBMITTED: "Recurso do RSC apresentado", CPRSC_DECISION_RECORDED: "Decisão da CPRSC registrada", SCORE_CHANGED: "Pontuação alterada", EVIDENCE_CHANGED: "Comprovante alterado", INDIVIDUAL_EVALUATION_CHANGED: "Parecer individual alterado" }
const inputClass = fieldClass
const buttonClass = primaryButtonClass
const day = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Não registrado"
function emptyNominee(index: number): Nominee { return { name: "", email: "", phone: "", origin: index < 5 ? "EXTERNAL" : "INTERNAL", membership: index < 3 || index === 5 ? "PRIMARY" : "SUBSTITUTE", doctorateTitle: "", institution: "", federalInstitution: false, careerLevel: "C4", knowledgeArea: "", sameKnowledgeArea: true, relatedAreaJustification: "", priorConsentAt: "" } }
async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/sec-ebtt/${path}`, { method: body ? "POST" : "GET", headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined, cache: "no-store" })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação")
  return payload.data
}

export default function CaseCompliancePanel({ processId, actor, memberId, onChanged }: { processId: number; actor: "DOCENTE" | "CPPD" | "AVALIADOR"; memberId?: number; onChanged?: () => Promise<void> }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useFeedbackState<string>("", "error")
  const [message, setMessage] = useFeedbackState<string>("", "auto")
  const [busy, setBusy] = useState(false)
  const [documentError, setDocumentError] = useFeedbackState<string>("", "error")
  const [documentMessage, setDocumentMessage] = useFeedbackState<string>("", "auto")
  const [generatingDocument, setGeneratingDocument] = useState<string | null>(null)
  const [nominees, setNominees] = useState<Nominee[]>(Array.from({ length: 7 }, (_, i) => emptyNominee(i)))
  const [degrees, setDegrees] = useState<{ idTeacherDegree: number; course: string; degreeType: string }[]>([])
  const [signatureNote, setSignatureNote] = useState("")
  const endpoint = `cases/${processId}`
  const load = useCallback(async () => {
    try {
      const value: Data = await api(`${endpoint}/compliance`)
      setData(value)
      if (value.nominees.length) setNominees(value.nominees.map(n => ({ ...n, sameKnowledgeArea: !n.relatedAreaJustification, priorConsentAt: n.priorConsentAt.slice(0, 10) })))
      if (actor === "DOCENTE") setDegrees(await api("teacher/degrees"))
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar") }
  }, [endpoint, actor])
  useEffect(() => { load() }, [load])
  async function run(path: string, body: unknown) {
    setBusy(true); setError(""); setMessage("")
    try { await api(path, body); await load(); await onChanged?.(); setMessage("Registro salvo com sucesso.") } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar") } finally { setBusy(false) }
  }
  async function generateDocument(kind: string) {
    if (busy) return
    setBusy(true); setDocumentError(""); setDocumentMessage(""); setGeneratingDocument(kind)
    let downloadUrl: string | undefined
    try {
      const response = await fetch(`/api/sec-ebtt/${endpoint}/documents/${kind}`, { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(typeof payload?.message === "string" ? payload.message : "Não foi possível gerar o documento. Tente novamente.")
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error("O servidor não retornou um PDF. Tente novamente.")
      }
      downloadUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `${labels[kind] || "Documento"} - processo ${processId}.pdf`
      document.body.appendChild(link)
      try { link.click() } finally { link.remove() }
      setDocumentMessage(`${labels[kind] || "Documento"} gerado. O download do PDF foi iniciado.`)
      await load()
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : "Não foi possível gerar o documento. Tente novamente.")
    } finally {
      if (downloadUrl) {
        const url = downloadUrl
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
      setBusy(false); setGeneratingDocument(null)
    }
  }
  const save = (body: unknown) => run(`${endpoint}/compliance`, body)
  async function performance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("")
    try { const upload = new FormData(); upload.set("file", form.get("file")!); const file = await api("teacher/evidence", upload); await save({ action: "SET_PERFORMANCE_CLAIM", points: Number(form.get("points")), evidenceFileId: file.idEvidenceFile }) } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha no envio") } finally { setBusy(false) }
  }
  const updateNominee = (index: number, key: keyof Nominee, value: string | boolean) => setNominees(values => values.map((n, i) => i === index ? { ...n, [key]: value } : n))
  if (!data) return <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 text-sm">{error || "Carregando documentos e requisitos..."}</section>
  const opinionsReady = data.members.length === 4 && data.members.every(member => member.evaluationStatus === "SUBMITTED")
  const requiresOpinions = (kind: string) => kind === "CONSOLIDATED_OPINION" || kind === "PRESIDENT_OPINION"
  const signatureReviewHintId = `signature-review-hint-${processId}`
  const signatureReviewBlockedReason = busy
    ? "Aguarde a operação em andamento terminar."
    : !signatureNote.trim()
      ? 'Preencha o campo “Resultado da conferência da assinatura” acima, informando onde e como conferiu a assinatura, para liberar Validar e Recusar.'
      : undefined
  return <section className="space-y-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 text-sm">
    <h2 className="text-base font-semibold">Documentos e requisitos do processo</h2>
    {error && null}{message && null}
    {data.financialEffectsAt && <p>Efeitos financeiros: <strong>{day(data.financialEffectsAt)}</strong></p>}
    {data.category === "FULL_PROFESSOR" && <div className="space-y-2">
      <p>Desempenho: {data.compliance?.performanceApprovedAt ? `aprovado com ${data.compliance.performancePoints} pontos` : "aguarda conferência da CPPD"}. Doutorado: {data.compliance?.doctorateValidatedAt ? "validado" : "aguarda conferência"}. Indicados: {data.compliance?.nomineesValidatedAt ? "validados" : `${data.nominees.length} de 7 cadastrados`}.</p>
      {data.compliance?.performanceFileId && <a className="underline" target="_blank" rel="noreferrer" href={`/api/sec-ebtt/${endpoint}/files/${data.compliance.performanceFileId}`}>Abrir avaliação de desempenho</a>}
      {data.canEdit && <>
        <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><summary className="cursor-pointer font-medium">Avaliação de desempenho e diploma</summary>
          <form onSubmit={performance} className="my-3 grid gap-3"><label className="block space-y-1 text-sm">Pontuação da avaliação de desempenho<FormInput name="points" type="number" min="120" step="0.01" defaultValue={data.compliance?.claimedPerformancePoints} required className={inputClass} aria-label="Pontuação da avaliação de desempenho" /></label><label className="block space-y-1 text-sm">Formulário e comprovantes da avaliação em PDF<FormInput name="file" type="file" accept="application/pdf" required className={inputClass} aria-label="Formulário e comprovantes da avaliação em PDF" /></label><ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Salvar desempenho</ActionButton></form>
          <p>Doutorado selecionado: {data.doctorate?.course || "Nenhum"}. Cadastre suas titulações no perfil para reutilizar o diploma.</p>
          <FormSelect aria-label="Selecionar diploma de doutorado" className={inputClass} defaultValue="" onChange={event => { if (event.target.value) save({ action: "SELECT_DOCTORATE", degreeId: Number(event.target.value) }) }}><option value="">Escolher doutorado cadastrado</option>{degrees.filter(d => ["DOCTORATE", "DOUTORADO"].includes(d.degreeType)).map(d => <option key={d.idTeacherDegree} value={d.idTeacherDegree}>{d.course}</option>)}</FormSelect>
          {data.evaluationMode === "THESIS" && <ActionButton disabled={busy} className={`${buttonClass} mt-3`} onClick={() => save({ action: "DECLARE_ORIGINALITY", accepted: true })} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{data.compliance?.thesisOriginalityDeclaredAt ? "Ineditismo declarado" : "Declarar que a tese apresentada é inédita"}</ActionButton>}
        </details>
        <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><summary className="cursor-pointer font-medium">Cadastrar os sete indicados da Comissão Especial</summary>
          <p className="my-3">Informe três externos titulares, dois externos suplentes, um interno titular e um interno suplente. Todos devem ter ciência da indicação.</p>
          <form onSubmit={event => { event.preventDefault(); save({ action: "SAVE_NOMINEES", nominees }) }} className="space-y-4">
            {nominees.map((n, index) => <fieldset key={index} className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:grid-cols-2"><legend>{index + 1}. {n.origin === "INTERNAL" ? "Interno" : "Externo"} {n.membership === "PRIMARY" ? "titular" : "suplente"}</legend>
              {([['name','Nome completo'],['email','E-mail'],['phone','Telefone'],['doctorateTitle','Título de doutorado'],['institution','Instituição'],['knowledgeArea','Área de conhecimento']] as [keyof Nominee,string][]).map(([key,label]) => <label key={key}>{label}<FormInput required className={inputClass} type={key === "email" ? "email" : "text"} value={String(n[key])} onChange={event => updateNominee(index,key,event.target.value)} fieldKind={String(key) === "cpf" ? "cpf" : String(key) === "siape" ? "siape" : String(key) === "phone" ? "phone" : String(key) === "email" ? "email" : undefined} /></label>)}
              <label className="block space-y-1 text-sm">Posição na carreira<FormSelect className={inputClass} value={n.careerLevel} onChange={event => updateNominee(index,"careerLevel",event.target.value)} aria-label="Posição na carreira" ><option value="C4">C4</option><option value="D1">Titular</option><option value="EQUIVALENT_TITULAR">Equivalente ou superior a Titular</option></FormSelect></label>
              <label className="block space-y-1 text-sm">Data da ciência prévia<FormInput required className={inputClass} type="date" value={n.priorConsentAt} onChange={event => updateNominee(index,"priorConsentAt",event.target.value)} aria-label="Data da ciência prévia" /></label>
              <label className="block space-y-1 text-sm"><FormInput type="checkbox" required checked={n.federalInstitution} onChange={event => updateNominee(index,"federalInstitution",event.target.checked)} aria-label="Vinculado a instituição federal de ensino" /> Vinculado a instituição federal de ensino</label>
              <label className="block space-y-1 text-sm"><FormInput type="checkbox" checked={n.sameKnowledgeArea} onChange={event => updateNominee(index,"sameKnowledgeArea",event.target.checked)} aria-label="Mesma área de conhecimento do requerente" /> Mesma área de conhecimento do requerente</label>
              {!n.sameKnowledgeArea && <label className="sm:col-span-2">Justificativa da área afim<FormTextarea required className={inputClass} value={n.relatedAreaJustification || ""} onChange={event => updateNominee(index,"relatedAreaJustification",event.target.value)} aria-label="Justificativa da área afim" /></label>}
            </fieldset>)}<ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Salvar lista de indicados</ActionButton>
          </form>
        </details>
      </>}
      {data.canReview && <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4" open><summary className="cursor-pointer font-medium">Análise prévia da CPPD</summary><form className="my-3 space-y-3" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); save({ action: "REVIEW_ELIGIBILITY", points: Number(f.get("points")), requirementsMetAt: f.get("date"), opinion: f.get("opinion"), doctorateApproved: f.get("degree") === "on" }) }}>
        <label className="block space-y-1 text-sm">Pontuação reconhecida<FormInput name="points" className={inputClass} type="number" min="120" step="0.01" required aria-label="Pontuação reconhecida" /></label><label className="block space-y-1 text-sm">Data de cumprimento dos requisitos de desempenho<FormInput name="date" className={inputClass} type="date" required aria-label="Data de cumprimento dos requisitos de desempenho" /></label><label className="block space-y-1 text-sm">Parecer fundamentado<FormTextarea name="opinion" className={inputClass} required aria-label="Parecer fundamentado" /></label><label className="block"><FormInput type="checkbox" name="degree" required aria-label="Conferi o diploma e seu reconhecimento nacional, quando aplicável" /> Conferi o diploma e seu reconhecimento nacional, quando aplicável</label><ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Aprovar desempenho e doutorado</ActionButton>
      </form><ActionButton disabled={busy || data.nominees.length !== 7} className={buttonClass} onClick={() => save({ action: "REVIEW_NOMINEES", confirmed: true })} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : (data.nominees.length !== 7) ? "Cadastre os sete indicados antes de confirmar a conferência." : "Este controle está indisponível na etapa atual."} >Confirmar conferência dos sete indicados e sua elegibilidade</ActionButton></details>}
    </div>}
    {data.category === "RSC" && (data.canEdit || data.canReview) && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); save({ action: "SAVE_REFERENCES", simecReference: f.get("reference"), simecSelectionReference: f.get("selection") }) }}><label className="block space-y-1 text-sm">Referência do cadastro no SIMEC<FormInput name="reference" className={inputClass} defaultValue={data.compliance?.simecReference || ""} aria-label="Referência do cadastro no SIMEC" /></label><label className="block space-y-1 text-sm">Referência do sorteio dos avaliadores no SIMEC<FormInput name="selection" className={inputClass} defaultValue={data.compliance?.simecSelectionReference || ""} aria-label="Referência do sorteio dos avaliadores no SIMEC" /></label><ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Salvar referências</ActionButton></form>}
    <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><summary className="cursor-pointer font-medium">Gerar documentos para conferência e assinatura</summary>
      <div className="mt-3 flex flex-wrap gap-3">{data.documents.filter(kind => labels[kind]).map(kind => <ActionButton type="button" className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} key={kind} disabled={busy || (requiresOpinions(kind) && !opinionsReady)} aria-describedby={requiresOpinions(kind) && !opinionsReady ? `document-opinions-${processId}` : undefined} onClick={() => void generateDocument(kind)} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : ((requiresOpinions(kind) && !opinionsReady)) ? "Aguarde o envio dos quatro pareceres individuais da comissão." : "Este controle está indisponível na etapa atual."} >{generatingDocument === kind ? "Gerando..." : labels[kind]}</ActionButton>)}</div>
      {documentError && null}
      {documentMessage && null}
      {!opinionsReady && data.documents.some(requiresOpinions) && <p id={`document-opinions-${processId}`} className="mt-3 text-[var(--text-secondary)]">Aguarde o envio dos quatro pareceres individuais da comissão para gerar o parecer consolidado{data.documents.includes("PRESIDENT_OPINION") ? " ou o parecer do presidente" : ""}.</p>}
    </details>
    <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><summary className="cursor-pointer font-medium">Documentos assinados e conferência</summary><p className="my-3">Assine na plataforma institucional e envie o PDF. A CPPD confere a assinatura e registra o resultado.</p>
      {(!['APPROVED','FINALIZED','REJECTED'].includes(data.status) || data.appeals.some(a => a.stage === 'CPRSC' && a.status === 'SUBMITTED')) && (actor !== 'DOCENTE' || data.evaluationMode === 'THESIS') && <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); run(`${endpoint}/signatures`, f) }}>
        <label className="block space-y-1 text-sm">Documento<FormSelect name="documentKind" defaultValue={actor === "AVALIADOR" ? "INDIVIDUAL_OPINION" : actor === "DOCENTE" ? "THESIS_ORIGINALITY" : "CONSOLIDATED_OPINION"} className={inputClass} aria-label="Documento" >{Object.entries(labels).filter(([key]) => !['APPLICATION','NOMINEES'].includes(key) && (actor === 'CPPD' || (actor === 'AVALIADOR' ? key === 'INDIVIDUAL_OPINION' : key === 'THESIS_ORIGINALITY'))).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</FormSelect></label>
        <label className="block space-y-1 text-sm">Avaliador do parecer individual<FormSelect name="memberId" defaultValue={memberId || ""} className={inputClass} aria-label="Avaliador do parecer individual" ><option value="">Não se aplica</option>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</FormSelect></label>
        <label className="block space-y-1 text-sm">Signatário<FormInput name="signer" className={inputClass} required aria-label="Signatário" /></label><label className="block space-y-1 text-sm">Plataforma de assinatura<FormInput name="provider" className={inputClass} placeholder="Gov.br, SIPAC ou outra" required aria-label="Plataforma de assinatura" /></label><label className="block space-y-1 text-sm">Data da assinatura<FormInput name="signedAt" type="date" className={inputClass} required aria-label="Data da assinatura" /></label><label className="block space-y-1 text-sm">PDF assinado<FormInput name="file" type="file" accept="application/pdf" className={inputClass} required aria-label="PDF assinado" /></label><ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Enviar documento assinado</ActionButton>
      </form>}
      {actor === "CPPD" && <div className="my-3 space-y-1">
        <label className="block">Resultado da conferência da assinatura (obrigatório)<FormTextarea className={inputClass} value={signatureNote} onChange={event => setSignatureNote(event.target.value)} placeholder="Registre onde e como conferiu a assinatura" aria-describedby={signatureReviewHintId} aria-label="Resultado da conferência da assinatura (obrigatório)" /></label>
        <p id={signatureReviewHintId} className="text-[var(--text-secondary)]">{signatureReviewBlockedReason || "Conferência preenchida. Você já pode validar ou recusar o documento correspondente."}</p>
      </div>}
      <ul className="mt-3 space-y-3">{data.signatures.map(s => <li key={s.idArtifact} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><a className="underline" href={`/api/sec-ebtt/${endpoint}/signatures/${s.idArtifact}/file`} target="_blank" rel="noreferrer">{labels[s.documentKind] || s.documentKind}, versão {s.version}</a><p>{s.signer} · {s.provider} · {day(s.signedAt)} · {s.validatedAt ? "Validado" : s.rejectedAt ? "Recusado" : "Aguardando conferência"}</p>{actor === "CPPD" && !s.validatedAt && !s.rejectedAt && <div className="mt-3 flex flex-wrap gap-3">
        {([{ label: "Validar", approved: true, className: buttonClass }, { label: "Recusar", approved: false, className: secondaryButtonClass }]).map(action => <span
          key={action.label}
          className={signatureReviewBlockedReason ? "inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--input-border-focus)] cursor-not-allowed" : "inline-flex"}
          title={signatureReviewBlockedReason}
          tabIndex={signatureReviewBlockedReason ? 0 : undefined}
          role={signatureReviewBlockedReason ? "group" : undefined}
          aria-label={signatureReviewBlockedReason ? `${action.label} indisponível` : undefined}
          aria-describedby={signatureReviewBlockedReason ? signatureReviewHintId : undefined}
        ><ActionButton type="button" disabled={!!signatureReviewBlockedReason} aria-describedby={signatureReviewHintId} className={`${action.className} disabled:pointer-events-none`} onClick={() => run(`${endpoint}/signatures/${s.idArtifact}/validate`, { approved: action.approved, note: signatureNote })} disabledReason={(!!signatureReviewBlockedReason) ? signatureReviewBlockedReason : "Este controle está indisponível na etapa atual."} >{action.label}</ActionButton></span>)}
      </div>}</li>)}</ul>
    </details>
    {data.category === "RSC" && <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><summary className="cursor-pointer font-medium">Recursos do RSC</summary><p className="my-3">O recurso à CPPD deve ser apresentado em até 45 dias, com nova comissão e sem novas provas. Persistindo o indeferimento, o recurso final à CPRSC tem prazo de dez dias.</p>
      {actor === "DOCENTE" && data.status === "REJECTED" && !data.appeals.some(a => a.status === "SUBMITTED") && <form onSubmit={event => { event.preventDefault(); const f=new FormData(event.currentTarget); run(`${endpoint}/appeals`, { stage: data.appeals.some(a => a.stage === "CPPD") ? "CPRSC" : "CPPD", reason: f.get("reason") }) }} className="space-y-3"><label className="block space-y-1 text-sm">Fundamentos do recurso<FormTextarea required name="reason" className={inputClass} aria-label="Fundamentos do recurso" /></label><ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Apresentar recurso</ActionButton></form>}
      {data.appeals.map(a => <div className="my-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4" key={a.idAppeal}><p>Recurso à {a.stage}, apresentado em {day(a.submittedAt)}. {a.decision === "APPROVED" ? "Deferido" : a.decision === "REJECTED" ? "Indeferido" : "Em andamento"}.</p><p>{a.reason}</p>{actor === "CPPD" && a.stage === "CPRSC" && a.status === "SUBMITTED" && <form className="space-y-3" onSubmit={event => { event.preventDefault(); const f=new FormData(event.currentTarget); run(`${endpoint}/appeals/${a.idAppeal}/decision`, { decision: f.get("decision"), decisionText: f.get("text"), externalReference: f.get("reference") }) }}><label className="block space-y-1 text-sm">Resultado da CPRSC<FormSelect name="decision" className={inputClass} aria-label="Resultado da CPRSC" ><option value="APPROVED">Deferido</option><option value="REJECTED">Indeferido</option></FormSelect></label><label className="block space-y-1 text-sm">Referência do ato externo<FormInput required name="reference" className={inputClass} aria-label="Referência do ato externo" /></label><label className="block space-y-1 text-sm">Decisão fundamentada<FormTextarea required name="text" className={inputClass} aria-label="Decisão fundamentada" /></label><ActionButton disabled={busy} className={buttonClass} disabledReason={(busy) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >Registrar decisão externa pela CPPD Central</ActionButton></form>}</div>)}
    </details>}
    <details><summary className="cursor-pointer">Histórico documental</summary><ul className="mt-3 space-y-3">{data.audits.map(a => <li key={a.idAudit} className="border-l-2 border-[var(--border-subtle)] pl-3"><p className="font-medium">{auditLabels[a.action] || "Registro de atualização do processo"}</p><p className="text-xs text-[var(--text-secondary)]">{new Date(a.occurredAt).toLocaleString("pt-BR")} · Responsável: {a.actor?.name || "Não identificado no registro antigo"}</p></li>)}</ul></details>
  </section>
}
