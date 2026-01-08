export function extractTimeFromDate(date: Date): string {
    return date.toISOString().split("T")[1].replace(".000Z", "")
}

export function convertTimeToDate(time: string): Date {
    return new Date(`0001-01-01T${time}z`)
}

