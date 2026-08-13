"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import ConfirmModal from "@/components/ConfirmModal"

type CppdDecision = "APPROVED" | "REJECTED"

interface ParecerTotalsDto {
  docenteTotal: number
  cppdTotal: number
  minRequiredPoints: number | null
}

interface DivergentItemDto {
  itemId: number
  description: string
  docentePoints: number
  cppdPoints: number
  evaluatorComment: string | null
}

interface ParecerPreviewDto {
  totals: ParecerTotalsDto
  divergentItems: DivergentItemDto[]
  suggestedOpinion: string
  evaluatorUserIds: number[]
}

interface ApiResponse<T = any> {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return ""
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CppdParecerPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const processId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const [preview, setPreview] = useState<ParecerPreviewDto | null>(null)
  const [opinion, setOpinion] = useState("")
  const [decision, setDecision] = useState<CppdDecision>("APPROVED")

  const [finalized, setFinalized] = useState(false)
  const [finalOpinion, setFinalOpinion] = useState<string>("")

  const [confirmOpen, setConfirmOpen] = useState(false)

  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function redirectToLogin() {
    const nextPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/cppd"
    router.push(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  async function fetchApi<T>(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    })

    if (res.status === 401 || res.status === 403) {
      redirectToLogin()
      return { ok: false, status: res.status, payload: null as ApiResponse<T> | null }
    }

    const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null
    return { ok: res.ok, status: res.status, payload }
  }

