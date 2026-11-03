export function controlValidationMessage(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = control.getAttribute("aria-label") || control.name || "este campo"
  const target = label === "este campo" ? label : `“${label}”`
  const validity = control.validity
  if (validity.valueMissing) return control.tagName === "SELECT" ? `Selecione uma opção em ${target}.` : `Preencha ${target}.`
  if (validity.typeMismatch && control instanceof HTMLInputElement && control.type === "email") return "E-mail inválido. Confira o endereço completo."
  if (validity.rangeUnderflow && control instanceof HTMLInputElement) return `O valor de ${target} deve ser igual ou maior que ${control.min}.`
  if (validity.rangeOverflow && control instanceof HTMLInputElement) return `O valor de ${target} deve ser igual ou menor que ${control.max}.`
  if (validity.stepMismatch) return `Confira a precisão ou os incrementos permitidos em ${target}.`
  if (validity.badInput) return `Informe um valor válido em ${target}.`
  if (validity.tooShort) return `Complete ${target}. A quantidade de caracteres é insuficiente.`
  if (validity.tooLong) return `Reduza o conteúdo de ${target}. O limite de caracteres foi ultrapassado.`
  if (validity.patternMismatch) return `Confira o formato informado em ${target}.`
  return validity.customError ? control.validationMessage : `Confira ${target}. O valor informado não é válido.`
}
