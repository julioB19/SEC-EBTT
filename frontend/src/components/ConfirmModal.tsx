"use client"

import { useEffect, useRef } from "react"

type Props = {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
  onConfirm,
  onCancel
}: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="
        fixed inset-0 z-[70]
        flex items-center justify-center
        p-4
        bg-black/40
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="
          w-full max-w-md
          rounded-2xl
          bg-white
          bg-[var(--surface-card)]
          border border-[var(--border-subtle)]
          shadow-xl
          p-6
        "
      >
        <h2
          id="confirm-title"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          {title}
        </h2>

        {description && (
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {description}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="
              px-4 py-2 rounded-xl text-sm
              border border-[var(--border-subtle)]
              bg-white bg-[var(--surface-card)]
              text-[var(--text-primary)]
              hover:bg-[var(--surface-muted)]
              disabled:opacity-60
            "
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="
              px-4 py-2 rounded-xl text-sm font-medium
              bg-[var(--btn-primary-bg)]
              text-[var(--btn-primary-text)]
              hover:bg-[var(--btn-primary-hover-bg)]
              disabled:opacity-60
            "
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Confirmando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
