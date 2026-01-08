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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        className="
          relative z-[101] w-full max-w-md
          rounded-2xl border border-gray-200
          bg-white text-gray-900 shadow-2xl px-6 py-5
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h2
          id="confirm-title"
          className="text-lg font-semibold"
        >
          {title}
        </h2>

        {description && (
          <p className="mt-2 text-sm text-gray-600">
            {description}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="
              px-4 py-2 rounded-xl text-sm
              border border-gray-300
              bg-white text-gray-800
              hover:bg-gray-50
              disabled:opacity-60
            "
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="
              px-4 py-2 rounded-xl text-sm font-medium
              bg-black text-white
              hover:opacity-90
              disabled:opacity-60
            "
          >
            {loading ? "Confirmando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
