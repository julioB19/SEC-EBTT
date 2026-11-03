"use client"
import { ComponentPropsWithRef } from "react"
import DisabledHint from "./DisabledHint"
import { notifyFeedback } from "@/lib/feedback"
import { controlValidationMessage } from "@/utils/controlValidationMessage"

export function FormSelect({ disabled, disabledReason, title, className = "", onInvalid, ...props }: ComponentPropsWithRef<"select"> & { disabledReason?: string }) {
  return <DisabledHint disabled={disabled} reason={disabledReason || title} fullWidth><select {...props} disabled={disabled} title={disabled ? undefined : title} className={`w-full min-w-0 ${className} disabled:pointer-events-none`} onInvalid={event => { event.preventDefault(); notifyFeedback(controlValidationMessage(event.currentTarget), "error", "Confira os dados informados"); onInvalid?.(event) }} /></DisabledHint>
}
export function FormTextarea({ disabled, disabledReason, title, className = "", onInvalid, ...props }: ComponentPropsWithRef<"textarea"> & { disabledReason?: string }) {
  return <DisabledHint disabled={disabled || props.readOnly} reason={disabledReason || title} fullWidth><textarea {...props} disabled={disabled} title={disabled ? undefined : title} className={`w-full min-w-0 ${className} disabled:pointer-events-none`} onInvalid={event => { event.preventDefault(); notifyFeedback(controlValidationMessage(event.currentTarget), "error", "Confira os dados informados"); onInvalid?.(event) }} /></DisabledHint>
}
