const revokedAccessTokens = new Set<string>()
const revokedRefreshTokens = new Set<string>()

export function revokeAccessToken(token: string): void {
  if (token) revokedAccessTokens.add(token)
}

export function revokeRefreshToken(token: string): void {
  if (token) revokedRefreshTokens.add(token)
}

export function isAccessTokenRevoked(token: string): boolean {
  return revokedAccessTokens.has(token)
}

export function isRefreshTokenRevoked(token: string): boolean {
  return revokedRefreshTokens.has(token)
}

export function isLikelyJwt(token: string | undefined): boolean {
  if (!token) return false
  return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token.trim())
}

