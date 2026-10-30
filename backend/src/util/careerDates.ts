export function addMonthsClamped(base: Date, months: number) {
  const result = new Date(base)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, last))
  return result
}

export function latestRequirementDate(dates: Array<Date | null | undefined>) {
  const values = dates.filter((value): value is Date => Boolean(value && Number.isFinite(value.getTime())))
  if (!values.length) throw new Error("Informe as datas de cumprimento dos requisitos")
  return new Date(Math.max(...values.map(value => value.getTime())))
}

export function careerPreparationAllowed(start: Date, now: Date, months: number) {
  const firstDay = addMonthsClamped(start, months)
  firstDay.setUTCDate(firstDay.getUTCDate() - 60)
  return now.getTime() >= firstDay.getTime()
}

export function formatCalendarDate(value: Date) {
  return value.toLocaleDateString("pt-BR", { timeZone: "UTC" })
}
