"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

import { ApiResponse, UiItem, UiNode } from "./types"
import { makeDraftId, normalizeCode } from "./helpers"
import { atualizarItem, atualizarNo, criarItem, criarNo, obterEstruturaTabela } from "./api"

function emptyItem(): UiItem {
  return {
    description: "",
    unit: "",
    points: "0",
    hasMaxPoints: false,
    maxPoints: "",
    formulaKey: ""
  }
}

function emptyRootNode(): UiNode {
  return {
    draftId: makeDraftId("block"),
    name: "",
    code: "",
    parentDraftId: null,
    sortOrder: 0,
    hasFormula: false,
    formulaExpression: "",
    items: []
  }
}

function normalizeFormulaKey(value: string) {
  const v = String(value ?? "").trim().toUpperCase()
  return v ? v : ""
}

function getSubtreeDraftIds(rootDraftId: string, nodes: UiNode[]) {
  const set = new Set<string>()
  const queue: string[] = [rootDraftId]

  while (queue.length) {
    const cur = queue.shift()!
    if (set.has(cur)) continue
    set.add(cur)

    for (const n of nodes) {
      if (n.parentDraftId === cur) queue.push(n.draftId)
    }
  }

  return set
}

export default function ScoringTableBlockBuilderPage() {
  const router = useRouter()
  const params = useParams<{ tableId: string }>()
  const tableId = useMemo(() => Number(params.tableId), [params.tableId])

  const [mounted, setMounted] = useState(false)

 
  const [nodes, setNodes] = useState<UiNode[]>([])

 
  const [selectedBlockDraftId, setSelectedBlockDraftId] = useState<string>("")

  const [saving, setSaving] = useState(false)
  const [loadingStructure, setLoadingStructure] = useState(false)

  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<string[] | null>(null)

  useEffect(() => {
    setMounted(true)
    bootstrap()
  }, [])

  function redirectToLogin() {
    const nextPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/admin"
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

  async function bootstrap(keepSelectionDraftId?: string) {
    if (!Number.isFinite(tableId) || tableId <= 0) return

    setError(null)
    setDetails(null)
    setInfoMessage(null)
    setLoadingStructure(true)

    try {
      const data = await obterEstruturaTabela(tableId)

      const rawNodes: any[] = Array.isArray(data?.nodes) ? data.nodes : []
      const rawItems: any[] = Array.isArray(data?.items) ? data.items : []

      const itemsByNode = new Map<number, any[]>()
      for (const it of rawItems) {
        const nodeId = Number(it?.nodeId ?? it?.idScoringNode ?? 0)
        if (!nodeId) continue
        if (!itemsByNode.has(nodeId)) itemsByNode.set(nodeId, [])
        itemsByNode.get(nodeId)!.push(it)
      }

   
      const draftByDbId = new Map<number, string>()
      for (const n of rawNodes) {
        const id = Number(n?.idScoringNode ?? n?.id ?? 0)
        if (id) draftByDbId.set(id, `db_${id}`)
      }

      const uiNodes: UiNode[] = rawNodes.map((n: any) => {
        const idScoringNode = Number(n?.idScoringNode ?? n?.id ?? 0) || undefined
        const draftId = idScoringNode ? `db_${idScoringNode}` : makeDraftId("node")

        const parentId = Number(n?.parentId ?? 0) || null
        const parentDraftId = parentId ? draftByDbId.get(parentId) ?? null : null

        const nodeItems = itemsByNode.get(Number(idScoringNode ?? 0)) ?? []

        return {
          idScoringNode,
          draftId,
          name: String(n?.name ?? "").trim(),
          code: String(n?.code ?? "").trim(),
          parentDraftId,
          sortOrder: Number(n?.sortOrder ?? 0) || 0,
          hasFormula: !!n?.hasFormula,
          formulaExpression: String(n?.formulaExpression ?? "").trim(),
          items: nodeItems.map((it: any) => ({
            idScoringItem: Number(it?.idScoringItem ?? it?.id ?? 0) || undefined,
            description: String(it?.description ?? "").trim(),
            unit: String(it?.unit ?? "").trim(),
            points: String(it?.points ?? "0"),
            hasMaxPoints: !!it?.hasMaxPoints,
            maxPoints: String(it?.maxPoints ?? "").trim(),
            formulaKey: String(it?.formulaKey ?? "").trim()
          }))
        }
      })

      setNodes(uiNodes)

      if (keepSelectionDraftId) {
        const exists = uiNodes.some(n => n.draftId === keepSelectionDraftId)
        setSelectedBlockDraftId(exists ? keepSelectionDraftId : "")
      } else {
        setSelectedBlockDraftId("")
      }

      setInfoMessage("Estrutura carregada do banco.")
    } catch (err: any) {
      console.error("Erro ao carregar estrutura:", err)
      setError(err?.message ?? "Erro ao carregar estrutura.")
    } finally {
      setLoadingStructure(false)
    }
  }

  const blocks = useMemo(() => {
    return nodes
      .filter(n => !n.parentDraftId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [nodes])

  const selectedSubtreeIds = useMemo(() => {
    if (!selectedBlockDraftId) return new Set<string>()
    return getSubtreeDraftIds(selectedBlockDraftId, nodes)
  }, [selectedBlockDraftId, nodes])

  const visibleNodes = useMemo(() => {
    if (!selectedBlockDraftId) return []
    return nodes
      .filter(n => selectedSubtreeIds.has(n.draftId))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [selectedBlockDraftId, nodes, selectedSubtreeIds])

  function updateNode(draftId: string, patch: Partial<UiNode>) {
    setNodes(prev => prev.map(n => (n.draftId === draftId ? { ...n, ...patch } : n)))
  }

  function addNode() {
    if (!selectedBlockDraftId) return

    const newNode: UiNode = {
      draftId: makeDraftId("node"),
      name: "",
      code: "",
      parentDraftId: selectedBlockDraftId, 
      sortOrder: visibleNodes.length + 1,
      hasFormula: false,
      formulaExpression: "",
      items: []
    }

    setNodes(prev => [...prev, newNode])
  }

  function removeNode(draftId: string) {
    setNodes(prev => prev.filter(n => n.draftId !== draftId))
  }

  function addItem(nodeDraftId: string) {
    setNodes(prev =>
      prev.map(n =>
        n.draftId === nodeDraftId
          ? { ...n, items: [...(n.items ?? []), emptyItem()] }
          : n
      )
    )
  }

  function updateItem(nodeDraftId: string, index: number, patch: Partial<UiItem>) {
    setNodes(prev =>
      prev.map(n => {
        if (n.draftId !== nodeDraftId) return n
        const items = [...(n.items ?? [])]
        items[index] = { ...items[index], ...patch }
        return { ...n, items }
      })
    )
  }

  function removeItem(nodeDraftId: string, index: number) {
    setNodes(prev =>
      prev.map(n => {
        if (n.draftId !== nodeDraftId) return n
        const items = [...(n.items ?? [])]
        items.splice(index, 1)
        return { ...n, items }
      })
    )
  }

  function handleSelectBlock(value: string) {
    setError(null)
    setDetails(null)
    setInfoMessage(null)

    if (value === "__NEW__") {
      // cria um bloco novo vazio (nó raiz)
      const root = emptyRootNode()
      setNodes(prev => [...prev, root])
      setSelectedBlockDraftId(root.draftId)
      return
    }

    setSelectedBlockDraftId(value)
  }

  function validateBeforeSave(currentNodes: UiNode[]) {
    const errs: string[] = []

    if (!Number.isFinite(tableId) || tableId <= 0) errs.push("tableId inválido.")
    if (!selectedBlockDraftId) errs.push("Selecione um bloco para editar/salvar.")

    currentNodes.forEach((n, i) => {
      if (!String(n.name ?? "").trim()) errs.push(`Nó ${i + 1}: informe o nome.`)
      if (!normalizeCode(n.code)) errs.push(`Nó ${i + 1}: informe o código.`)

      const items = n.items ?? []
      const childrenCount = currentNodes.filter(x => x.parentDraftId === n.draftId).length

      if (childrenCount === 0) {
        if (items.length === 0 && !n.hasFormula) {
          errs.push(`Nó ${i + 1}: adicione ao menos um item ou marque que possui fórmula.`)
        }
      }

      if (n.hasFormula && !String(n.formulaExpression ?? "").trim()) {
        errs.push(`Nó ${i + 1}: a fórmula é obrigatória.`)
      }

      items.forEach((it, j) => {
        if (!String(it.description ?? "").trim()) errs.push(`Nó ${i + 1} · Item ${j + 1}: informe a descrição.`)
        if (!String(it.points ?? "").trim()) errs.push(`Nó ${i + 1} · Item ${j + 1}: informe os pontos.`)
        if (it.hasMaxPoints && !String(it.maxPoints ?? "").trim()) {
          errs.push(`Nó ${i + 1} · Item ${j + 1}: maxPoints é obrigatório quando tem máximo.`)
        }

        const fk = normalizeFormulaKey(it.formulaKey)
        if (fk && !/^[A-Z][A-Z0-9_]*$/.test(fk)) {
          errs.push(`Nó ${i + 1} · Item ${j + 1}: formulaKey inválida (ex: A, A1, VAR_X).`)
        }
      })
    })

    return errs
  }

  async function handleSalvarTudo() {
    setError(null)
    setDetails(null)
    setInfoMessage(null)

    const currentNodes = visibleNodes
    const errs = validateBeforeSave(currentNodes)
    if (errs.length) {
      setError("Revise os campos obrigatórios antes de salvar.")
      setDetails(errs)
      return
    }

    try {
      setSaving(true)

      const draftToDb = new Map<string, number>()

      for (const n of currentNodes) {
        if (n.idScoringNode) draftToDb.set(n.draftId, n.idScoringNode)
      }

      for (const n of currentNodes) {
        if (n.idScoringNode) continue

        const created = await criarNo(tableId, {
          name: String(n.name ?? "").trim(),
          code: normalizeCode(n.code) || null,
          sortOrder: Number(n.sortOrder ?? 0) || 0,
          parentId: null,
          hasFormula: !!n.hasFormula,
          formulaExpression: n.hasFormula ? String(n.formulaExpression ?? "").trim() : null
        })

        const id = Number(created?.idScoringNode ?? created?.id ?? 0)
        if (!id) throw new Error("Falha ao criar nó (id não retornou).")

        draftToDb.set(n.draftId, id)

        setNodes(prev =>
          prev.map(x => (x.draftId === n.draftId ? { ...x, idScoringNode: id } : x))
        )
      }

      for (const n of currentNodes) {
        const nodeId = draftToDb.get(n.draftId)
        if (!nodeId) continue

        const parentId =
          n.parentDraftId && draftToDb.has(n.parentDraftId)
            ? draftToDb.get(n.parentDraftId) ?? null
            : null

        await atualizarNo(nodeId, {
          name: String(n.name ?? "").trim(),
          code: normalizeCode(n.code) || null,
          sortOrder: Number(n.sortOrder ?? 0) || 0,
          parentId,
          hasFormula: !!n.hasFormula,
          formulaExpression: n.hasFormula ? String(n.formulaExpression ?? "").trim() : null
        })
      }

      for (const n of currentNodes) {
        const nodeId = draftToDb.get(n.draftId)
        if (!nodeId) continue

        for (let idx = 0; idx < (n.items ?? []).length; idx++) {
          const it = n.items[idx]

          const body = {
            description: String(it.description ?? "").trim(),
            unit: String(it.unit ?? "").trim() ? String(it.unit ?? "").trim() : null,
            points: String(it.points ?? "0"),
            hasMaxPoints: !!it.hasMaxPoints,
            maxPoints: it.hasMaxPoints
              ? (String(it.maxPoints ?? "").trim() ? String(it.maxPoints).trim() : null)
              : null,
            formulaKey: String(it.formulaKey ?? "").trim()
              ? String(it.formulaKey).trim().toUpperCase()
              : null
          }

          if (it.idScoringItem) {
            await atualizarItem(it.idScoringItem, body)
          } else {
            const created = await criarItem(nodeId, body)
            const idItem = Number(created?.idScoringItem ?? created?.id ?? 0)

            if (idItem) {
              setNodes(prev =>
                prev.map(x => {
                  if (x.draftId !== n.draftId) return x
                  const items = [...(x.items ?? [])]
                  if (!items[idx]) return x
                  items[idx] = { ...items[idx], idScoringItem: idItem }
                  return { ...x, items }
                })
              )
            }
          }
        }
      }

      setInfoMessage("Bloco salvo no banco com sucesso.")

      const selected = nodes.find(n => n.draftId === selectedBlockDraftId)
      await bootstrap(selected?.idScoringNode ? `db_${selected.idScoringNode}` : undefined)
    } catch (err: any) {
      console.error("Erro ao salvar tudo:", err)
      setError(err?.message ?? "Erro inesperado ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 md:px-6 lg:px-8 py-6">
          <p className="text-[var(--text-secondary)]">Carregando builder...</p>
        </div>
      </main>
    )
  }

  if (!Number.isFinite(tableId)) {
    return (
      <main className="min-h-[60vh]">
        <div className="px-4 md:px-6 lg:px-8 py-6">
          <p className="text-[var(--state-danger-text)] text-sm">tableId inválido.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[60vh]">
      <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Cadastro de Tabela de Pontuação</h1>
            <p className="text-sm text-[var(--text-secondary)]">Tabela #{tableId} · editar por bloco</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                         text-xs text-[var(--btn-secondary-text)]
                         hover:bg-[var(--btn-secondary-hover-bg)] transition"
            >
              Voltar
            </Link>

            <button
              type="button"
              onClick={addNode}
              disabled={saving || loadingStructure || !selectedBlockDraftId}
              className="px-4 py-2 rounded-full border border-[var(--btn-secondary-border)]
                         text-xs text-[var(--btn-secondary-text)]
                         hover:bg-[var(--btn-secondary-hover-bg)] transition
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Adicionar SubItem
            </button>

            <button
              type="button"
              onClick={handleSalvarTudo}
              disabled={saving || loadingStructure || !selectedBlockDraftId}
              className="inline-flex items-center rounded-full px-6 py-2 text-xs font-semibold
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)]
                         disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </header>

        {(infoMessage || error) && (
          <div className="space-y-2">
            {infoMessage && <p className="text-xs text-[var(--state-success-text)]">{infoMessage}</p>}
            {error && <p className="text-xs text-[var(--state-danger-text)]">{error}</p>}

            {details && details.length > 0 && (
              <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-3">
                <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-1">Detalhes</div>
                <ul className="list-disc pl-5 space-y-1">
                  {details.map((d, i) => (
                    <li key={i} className="text-[11px] text-[var(--text-secondary)]">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <section className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm space-y-2">
          <label className="block text-[11px] text-[var(--text-secondary)]">Selecione o bloco</label>

          <select
            className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                       bg-[var(--surface-bg)] px-4 py-2
                       text-[var(--text-primary)]
                       focus:outline-none focus:border-[var(--border-strong)]"
            value={selectedBlockDraftId || ""}
            onChange={e => handleSelectBlock(e.target.value)}
            disabled={saving || loadingStructure}
          >
            <option value="">(selecione…)</option>

            {blocks.map(b => (
              <option key={b.draftId} value={b.draftId}>
                {b.name?.trim() ? `${b.name} (${b.code || "sem código"})` : b.draftId}
              </option>
            ))}

            <option value="__NEW__">+ Novo bloco</option>
          </select>

          {!selectedBlockDraftId && (
            <p className="text-[11px] text-[var(--text-secondary)]">
              Selecione um bloco existente para editar, ou escolha <b>Novo bloco</b> para cadastrar um do zero.
            </p>
          )}
        </section>
        {selectedBlockDraftId && (
          <section className="space-y-4">
            {visibleNodes.map((node, nodeIndex) => {
              const isPersisted = !!node.idScoringNode
              const isRootBlock = node.draftId === selectedBlockDraftId

              const parentOptions = visibleNodes.filter(n => n.draftId !== node.draftId)

              return (
                <div
                  key={node.draftId}
                  className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {isRootBlock ? "Bloco (raiz)" : `SubItem ${nodeIndex + 1}`}
                        {isPersisted ? ` · #${node.idScoringNode}` : " · (novo)"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeNode(node.draftId)}
                      disabled={saving || loadingStructure || isPersisted || isRootBlock}
                      title={
                        isRootBlock
                          ? "O bloco raiz não pode ser removido aqui."
                          : isPersisted
                            ? "Remoção de nó já salvo não está implementada (sem delete no backend)."
                            : ""
                      }
                      className="px-4 py-2 rounded-full border border-[var(--border-subtle)]
                                 text-[11px] font-medium text-[var(--text-secondary)]
                                 hover:bg-[var(--surface-muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] text-[var(--text-secondary)]">Nome</label>
                      <input
                        className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                   bg-[var(--surface-bg)] px-4 py-2
                                   text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--border-strong)]"
                        value={node.name}
                        onChange={e => updateNode(node.draftId, { name: e.target.value })}
                        disabled={saving || loadingStructure}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] text-[var(--text-secondary)]">Código</label>
                      <input
                        className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                   bg-[var(--surface-bg)] px-4 py-2
                                   text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--border-strong)]"
                        value={node.code}
                        onChange={e => updateNode(node.draftId, { code: e.target.value })}
                        placeholder="Ex: DOC"
                        disabled={saving || loadingStructure}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] text-[var(--text-secondary)]">Ordem</label>
                      <input
                        className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                   bg-[var(--surface-bg)] px-4 py-2
                                   text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--border-strong)]"
                        value={String(node.sortOrder)}
                        onChange={e => updateNode(node.draftId, { sortOrder: Number(e.target.value) })}
                        disabled={saving || loadingStructure}
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-[11px] text-[var(--text-secondary)]">Pai</label>

                      <select
                        className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                   bg-[var(--surface-bg)] px-4 py-2
                                   text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--border-strong)]"
                        value={node.parentDraftId ?? ""}
                        onChange={e => updateNode(node.draftId, { parentDraftId: e.target.value || null })}
                        disabled={saving || loadingStructure || isRootBlock}
                      >
                        <option value="">(raiz)</option>
                        {parentOptions.map(n => (
                          <option key={n.draftId} value={n.draftId}>
                            {n.name?.trim() ? `${n.name} (${n.code || "sem código"})` : n.draftId}
                          </option>
                        ))}
                      </select>

                      {isRootBlock && (
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          O bloco raiz sempre fica como “raiz”.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] text-[var(--text-secondary)]">Fórmula</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={node.hasFormula}
                          onChange={e => updateNode(node.draftId, { hasFormula: e.target.checked })}
                          disabled={saving || loadingStructure}
                        />
                        <span className="text-xs text-[var(--text-primary)]">Possui fórmula</span>
                      </div>
                    </div>

                    {node.hasFormula && (
                      <div className="space-y-1 md:col-span-3">
                        <label className="block text-[11px] text-[var(--text-secondary)]">Expressão</label>
                        <input
                          className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                     bg-[var(--surface-bg)] px-4 py-2
                                     text-[var(--text-primary)]
                                     focus:outline-none focus:border-[var(--border-strong)]"
                          value={node.formulaExpression}
                          onChange={e => updateNode(node.draftId, { formulaExpression: e.target.value })}
                          placeholder="Ex: A * 0.5 + B"
                          disabled={saving || loadingStructure}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Itens</div>

                      <button
                        type="button"
                        onClick={() => addItem(node.draftId)}
                        disabled={saving || loadingStructure}
                        className="px-4 py-2 rounded-full border border-[var(--border-subtle)]
                                   text-[11px] font-medium text-[var(--text-secondary)]
                                   hover:bg-[var(--surface-muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Adicionar item
                      </button>
                    </div>

                    {node.items.map((item, idx) => {
                      const itemPersisted = !!item.idScoringItem

                      return (
                        <div
                          key={item.idScoringItem ? `db_${item.idScoringItem}` : idx}
                          className="border border-[var(--border-subtle)] rounded-2xl p-3 bg-[var(--surface-muted-bg)] space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-[var(--text-primary)]">
                              Item {idx + 1} {itemPersisted ? `· #${item.idScoringItem}` : "· (novo)"}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(node.draftId, idx)}
                              disabled={saving || loadingStructure || itemPersisted}
                              title={itemPersisted ? "Remoção de item já salvo não está implementada (sem delete no backend)." : ""}
                              className="px-4 py-2 rounded-full border border-[var(--border-subtle)]
                                         text-[11px] font-medium text-[var(--text-secondary)]
                                         hover:bg-[var(--surface-muted)] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Remover
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1 md:col-span-2">
                              <label className="block text-[11px] text-[var(--text-secondary)]">Descrição</label>
                              <input
                                className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                           bg-[var(--surface-bg)] px-4 py-2
                                           text-[var(--text-primary)]
                                           focus:outline-none focus:border-[var(--border-strong)]"
                                value={item.description}
                                onChange={e => updateItem(node.draftId, idx, { description: e.target.value })}
                                disabled={saving || loadingStructure}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[11px] text-[var(--text-secondary)]">Unidade</label>
                              <input
                                className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                           bg-[var(--surface-bg)] px-4 py-2
                                           text-[var(--text-primary)]
                                           focus:outline-none focus:border-[var(--border-strong)]"
                                value={item.unit}
                                onChange={e => updateItem(node.draftId, idx, { unit: e.target.value })}
                                disabled={saving || loadingStructure}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[11px] text-[var(--text-secondary)]">Pontos</label>
                              <input
                                className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                           bg-[var(--surface-bg)] px-4 py-2
                                           text-[var(--text-primary)]
                                           focus:outline-none focus:border-[var(--border-strong)]"
                                value={item.points}
                                onChange={e => updateItem(node.draftId, idx, { points: e.target.value })}
                                disabled={saving || loadingStructure}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[11px] text-[var(--text-secondary)]">Máximo</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.hasMaxPoints}
                                  onChange={e => updateItem(node.draftId, idx, { hasMaxPoints: e.target.checked })}
                                  disabled={saving || loadingStructure}
                                />
                                <span className="text-xs text-[var(--text-primary)]">Possui pontuação máxima</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[11px] text-[var(--text-secondary)]">Pontuação máxima</label>
                              <input
                                className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                           bg-[var(--surface-bg)] px-4 py-2
                                           text-[var(--text-primary)]
                                           focus:outline-none focus:border-[var(--border-strong)]"
                                value={item.maxPoints}
                                onChange={e => updateItem(node.draftId, idx, { maxPoints: e.target.value })}
                                disabled={saving || loadingStructure || !item.hasMaxPoints}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[11px] text-[var(--text-secondary)]">Variável da expressão</label>
                              <input
                                className="w-full text-sm rounded-full border border-[var(--border-subtle)]
                                           bg-[var(--surface-bg)] px-4 py-2
                                           text-[var(--text-primary)]
                                           focus:outline-none focus:border-[var(--border-strong)]"
                                value={item.formulaKey}
                                onChange={e => updateItem(node.draftId, idx, { formulaKey: e.target.value })}
                                placeholder="Ex: A"
                                disabled={saving || loadingStructure}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {node.items.length === 0 && (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Nenhum item cadastrado neste subitem (permitido para subitem pai).
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
