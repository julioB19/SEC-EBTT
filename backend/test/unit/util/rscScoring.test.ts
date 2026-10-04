import { describe, expect, test } from "@jest/globals"
import { calculateRscItemPoints, capScore } from "../../../src/util/rscScoring"

describe("rscScoring", () => {
  test("calcula quantidade vezes ponto-base, fator e peso e arredonda por critério", () => {
    expect(calculateRscItemPoints({ quantity: 4, basePoints: 1, factor: 0.1, weight: 1 })).toBe(0)
    expect(calculateRscItemPoints({ quantity: 5, basePoints: 1, factor: 0.1, weight: 1 })).toBe(1)
    expect(calculateRscItemPoints({ quantity: 10, basePoints: 1, factor: 0.34, weight: 3 })).toBe(10)
  })

  test("rejeita quantidade fracionária, negativa ou acima do limite", () => {
    expect(() => calculateRscItemPoints({ quantity: 1.5, basePoints: 1 })).toThrow(/inteiro/)
    expect(() => calculateRscItemPoints({ quantity: -1, basePoints: 1 })).toThrow(/inteiro/)
    expect(() =>
      calculateRscItemPoints({ quantity: 6, basePoints: 1, maxQuantity: 5 })
    ).toThrow(/máximo permitido/)
  })

  test("aplica o teto da diretriz", () => {
    expect(capScore(24, 20)).toBe(20)
    expect(capScore(16, 20)).toBe(16)
    expect(capScore(16, null)).toBe(16)
  })
})
