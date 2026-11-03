import { clientFetch as fetch } from "./clientFetch"
"use client"

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  })
  // limpa o sessionStorage (roles temporárias, se houver)
  sessionStorage.clear()
  // redireciona pro login
  window.location.href = "/login"
}
