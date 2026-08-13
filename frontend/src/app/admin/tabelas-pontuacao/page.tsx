"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type ScoringTableStatus = "DRAFT" | "ACTIVE" | "INACTIVE"

type AdminScoringTableRow = {
  idScoringTable: number
  name: string
  status: ScoringTableStatus
  startsOn: string | null
  endsOn: string | null
  createdAt?: string
  updatedAt?: string
}

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

const STATUS_LABEL: Record<ScoringTableStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  INACTIVE: "Inativada"
}

function statusBadgeClasses(status: ScoringTableStatus) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-100"
  if (status === "INACTIVE") return "bg-slate-100 text-slate-700 border-slate-200"
  return "bg-amber-50 text-amber-700 border-amber-100"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR")
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ""
  const s = String(value).trim()
  if (!s) return ""

  if (s.includes("T")) return s.split("T")[0]

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function formatVigencia(startsOn: string | null | undefined, endsOn: string | null | undefined) {
  const s = startsOn ? formatDate(startsOn) : null
  const e = endsOn ? formatDate(endsOn) : null

  if (s && e) return `Vigência: ${s} até ${e}`
  if (s && !e) return `Vigência: a partir de ${s} (sem data final)`
  if (!s && e) return `Vigência: até ${e}`
  return "Vigência: sem datas definidas"
}

function normalizeString(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function statusRank(status: ScoringTableStatus) {
  if (status === "ACTIVE") return 0
  if (status === "DRAFT") return 1
  return 2
}

type ConfirmState = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: "danger" | "default"
  onConfirm?: () => void
}

export default function AdminTabelasPontuacaoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AdminScoringTableRow[]>([])

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState<string>(searchParams.get("status") ?? "")

  const [savingId, setSavingId] = useState<number | null>(null)
  const [vigenciaEditingId, setVigenciaEditingId] = useState<number | null>(null)

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: "",
    message: ""
  })

  function openConfirm(next: Omit<ConfirmState, "open">) {
    setConfirm({ open: true, ...next })
  }

  function closeConfirm() {
    setConfirm(prev => ({ ...prev, open: false, onConfirm: undefined }))
  }

  function redirectToLogin() {
    const nextPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/admin/tabelas-pontuacao"
    router.push(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  async function fetchApi<T>(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
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

  const queryString = useMemo(() => {
    const sp = new URLSearchParams()

    const qTrim = normalizeString(q)
    if (qTrim) sp.set("q", qTrim)

    const statusTrim = normalizeString(status)
    if (statusTrim) sp.set("status", statusTrim)

    const s = sp.toString()
    return s ? `?${s}` : ""
  }, [q, status])

  async function load() {
    setLoading(true)
    setError(null)

    const r = await fetchApi<AdminScoringTableRow[]>(`/api/admin/tabelas-pontuacao${queryString}`, {
      method: "GET"
    })

    if (!r.ok || !r.payload || r.payload.status === "error" || !Array.isArray(r.payload.data)) {
      setRows([])
      setError(r.payload?.message ?? "Não foi possível carregar as tabelas.")
      setLoading(false)
      return
    }

    setRows(r.payload.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function applyFilters() {
    setVigenciaEditingId(null)
    router.push(`/admin/tabelas-pontuacao${queryString}`)
    load()
  }

  async function patchTable(tableId: number, data: any) {
    setSavingId(tableId)
    setError(null)

    try {
      const r = await fetchApi(`/api/admin/tabelas-pontuacao/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      })

      if (!r.ok || !r.payload || r.payload.status === "error") {
        setError(r.payload?.message ?? "Falha ao atualizar a tabela.")
        return false
      }

      await load()
      return true
    } finally {
      setSavingId(null)
    }
  }

  async function deleteTable(tableId: number) {
    setSavingId(tableId)
    setError(null)

    try {
      const r = await fetchApi(`/api/admin/tabelas-pontuacao/${tableId}`, {
        method: "DELETE"
      })

      if (!r.ok || !r.payload || r.payload.status === "error") {
        setError(r.payload?.message ?? "Falha ao excluir a tabela.")
        return false
      }

      await load()
      return true
    } finally {
      setSavingId(null)
    }
  }

  const orderedRows = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const ra = statusRank(a.status)
      const rb = statusRank(b.status)
      if (ra !== rb) return ra - rb

      const sa = a.startsOn ? new Date(a.startsOn).getTime() : -Infinity
      const sb = b.startsOn ? new Date(b.startsOn).getTime() : -Infinity
      if (sa !== sb) return sb - sa

      return b.idScoringTable - a.idScoringTable
    })
    return arr
  }, [rows])

  function renderRow(row: AdminScoringTableRow) {
    const disabled = savingId !== null && savingId !== row.idScoringTable
    const isEditingVigencia = vigenciaEditingId === row.idScoringTable

    const canEditStructure = row.status === "DRAFT"
    const canDelete = row.status === "DRAFT"
    const canToggleStatus = row.status === "DRAFT" || row.status === "ACTIVE"
    const isInactive = row.status === "INACTIVE"

    const statusActionLabel =
      row.status === "DRAFT"
        ? "Ativar"
        : row.status === "ACTIVE"
          ? "Inativar"
          : "Inativada"

    const statusActionTitle =
      row.status === "DRAFT"
        ? "Ativar tabela"
        : row.status === "ACTIVE"
          ? "Inativar tabela (não pode reativar depois)"
          : "Esta tabela foi inativada e não pode ser reativada."

    return (
      <div
        key={row.idScoringTable}
        className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--text-primary)] break-words">
                {row.name}
              </h2>

              <span
                className={
                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border " +
                  statusBadgeClasses(row.status)
                }
                title={row.status}
              >
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ID: {row.idScoringTable} · {formatVigencia(row.startsOn, row.endsOn)}
            </p>

            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Criada em: {formatDate(row.createdAt)} · Atualizada em: {formatDate(row.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/tabelas-pontuacao/${row.idScoringTable}/mapeamento`}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition"
              title="Consultar os marcadores que devem ser inseridos na planilha"
            >
              Campos da planilha
            </Link>

            <Link
              href={canEditStructure ? `/admin/tabelas-pontuacao/nova/${row.idScoringTable}/builder` : "#"}
              aria-disabled={!canEditStructure}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition
                         disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={e => {
                if (!canEditStructure) e.preventDefault()
              }}
              title={canEditStructure ? "Editar estrutura da tabela" : "Só é possível editar estrutura em rascunho"}
            >
              Editar estrutura
            </Link>

            <button
              type="button"
              disabled={disabled || savingId === row.idScoringTable || !canToggleStatus}
              onClick={() => {
                setVigenciaEditingId(null)

                if (row.status === "DRAFT") {
                  openConfirm({
                    title: "Ativar tabela",
                    message: "Ao ativar, esta tabela poderá ser usada como vigente conforme a vigência configurada.",
                    confirmText: "Ativar",
                    cancelText: "Cancelar",
                    onConfirm: () => {
                      closeConfirm()
                      patchTable(row.idScoringTable, { status: "ACTIVE" })
                    }
                  })
                  return
                }

                if (row.status === "ACTIVE") {
                  openConfirm({
                    title: "Inativar tabela",
                    message:
                      "Tem certeza que deseja inativar esta tabela?\n\nDepois de inativada, NÃO é possível ativar novamente.",
                    confirmText: "Inativar",
                    cancelText: "Cancelar",
                    tone: "danger",
                    onConfirm: () => {
                      closeConfirm()
                      patchTable(row.idScoringTable, { status: "INACTIVE" })
                    }
                  })
                  return
                }
              }}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition
                         disabled:opacity-60 disabled:cursor-not-allowed"
              title={statusActionTitle}
            >
              {savingId === row.idScoringTable ? "Salvando..." : statusActionLabel}
            </button>

            <button
              type="button"
              disabled={disabled || savingId === row.idScoringTable}
              onClick={() => {
                setError(null)
                setVigenciaEditingId(prev => (prev === row.idScoringTable ? null : row.idScoringTable))
              }}
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition
                         disabled:opacity-60 disabled:cursor-not-allowed"
              title="Editar datas de vigência"
            >
              {isEditingVigencia ? "Fechar vigência" : "Editar vigência"}
            </button>

            {canDelete && (
              <button
                type="button"
                disabled={disabled || savingId === row.idScoringTable}
                onClick={() => {
                  openConfirm({
                    title: "Excluir tabela",
                    message: "Tem certeza que deseja excluir esta tabela? Essa ação não pode ser desfeita.",
                    confirmText: "Excluir",
                    cancelText: "Cancelar",
                    tone: "danger",
                    onConfirm: () => {
                      closeConfirm()
                      setVigenciaEditingId(null)
                      deleteTable(row.idScoringTable)
                    }
                  })
                }}
                className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                           border border-red-200 bg-white text-red-700
                           hover:bg-red-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                title="Excluir tabela (somente rascunho)"
              >
                {savingId === row.idScoringTable ? "Excluindo..." : "Excluir"}
              </button>
            )}
          </div>
        </div>

        {isEditingVigencia && (
          <EditVigenciaCard
            disabled={disabled || savingId === row.idScoringTable}
            startsOn={row.startsOn}
            endsOn={row.endsOn}
            onCancel={() => setVigenciaEditingId(null)}
            onSave={(startsOn, endsOn) => {
              openConfirm({
                title: "Salvar vigência",
                message: "Confirmar alteração das datas de vigência desta tabela?",
                confirmText: "Salvar",
                cancelText: "Cancelar",
                onConfirm: async () => {
                  closeConfirm()

                  const ok = await patchTable(row.idScoringTable, {
                    startsOn: startsOn === "" ? null : startsOn,
                    endsOn: endsOn === "" ? null : endsOn
                  })

                  if (ok) setVigenciaEditingId(null)
                }
              })
            }}
          />
        )}
      </div>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        cancelText={confirm.cancelText}
        tone={confirm.tone}
        onCancel={closeConfirm}
        onConfirm={() => confirm.onConfirm?.()}
      />

      <div className="max-w-6xl mx-auto space-y-6 px-4 md:px-6 lg:px-8 py-6">
        <header className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Tabelas de pontuação</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Gerencie vigência, status e edição de estrutura.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background]"
            >
              Voltar
            </Link>

            <Link
              href="/admin/tabelas-pontuacao/nova"
              className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)] transition-[background]"
            >
              Criar nova tabela
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Nome da tabela"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
            />

            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Ativa</option>
              <option value="DRAFT">Rascunho</option>
              <option value="INACTIVE">Inativada</option>
            </select>

            <button
              type="button"
              onClick={applyFilters}
              className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-bg-2)]"
            >
              Aplicar
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
        ) : orderedRows.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-6 text-sm text-[var(--text-secondary)]">
            Nenhuma tabela encontrada.
          </div>
        ) : (
          <section className="space-y-4">{orderedRows.map(r => renderRow(r))}</section>
        )}
      </div>
    </main>
  )
}

