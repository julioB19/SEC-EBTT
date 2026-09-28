"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { FormEvent, useCallback, useEffect, useState } from "react"
import ConfirmModal from "@/components/ConfirmModal"

type GeccStatus = "DRAFT" | "PENDING_DOCUMENTS" | "READY_TO_SEND" | "SENT_TO_CGP" | "COMPLETED" | "CANCELED"
type InterestedType = "INTERNAL_EVALUATOR" | "EXTERNAL_EVALUATOR" | "CPPD_UNIT" | "OTHER"
type EvidenceFile = { idEvidenceFile: number; originalName: string; mimeType: string | null; sizeBytes: number | null }

type GeccData = {
  process: {
    idProcess: number
    status: string
    processTypeName: string
    teacherName: string
    teacherSiape: string | null
    campus: string
    cityState: string
  }
  gecc: {
    idProcessGecc: number
    externalNumber: string | null
    status: GeccStatus
    sentToCgpAt: string | null
    checklistFile: EvidenceFile | null
    interestedPeople: Array<{
      personId: number
      type: InterestedType
      informedEmail: string | null
      name: string
      email: string | null
    }>
    documents: Array<{
      idGeccDocument: number
      personId: number | null
      personName: string | null
      documentType: string
      receivedAt: string | null
      file: EvidenceFile | null
    }>
  }
}

type ApiResponse<T> = { status: string; message: string; data: T | null }

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--input-border-focus)] disabled:bg-[var(--surface-muted-bg)] disabled:opacity-80"

function statusLabel(status: GeccStatus) {
  if (status === "PENDING_DOCUMENTS") return "Documentação pendente"
  if (status === "READY_TO_SEND") return "Pronto para envio"
  if (status === "SENT_TO_CGP") return "Enviado à CGP"
  if (status === "COMPLETED") return "Concluído"
  if (status === "CANCELED") return "Cancelado"
  return "Rascunho"
}

function interestedTypeLabel(type: InterestedType) {
  if (type === "INTERNAL_EVALUATOR") return "Avaliador interno"
  if (type === "EXTERNAL_EVALUATOR") return "Avaliador externo"
  if (type === "CPPD_UNIT") return "Unidade CPPD"
  return "Outro"
}

