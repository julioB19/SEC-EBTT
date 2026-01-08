"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

type Props = { children: React.ReactNode }

export function ProfileMenuShell({ children }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full
                   bg-[var(--gray-800)] text-[var(--navbar-text)]
                   hover:bg-[var(--gray-700)] transition"
      >
        <span>PF</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 min-w-[12rem] rounded-lg
                     bg-[var(--surface-contrast-bg)]
                     text-[var(--navbar-text)]
                     shadow-lg z-50 py-2"
        >
          {children}
        </div>
      )}
    </div>
  )
}