function EditVigenciaCard(props: {
  disabled: boolean
  startsOn: string | null
  endsOn: string | null
  onSave: (startsOn: string, endsOn: string) => void
  onCancel: () => void
}) {
  const [startsOn, setStartsOn] = useState(toDateInputValue(props.startsOn))
  const [endsOn, setEndsOn] = useState(toDateInputValue(props.endsOn))

  useEffect(() => {
    setStartsOn(toDateInputValue(props.startsOn))
    setEndsOn(toDateInputValue(props.endsOn))
  }, [props.startsOn, props.endsOn])

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Editar vigência</div>

        <button
          type="button"
          disabled={props.disabled}
          onClick={props.onCancel}
          className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                     border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Fechar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Data inicial</label>
          <input
            type="date"
            value={startsOn}
            onChange={e => setStartsOn(e.target.value)}
            disabled={props.disabled}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                       px-3 py-2 text-sm text-[var(--text-primary)] outline-none
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--text-secondary)]">Data final (opcional)</label>
          <input
            type="date"
            value={endsOn}
            onChange={e => setEndsOn(e.target.value)}
            disabled={props.disabled}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]
                       px-3 py-2 text-sm text-[var(--text-primary)] outline-none
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => {
            setStartsOn(toDateInputValue(props.startsOn))
            setEndsOn(toDateInputValue(props.endsOn))
            props.onCancel()
          }}
          className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                     border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={props.disabled}
          onClick={() => props.onSave(startsOn, endsOn)}
          className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                     bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                     hover:bg-[var(--btn-primary-hover-bg)] transition-[background]
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

function ConfirmModal(props: {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: "danger" | "default"
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmText = props.confirmText ?? "Confirmar"
  const cancelText = props.cancelText ?? "Cancelar"
  const tone = props.tone ?? "default"

  useEffect(() => {
    if (!props.open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [props.open])

  if (!props.open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={e => {
        if (e.target === e.currentTarget) props.onCancel()
      }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-lg p-5">
        <div className="space-y-2">
          <div className="text-base font-semibold text-[var(--text-primary)]">{props.title}</div>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{props.message}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                       border border-[var(--border-subtle)] hover:bg-[var(--surface-bg-2)] transition"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={props.onConfirm}
            className={
              "rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide transition " +
              (tone === "danger"
                ? "border border-red-200 bg-white text-red-700 hover:bg-red-100"
                : "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]")
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
