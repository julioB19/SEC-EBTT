"use client"
import { useEffect, useRef } from "react"
import { supersedeFallbackFeedback } from "@/lib/feedback"
import { primaryButtonClass } from "@/components/ui/systemStyles"
import Dialog from "@/components/ui/Dialog"

interface ModalProps {
  open: boolean
  title: string
  message: string
  variant?: "success" | "error" | "info"
  managed?: boolean
  onClose: () => void
}

export default function Modal({ open, title, message, variant = "info", managed = false, onClose }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open && !managed) supersedeFallbackFeedback(variant) }, [open, managed, variant])
  return <Dialog open={open} title={title} description={message} initialFocus={closeRef} onRequestClose={onClose} footer={<button ref={closeRef} type="button" className={primaryButtonClass} onClick={onClose}>Entendi</button>}>
    <span className="sr-only">{variant === "error" ? "Erro" : variant === "success" ? "Sucesso" : "Informação"}</span>
  </Dialog>
}
