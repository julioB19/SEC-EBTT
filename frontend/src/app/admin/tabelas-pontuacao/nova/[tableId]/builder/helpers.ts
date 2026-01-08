import { UiNode } from "./types"

export function makeDraftId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function normalizeCode(value: string) {
  return String(value ?? "").trim().toUpperCase()
}

function normalizeFormulaKey(value: string) {
  const v = String(value ?? "").trim().toUpperCase()
  return v ? v : null
}

function normalizeNullableString(value: string) {
  const v = String(value ?? "").trim()
  return v ? v : null
}

export function buildSaveBlockPayload(blockName: string, nodes: UiNode[]) {
  const bn = String(blockName ?? "").trim()

  return {
    blockName: bn,
    nodes: nodes.map((n, idx) => ({
      draftId: String(n.draftId ?? "").trim(),
      name: String(n.name ?? "").trim(),
      code: normalizeCode(n.code),
      parentDraftId: normalizeNullableString(String(n.parentDraftId ?? "")),
      sortOrder: n.sortOrder && n.sortOrder > 0 ? n.sortOrder : idx + 1,
      hasFormula: !!n.hasFormula,
      formulaExpression: n.hasFormula ? normalizeNullableString(String(n.formulaExpression ?? "")) : null,
      items: (n.items ?? []).map(i => ({
        description: String(i.description ?? "").trim(),
        unit: normalizeNullableString(String(i.unit ?? "")),
        points: String(i.points ?? "0"),
        hasMaxPoints: !!i.hasMaxPoints,
        maxPoints: i.hasMaxPoints ? normalizeNullableString(String(i.maxPoints ?? "")) : null,
        formulaKey: normalizeFormulaKey(String(i.formulaKey ?? ""))
      }))
    }))
  }
}
