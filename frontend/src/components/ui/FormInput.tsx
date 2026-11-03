"use client"
import { InputHTMLAttributes, useEffect, useId, useRef, useState } from "react"
import { FieldKind, fieldError, formatField } from "@/utils/inputValidation"
import { notifyFeedback } from "@/lib/feedback"
import DisabledHint from "./DisabledHint"
import { controlValidationMessage } from "@/utils/controlValidationMessage"

type Props = InputHTMLAttributes<HTMLInputElement> & { fieldKind?: FieldKind; disabledReason?: string }
export default function FormInput({ fieldKind, disabledReason, disabled, title, onChange, onBlur, onInvalid, value, defaultValue, className = "", ...props }: Props) {
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const isCheck = props.type === "checkbox" || props.type === "radio"
  const kind = fieldKind ?? (props.type === "email" ? "email" : props.type === "tel" ? "phone" : undefined)
  const describe = [props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") || undefined
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const message = disabled || props.readOnly ? "" : fieldError(input.value, kind)
    input.setCustomValidity(message)
    setError(previous => previous ? message : "")
  }, [value, kind, disabled, props.readOnly])
  const input = <input {...props} ref={inputRef} disabled={disabled} title={disabled ? undefined : title} className={`${isCheck ? "" : "w-full min-w-0"} ${className} disabled:pointer-events-none`} value={typeof value === "string" ? formatField(value, kind) : value} defaultValue={typeof defaultValue === "string" ? formatField(defaultValue, kind) : defaultValue}
    maxLength={kind === "cpf" ? 14 : kind === "phone" ? 15 : kind === "uf" ? 2 : kind === "cep" ? 9 : props.maxLength}
    inputMode={["cpf", "phone", "siape", "cep", "code"].includes(kind ?? "") ? "numeric" : props.inputMode}
    aria-label={props["aria-label"] ?? (kind === "cpf" ? "CPF" : kind === "phone" ? "Telefone" : kind === "siape" ? "SIAPE" : kind === "uf" ? "UF" : kind === "cep" ? "CEP" : undefined)} aria-describedby={describe} aria-invalid={error ? true : props["aria-invalid"]}
    onChange={event => {
      if (kind) event.currentTarget.value = formatField(event.currentTarget.value, kind)
      event.currentTarget.setCustomValidity(fieldError(event.currentTarget.value, kind))
      setError("")
      onChange?.(event)
    }}
    onBlur={event => {
      const message = fieldError(event.currentTarget.value, kind)
      event.currentTarget.setCustomValidity(message)
      setError(message)
      onBlur?.(event)
    }}
    onInvalid={event => {
      const message = fieldError(event.currentTarget.value, kind) || controlValidationMessage(event.currentTarget)
      event.preventDefault()
      setError(message)
      notifyFeedback(message, "error", "Confira os dados informados")
      onInvalid?.(event)
    }} />
  return <DisabledHint disabled={disabled || props.readOnly} reason={disabledReason || title} fullWidth={!isCheck}>
    {input}{error && <span id={errorId} className="mt-1 block text-xs text-red-700">{error}</span>}
  </DisabledHint>
}
