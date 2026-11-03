"use client"
import { ReactNode, useRef } from "react"
import ActionButton from "@/components/ui/ActionButton"
import Dialog from "@/components/ui/Dialog"
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/systemStyles"
import { translateBackendError } from "@/utils/translateBackendError"

type Props = {
  children?: ReactNode
  open: boolean
  title: string
  description?: string
  error?: string | null
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ children, open, title, description, error, confirmText = "Confirmar", cancelText = "Cancelar", loading = false, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return <Dialog open={open} title={title} description={description} initialFocus={cancelRef} closeDisabled={loading} onRequestClose={onCancel} footer={<>
    <ActionButton ref={cancelRef} type="button" className={secondaryButtonClass} onClick={onCancel} disabled={loading} disabledReason="Aguarde o registro da operação antes de fechar ou confirmar novamente.">{cancelText}</ActionButton>
    <ActionButton type="button" className={primaryButtonClass} onClick={onConfirm} disabled={loading} disabledReason="Aguarde o registro da operação antes de fechar ou confirmar novamente.">{loading ? "Confirmando..." : confirmText}</ActionButton>
  </>}>
    {children}
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{translateBackendError({ message: error })}</p>}
  </Dialog>
}
