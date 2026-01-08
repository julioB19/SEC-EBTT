"use client"

type ModalVariant = "success" | "error" | "info"

interface ModalProps {
  open: boolean
  title: string
  message: string
  variant?: ModalVariant
  onClose: () => void
}

export default function Modal({
  open,
  title,
  message,
  variant = "info",
  onClose
}: ModalProps) {
  if (!open) return null

  const variantStyles = {
    success: {
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-700",
      titleColor: "text-emerald-800"
    },
    error: {
      iconBg: "bg-red-50",
      iconColor: "text-red-700",
      titleColor: "text-red-800"
    },
    info: {
      iconBg: "bg-slate-50",
      iconColor: "text-slate-600",
      titleColor: "text-slate-900"
    }
  }[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="
          bg-white
          border border-slate-200
          rounded-2xl shadow-lg max-w-sm w-full mx-4 overflow-hidden
        "
      >
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <h2 className={`text-sm font-semibold ${variantStyles.titleColor}`}>
            {title}
          </h2>
        </div>

        <div className="px-4 py-5 text-sm text-slate-800 flex gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center ${variantStyles.iconBg}`}
          >
            {variant === "success" && (
              <span className={`text-lg font-bold ${variantStyles.iconColor}`}>
                ✓
              </span>
            )}
            {variant === "error" && (
              <span className={`text-lg font-bold ${variantStyles.iconColor}`}>
                !
              </span>
            )}
            {variant === "info" && (
              <span className={`text-lg font-bold ${variantStyles.iconColor}`}>
                i
              </span>
            )}
          </div>

          <p className="leading-relaxed">{message}</p>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="
              w-full px-4 py-2 text-sm font-medium rounded-xl
              bg-slate-900 text-white
              hover:bg-slate-800
              transition
            "
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
