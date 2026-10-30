import { describe, expect, test } from "@jest/globals"
import { addMonthsClamped, careerPreparationAllowed, latestRequirementDate } from "../../../src/util/careerDates"
import { addBusinessDaysDeadline, addCalendarDaysDeadline } from "../../../src/util/proceduralDeadline"

describe("Datas dos requisitos e suspensão de prazos", () => {
  test("fim de mês e ano bissexto respeitam meses completos", () => {
    expect(addMonthsClamped(new Date("2024-02-29"), 12).toISOString().slice(0, 10)).toBe("2025-02-28")
    expect(addMonthsClamped(new Date("2024-01-31"), 1).toISOString().slice(0, 10)).toBe("2024-02-29")
  })
  test("preparação abre no limite exato de 60 dias", () => {
    const start = new Date("2024-01-01")
    expect(careerPreparationAllowed(start, new Date("2025-11-01"), 24)).toBe(false)
    expect(careerPreparationAllowed(start, new Date("2025-11-02"), 24)).toBe(true)
  })
  test("efeitos usam o requisito cumprido por último", () => {
    expect(latestRequirementDate([new Date("2025-01-01"), new Date("2025-05-10"), new Date("2025-03-01")]).toISOString().slice(0, 10)).toBe("2025-05-10")
  })
  test("dias úteis excluem feriados e recesso", () => {
    const periods = [{ startsOn: new Date("2026-10-19"), endsOn: new Date("2026-10-19"), kind: "HOLIDAY" }, { startsOn: new Date("2026-10-20"), endsOn: new Date("2026-10-21"), kind: "RECESS" }]
    expect(addBusinessDaysDeadline(new Date("2026-10-16"), 2, periods).toISOString().slice(0, 10)).toBe("2026-10-23")
  })
  test("dias corridos são suspensos durante férias, mas contam feriados", () => {
    const periods = [{ startsOn: new Date("2026-10-18"), endsOn: new Date("2026-10-20"), kind: "VACATION" }]
    expect(addCalendarDaysDeadline(new Date("2026-10-17"), 2, periods).toISOString().slice(0, 10)).toBe("2026-10-22")
  })
})
