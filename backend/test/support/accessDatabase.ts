// A transactional database double for exercising whole onboarding flows without a live MySQL server.
export function accessDatabase() {
  const tables = ["campus", "campusEmailDomain", "user", "person", "role", "userRole", "externalEvaluatorProfile", "docenteProfile", "accessInvitation", "accessAttempt", "accessRateLimit", "googleIdentity"]
  let rows: Record<string, any[]> = Object.fromEntries(tables.map(table => [table, []]))
  let sequence = 0
  let queue: Promise<unknown> = Promise.resolve()
  const clone = <T>(value: T): T => structuredClone(value)
  function matches(row: any, where: any = {}): boolean {
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === "OR") return value.some((clause: any) => matches(row, clause))
      if (["campusId_domain", "provider_subject", "provider_userId", "userId_roleId"].includes(key)) return matches(row, value)
      if (value instanceof Date) return row[key]?.getTime() === value.getTime()
      if (value && typeof value === "object") return Object.entries(value).every(([operator, expected]: [string, any]) => {
        if (operator === "gt") return row[key] > expected
        if (operator === "gte") return row[key] >= expected
        if (operator === "lt") return row[key] < expected
        if (operator === "lte") return row[key] <= expected
        if (operator === "in") return expected.includes(row[key])
        if (operator === "equals") return JSON.stringify(row[key]) === JSON.stringify(expected)
        return false
      })
      return row[key] === value
    })
  }
  function hydrate(table: string, row: any, args: any = {}) {
    if (!row) return null
    let result = clone(row)
    if (table === "user") {
      result.roles = rows.userRole.filter(link => link.userId === row.idUser).map(link => ({ ...clone(link), role: clone(rows.role.find(role => role.idRole === link.roleId)) }))
      result.externalEvaluator = clone(rows.externalEvaluatorProfile.find(item => item.userId === row.idUser) ?? null)
      result.docente = clone(rows.docenteProfile.find(item => item.userId === row.idUser) ?? null)
      result.person = clone(rows.person.find(item => item.idPerson === row.personId) ?? null)
    }
    if (table === "accessAttempt" && args.include?.invitation) result.invitation = clone(rows.accessInvitation.find(item => item.id === row.invitationId) ?? null)
    if (args.select) result = Object.fromEntries(Object.keys(args.select).map(key => [key, result[key]]))
    return result
  }
  function update(row: any, data: any) {
    for (const [key, value] of Object.entries(data) as [string, any][]) {
      if (value === undefined) continue
      row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : clone(value)
    }
    row.updatedAt = new Date()
  }
  const db: any = {}
  for (const table of tables) {
    const delegate: any = {
      findUnique: async (args: any) => hydrate(table, rows[table].find(row => matches(row, args.where)), args),
      findFirst: async (args: any = {}) => hydrate(table, rows[table].find(row => matches(row, args.where)), args),
      findMany: async (args: any = {}) => rows[table].filter(row => matches(row, args.where)).map(row => hydrate(table, row, args)),
      findUniqueOrThrow: async (args: any) => {
        const row = await delegate.findUnique(args)
        if (!row) throw new Error(`Registro ausente: ${table}`)
        return row
      },
      create: async ({ data }: any) => {
        const n = ++sequence
        const row: any = { id: `record${n}`, createdAt: new Date(), updatedAt: new Date(), active: true, deletedDate: null,
          consumedAt: null, codeHash: null, codeAttempts: 0, codeSentAt: null, googleSubject: null, googleEmail: null,
          emailVerifiedAt: null, invitationId: null, purpose: "LOGIN", status: "PENDING", provider: "GOOGLE", ...clone(data) }
        if (table === "campus") row.idCampus = data.idCampus ?? n
        if (table === "user") row.idUser = data.idUser ?? n
        if (table === "person") row.idPerson = data.idPerson ?? n
        if (table === "role") row.idRole = data.idRole ?? BigInt(n)
        if (table === "externalEvaluatorProfile") row.idExternalEvaluator = n
        rows[table].push(row)
        return hydrate(table, row)
      },
      update: async ({ where, data }: any) => {
        const row = rows[table].find(row => matches(row, where))
        if (!row) throw new Error(`Registro ausente: ${table}`)
        update(row, data)
        return hydrate(table, row)
      },
      updateMany: async ({ where, data }: any) => {
        const selected = rows[table].filter(row => matches(row, where))
        selected.forEach(row => update(row, data))
        return { count: selected.length }
      },
      upsert: async ({ where, create, update: change }: any) => rows[table].some(row => matches(row, where))
        ? delegate.update({ where, data: change }) : delegate.create({ data: create })
    }
    db[table] = delegate
  }
  db.$transaction = (run: (tx: any) => Promise<unknown>) => {
    const result = queue.then(async () => {
      const snapshot = clone(rows)
      try { return await run(db) } catch (error) { rows = snapshot; throw error }
    })
    queue = result.catch(() => {})
    return result
  }
  return db
}
