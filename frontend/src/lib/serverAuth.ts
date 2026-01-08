import { cookies } from "next/headers"

export async function getAccessTokenFromCookies(): Promise<string | null> {
  const jar = await cookies()
  const raw = jar.get("accessToken")?.value
  return raw || null
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAccessTokenFromCookies()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
