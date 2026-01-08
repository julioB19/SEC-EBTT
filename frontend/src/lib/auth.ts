import { cookies } from "next/headers"

export async function getAccessTokenFromCookies() {
  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function isAuthenticated() {
  const token = await getAccessTokenFromCookies()
  return Boolean(token)
}