export default function GeccPage() {
  const params = useParams<{ id: string }>()
  const processId = Number(params.id)
  const [data, setData] = useState<GeccData | null>(null)
  const [externalNumber, setExternalNumber] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [interestedType, setInterestedType] = useState<InterestedType>("EXTERNAL_EVALUATOR")
  const [documentType, setDocumentType] = useState("")
  const [documentPersonId, setDocumentPersonId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<"SENT_TO_CGP" | "COMPLETED" | null>(null)

  const applyData = useCallback((next: GeccData) => {
    setData(next)
    setExternalNumber(next.gecc.externalNumber ?? "")
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/cppd/processos/${processId}/gecc`, { credentials: "include", cache: "no-store" })
      const payload = (await response.json().catch(() => null)) as ApiResponse<GeccData> | null
      if (!response.ok || !payload?.data) {
        setError(payload?.message ?? "Não foi possível carregar o GECC.")
        return
      }
      applyData(payload.data)
    } catch {
      setError("Não foi possível carregar o GECC.")
    } finally {
      setLoading(false)
    }
  }, [applyData, processId])

  useEffect(() => {
    if (Number.isInteger(processId) && processId > 0) load()
  }, [load, processId])

  async function jsonMutation(url: string, init: RequestInit, success: string) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(url, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<GeccData> | null
      if (!response.ok || !payload?.data) {
        setError(payload?.message ?? "Não foi possível concluir a operação.")
        return false
      }
      applyData(payload.data)
      setMessage(success)
      return true
    } catch {
      setError("Não foi possível concluir a operação.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault()
    await jsonMutation(
      `/api/cppd/processos/${processId}/gecc`,
      { method: "PUT", body: JSON.stringify({ externalNumber: externalNumber.trim() || null }) },
      "Número externo salvo."
    )
  }

  async function addInterested(event: FormEvent) {
    event.preventDefault()
    const saved = await jsonMutation(
      `/api/cppd/processos/${processId}/gecc/interessados`,
      { method: "POST", body: JSON.stringify({ name, email, type: interestedType }) },
      "Interessado adicionado."
    )
    if (saved) {
      setName("")
      setEmail("")
    }
  }

  async function removeInterested(personId: number, type: InterestedType) {
    await jsonMutation(
      `/api/cppd/processos/${processId}/gecc/interessados/${personId}/${type}`,
      { method: "DELETE" },
      "Interessado removido."
    )
  }

  async function uploadDocument(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError("Selecione um arquivo.")
      return
    }
    const formData = new FormData()
    formData.append("file", file)
    formData.append("documentType", documentType.trim())
    if (documentPersonId) formData.append("personId", documentPersonId)

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/cppd/processos/${processId}/gecc/documentos`, {
        method: "POST",
        credentials: "include",
        body: formData
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse<GeccData> | null
      if (!response.ok || !payload?.data) {
        setError(payload?.message ?? "Não foi possível anexar o documento.")
        return
      }
      applyData(payload.data)
      setDocumentType("")
      setDocumentPersonId("")
      setFile(null)
      setMessage("Documento anexado.")
    } catch {
      setError("Não foi possível anexar o documento.")
    } finally {
      setBusy(false)
    }
  }

  async function removeDocument(documentId: number) {
    await jsonMutation(
      `/api/cppd/processos/${processId}/gecc/documentos/${documentId}`,
      { method: "DELETE" },
      "Documento removido."
    )
  }

  async function generateChecklist() {
    await jsonMutation(
      `/api/cppd/processos/${processId}/gecc/checklist`,
      { method: "POST" },
      "Checklist PDF gerado."
    )
  }

  async function updateStatus(status: "READY_TO_SEND" | "SENT_TO_CGP" | "COMPLETED") {
    await jsonMutation(
      `/api/cppd/processos/${processId}/gecc/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      status === "READY_TO_SEND"
        ? "Organização marcada como pronta."
        : status === "SENT_TO_CGP"
          ? "Envio manual à CGP registrado."
          : "GECC concluído e processo finalizado."
    )
    setPendingStatus(null)
  }

  function fileUrl(evidenceFileId: number) {
    return `/api/cppd/processos/${processId}/gecc/documentos/conteudo/${evidenceFileId}`
  }

  if (loading) return <p className="px-4 py-8 text-sm text-[var(--text-secondary)]">Carregando GECC...</p>
  if (!data) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--state-danger-text)]">{error ?? "GECC indisponível."}</p>
        <Link href="/cppd/processos" className="mt-4 inline-block text-sm font-semibold underline">Voltar</Link>
      </div>
    )
  }

  const editable = data.gecc.status === "DRAFT" || data.gecc.status === "PENDING_DOCUMENTS"

  return (
    <main className="min-h-[60vh]">
      <ConfirmModal
        open={pendingStatus !== null}
        title={pendingStatus === "SENT_TO_CGP" ? "Registrar envio à CGP?" : "Concluir o GECC?"}
        description={
          pendingStatus === "SENT_TO_CGP"
            ? "Confirme somente depois de realizar o envio no canal externo correspondente."
            : "A conclusão finalizará o processo no SEC-EBTT."
        }
        confirmText={pendingStatus === "SENT_TO_CGP" ? "Registrar envio" : "Concluir"}
        loading={busy}
        onConfirm={() => pendingStatus && updateStatus(pendingStatus)}
        onCancel={() => setPendingStatus(null)}
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/cppd/processos" className="text-xs font-semibold text-[var(--text-secondary)] hover:underline">Processos</Link>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Organização GECC</h1>
            <p className="text-sm text-[var(--text-secondary)]">Processo #{data.process.idProcess} · {data.process.teacherName}</p>
          </div>
          <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-semibold">
            {statusLabel(data.gecc.status)}
          </span>
        </header>

        {error && <p className="text-sm text-[var(--state-danger-text)]">{error}</p>}
        {message && <p className="text-sm text-[var(--state-success-text)]">{message}</p>}

        <section className="grid gap-4 border-y border-[var(--border-subtle)] py-5 text-sm sm:grid-cols-3">
          <div><span className="block text-xs text-[var(--text-secondary)]">Processo</span>{data.process.processTypeName}</div>
          <div><span className="block text-xs text-[var(--text-secondary)]">SIAPE</span>{data.process.teacherSiape ?? "Não informado"}</div>
          <div><span className="block text-xs text-[var(--text-secondary)]">Campus</span>{data.process.campus}</div>
        </section>

        <form onSubmit={saveDetails} className="space-y-3 border-b border-[var(--border-subtle)] pb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Identificação externa</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-[var(--text-primary)]">
              Número do processo externo
              <input className={inputClass} value={externalNumber} onChange={event => setExternalNumber(event.target.value)} disabled={!editable || busy} />
            </label>
            {editable && <button disabled={busy} className="h-10 rounded-md bg-[var(--btn-primary-bg)] px-4 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50">Salvar</button>}
          </div>
        </form>

        <section className="space-y-4 border-b border-[var(--border-subtle)] pb-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Interessados</h2>
          {editable && (
            <form onSubmit={addInterested} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_210px_auto] lg:items-end">
              <label className="text-sm font-medium text-[var(--text-primary)]">Nome<input required className={inputClass} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
              <label className="text-sm font-medium text-[var(--text-primary)]">E-mail<input required type="email" className={inputClass} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
              <label className="text-sm font-medium text-[var(--text-primary)]">Vínculo<select className={inputClass} value={interestedType} onChange={event => setInterestedType(event.target.value as InterestedType)} disabled={busy}><option value="INTERNAL_EVALUATOR">Avaliador interno</option><option value="EXTERNAL_EVALUATOR">Avaliador externo</option><option value="CPPD_UNIT">Unidade CPPD</option><option value="OTHER">Outro</option></select></label>
              <button disabled={busy} className="h-10 rounded-md bg-[var(--btn-primary-bg)] px-4 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50">Adicionar</button>
            </form>
          )}
          {data.gecc.interestedPeople.length ? (
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {data.gecc.interestedPeople.map(person => (
                <div key={`${person.personId}-${person.type}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-semibold text-[var(--text-primary)]">{person.name}</p><p className="text-xs text-[var(--text-secondary)]">{person.informedEmail ?? person.email} · {interestedTypeLabel(person.type)}</p></div>
                  {editable && <button type="button" onClick={() => removeInterested(person.personId, person.type)} disabled={busy} className="text-xs font-semibold text-[var(--state-danger-text)] hover:underline disabled:opacity-50">Remover</button>}
                </div>
              ))}
            </div>
          ) : <p className="border-y border-[var(--border-subtle)] py-5 text-center text-sm text-[var(--text-secondary)]">Nenhum interessado cadastrado.</p>}
        </section>

        <section className="space-y-4 border-b border-[var(--border-subtle)] pb-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Documentos</h2>
          {editable && (
            <form onSubmit={uploadDocument} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_240px_1fr_auto] lg:items-end">
              <label className="text-sm font-medium text-[var(--text-primary)]">Tipo do documento<input required maxLength={80} className={inputClass} value={documentType} onChange={event => setDocumentType(event.target.value)} disabled={busy} /></label>
              <label className="text-sm font-medium text-[var(--text-primary)]">Interessado<select className={inputClass} value={documentPersonId} onChange={event => setDocumentPersonId(event.target.value)} disabled={busy}><option value="">Documento geral</option>{data.gecc.interestedPeople.map(person => <option key={`${person.personId}-${person.type}`} value={person.personId}>{person.name}</option>)}</select></label>
              <label className="text-sm font-medium text-[var(--text-primary)]">Arquivo<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={busy} className="mt-1 block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--btn-secondary-border)] file:bg-[var(--surface-bg)] file:px-3 file:py-2 file:text-xs" /></label>
              <button disabled={busy || !file} className="h-10 rounded-md bg-[var(--btn-primary-bg)] px-4 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50">Anexar</button>
            </form>
          )}
          {data.gecc.documents.length ? (
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {data.gecc.documents.map(document => (
                <div key={document.idGeccDocument} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-semibold text-[var(--text-primary)]">{document.documentType}</p><p className="text-xs text-[var(--text-secondary)]">{document.personName ?? "Documento geral"}</p>{document.file && <a href={fileUrl(document.file.idEvidenceFile)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-700 hover:underline">{document.file.originalName}</a>}</div>
                  {editable && <button type="button" onClick={() => removeDocument(document.idGeccDocument)} disabled={busy} className="text-xs font-semibold text-[var(--state-danger-text)] hover:underline disabled:opacity-50">Remover</button>}
                </div>
              ))}
            </div>
          ) : <p className="border-y border-[var(--border-subtle)] py-5 text-center text-sm text-[var(--text-secondary)]">Nenhum documento anexado.</p>}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-[var(--text-primary)]">Checklist</h2>{data.gecc.checklistFile && <a href={fileUrl(data.gecc.checklistFile.idEvidenceFile)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700 hover:underline">{data.gecc.checklistFile.originalName}</a>}</div>
            {editable && <button type="button" onClick={generateChecklist} disabled={busy} className="rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] disabled:opacity-50">Gerar checklist PDF</button>}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
            {editable && <button type="button" onClick={() => updateStatus("READY_TO_SEND")} disabled={busy} className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50">Marcar como pronto</button>}
            {data.gecc.status === "READY_TO_SEND" && <button type="button" onClick={() => setPendingStatus("SENT_TO_CGP")} disabled={busy} className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50">Registrar envio manual à CGP</button>}
            {data.gecc.status === "SENT_TO_CGP" && <button type="button" onClick={() => setPendingStatus("COMPLETED")} disabled={busy} className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] disabled:opacity-50">Concluir GECC</button>}
          </div>
        </section>
      </div>
    </main>
  )
}
