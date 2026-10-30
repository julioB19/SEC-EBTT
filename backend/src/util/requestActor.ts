import { AsyncLocalStorage } from "async_hooks"
export const requestActor = new AsyncLocalStorage<{ userId: number }>()
export function auditActor(fallback: number) { return requestActor.getStore()?.userId ?? fallback }
