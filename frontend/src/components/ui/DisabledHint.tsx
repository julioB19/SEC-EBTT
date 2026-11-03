"use client"
import { ReactNode, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export default function DisabledHint({ disabled, reason, children, fullWidth = false, className = "", descriptionId }: { disabled?: boolean; reason?: string; children: ReactNode; fullWidth?: boolean; className?: string; descriptionId?: string }) {
  const generatedId = useId()
  const id = descriptionId ?? generatedId
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [placement, setPlacement] = useState<{ left: number; top: number; below: boolean; host: Element } | null>(null)
  const text = reason || "Este controle está indisponível na etapa atual."
  useLayoutEffect(() => {
    if (!visible || !disabled || !anchorRef.current) { setPlacement(null); return }
    const rect = anchorRef.current.getBoundingClientRect()
    const width = Math.min(352, window.innerWidth - 24)
    const below = rect.top < 130
    setPlacement({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: below ? rect.bottom + 8 : rect.top - 8, below, host: anchorRef.current.closest("dialog[open]") || document.body })
    const close = () => setVisible(false)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close) }
  }, [visible, disabled])
  const show = Boolean(disabled && visible && placement)
  return <span ref={anchorRef} className={`${fullWidth ? "block min-w-0 w-full" : "inline-flex max-w-full align-middle"} ${disabled ? "cursor-not-allowed" : ""} ${className}`} tabIndex={disabled ? 0 : undefined} role={disabled ? "group" : undefined} aria-label={disabled ? "Controle indisponível" : undefined} aria-describedby={disabled ? id : undefined} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onFocus={() => setVisible(true)} onBlur={() => setVisible(false)} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setVisible(false) } }}>
    {children}
    {disabled && !show && <span id={id} role="tooltip" className="sr-only">{text}</span>}
    {show && placement && createPortal(<span id={id} role="tooltip" style={{ position: "fixed", left: placement.left, top: placement.top, transform: placement.below ? undefined : "translateY(-100%)", width: "max-content", maxWidth: "min(22rem, calc(100vw - 24px))" }} className="pointer-events-none z-[100] rounded-xl bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case leading-5 tracking-normal text-white shadow-lg">{text}</span>, placement.host)}
  </span>
}
