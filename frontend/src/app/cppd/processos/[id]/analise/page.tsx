"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

type Decision = "APPROVED" | "REJECTED"

type DocumentRequirement = {
  idDocumentRequirement: number
  code: string
  name: string
  description: string | null
  required: boolean
}

type ProcessDocument = {
  idDocumentProcess: number
  documentType: string
  evidenceFile: {
    idEvidenceFile: number
    originalName: string
    mimeType: string | null
    sizeBytes: string | number | null
  } | null
}

type ProcessData = {
  idProcess: number
  status: string
  createdAt: string
  submittedAt: string | null
  campus: string
  cidadeUF: string
  externalNumber: string | null
  evaluationOpinion: string | null
  user: {
    name: string
    email: string
    docente: { siape: string } | null
  }
  processTypeConfig: {
    name: string
    requiresScoring: boolean
    requiresCommittee: boolean
    documentRequirements: DocumentRequirement[]
  } | null
  documents: ProcessDocument[]
}

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR")
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    SUBMITTED: "Enviado",
    UNDER_REVIEW: "Em análise",
    APPROVED: "Deferido",
    REJECTED: "Indeferido",
  }
  return labels[status] ?? status
}

export default function DocumentReviewPage() {
  const params = useParams<{ id: string }>()
  const processId = Number(params.id)
  const [process, setProcess] = useState<ProcessData | null>(null)
  const [opinionText, setOpinionText] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadProcess = useCallback(async () => {
    if (!Number.isInteger(processId) || processId <= 0) {
      setError("Identificador de processo inválido.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/cppd/processos/${processId}`, {
        credentials: "include",
        cache: "no-store",
      })
      const body = (await response
        .json()
        .catch(() => null)) as ApiResponse<ProcessData> | null
      if (!response.ok || !body?.data) {
        setError(body?.message ?? "Não foi possível carregar o processo.")
        return
      }
      setProcess(body.data)
      setOpinionText(body.data.evaluationOpinion ?? "")
    } catch {
      setError("Não foi possível conectar ao servidor.")
    } finally {
      setLoading(false)
    }
  }, [processId])

  useEffect(() => {
    void loadProcess()
  }, [loadProcess])

  const documentsByType = useMemo(() => {
    const map = new Map<string, ProcessDocument[]>()
    for (const document of process?.documents ?? []) {
      const documents = map.get(document.documentType) ?? []
      documents.push(document)
      map.set(document.documentType, documents)
    }
    return map
  }, [process])

  const reviewable =
    process?.status === "SUBMITTED" || process?.status === "UNDER_REVIEW"

  async function submitDecision(decision: Decision) {
    const opinion = opinionText.trim()
    if (!opinion) {
      setError("Informe o parecer da CPPD antes de concluir.")
      return
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/cppd/processos/${processId}/analise/decisao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ decision, opinionText: opinion }),
        },
      )
      const body = (await response.json().catch(() => null)) as ApiResponse<{
        status: string
        evaluationOpinion: string
      }> | null
      if (!response.ok || !body?.data) {
        setError(body?.message ?? "Não foi possível concluir a análise.")
        return
      }
      setProcess((current) =>
        current
          ? {
              ...current,
              status: body.data!.status,
              evaluationOpinion: body.data!.evaluationOpinion,
            }
          : current,
      )
      setMessage(
        decision === "APPROVED" ? "Processo deferido." : "Processo indeferido.",
      )
    } catch {
      setError("Não foi possível conectar ao servidor.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="px-4 py-8 text-sm text-[var(--text-secondary)]">
        Carregando análise...
      </main>
    )
  }

  if (!process) {
    return (
      <main className="px-4 py-8 space-y-4">
        <p className="text-sm text-[var(--state-danger-text)]">
          {error ?? "Processo não encontrado."}
        </p>
        <Link
          href="/cppd/processos"
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          Voltar aos processos
        </Link>
      </main>
    )
  }

  const requirements = process.processTypeConfig?.documentRequirements ?? []

  return (
    <main className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Análise documental
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Processo #{process.idProcess} ·{" "}
            {process.processTypeConfig?.name ?? "Processo"}
          </p>
        </div>
        <Link
          href="/cppd/processos"
          className="inline-flex items-center rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]"
        >
          Voltar
        </Link>
      </header>

      <section className="border-y border-[var(--border-subtle)] py-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Docente</dt>
            <dd className="mt-1 text-sm font-medium">{process.user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">SIAPE</dt>
            <dd className="mt-1 text-sm font-medium">
              {process.user.docente?.siape ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Campus</dt>
            <dd className="mt-1 text-sm font-medium">{process.campus}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Situação</dt>
            <dd className="mt-1 text-sm font-medium">
              {statusLabel(process.status)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Local</dt>
            <dd className="mt-1 text-sm font-medium">{process.cidadeUF}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">Enviado em</dt>
            <dd className="mt-1 text-sm font-medium">
              {formatDate(process.submittedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-secondary)]">
              Número externo
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {process.externalNumber ?? "-"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Documentos
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Confira os documentos apresentados para este tipo de processo.
          </p>
        </div>

        {requirements.length === 0 ? (
          <p className="border border-[var(--border-subtle)] rounded-md p-4 text-sm text-[var(--text-secondary)]">
            Nenhum documento obrigatório foi configurado para este tipo de
            processo.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {requirements.map((requirement) => {
              const documents = documentsByType.get(requirement.code) ?? []
              return (
                <div
                  key={requirement.idDocumentRequirement}
                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {requirement.name}
                    </p>
                    {requirement.description ? (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {requirement.description}
                      </p>
                    ) : null}
                    {documents.map((document) => (
                      <p
                        key={document.idDocumentProcess}
                        className="mt-2 text-xs text-[var(--text-primary)]"
                      >
                        {document.evidenceFile?.originalName ??
                          "Arquivo sem identificação"}
                      </p>
                    ))}
                  </div>
                  <span
                    className={`text-xs font-medium ${documents.length > 0 ? "text-[var(--state-success-text)]" : "text-[var(--state-danger-text)]"}`}
                  >
                    {documents.length > 0
                      ? "Recebido"
                      : requirement.required
                        ? "Pendente"
                        : "Opcional"}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
        <div>
          <label
            htmlFor="opinion"
            className="text-sm font-semibold text-[var(--text-primary)]"
          >
            Parecer da CPPD
          </label>
          <textarea
            id="opinion"
            value={opinionText}
            onChange={(event) => setOpinionText(event.target.value)}
            disabled={!reviewable || submitting}
            rows={7}
            className="mt-2 w-full rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:bg-[var(--surface-muted)]"
            placeholder="Registre a análise da documentação apresentada."
          />
        </div>

        {error ? (
          <p className="text-sm text-[var(--state-danger-text)]">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-[var(--state-success-text)]">{message}</p>
        ) : null}

        {reviewable ? (
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitDecision("REJECTED")}
              className="rounded-md border border-[var(--state-danger-text)] px-4 py-2 text-sm font-medium text-[var(--state-danger-text)] disabled:opacity-50"
            >
              Indeferir
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitDecision("APPROVED")}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50"
            >
              {submitting ? "Concluindo..." : "Deferir"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Esta análise já foi concluída.
          </p>
        )}
      </section>
    </main>
  )
}
