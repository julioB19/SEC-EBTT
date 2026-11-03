import { scheduleFallbackFeedback } from "./feedback"

export type ClientRequestInit = RequestInit & { feedback?: "auto" | "silent" }

export function isUserMutation(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase()
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false
  let pathname: string
  try {
    const parsed = new URL(url, "http://app.local")
    if (!url.startsWith("/") && typeof window !== "undefined" && parsed.origin !== window.location.origin) return false
    pathname = parsed.pathname
  } catch { return false }
  if (!pathname.startsWith("/api/")) return false
  return !/^\/api\/(auth\/|acesso\/(status|google-start|google-complete|verify-email|send-code|invitation|config|campuses))/.test(pathname)
}

export async function clientFetch(input: RequestInfo | URL, init?: ClientRequestInit): Promise<Response> {
  const { feedback = "auto", ...requestInit } = init ?? {}
  const report = typeof window !== "undefined" && feedback !== "silent" && isUserMutation(input, requestInit)
  try {
    const response = await fetch(input, requestInit)
    if (report && response.status !== 401) {
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.clone().json().catch(() => null) : null
      const succeeded = response.ok && !["error", "ERROR", "INVALID_INPUT", "BUSINESS_RULE_ERROR"].includes(payload?.status)
      const message = typeof payload?.message === "string" && payload.message.trim() && !/^(success|ok)$/i.test(payload.message.trim())
        ? payload.message : succeeded ? "Operação concluída com sucesso." : "Não foi possível concluir a operação. Tente novamente."
      scheduleFallbackFeedback(message, succeeded ? "success" : "error")
    }
    return response
  } catch (cause) {
    if (report && !(cause instanceof Error && cause.name === "AbortError")) {
      scheduleFallbackFeedback("Não foi possível comunicar com o sistema. Verifique sua conexão e tente novamente.", "error")
    }
    throw cause
  }
}
