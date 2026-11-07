import { describe, expect, test } from "@jest/globals"
import { addBusinessDaysDeadline, addCalendarDaysDeadline, addCalendarDaysFromDateLabel, deadlineExpired } from "../../../src/util/proceduralDeadline"

describe("proceduralDeadline", () => {
  test("conta dois dias úteis atravessando o fim de semana", () => {
    const thursday = new Date("2026-10-01T12:00:00.000Z")
    expect(addBusinessDaysDeadline(thursday, 2).toISOString()).toBe("2026-10-06T02:59:59.999Z")
  })

  test("calcula o prazo de 45 dias até o final do dia", () => {
    const ordinance = new Date("2026-09-29")
    expect(addCalendarDaysFromDateLabel(ordinance, 45).toISOString()).toBe("2026-11-14T02:59:59.999Z")
  })

  test("suspende dias úteis em feriados, recessos e férias sem contar sobreposições duas vezes", () => {
    const periods = [
      { startsOn: new Date("2026-10-02"), endsOn: new Date("2026-10-02"), kind: "HOLIDAY" },
      { startsOn: new Date("2026-10-05"), endsOn: new Date("2026-10-06"), kind: "RECESS" },
      { startsOn: new Date("2026-10-06"), endsOn: new Date("2026-10-07"), kind: "VACATION" },
    ]
    expect(addBusinessDaysDeadline(new Date("2026-10-01T12:00:00Z"), 2, periods).toISOString()).toBe("2026-10-10T02:59:59.999Z")
    expect(addCalendarDaysDeadline(new Date("2026-10-01T12:00:00Z"), 5, periods).toISOString()).toBe("2026-10-10T02:59:59.999Z")
  })

  test("considera vencido somente depois do instante final", () => {
    const deadline = addBusinessDaysDeadline(new Date("2026-10-06T01:00:00Z"), 0)
    expect(deadline.toISOString()).toBe("2026-10-06T02:59:59.999Z")
    expect(deadlineExpired(deadline, new Date("2026-10-06T01:00:00Z"))).toBe(false)
    expect(deadlineExpired(deadline, deadline)).toBe(false)
    expect(deadlineExpired(deadline, new Date("2026-10-06T03:00:00.000Z"))).toBe(true)
  })
})
