"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function onlyDigits(input: string) {
  let out = ""
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") out += ch
  }
  return out
}

function formatCPF(raw: string) {
  const d = onlyDigits(raw).slice(0, 11)

  const p1 = d.slice(0, 3)
  const p2 = d.slice(3, 6)
  const p3 = d.slice(6, 9)
  const p4 = d.slice(9, 11)

  let out = ""
  if (p1) out += p1
  if (p2) out += `.${p2}`
  if (p3) out += `.${p3}`
  if (p4) out += `-${p4}`
  return out
}

export default function ResetPasswordClient() {
  const sp = useSearchParams()
  const router = useRouter()

  const [cpf, setCpf] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const qCpf = sp.get("cpf")
    if (qCpf) setCpf(formatCPF(qCpf))

    const qCode = sp.get("code")
    if (qCode) setCode(onlyDigits(qCode).slice(0, 6))
  }, [sp])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMsg(null)

    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem")
      return
    }

    setLoading(true)

    const r = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf: onlyDigits(cpf),
        code: onlyDigits(code),
        newPassword
      })
    })

    const json = await r.json().catch(() => null)
    setLoading(false)

    if (!r.ok) {
      setError(json?.message ?? "Não foi possível redefinir a senha")
      return
    }

    setMsg(json?.message ?? "Senha atualizada com sucesso")

    setTimeout(() => router.push("/login"), 800)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-muted)] p-4">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6 text-center">
        SEC-EBTT
      </h1>

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
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Redefinir senha
        </h2>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">CPF</label>
          <input
            value={cpf}
            onChange={e => setCpf(formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="
              w-full border border-[var(--border-subtle)]
              rounded-xl px-3 py-2 text-sm
              bg-white
              text-[var(--text-primary)]
              placeholder:text-[var(--text-secondary)]
              outline-none
              focus:ring-2 focus:ring-[var(--brand)]
            "
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">
            Código (6 dígitos)
          </label>
          <input
            value={code}
            onChange={e => setCode(onlyDigits(e.target.value).slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            className="
              w-full border border-[var(--border-subtle)]
              rounded-xl px-3 py-2 text-sm
              bg-white
              text-[var(--text-primary)]
              placeholder:text-[var(--text-secondary)]
              outline-none
              focus:ring-2 focus:ring-[var(--brand)]
            "
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">Nova senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
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
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">
            Confirmar nova senha
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
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
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 p-2 rounded-xl">
            {error}
          </p>
        )}

        {msg && (
          <p className="text-green-700 text-sm bg-green-50 border border-green-200 p-2 rounded-xl">
            {msg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full rounded-xl px-4 py-2 text-sm font-medium
            bg-[var(--btn-primary-bg)]
            text-[var(--btn-primary-text)]
            hover:bg-[var(--btn-primary-hover-bg)]
            disabled:opacity-50
          "
        >
          {loading ? "Salvando..." : "Alterar senha"}
        </button>

        <div className="pt-2 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-[var(--brand)] hover:underline"
          >
            Pedir outro código
          </a>
        </div>
      </form>
    </div>
  )
}
