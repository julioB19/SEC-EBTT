export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const r = await fetch(input, {
    ...init,
    credentials: "include"
  })

  if (r.status !== 401) return r

  const rr = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  })
  if (!rr.ok) return r

  return fetch(input, {
    ...init,
    credentials: "include"
  })
}
