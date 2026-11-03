export type FieldKind = "cpf" | "phone" | "siape" | "uf" | "cep" | "code" | "email"
export const digitsOnly = (value: string) => value.replace(/\D/g, "")
export function validCpf(value: string) {
  const digits = digitsOnly(value)
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false
  for (let length = 9; length < 11; length++) {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i)
    const check = (sum * 10) % 11 % 10
    if (check !== Number(digits[length])) return false
  }
  return true
}
export function formatField(value: string, kind?: FieldKind) {
  if (!kind || kind === "email") return value
  if (kind === "uf") return value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2)
  const digits = digitsOnly(value)
  if (kind === "cpf") return digits.slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2").replace(/(\.\d{3})(\d)/, "$1-$2")
  if (kind === "phone") {
    const phone = digits.slice(0, 11)
    if (phone.length <= 2) return phone ? `(${phone}` : ""
    const local = phone.slice(2)
    const split = local.length > 8 ? 5 : 4
    return `(${phone.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? `-${local.slice(split)}` : ""}`
  }
  if (kind === "cep") return digits.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2")
  return kind === "code" ? digits.slice(0, 6) : digits.slice(0, 30)
}
export function fieldError(value: string, kind?: FieldKind) {
  if (!value || !kind) return ""
  if (kind === "cpf" && !validCpf(value)) return "CPF inválido. Confira os 11 dígitos e os dígitos verificadores."
  if (kind === "phone" && !/^\d{10,11}$/.test(digitsOnly(value))) return "Telefone inválido. Informe o DDD e o número, com 10 ou 11 dígitos."
  if (kind === "siape" && !/^\d+$/.test(value)) return "SIAPE inválido. Informe somente números."
  if (kind === "uf" && !["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].includes(value)) return "UF inválida. Informe a sigla de um estado brasileiro."
  if (kind === "cep" && digitsOnly(value).length !== 8) return "CEP inválido. Informe os oito dígitos."
  if (kind === "code" && digitsOnly(value).length !== 6) return "Informe o código de seis dígitos recebido por e-mail."
  if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "E-mail inválido. Confira o endereço completo."
  return ""
}
