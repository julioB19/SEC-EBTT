"use client"
import { ButtonHTMLAttributes, Ref } from "react"
import DisabledHint from "./DisabledHint"
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { disabledReason?: string; ref?: Ref<HTMLButtonElement> }
export default function ActionButton({ disabledReason, disabled, title, className = "", ...props }: Props) {
  return <DisabledHint className={className.split(/\s+/).filter(token => /^(?:(?:sm|md|lg|xl):)?(?:self-|col-span-|row-span-|order-|ml-auto|mr-auto)/.test(token)).join(" ")} disabled={disabled} reason={disabledReason || title} fullWidth={/(^|\s)w-full(\s|$)/.test(className)}><button {...props} disabled={disabled} title={disabled ? undefined : title} className={`${className} disabled:pointer-events-none`} /></DisabledHint>
}
