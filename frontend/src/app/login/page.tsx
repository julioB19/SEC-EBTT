"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"
import { GoogleEntry } from "@/components/GoogleEntry"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

function pathForRole(role: Role | null | undefined) {
  if (role === "DOCENTE") return "/docente"
  if (role === "CPPD_MEMBER" || role === "CPPD_CENTRAL") return "/cppd"
  if (role === "ADMIN") return "/admin"
  if (role === "EXTERNAL_EVALUATOR") return "/avaliador"
  return "/dashboard"
}

export default function LoginPage() {
  const [cpf, setCpf] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useFeedbackState<string | null>(null, "error")
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cpf, password })
    })

    const json = await r.json()
    setLoading(false)

    if (!r.ok) {
      setError(json?.message ?? "Falha no login")
      return
    }

    const data = json as {
      roles?: Role[]
      selectedRole?: Role | null
      needsProfileSelection?: boolean
    }

    if (data.needsProfileSelection) {
      sessionStorage.setItem("roles", JSON.stringify(data.roles ?? []))
      sessionStorage.setItem("selectedRole", JSON.stringify(data.selectedRole ?? null))
      router.push("/select-role")
      return
    }

    if (data.selectedRole) {
      router.push(pathForRole(data.selectedRole))
      return
    }

    if (Array.isArray(data.roles) && data.roles.length === 1) {
      router.push(pathForRole(data.roles[0]))
      return
    }

    router.push("/dashboard")

} catch {
setError("Não foi possível entrar. Verifique sua conexão e tente novamente.")
} finally {
setLoading(false)
}
}

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-muted)] p-4">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6 text-center">SEC-EBTT</h1>

      <form
        onSubmit={onSubmit}
        className="
          w-full max-w-sm
          bg-white
          border border-[var(--border-subtle)]
          rounded-2xl shadow-sm
          p-6 space-y-5
        "
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Entrar</h2>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">CPF</label>
          <FormInput
            value={cpf}
            onChange={e => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            className="
              w-full border border-[var(--border-subtle)]
              rounded-xl px-3 py-2 text-sm
              bg-white
              text-[var(--text-primary)]
              placeholder:text-[var(--text-secondary)]
              outline-none
              focus:ring-2 focus:ring-[var(--brand)]
            "
           fieldKind={"cpf"}  aria-label="CPF" />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">Senha</label>
          <FormInput
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="
              w-full border border-[var(--border-subtle)]
              rounded-xl px-3 py-2 text-sm
              bg-white
              text-[var(--text-primary)]
              placeholder:text-[var(--text-secondary)]
              outline-none
              focus:ring-2 focus:ring-[var(--brand)]
            "
           aria-label="Senha" />
        </div>

        {error && null}

        <ActionButton
          type="submit"
          disabled={loading}
          className="
            w-full rounded-xl px-4 py-2 text-sm font-medium
            bg-[var(--btn-primary-bg)]
            text-[var(--btn-primary-text)]
            hover:bg-[var(--btn-primary-hover-bg)]
            disabled:opacity-50
          "
         disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
          {loading ? "Entrando..." : "Entrar"}
        </ActionButton>

        <GoogleEntry />
        <div className="pt-2 text-center">
          <a href="/forgot-password" className="text-sm text-[var(--brand)] hover:underline">
            Esqueci minha senha
          </a>
        </div>

        <div className="pt-2 text-center">
          <span className="text-sm text-[var(--text-secondary)]">Não tem conta?</span>{" "}
          <a href="/register-professor" className="text-sm text-[var(--brand)] hover:underline">
            Cadastre-se
          </a>
        </div>
      </form>
    </div>
  )
}
