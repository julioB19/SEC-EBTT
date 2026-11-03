"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import ActionButton from "@/components/ui/ActionButton"
import FormInput from "@/components/ui/FormInput"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/systemStyles"

type SignedOpinion = {
  idArtifact: number
  memberId: number | null
  documentKind: string
  version: number
  signer: string
  provider: string
  signedAt: string
  validatedAt: string | null
  rejectedAt: string | null
  validationNote?: string | null
}

type OpinionContext = {
  status: string
  category: string
  compliance: { performanceFileId?: number | null } | null
  members: { id: number; name: string }[]
  signatures: SignedOpinion[]
}

type Props = {
  processId: number
  memberId: number
  evaluationStatus: string
}

const sectionClass = "space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5"
const day = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" })

export default function EvaluatorOpinionSteps({ processId, memberId, evaluationStatus }: Props) {
  const [context, setContext] = useState<OpinionContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useFeedbackState<string>("", "error")
  const [message, setMessage] = useFeedbackState<string>("", "auto")
  const [downloadError, setDownloadError] = useFeedbackState<string>("", "error")
  const endpoint = `/api/sec-ebtt/cases/${processId}`

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${endpoint}/compliance`, { credentials: "include", cache: "no-store", signal })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.data) throw new Error(payload?.message || "Não foi possível consultar a situação do parecer assinado.")
    if (!signal?.aborted) setContext(payload.data)
  }, [endpoint])

  useEffect(() => {
    setContext(null); setLoading(true); setError(""); setMessage(""); setDownloadError("")
    const controller = new AbortController()
    void load(controller.signal).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha ao consultar o parecer assinado.")
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [load, memberId, evaluationStatus])

  const submitted = evaluationStatus === "SUBMITTED"
  const member = context?.members.find(value => value.id === memberId)
  const opinions = (context?.signatures ?? [])
    .filter(value => value.documentKind === "INDIVIDUAL_OPINION" && value.memberId === memberId)
    .sort((a, b) => b.version - a.version)
  const latest = opinions[0]
  const processClosed = context ? ["APPROVED", "REJECTED", "FINALIZED"].includes(context.status) : false
  const canUpload = submitted && !!member && !processClosed && (!latest || !!latest.rejectedAt)

  async function downloadOpinion() {
    if (!submitted || downloading) return
    setDownloading(true); setDownloadError("")
    let url: string | undefined
    try {
      const response = await fetch(`/api/avaliador/avaliacoes/${memberId}/parecer`, { credentials: "include", cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Não foi possível baixar seu parecer. Tente novamente.")
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("O servidor não retornou o PDF do parecer.")
      url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = `Parecer individual - processo ${processId} - avaliador ${memberId}.pdf`
      document.body.appendChild(link)
      try { link.click() } finally { link.remove() }
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : "Não foi possível baixar o parecer.")
    } finally {
      if (url) { const objectUrl = url; setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000) }
      setDownloading(false)
    }
  }

  async function uploadOpinion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canUpload || !member || uploading) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const file = form.get("file")
    if (!(file instanceof File) || !file.size) { setError("Selecione o PDF assinado."); return }
    if (file.size > 20 * 1024 * 1024) { setError("O PDF assinado deve ter até 20 MB."); return }
    form.set("documentKind", "INDIVIDUAL_OPINION")
    form.set("memberId", String(memberId))
    form.set("signer", member.name)
    setUploading(true); setError(""); setMessage("")
    try {
      const response = await fetch(`${endpoint}/signatures`, { method: "POST", credentials: "include", body: form })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.message || "Não foi possível enviar o parecer assinado.")
      await load()
      formElement.reset()
      setMessage("Parecer assinado enviado. Aguarde a conferência da CPPD.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o parecer assinado.")
    } finally { setUploading(false) }
  }

  return <>
    {context?.category === "FULL_PROFESSOR" && context.compliance?.performanceFileId && <aside className={sectionClass}>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Documento adicional para análise</h2>
      <a className="text-sm underline" href={`${endpoint}/files/${context.compliance.performanceFileId}`} target="_blank" rel="noreferrer">Consultar avaliação de desempenho do docente</a>
    </aside>}

    <section className={sectionClass} aria-labelledby="opinion-download-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="opinion-download-title" className="text-base font-semibold text-[var(--text-primary)]">2. Baixar e assinar meu parecer</h2>
        <span className="text-xs text-[var(--text-secondary)]">{submitted ? "Disponível" : "Aguardando envio da avaliação"}</span>
      </div>
      {submitted ? <p className="text-sm text-[var(--text-secondary)]">Baixe seu parecer em PDF e assine na plataforma institucional. Depois, envie o arquivo assinado na próxima etapa.</p>
        : <p className="text-sm text-[var(--text-secondary)]">Disponível após enviar sua avaliação na etapa 1. Salvar o rascunho ainda não libera o PDF para assinatura.</p>}
      <ActionButton type="button" disabled={!submitted || downloading} onClick={() => void downloadOpinion()} className={secondaryButtonClass} disabledReason={(!submitted) ? "Envie sua avaliação antes de baixar o parecer para assinatura." : (downloading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
        {downloading ? "Baixando..." : "Baixar meu parecer em PDF"}
      </ActionButton>
      {downloadError && null}
    </section>

    <section className={sectionClass} aria-labelledby="opinion-upload-title">
      <h2 id="opinion-upload-title" className="text-base font-semibold text-[var(--text-primary)]">3. Enviar meu parecer assinado</h2>
      {!submitted && <p className="text-sm text-[var(--text-secondary)]">Primeiro envie sua avaliação e baixe o parecer na etapa 2. Depois de assiná-lo, você poderá anexar o PDF aqui.</p>}
      {loading && <p role="status" className="text-sm text-[var(--text-secondary)]">Consultando a situação do parecer assinado...</p>}
      {error && null}
      {!context && !loading && error && <button type="button" className={secondaryButtonClass} onClick={() => {
        setLoading(true); setError("")
        void load().catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível consultar a situação."))
          .finally(() => setLoading(false))
      }}>Consultar situação novamente</button>}
      {message && null}
      {submitted && member && <p className="text-sm text-[var(--text-secondary)]">Parecer individual de <strong>{member.name}</strong>. O documento será vinculado automaticamente à sua avaliação.</p>}
      {submitted && latest && <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted-bg)] p-4 text-sm">
        <p className={`font-semibold ${latest.validatedAt ? "text-emerald-700" : latest.rejectedAt ? "text-red-700" : "text-amber-700"}`}>
          {latest.validatedAt ? "Assinatura validada pela CPPD" : latest.rejectedAt ? "Correção solicitada pela CPPD" : "Aguardando conferência da CPPD"}
        </p>
        <a className="underline" href={`${endpoint}/signatures/${latest.idArtifact}/file`} target="_blank" rel="noreferrer">Abrir meu parecer assinado - versão {latest.version}</a>
        <p>{latest.signer} · {latest.provider} · assinatura em {day(latest.signedAt)}</p>
        {latest.validationNote && <p>Conferência da CPPD: {latest.validationNote}</p>}
      </div>}
      {submitted && !loading && !member && !error && <p role="alert" className="text-sm text-red-700">Não foi possível identificar seu vínculo com a comissão. Atualize a página antes de enviar o documento.</p>}
      {submitted && processClosed && <p className="text-sm text-[var(--text-secondary)]">O processo está concluído. Os documentos permanecem disponíveis para consulta.</p>}
      {canUpload && <form onSubmit={uploadOpinion} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[var(--text-primary)]">Plataforma de assinatura
          <FormInput name="provider" className={`${fieldClass} mt-1`} placeholder="Gov.br, SIPAC ou outra" required maxLength={80} disabled={uploading}  disabledReason={(uploading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Plataforma de assinatura" />
        </label>
        <label className="block text-sm font-medium text-[var(--text-primary)]">Data da assinatura
          <FormInput name="signedAt" type="date" className={`${fieldClass} mt-1`} required disabled={uploading}  disabledReason={(uploading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="Data da assinatura" />
        </label>
        <label className="block text-sm font-medium text-[var(--text-primary)] sm:col-span-2">PDF assinado
          <FormInput name="file" type="file" accept=".pdf,application/pdf" className={`${fieldClass} mt-1`} required disabled={uploading}  disabledReason={(uploading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."}  aria-label="PDF assinado" />
          <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">Envie o PDF resultante da assinatura, com até 20 MB. A CPPD fará a conferência.</span>
        </label>
        <ActionButton type="submit" disabled={uploading} className={`${primaryButtonClass} sm:col-span-2`} disabledReason={(uploading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >{uploading ? "Enviando..." : latest?.rejectedAt ? "Reenviar meu parecer assinado" : "Enviar meu parecer assinado"}</ActionButton>
      </form>}
      {submitted && opinions.length > 1 && <details className="text-sm">
        <summary className="cursor-pointer font-medium">Versões anteriores do meu parecer assinado</summary>
        <ul className="mt-2 space-y-2">{opinions.slice(1).map(opinion => <li key={opinion.idArtifact}>
          <a className="underline" href={`${endpoint}/signatures/${opinion.idArtifact}/file`} target="_blank" rel="noreferrer">Versão {opinion.version}</a>
          {` · ${day(opinion.signedAt)} · ${opinion.validatedAt ? "Validada" : opinion.rejectedAt ? "Recusada" : "Aguardando conferência"}`}
        </li>)}</ul>
      </details>}
    </section>
  </>
}
