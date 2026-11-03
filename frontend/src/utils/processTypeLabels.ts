const PROCESS_TYPE_LABELS: Record<string, string> = {
  PROGRESSION: "Progressão",
  PROGRESSAO: "Progressão",
  PROMOTION: "Promoção",
  PROMOCAO: "Promoção",
  FULL_PROFESSOR: "Promoção à Classe Titular",
  RSC: "RSC"
}

/** Traduz os tipos conhecidos apenas para exibição, preservando nomes personalizados. */
export function formatProcessTypeLabel(code?: string | null, name?: string | null): string {
  const key = (value?: string | null) => value?.trim().toUpperCase().replace(/[ -]+/g, "_") ?? ""
  return PROCESS_TYPE_LABELS[key(code)] ?? PROCESS_TYPE_LABELS[key(name)] ?? (name?.trim() || code?.trim() || "Tipo de processo não informado")
}
