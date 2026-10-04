export type RscItemCalculation = {
  quantity: number
  basePoints: number
  factor?: number | null
  weight?: number | null
  maxQuantity?: number | null
}

export function calculateRscItemPoints(input: RscItemCalculation): number {
  const quantity = Number(input.quantity)
  const basePoints = Number(input.basePoints)
  const factor = input.factor === null || input.factor === undefined ? 1 : Number(input.factor)
  const weight = input.weight === null || input.weight === undefined ? 1 : Number(input.weight)

  if (![quantity, basePoints, factor, weight].every(Number.isFinite)) {
    throw new Error("Configuração de pontuação RSC inválida")
  }
  if (quantity < 0 || !Number.isInteger(quantity)) {
    throw new Error("A quantidade do RSC deve ser um número inteiro maior ou igual a zero")
  }
  if (
    input.maxQuantity !== null &&
    input.maxQuantity !== undefined &&
    quantity > Number(input.maxQuantity)
  ) {
    throw new Error(`A quantidade excede o máximo permitido de ${input.maxQuantity}`)
  }

  return Math.round(quantity * basePoints * factor * weight)
}

export function capScore(total: number, maxPoints?: number | null): number {
  if (maxPoints === null || maxPoints === undefined) return total
  const maximum = Number(maxPoints)
  return Number.isFinite(maximum) ? Math.min(total, maximum) : total
}
