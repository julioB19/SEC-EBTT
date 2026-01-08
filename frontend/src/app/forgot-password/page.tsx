"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Modal from "@/components/Modal"

type ModalVariant = "success" | "error" | "info"

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

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

export default function ForgotPasswordPage() {
  const [cpf, setCpf] = useState("")
  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  const router = useRouter()

  function openModal(payload: Omit<ModalState, "open">) {
    setModal({ open: true, ...payload })
  }

  function closeModal() {
    setModal(prev => ({ ...prev, open: false }))

    const cpfDigits = onlyDigits(cpf)
    const q = encodeURIComponent(cpfDigits)
    router.push(`/reset-password?cpf=${q}`)
  }

  function onCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(formatCPF(e.target.value))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const cpfDigits = onlyDigits(cpf)

      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits })
      })

      const json = await r.json().catch(() => null)

      if (!r.ok) {
        openModal({
          title: "Erro",
          message: json?.message ?? "Não foi possível solicitar o código.",
          variant: "error"
        })
        return
      }

      openModal({
        title: "Código enviado",
        message:
          "Caso seu cadastro seja localizado pelo CPF informado, enviaremos um código no e-mail cadastrado.",
        variant: "info"
      })
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message ?? "Ocorreu um erro ao solicitar o código.",
        variant: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-muted)] p-4">
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6 text-center">
        SEC-EBTT
      </h1>

      <form
        onSubmit={onSubmit}
        className="
          w-full max-w-sm
          bg-[var(--surface-card)]
          border border-[var(--border-subtle)]
          rounded-2xl shadow-sm
          p-6 space-y-5
        "
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Esqueci minha senha
        </h2>

        <p className="text-sm text-[var(--text-secondary)]">
          Informe seu CPF para receber um código de redefinição.
        </p>

        <div className="space-y-1">
          <label className="block text-sm text-[var(--text-secondary)]">CPF</label>
          <input
            value={cpf}
            onChange={onCpfChange}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="
              w-full border border-[var(--border-subtle)]
              rounded-xl px-3 py-2 text-sm
              bg-[var(--surface-card)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-secondary)]
              outline-none
              focus:ring-2 focus:ring-[var(--brand)]
            "
          />
        </div>

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
          {loading ? "Enviando..." : "Enviar código"}
        </button>

        <div className="pt-2 text-center">
          <a href="/login" className="text-sm text-[var(--brand)] hover:underline">
            Voltar para o login
          </a>
        </div>
      </form>
    </div>
  )
}
