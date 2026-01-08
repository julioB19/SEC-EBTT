"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type ScoringTableStatus = "DRAFT" | "ACTIVE"

type Table = {
  idScoringTable: number
  name: string
  startsOn: string | null
  endsOn: string | null
  status: ScoringTableStatus
  minRequiredPoints?: string | number | null
}

type Node = {
  idScoringNode: number
  scoringTableId: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
}

type Item = {
  idScoringItem: number
  scoringTableId: number
  nodeId: number
  description: string
  unit: string | null
  points: string | number
  hasMaxPoints: boolean
  maxPoints: string | number | null
  formulaKey: string | null
}

type VigenteData = {
  table: Table | null
  nodes: Node[]
  items: Item[]
}

type ApiResponse<T = any> = {
  status?: "success" | "error"
  message?: string
  data?: T
  details?: any
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d)
}

function formatNumber(value: any) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value ?? "")
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeText(v: any) {
  return String(v ?? "").trim().replace(/\s+/g, " ")
}

function normalizeUpper(v: any) {
  const s = normalizeText(v)
  return s === "" ? "" : s.toUpperCase()
}

function safeNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function tokenizeNatural(s: string) {
  const str = normalizeUpper(s)
  if (!str) return []
  return str.match(/[A-Z]+|\d+/g) ?? [str]
}

function compareNaturalKey(aRaw: any, bRaw: any) {
  const a = normalizeUpper(aRaw)
  const b = normalizeUpper(bRaw)
  if (a === b) return 0

  const ta = tokenizeNatural(a)
  const tb = tokenizeNatural(b)

  const len = Math.max(ta.length, tb.length)
  for (let i = 0; i < len; i++) {
    const pa = ta[i]
    const pb = tb[i]

    if (pa === undefined) return -1
    if (pb === undefined) return 1
    if (pa === pb) continue

    const na = /^\d+$/.test(pa) ? Number(pa) : null
    const nb = /^\d+$/.test(pb) ? Number(pb) : null

    if (na !== null && nb !== null) {
      if (na !== nb) return na - nb
      continue
    }

    if (na !== null && nb === null) return -1
    if (na === null && nb !== null) return 1

    const cmp = pa.localeCompare(pb, "pt-BR", { sensitivity: "base" })
    if (cmp !== 0) return cmp
  }

  return a.localeCompare(b, "pt-BR", { sensitivity: "base" })
}

type TreeNode = {
  nodeId: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
  items: Item[]
  children: TreeNode[]
}

