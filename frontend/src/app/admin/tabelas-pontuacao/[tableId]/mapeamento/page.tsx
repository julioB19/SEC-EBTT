"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

type ScoringNode = {
  idScoringNode: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
}

type ScoringItem = {
  idScoringItem: number
  nodeId: number
  description: string
  unit: string | null
  points: string | number
}

type Structure = {
  table: { idScoringTable: number; name: string; status: string }
  nodes: ScoringNode[]
  items: ScoringItem[]
}

type ApiResponse = {
  status: "success" | "error"
  message: string
  data: Structure | null
}

export default function ScoringTableSpreadsheetMappingPage() {
  const params = useParams<{ tableId: string }>()
  const router = useRouter()
  const tableId = Number(params.tableId)
  const [structure, setStructure] = useState<Structure | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useFeedbackState<string | null>(null, "error")
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/admin/tabelas-pontuacao/${tableId}/estrutura`, {
          credentials: "include",
          cache: "no-store"
        })

        if (response.status === 401 || response.status === 403) {
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
          return
        }

        const payload = (await response.json().catch(() => null)) as ApiResponse | null
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.message ?? "Não foi possível carregar os campos da tabela.")
        }

        setStructure(payload.data)
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível carregar os campos da tabela.")
      } finally {
        setLoading(false)
      }
    }

    if (Number.isInteger(tableId) && tableId > 0) load()
    else {
      setError("Tabela de pontuação inválida.")
      setLoading(false)
    }
  }, [router, tableId])

  const rows = useMemo(() => {
    if (!structure) return []

    const nodeById = new Map(structure.nodes.map(node => [node.idScoringNode, node]))
    const orderedNodes = [...structure.nodes].sort((a, b) =>
      a.sortOrder - b.sortOrder || a.idScoringNode - b.idScoringNode
    )
    const nodeOrder = new Map(orderedNodes.map((node, index) => [node.idScoringNode, index]))

    return [...structure.items]
      .sort((a, b) =>
        (nodeOrder.get(a.nodeId) ?? Number.MAX_SAFE_INTEGER) -
          (nodeOrder.get(b.nodeId) ?? Number.MAX_SAFE_INTEGER) ||
        a.idScoringItem - b.idScoringItem
      )
      .map(item => ({ item, node: nodeById.get(item.nodeId) }))
  }, [structure])

  async function copyMarker(marker: string) {
    await navigator.clipboard.writeText(marker)
    setCopied(marker)
    window.setTimeout(() => setCopied(current => (current === marker ? null : current)), 1500)
  }

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-6 lg:px-8 py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Campos da planilha de pontuação
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {structure ? `${structure.table.name} · Tabela #${structure.table.idScoringTable}` : `Tabela #${tableId}`}
            </p>
          </div>

          <></>
        </header>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Insira cada marcador exatamente como exibido abaixo na célula destinada à quantidade do item.
          Ao exportar, o sistema substituirá o marcador pela quantidade informada pelo docente.
        </section>

        {loading && <p className="text-sm text-[var(--text-secondary)]">Carregando campos...</p>}

        {error && (
          null
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] p-5 text-sm text-[var(--text-secondary)]">
            Esta tabela ainda não possui itens cadastrados.
          </div>
        )}

        {rows.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--surface-bg-2)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-3">Bloco</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Pontos</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Campo na planilha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {rows.map(({ item, node }) => {
                    const marker = `[[ID${item.idScoringItem}]]`
                    return (
                      <tr key={item.idScoringItem}>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {node?.code ? `${node.code} · ` : ""}{node?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{item.description}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{item.unit || "—"}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{String(item.points)}</td>
                        <td className="px-4 py-3 font-mono">{item.idScoringItem}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => copyMarker(marker)}
                            className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 font-mono
                                       hover:bg-[var(--surface-bg-2)] transition"
                            title="Copiar marcador"
                          >
                            {copied === marker ? "Copiado!" : marker}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
