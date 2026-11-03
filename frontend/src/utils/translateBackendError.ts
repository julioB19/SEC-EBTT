type ContextoErro = "register" | "login" | "default"

export function translateBackendError(json: any, contexto: ContextoErro = "default"): string {
  const code = typeof json?.code === "string" ? json.code : undefined
  const rawMessage = typeof json?.message === "string" ? json.message : ""
  const data = json?.data

  const messages: Record<string, string> = {
    "Process is not available for CPPD evaluation": "Este processo ainda não está disponível para avaliação da CPPD. Ele precisa estar enviado ou em análise.",
    "Process is not available for CPPD view": "Este processo ainda não está disponível para consulta da CPPD. Aguarde o envio pelo docente.",
    "Only SUBMITTED or UNDER_REVIEW processes can have scores updated": "Só é possível alterar a pontuação de processos enviados ou em análise.",
    "Process not found": "Processo não encontrado.",
    "Failed to fetch": "Não foi possível comunicar com o sistema. Verifique sua conexão e tente novamente.",
    "NetworkError when attempting to fetch resource.": "Não foi possível comunicar com o sistema. Verifique sua conexão e tente novamente."
  }
  if (messages[rawMessage]) return messages[rawMessage]

  if (code === "INVALID_CREDENTIALS") {
    return "CPF ou senha inválidos."
  }

  if (code === "USER_EXISTS") {
    return "Já existe um usuário cadastrado com esse CPF ou e-mail."
  }

  if (code === "USER_NOT_FOUND") {
    return "Usuário não encontrado."
  }

  if (code === "INVALID_REFRESH_TOKEN") {
    return "Sessão expirada ou inválida. Faça login novamente."
  }

  if (code === "INVALID_INPUT") {
    if (Array.isArray(data) && data.length > 0) {
      const first = String(data[0])
      const lower = first.toLowerCase()

      if (lower.includes("cpf")) {
        return "Verifique o CPF informado."
      }
      if (lower.includes("email") || lower.includes("e-mail")) {
        return "E-mail inválido. Informe um e-mail válido."
      }

      return first
    }

    if (contexto === "register") {
      return "Dados inválidos. Verifique os campos do cadastro."
    }

    return "Dados inválidos. Verifique as informações enviadas."
  }

  const msg = rawMessage.toLowerCase()

  if (
    msg.includes("user exists") ||
    msg.includes("user already exists") ||
    msg.includes("user with this") ||
    msg.includes("already in use")
  ) {
    return "Já existe um usuário cadastrado com esses dados (CPF ou e-mail)."
  }

  if (msg.includes("unique constraint") || msg.includes("duplicate")) {
    return "Email ou CPF já está em uso."
  }

  if (msg.includes("must be a valid email")) {
    return "E-mail inválido. Informe um e-mail válido."
  }

  if (msg.includes("is required")) {
    return "Existem campos obrigatórios não preenchidos. Verifique o formulário."
  }

  if (msg.includes("invalid cpf")) {
    return "CPF inválido."
  }

  if (msg.includes("password") && msg.includes("length")) {
    return "A senha não atende aos requisitos mínimos."
  }

  if (/must be|must contain|is not allowed|does not match|is required/.test(msg)) {
    const field = rawMessage.match(/^["']([^"']+)["']/)?.[1]
    const labels: Record<string, string> = { cpf: "CPF", phone: "telefone", email: "e-mail", password: "senha", newPassword: "nova senha", name: "nome", uf: "UF", city: "cidade", siape: "SIAPE", signedAt: "data da assinatura" }
    return field ? `Confira o campo ${labels[field] || "informado"}. O valor não está no formato esperado.` : "Confira os campos informados. Há valores fora do formato esperado."
  }

  if (rawMessage) {
    return rawMessage
  }

  if (contexto === "register") {
    return "Não foi possível concluir o cadastro. Verifique os dados e tente novamente."
  }

  if (contexto === "login") {
    return "Não foi possível realizar o login. Tente novamente."
  }

  return "Ocorreu um erro ao processar sua solicitação."
}
