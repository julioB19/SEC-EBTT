"use client"

import BackButton from "@/components/ui/BackButton"
import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import { FormEvent, Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function InvitationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [cpf, setCpf] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useFeedbackState<string | null>(null, "error")
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    const queryEmail = searchParams.get("email")
    const queryCode = searchParams.get("code")
    if (queryEmail) setEmail(current => current || queryEmail)
    if (queryCode) setCode(current => current || queryCode)
  }, [searchParams])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword !== confirmation) {
      setError("As senhas informadas não coincidem.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, cpf, newPassword })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.message ?? "Não foi possível concluir o cadastro.")
        return
      }

      setCompleted(true)
    } catch {
      setError("Não foi possível conectar ao sistema.")
    } finally {
      setLoading(false)
    }
  }

  if (completed) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Cadastro concluído</h1>
<BackButton />
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Seu acesso foi ativado. Entre usando seu CPF e a senha definida agora.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="mt-5 w-full rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]"
        >
          Ir para o login
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm"
    >
      <div>
        <BackButton />
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Concluir cadastro</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Defina os dados que serão usados no seu acesso.</p>
      </div>

      <label className="block space-y-1 text-sm text-[var(--text-secondary)]">
        <span>E-mail</span>
        <FormInput
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          required
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
         fieldKind={"email"} />
      </label>

      <label className="block space-y-1 text-sm text-[var(--text-secondary)]">
        <span>Código do convite</span>
        <FormInput
          value={code}
          onChange={event => setCode(event.target.value)}
          required
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block space-y-1 text-sm text-[var(--text-secondary)]">
        <span>CPF</span>
        <FormInput
          value={cpf}
          onChange={event => setCpf(event.target.value)}
          placeholder="000.000.000-00"
          required
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
         fieldKind={"cpf"} />
      </label>

      <label className="block space-y-1 text-sm text-[var(--text-secondary)]">
        <span>Senha</span>
        <FormInput
          type="password"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          minLength={8}
          required
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block space-y-1 text-sm text-[var(--text-secondary)]">
        <span>Confirmar senha</span>
        <FormInput
          type="password"
          value={confirmation}
          onChange={event => setConfirmation(event.target.value)}
          minLength={8}
          required
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      {error && null}

      <ActionButton
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-60"
       disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
        {loading ? "Concluindo..." : "Concluir cadastro"}
      </ActionButton>
    </form>
  )
}

export default function AcceptInvitationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface-muted)] p-4">
      <div className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">SEC-EBTT</div>
      <Suspense fallback={<p className="text-sm text-[var(--text-secondary)]">Carregando convite...</p>}>
        <InvitationForm />
      </Suspense>
    </main>
  )
}
