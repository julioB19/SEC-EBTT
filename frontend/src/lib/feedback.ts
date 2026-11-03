import { translateBackendError } from "../utils/translateBackendError"
export type FeedbackKind = "success" | "error" | "info"
export type Feedback = { id: number; kind: FeedbackKind; message: string; title?: string; source?: "request" | "screen" }
let current: Feedback | null = null
let sequence = 0
const queue: Feedback[] = []
const listeners = new Set<() => void>()
const fallbacks = new Map<ReturnType<typeof setTimeout>, FeedbackKind>()

export function cancelFallbackFeedback() {
  fallbacks.forEach((_kind, timer) => clearTimeout(timer))
  fallbacks.clear()
}

export function supersedeFallbackFeedback(kind: FeedbackKind) {
  const matching = Array.from(fallbacks).reverse().find(([, pendingKind]) => pendingKind === kind)
  if (matching) { clearTimeout(matching[0]); fallbacks.delete(matching[0]) }
}

function publish(message: string, kind: FeedbackKind, title: string | undefined, source: "request" | "screen") {
  if (!message.trim()) return
  message = translateBackendError({ message })
  if (current?.message === message && current.kind === kind) return
  if (queue.some(item => item.message === message && item.kind === kind)) return
  const next: Feedback = { id: ++sequence, kind, message, title, source }
  if (!current) current = next
  else queue.push(next)
  listeners.forEach(listener => listener())
}

export function notifyFeedback(message: string, kind: FeedbackKind = "info", title?: string) {
  if (!message.trim()) return
  const translated = translateBackendError({ message })
  // A detailed message for an already visible request updates that same popup.
  if (current?.source === "request" && current.kind === kind) {
    current = { ...current, message: translated, title, source: "screen" }
    listeners.forEach(listener => listener())
    return
  }
  supersedeFallbackFeedback(kind)
  publish(translated, kind, title, "screen")
}

export function scheduleFallbackFeedback(message: string, kind: FeedbackKind) {
  const timer = setTimeout(() => {
    fallbacks.delete(timer)
    publish(message, kind, undefined, "request")
  }, 350)
  fallbacks.set(timer, kind)
}

export function dismissFeedback() {
  current = queue.shift() ?? null
  listeners.forEach(listener => listener())
}
export const feedbackSnapshot = () => current
export const serverFeedbackSnapshot = () => null
export function subscribeFeedback(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function classifyFeedback(message: string): FeedbackKind {
  if (/falh|erro|inválid|invalido|não foi|nao foi|não é|não pode|não há|obrigat|preencha|informe|selecione|bloquead|recusad|expirad|negad|insuficiente/i.test(message)) return "error"
  if (/sucesso|salv[oa]|criad|atualizad|registrad|ativad|excluíd|excluid|removid|enviad|copiad|anexad|vinculad|concluíd|concluid|gerad/i.test(message)) return "success"
  return "info"
}