function buildTree(nodes: Node[], items: Item[]): TreeNode[] {
  const map = new Map<number, TreeNode>()

  nodes.forEach(n => {
    map.set(n.idScoringNode, {
      nodeId: n.idScoringNode,
      parentId: n.parentId ?? null,
      name: n.name,
      code: n.code ?? null,
      sortOrder: safeNumber(n.sortOrder),
      hasFormula: !!n.hasFormula,
      formulaExpression: n.formulaExpression ?? null,
      items: [],
      children: []
    })
  })

  const itemsByNode = new Map<number, Item[]>()
  items.forEach(it => {
    const list = itemsByNode.get(it.nodeId) ?? []
    list.push(it)
    itemsByNode.set(it.nodeId, list)
  })

  map.forEach(node => {
    const list = itemsByNode.get(node.nodeId) ?? []
    list.sort((a, b) => a.idScoringItem - b.idScoringItem)
    node.items = list
  })

  const roots: TreeNode[] = []
  map.forEach(node => {
    if (node.parentId === null || node.parentId === undefined) {
      roots.push(node)
    } else {
      const parent = map.get(node.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })

  
  const cmpNode = (a: TreeNode, b: TreeNode) => {
    const cA = normalizeUpper(a.code)
    const cB = normalizeUpper(b.code)

    if (cA && !cB) return -1
    if (!cA && cB) return 1

    if (cA && cB) {
      const byCode = compareNaturalKey(cA, cB)
      if (byCode !== 0) return byCode
    }

    const nA = normalizeText(a.name)
    const nB = normalizeText(b.name)
    const byName = compareNaturalKey(nA, nB)
    if (byName !== 0) return byName

    return a.nodeId - b.nodeId
  }

  const sortTree = (arr: TreeNode[]) => {
    arr.sort(cmpNode)
    arr.forEach(n => sortTree(n.children))
  }

  sortTree(roots)
  return roots
}

function statusLabel(status: ScoringTableStatus) {
  if (status === "ACTIVE") return "Ativa"
  if (status === "DRAFT") return "Rascunho"
  return status
}

function formatVigencia(startsOn: string | null, endsOn: string | null) {
  const ini = formatDate(startsOn)

  if (!startsOn && !endsOn) return "Sem vigência definida"
  if (startsOn && !endsOn) return `A partir de ${ini}`
  if (!startsOn && endsOn) return `Até ${formatDate(endsOn)}`
  return `${ini} a ${formatDate(endsOn)}`
}

export default function CppdScoringTableVigentePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<VigenteData | null>(null)

  function redirectToLogin() {
    const nextPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/cppd/tabelas"
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

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const r = await fetchApi<VigenteData>("/api/cppd/tabelas-pontuacao/vigente", {
          method: "GET"
        })

        if (!r.payload || !r.ok || r.payload.status === "error") {
          setData(null)
          setError(r.payload?.message ?? "Não foi possível carregar a tabela de pontuação vigente.")
          return
        }

        const d = (r.payload.data ?? null) as any

        const next: VigenteData = {
          table: d?.table ?? null,
          nodes: Array.isArray(d?.nodes) ? d.nodes : [],
          items: Array.isArray(d?.items) ? d.items : []
        }

        setData(next)
      } catch (err) {
        console.error("Erro ao carregar tabela vigente:", err)
        setData(null)
        setError("Erro inesperado ao carregar a tabela vigente.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const treeRoots = useMemo(() => {
    if (!data?.table) return []
    return buildTree(data.nodes ?? [], data.items ?? [])
  }, [data])

  function renderItemRow(item: Item) {
    return (
      <div
        key={item.idScoringItem}
        className="border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--surface-muted-bg)]"
      >
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start">
            <div className="min-w-0">
              <div className="mt-1 flex flex-wrap items-start gap-2 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)] break-words min-w-0">
                  {item.description}
                </span>

                {item.formulaKey && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold
                               bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                               text-[var(--text-primary)] shrink-0"
                    title="Variável usada na fórmula do bloco"
                  >
                    {item.formulaKey}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-row items-center gap-2 shrink-0 whitespace-nowrap">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                           bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                           text-[var(--text-primary)] w-fit"
              >
                Pontos:
                <span className="ml-1 font-semibold">{formatNumber(item.points)}</span>
              </span>

              {item.hasMaxPoints && (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                             bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                             text-[var(--text-primary)] w-fit"
                >
                  Máximo:
                  <span className="ml-1 font-semibold">
                    {item.maxPoints !== null && item.maxPoints !== undefined ? formatNumber(item.maxPoints) : "—"}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)]">
            Unidade: {item.unit ?? "-"}
          </div>
        </div>
      </div>
    )
  }

  function renderNode(node: TreeNode) {
    const label = node.code ? `${node.code} - ${node.name}` : node.name

    return (
      <div key={node.nodeId} className="space-y-3">
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>

              {node.hasFormula && node.formulaExpression && (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Bloco com cálculo automático ·{" "}
                  <span className="font-semibold text-[var(--text-primary)]">{node.formulaExpression}</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-[var(--text-secondary)]">
              {node.items.length} item(ns)
            </div>
          </div>

          {node.items.length > 0 && (
            <div className="space-y-3">
              {node.items.map(item => renderItemRow(item))}
            </div>
          )}

          {node.children.length > 0 && (
            <div className="mt-4 border-l-2 border-dashed border-[var(--border-subtle)] pl-4 space-y-4">
              {node.children.map(child => renderNode(child))}
            </div>
          )}

          {node.items.length === 0 && node.children.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">Nenhuma atividade cadastrada neste bloco.</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 md:px-6 lg:px-8 py-6">
          <p className="text-[var(--text-secondary)]">Carregando tabela vigente...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 md:px-6 lg:px-8 py-6 space-y-4">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Tabela de pontuação vigente
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Consulta da tabela utilizada na avaliação dos processos.
            </p>
          </header>

          <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-2xl p-6 space-y-2">
            <p className="text-sm text-[var(--danger-text-strong)] whitespace-pre-wrap">{error}</p>
          </div>

          <Link
            href="/cppd"
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold
                       border border-[var(--btn-secondary-border)]
                       text-[var(--btn-secondary-text)]
                       hover:bg-[var(--btn-secondary-hover-bg)] transition"
          >
            Voltar
          </Link>
        </div>
      </main>
    )
  }

  const table = data?.table ?? null

  if (!table) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 md:px-6 lg:px-8 py-6 space-y-4">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Tabela de pontuação vigente
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Consulta da tabela utilizada na avaliação dos processos.
            </p>
          </header>

          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-6">
            <p className="text-[var(--text-primary)]">
              Nenhuma tabela vigente foi encontrada no momento.
            </p>
          </div>

          <Link
            href="/cppd"
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold
                       border border-[var(--btn-secondary-border)]
                       text-[var(--btn-secondary-text)]
                       hover:bg-[var(--btn-secondary-hover-bg)] transition"
          >
            Voltar
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Tabela de pontuação vigente
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Consulta da tabela utilizada na avaliação dos processos.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/cppd"
              className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                         text-xs text-[var(--btn-secondary-text)]
                         hover:bg-[var(--btn-secondary-hover-bg)] transition"
            >
              Voltar
            </Link>
          </div>
        </header>

        <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{table.name}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                Vigência: <span className="font-semibold text-[var(--text-primary)]">{formatVigencia(table.startsOn, table.endsOn)}</span>
              </div>
            </div>

            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium
                         bg-[var(--surface-muted-bg)] border border-[var(--border-subtle)]
                         text-[var(--text-primary)]"
              title={table.status}
            >
              Situação: <span className="ml-1 font-semibold">{statusLabel(table.status)}</span>
            </span>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)]">
            Blocos: {data?.nodes?.length ?? 0} • Itens: {data?.items?.length ?? 0}
          </div>
        </section>

        {treeRoots.length === 0 ? (
          <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm text-sm text-[var(--text-secondary)]">
            Estrutura da tabela ainda não está disponível para consulta.
          </section>
        ) : (
          <section className="space-y-4">
            {treeRoots.map(n => renderNode(n))}
          </section>
        )}
      </div>
    </main>
  )
}
