import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

export const institutionalTimeZone = "America/Sao_Paulo"

export function institutionalCivilDate(date: Date) {
  return dayjs(date).tz(institutionalTimeZone).format("YYYY-MM-DD")
}

export type CalendarPeriod = { startsOn: Date; endsOn: Date; kind: string }

function paused(date: Date, periods: CalendarPeriod[], business: boolean) {
  const day = date.toISOString().slice(0, 10)
  return periods.some(period => (business || period.kind !== "HOLIDAY") && day >= period.startsOn.toISOString().slice(0, 10) && day <= period.endsOn.toISOString().slice(0, 10))
}

export function addCalendarDaysDeadline(base: Date, days: number, periods: CalendarPeriod[] = []) {
  return countDeadline(base, days, periods, false)
}

// Portarias are stored as UTC date labels, rather than timestamps of an event.
export function addCalendarDaysFromDateLabel(base: Date, days: number, periods: CalendarPeriod[] = []) {
  const localMidnight = dayjs.tz(base.toISOString().slice(0, 10), institutionalTimeZone).toDate()
  return addCalendarDaysDeadline(localMidnight, days, periods)
}

export function addBusinessDaysDeadline(base: Date, days: number, periods: CalendarPeriod[] = []) {
  return countDeadline(base, days, periods, true)
}

function countDeadline(base: Date, days: number, periods: CalendarPeriod[], business: boolean) {
  if (!Number.isInteger(days) || days < 0) throw new Error("Prazo inválido")
  const result = new Date(institutionalCivilDate(base))
  let remaining = days
  let traversed = 0
  while (remaining > 0) {
    if (++traversed > 36600) throw new Error("Calendário sem dias disponíveis para este prazo")
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    if ((!business || (weekday !== 0 && weekday !== 6)) && !paused(result, periods, business)) remaining -= 1
  }
  while (paused(result, periods, business) || (business && [0, 6].includes(result.getUTCDay()))) {
    if (++traversed > 36600) throw new Error("Calendário sem dias disponíveis para este prazo")
    result.setUTCDate(result.getUTCDate() + 1)
  }
  result.setUTCDate(result.getUTCDate() + 1)
  const nextMidnight = dayjs.tz(result.toISOString().slice(0, 10), institutionalTimeZone)
  return new Date(nextMidnight.valueOf() - 1)
}

export function deadlineExpired(deadline: Date | null | undefined, now: Date) {
  return Boolean(deadline && now.getTime() > deadline.getTime())
}
