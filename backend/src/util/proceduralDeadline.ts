export function endOfUtcDay(date: Date) {
  const result = new Date(date)
  result.setUTCHours(23, 59, 59, 999)
  return result
}

export function addCalendarDaysDeadline(base: Date, days: number) {
  const result = new Date(base)
  result.setUTCDate(result.getUTCDate() + days)
  return endOfUtcDay(result)
}

export function addBusinessDaysDeadline(base: Date, days: number) {
  const result = new Date(base)
  let remaining = days
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return endOfUtcDay(result)
}

export function deadlineExpired(deadline: Date | null | undefined, now: Date) {
  return Boolean(deadline && now.getTime() > deadline.getTime())
}
