"use client"
import { ReactNode, RefObject, useEffect, useId, useRef } from "react"

type Props = {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  footer: ReactNode
  initialFocus?: RefObject<HTMLButtonElement | null>
  closeDisabled?: boolean
  onRequestClose: () => void
}

export default function Dialog({ open, title, description, children, footer, initialFocus, closeDisabled = false, onRequestClose }: Props) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onRequestClose)
  const busyRef = useRef(closeDisabled)
  closeRef.current = onRequestClose
  busyRef.current = closeDisabled
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) dialog.showModal()
    initialFocus?.current?.focus()
    const cancel = (event: Event) => { event.preventDefault(); if (!busyRef.current) closeRef.current() }
    dialog.addEventListener("cancel", cancel)
    return () => { dialog.removeEventListener("cancel", cancel); dialog.close(); if (previous?.isConnected) previous.focus() }
  }, [open, initialFocus])
  if (!open) return null
  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-6 text-[var(--text-primary)] shadow-xl backdrop:bg-black/50" onClick={event => {
    if (event.target !== event.currentTarget || closeDisabled) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onRequestClose()
  }}>
    <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
    {description && <p id={descriptionId} className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
    {children}
    <div className="mt-6 flex justify-end gap-3">{footer}</div>
  </dialog>
}