  async function loadPreview(overrideOpinion?: string) {
    setLoading(true)
    setError(null)
    setInfoMessage(null)

    try {
      const body = overrideOpinion !== undefined ? { overrideOpinion } : {}

      const { ok, payload } = await fetchApi<ParecerPreviewDto>(
        `/api/cppd/processos/${processId}/avaliacao/parecer`,
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      )

      if (!payload) {
        if (!ok) setError("Falha ao gerar a prévia do parecer.")
        setPreview(null)
        return
      }

      if (!ok || payload.status === "error") {
        setError(payload.message ?? "Falha ao gerar a prévia do parecer.")
        setPreview(null)
        return
      }

      if (!payload.data) {
        setError("Resposta sem dados ao gerar a prévia do parecer.")
        setPreview(null)
        return
      }

      setPreview(payload.data)
      setOpinion(payload.data.suggestedOpinion ?? "")
    } catch (err) {
      console.error("Erro ao gerar prévia do parecer:", err)
      setError("Erro inesperado ao gerar a prévia do parecer.")
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!Number.isFinite(processId) || processId <= 0) return
    loadPreview()
  }, [processId])

  const meetsMin = useMemo(() => {
    if (!preview) return null
    const min = preview.totals.minRequiredPoints
    if (min === null) return null
    return preview.totals.cppdTotal >= min
  }, [preview])

  const divergentCount = preview?.divergentItems?.length ?? 0

  async function handleRefreshPreview() {
    await loadPreview()
    setInfoMessage("Prévia atualizada.")
  }

  function getConfirmTitle() {
    if (decision === "APPROVED") return "Confirmar deferimento?"
    return "Confirmar indeferimento?"
  }

  function getConfirmDescription() {
    if (decision === "APPROVED") {
      return "Ao confirmar, o processo será finalizado como DEFERIDO e o parecer será salvo."
    }
    return "Ao confirmar, o processo será finalizado como INDEFERIDO e o parecer será salvo."
  }

  async function handleCopyParecer() {
    try {
      const md = finalOpinion || ""
      if (!md.trim()) return

      const supportsRich =
        typeof window !== "undefined" &&
        "ClipboardItem" in window &&
        !!navigator.clipboard?.write

      if (supportsRich) {
        const html = document.querySelector("#parecer-renderizado")?.innerHTML ?? ""

        const item = new ClipboardItem({
          "text/plain": new Blob([md], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        })

        await navigator.clipboard.write([item])
        setCopyMessage("Parecer copiado com formatação.")
      } else {
        await navigator.clipboard.writeText(md)
        setCopyMessage("Parecer copiado (Markdown).")
      }

      setTimeout(() => setCopyMessage(null), 2500)
    } catch (err) {
      console.error("Erro ao copiar parecer:", err)
      setCopyMessage("Não foi possível copiar o parecer.")
      setTimeout(() => setCopyMessage(null), 3000)
    }
  }

  async function finalizeConfirmed() {
    if (!preview) return

    setSubmitting(true)
    setError(null)
    setInfoMessage(null)

    try {
      const evaluatorUserIds = Array.isArray(preview.evaluatorUserIds)
        ? preview.evaluatorUserIds
            .map(id => Number(id))
            .filter(id => Number.isFinite(id) && id > 0)
        : []

      const trimmedOpinion = opinion.trim()
      const body = {
        decision,
        overrideOpinion: trimmedOpinion === "" ? null : trimmedOpinion,
        evaluatorUserIds
      }

      const { ok, payload } = await fetchApi<any>(
        `/api/cppd/processos/${processId}/avaliacao/finalizar`,
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      )

      if (!payload) {
        if (!ok) setError("Falha ao finalizar avaliação.")
        return
      }

      if (!ok || payload.status === "error") {
        const msg = payload.message ?? "Falha ao finalizar avaliação."
        const det = payload.details ? `\n\nDetalhes: ${JSON.stringify(payload.details)}` : ""
        console.error("Finalize error payload:", payload)
        setError(msg + det)
        return
      }

      setFinalOpinion(trimmedOpinion === "" ? (preview.suggestedOpinion ?? "") : trimmedOpinion)
      setFinalized(true)
      setInfoMessage("Avaliação finalizada. Parecer gerado abaixo.")
    } catch (err) {
      console.error("Erro ao finalizar avaliação:", err)
      setError("Erro inesperado ao finalizar avaliação.")
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  if (!Number.isFinite(processId) || processId <= 0) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-primary)]">ID de processo inválido.</p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-secondary)]">Gerando prévia do parecer...</p>
        </div>
      </main>
    )
  }

  if (error && !preview) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8 space-y-4">
          <p className="text-[var(--state-danger-text)] text-sm whitespace-pre-wrap">{error}</p>
          <button
            type="button"
            onClick={() => loadPreview()}
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold
                       bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                       hover:bg-[var(--btn-primary-hover-bg)] transition"
          >
            Tentar novamente
          </button>
          <Link
            href={`/cppd/processos/${processId}/avaliacao`}
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold
                       border border-[var(--btn-secondary-border)]
                       text-[var(--btn-secondary-text)]
                       hover:bg-[var(--btn-secondary-hover-bg)] transition"
          >
            Voltar para avaliação
          </Link>
        </div>
      </main>
    )
  }

  if (!preview) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 py-8">
          <p className="text-[var(--text-secondary)]">Nenhuma informação disponível para o parecer.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <ConfirmModal
        open={confirmOpen}
        title={getConfirmTitle()}
        description={getConfirmDescription()}
        confirmText="Confirmar"
        cancelText="Cancelar"
        loading={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={finalizeConfirmed}
      />

      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Parecer da CPPD</h1>
            <p className="text-sm text-[var(--text-secondary)]">Processo #{processId}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {finalized ? "Parecer final gerado." : "Revise a prévia do parecer e finalize a decisão."}
            </p>
          </div>

          <div className="flex gap-2">
            {finalized ? (
              <Link
                href="/cppd/processos"
                className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                           text-xs text-[var(--btn-secondary-text)]
                           hover:bg-[var(--btn-secondary-hover-bg)] transition"
              >
                Voltar para processos
              </Link>
            ) : (
              <Link
                href={`/cppd/processos/${processId}/avaliacao`}
                className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                           text-xs text-[var(--btn-secondary-text)]
                           hover:bg-[var(--btn-secondary-hover-bg)] transition"
              >
                Voltar para avaliação
              </Link>
            )}
          </div>
        </header>

        {(infoMessage || error || copyMessage) && (
          <div className="space-y-1">
            {infoMessage && <p className="text-xs text-[var(--state-success-text)]">{infoMessage}</p>}
            {copyMessage && <p className="text-xs text-[var(--state-success-text)]">{copyMessage}</p>}
            {error && <p className="text-xs text-[var(--state-danger-text)] whitespace-pre-wrap">{error}</p>}
          </div>
        )}

        {finalized ? (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Parecer (renderizado)</div>

              <button
                type="button"
                onClick={handleCopyParecer}
                className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                           text-xs text-[var(--btn-secondary-text)]
                           hover:bg-[var(--btn-secondary-hover-bg)] transition"
              >
                Copiar parecer
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted-bg)] p-4">
              <div id="parecer-renderizado" className="prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: props => <p {...props} className="text-sm text-[var(--text-primary)]" />,
                    strong: props => <strong {...props} className="font-semibold" />
                  }}
                >
                  {finalOpinion}
                </ReactMarkdown>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Resumo de pontuação</div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                                 bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                                 text-[var(--text-primary)]"
                    >
                      Docente:
                      <span className="ml-1 font-semibold">{formatNumber(preview.totals.docenteTotal)} pts</span>
                    </span>

                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                                 bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                                 text-[var(--text-primary)]"
                    >
                      CPPD:
                      <span className="ml-1 font-semibold">{formatNumber(preview.totals.cppdTotal)} pts</span>
                    </span>

                    {meetsMin !== null && (
                      <span
                        className={
                          "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border " +
                          (meetsMin
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-orange-200 text-zinc-700 border-orange-500")
                        }
                      >
                        {meetsMin ? "Atingiu o mínimo" : "Abaixo do mínimo"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-[var(--text-secondary)]">
                  Itens com divergência (docente x CPPD): <span className="font-semibold">{divergentCount}</span>
                </div>
              </div>

              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Itens divergentes</div>

                {preview.divergentItems.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">Nenhuma divergência encontrada.</p>
                ) : (
                  <div className="space-y-3">
                    {preview.divergentItems.map(it => (
                      <div
                        key={it.itemId}
                        className="border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--surface-muted-bg)]"
                      >
                        <div className="text-sm font-medium text-[var(--text-primary)] break-words">
                          {it.description}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 font-medium
                                       bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                                       text-[var(--text-primary)]"
                          >
                            Docente: <span className="ml-1 font-semibold">{formatNumber(it.docentePoints)} pts</span>
                          </span>

                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 font-medium
                                       bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                                       text-[var(--text-primary)]"
                          >
                            CPPD: <span className="ml-1 font-semibold">{formatNumber(it.cppdPoints)} pts</span>
                          </span>
                        </div>

                        {it.evaluatorComment && it.evaluatorComment.trim() !== "" && (
                          <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                            <span className="font-semibold text-[var(--text-primary)]">Comentário:</span>{" "}
                            {it.evaluatorComment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:sticky lg:top-4 self-start">
              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Texto do parecer</div>
                  <button
                    type="button"
                    onClick={handleRefreshPreview}
                    className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                               text-xs text-[var(--btn-secondary-text)]
                               hover:bg-[var(--btn-secondary-hover-bg)] transition"
                  >
                    Atualizar prévia
                  </button>
                </div>

                <div className="mt-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted-bg)] p-3">
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Dica: você pode usar <span className="font-semibold">Markdown</span>.
                    Para deixar em <span className="font-semibold">negrito</span>, use{" "}
                    <span className="font-semibold">**assim**</span>.
                  </p>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={16}
                  value={opinion}
                  onChange={e => setOpinion(e.target.value)}
                  className="mt-3 w-full text-xs rounded-2xl border border-[var(--border-subtle)]
                             bg-[var(--surface-bg)] px-3 py-2
                             text-[var(--text-primary)]
                             focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Finalizar avaliação</div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Decisão</label>
                    <select
                      value={decision}
                      onChange={e => setDecision(e.target.value as CppdDecision)}
                      className="w-full text-xs rounded-full border border-[var(--border-subtle)]
                                 bg-[var(--surface-bg)] px-3 py-2
                                 text-[var(--text-primary)]
                                 focus:outline-none focus:border-[var(--border-strong)]"
                    >
                      <option value="APPROVED">Deferir</option>
                      <option value="REJECTED">Indeferir</option>
                    </select>
                  </div>

                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={submitting}
                      className="inline-flex items-center justify-center rounded-full px-6 py-2 text-xs font-semibold
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-60 disabled:cursor-not-allowed transition w-full sm:w-auto"
                    >
                      {submitting ? "Finalizando..." : "Finalizar"}
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-[var(--text-muted)]">
                  Ao finalizar, o parecer será salvo e exibido aqui já formatado.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
