"use client"
import { usePathname, useRouter } from "next/navigation"
import { secondaryButtonClass } from "./systemStyles"

export function parentPage(pathname: string) {
  if (/^\/avaliador\/avaliacoes\//.test(pathname)) return "/avaliador"
  if (/^\/docente\/processos\/\d+\//.test(pathname)) return pathname.replace(/\/[^/]+$/, "")
  if (/^\/cppd\/processos\/\d+\//.test(pathname)) return "/cppd/processos"
  if (/^\/admin\/tabelas-pontuacao\//.test(pathname)) return "/admin/tabelas-pontuacao"
  if (pathname === "/perfil") return "/dashboard"
  if (/^\/(login|register-professor|forgot-password|reset-password|accept-invitation|acesso|select-role|forbidden)$/.test(pathname)) return "/login"
  const parts = pathname.split("/").filter(Boolean)
  return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : "/dashboard"
}

export default function BackButton() {
  const pathname = usePathname()
  const router = useRouter()
  if (["/admin", "/cppd", "/docente", "/avaliador", "/login", "/dashboard", "/"].includes(pathname)) return null
  return <div className="mx-auto mb-4 w-full max-w-6xl"><button type="button" className={secondaryButtonClass} onClick={() => router.push(parentPage(pathname))}><span aria-hidden="true" className="mr-2">←</span>Voltar</button></div>
}
