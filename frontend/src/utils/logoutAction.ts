"use client"

export function logoutAction() {
  fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  }).finally(() => {
    window.location.href = "/login"
  })
}
