"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Option = { label: string; value: string }

type Props = {
  id?: string
  value: string | null
  options: Option[]
  disabled?: boolean
  placeholder?: string
  onChange: (val: string) => void
}

export default function RoleDropdown({
  id,
  value,
  options,
  disabled,
  placeholder = "Selecionar...",
  onChange
}: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const current = useMemo(
    () => options.find(o => o.value === value) || null,
    [options, value]
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        setActiveIndex(-1)
        btnRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [])

  function toggle() {
    if (disabled) return
    setOpen(o => !o)
    if (!open) {
      const idx = Math.max(0, options.findIndex(o => o.value === value))
      setActiveIndex(idx)
    }
  }

  function selectAt(index: number) {
    const opt = options[index]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    setActiveIndex(index)
    btnRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      setOpen(true)
      const idx = Math.max(0, options.findIndex(o => o.value === value))
      setActiveIndex(idx)
      return
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(options.length - 1, i < 0 ? 0 : i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(0, i < 0 ? 0 : i - 1))
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (activeIndex >= 0) selectAt(activeIndex)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      btnRef.current?.focus()
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        id={id}
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="
          inline-flex items-center justify-between gap-2
          pr-8 pl-3 py-2 min-w-[170px]
          rounded-xl border border-[var(--gray-700)]
          bg-[var(--surface-contrast-bg)]
          text-sm text-[var(--navbar-text)]
          shadow-sm disabled:opacity-60
        "
        title="Trocar módulo"
      >
        <span>{current ? current.label : placeholder}</span>
        <svg
          className="pointer-events-none absolute right-2"
          width="16"
          height="16"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="
            absolute mt-2 w-full
            rounded-xl border border-[var(--gray-700)]
            bg-[var(--surface-contrast-bg)]
            shadow-lg overflow-hidden z-[60]
          "
        >
          <ul className="py-1 max-h-64 overflow-auto">
            {options.map((opt, idx) => {
              const selected = opt.value === value
              const active = idx === activeIndex
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectAt(idx)}
                    className={[
                      "w-full text-left px-3 py-2 text-sm",
                      "text-[var(--navbar-text)]",
                      active ? "bg-[var(--gray-800)]" : "",
                      selected ? "font-medium" : "font-normal"
                    ]
                      .join(" ")
                      .trim()}
                  >
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
