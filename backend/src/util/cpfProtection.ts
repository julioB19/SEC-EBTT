import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto"

const VERSION = "v1"

export function normalizeCpf(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

function masterSecret() {
  const secret = process.env.CPF_ENCRYPTION_KEY
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === "test") return "test-only-cpf-encryption-key-32-bytes"
  throw new Error("CPF_ENCRYPTION_KEY deve possuir pelo menos 32 caracteres")
}

function encryptionKey() {
  return createHash("sha256").update(`encryption:${masterSecret()}`).digest()
}

function hashingKey() {
  return createHash("sha256").update(`lookup:${masterSecret()}`).digest()
}

export function hashCpf(value: string): string {
  const cpf = normalizeCpf(value)
  if (!cpf) throw new Error("CPF vazio")
  return createHmac("sha256", hashingKey()).update(cpf).digest("hex")
}

export function encryptCpf(value: string): string {
  const cpf = normalizeCpf(value)
  if (!cpf) throw new Error("CPF vazio")

  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(cpf, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [VERSION, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptCpf(value: string): string {
  const [version, ivValue, authTagValue, encryptedValue] = String(value || "").split(".")
  if (version !== VERSION || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("CPF criptografado inválido")
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"))
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8")
}

export function protectCpf(value: string) {
  const cpf = normalizeCpf(value)
  return {
    cpf,
    cpfEncrypted: encryptCpf(cpf),
    cpfHash: hashCpf(cpf)
  }
}

export function readProtectedCpf(record: { cpf?: string | null; cpfEncrypted?: string | null }): string | null {
  if (record.cpfEncrypted) return decryptCpf(record.cpfEncrypted)
  return record.cpf ? normalizeCpf(record.cpf) : null
}
