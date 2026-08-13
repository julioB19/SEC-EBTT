import {
  ClassLevel,
  PrismaClient,
  RoleName,
  ScoringTableStatus
} from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const credentials = {
  admin: {
    cpf: "81188057006",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456"
  },
  cppd: {
    cpf: "51756662070",
    password: process.env.SEED_CPPD_PASSWORD ?? "Cppd@123456"
  },
  docente: {
    cpf: "65033520008",
    password: process.env.SEED_DOCENTE_PASSWORD ?? "Docente@123456"
  }
}

async function ensureUserRoles(userId: number, roles: RoleName[]) {
  const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } })
  const roleIds = roleRows.map(role => role.idRole)

  await prisma.userRole.deleteMany({
    where: {
      userId,
      ...(roleIds.length > 0 ? { roleId: { notIn: roleIds } } : {})
    }
  })

  for (const role of roleRows) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.idRole } },
      update: { deletedDate: null },
      create: { userId, roleId: role.idRole }
    })
  }
}

async function main() {
  await prisma.role.createMany({
    data: Object.values(RoleName).map(name => ({ name })),
    skipDuplicates: true
  })

  const admin = await prisma.user.upsert({
    where: { cpf: credentials.admin.cpf },
    update: {
      name: "Administrador do Sistema",
      email: `seed.admin.${credentials.admin.cpf}@if.edu.br`,
      passwordHash: await bcrypt.hash(credentials.admin.password, 10),
      active: true,
      deletedDate: null
    },
    create: {
      name: "Administrador do Sistema",
      email: `seed.admin.${credentials.admin.cpf}@if.edu.br`,
      cpf: credentials.admin.cpf,
      passwordHash: await bcrypt.hash(credentials.admin.password, 10),
      active: true
    }
  })
  await ensureUserRoles(admin.idUser, [RoleName.ADMIN])

  const cppd = await prisma.user.upsert({
    where: { cpf: credentials.cppd.cpf },
    update: {
      name: "Marina Lopes",
      email: `seed.cppd.${credentials.cppd.cpf}@if.edu.br`,
      passwordHash: await bcrypt.hash(credentials.cppd.password, 10),
      active: true,
      deletedDate: null
    },
    create: {
      name: "Marina Lopes",
      email: `seed.cppd.${credentials.cppd.cpf}@if.edu.br`,
      cpf: credentials.cppd.cpf,
      passwordHash: await bcrypt.hash(credentials.cppd.password, 10),
      active: true
    }
  })
  await ensureUserRoles(cppd.idUser, [RoleName.CPPD_MEMBER])

  const docente = await prisma.user.upsert({
    where: { cpf: credentials.docente.cpf },
    update: {
      name: "Docente Teste",
      email: `seed.docente.${credentials.docente.cpf}@if.edu.br`,
      phone: "(55) 99999-0000",
      city: "Santa Maria",
      uf: "RS",
      passwordHash: await bcrypt.hash(credentials.docente.password, 10),
      active: true,
      deletedDate: null
    },
    create: {
      name: "Docente Teste",
      email: `seed.docente.${credentials.docente.cpf}@if.edu.br`,
      cpf: credentials.docente.cpf,
      phone: "(55) 99999-0000",
      city: "Santa Maria",
      uf: "RS",
      passwordHash: await bcrypt.hash(credentials.docente.password, 10),
      active: true
    }
  })
  await ensureUserRoles(docente.idUser, [RoleName.DOCENTE])

  await prisma.docenteProfile.upsert({
    where: { userId: docente.idUser },
    update: {
      siape: "7654321",
      classLevel: ClassLevel.D1,
      start_interstice: new Date("2024-01-01T00:00:00.000Z"),
      educationLevel: "Graduação",
      assignment: "Campus Santa Maria",
      department: "Ensino",
      division: "Direção de Ensino",
      role: "Professor EBTT",
      immediate_supervisor: "Chefia Imediata",
      deletedDate: null
    },
    create: {
      userId: docente.idUser,
      siape: "7654321",
      classLevel: ClassLevel.D1,
      start_interstice: new Date("2024-01-01T00:00:00.000Z"),
      educationLevel: "Graduação",
      assignment: "Campus Santa Maria",
      department: "Ensino",
      division: "Direção de Ensino",
      role: "Professor EBTT",
      immediate_supervisor: "Chefia Imediata"
    }
  })

  const tableName = "Tabela EBTT 2025"
  let table = await prisma.scoringTable.findFirst({
    where: {
      OR: [
        { idScoringTable: 1 },
        { name: tableName, deletedDate: null }
      ]
    },
    orderBy: { idScoringTable: "asc" }
  })
  if (!table) {
    table = await prisma.scoringTable.create({
      data: {
        name: tableName,
        startsOn: new Date("2026-01-01T00:00:00.000Z"),
        endsOn: null,
        minRequiredPoints: null,
        status: ScoringTableStatus.ACTIVE
      }
    })
  } else {
    table = await prisma.scoringTable.update({
      where: { idScoringTable: table.idScoringTable },
      data: {
        name: tableName,
        startsOn: new Date("2026-01-01T00:00:00.000Z"),
        endsOn: null,
        minRequiredPoints: null,
        status: ScoringTableStatus.ACTIVE,
        deletedDate: null
      }
    })
  }

  const nodeDefinitions = [
    { name: "Docência", code: "DOC", sortOrder: 0, parent: null, hasFormula: false, formulaExpression: null },
    {
      name: "Número de horas aula", code: "NHA", sortOrder: 2, parent: "DOC",
      hasFormula: true, formulaExpression: "(MNP + (MND * 2) + NT) * NSI"
    },
    {
      name: "Atividade regular de docência em diferentes modalidades e níveis de ensino, por semestre",
      code: "ATVR", sortOrder: 3, parent: "DOC", hasFormula: false, formulaExpression: null
    },
    {
      name: "Modalidade de Ensino", code: "MDE", sortOrder: 4, parent: "ATVR",
      hasFormula: false, formulaExpression: null
    }
  ]
  const nodes = new Map<string, number>()
  for (const definition of nodeDefinitions) {
    const existing = await prisma.scoringNode.findFirst({
      where: { scoringTableId: table.idScoringTable, code: definition.code, deletedDate: null }
    })
    const node = existing
      ? await prisma.scoringNode.update({
          where: { idScoringNode: existing.idScoringNode },
          data: {
            name: definition.name,
            code: definition.code,
            sortOrder: definition.sortOrder,
            parentId: definition.parent ? nodes.get(definition.parent) ?? null : null,
            hasFormula: definition.hasFormula,
            formulaExpression: definition.formulaExpression,
            active: true,
            deletedDate: null
          }
        })
      : await prisma.scoringNode.create({
          data: {
            scoringTableId: table.idScoringTable,
            name: definition.name,
            code: definition.code,
            sortOrder: definition.sortOrder,
            parentId: definition.parent ? nodes.get(definition.parent) ?? null : null,
            hasFormula: definition.hasFormula,
            formulaExpression: definition.formulaExpression,
            active: true
          }
        })
    nodes.set(definition.code, node.idScoringNode)
  }

  const itemDefinitions = [
    { node: "NHA", description: "Número médio de períodos semanais", unit: "período de aula", points: "1.00", formulaKey: "MNP" },
    { node: "NHA", description: "Número médio de disciplinas semanais", unit: "disciplina", points: "2.00", formulaKey: "MND" },
    { node: "NHA", description: "Número médio de turmas semestrais", unit: "turma", points: "1.00", formulaKey: "NT" },
    { node: "NHA", description: "Semestres", unit: "semestre", points: "1.00", formulaKey: "NSI" },
    { node: "MDE", description: "Total de semestres - modalidade PROEJA", unit: "modalidade de ensino", points: "5.00", formulaKey: null },
    { node: "MDE", description: "Total de semestres - modalidade PROCampo", unit: "modalidade de ensino", points: "5.00", formulaKey: null }
  ]
  for (const definition of itemDefinitions) {
    const nodeId = nodes.get(definition.node)!
    const existing = await prisma.scoringItem.findFirst({
      where: {
        scoringTableId: table.idScoringTable,
        nodeId,
        description: definition.description,
        deletedDate: null
      }
    })
    const data = {
      scoringTableId: table.idScoringTable,
      nodeId,
      description: definition.description,
      unit: definition.unit,
      points: definition.points,
      formulaKey: definition.formulaKey,
      hasMaxPoints: false,
      maxPoints: null,
      active: true,
      deletedDate: null
    }
    if (existing) {
      await prisma.scoringItem.update({ where: { idScoringItem: existing.idScoringItem }, data })
    } else {
      await prisma.scoringItem.create({ data })
    }
  }

  console.log("Seed concluído. Credenciais de teste:")
  console.log(`ADMIN   CPF ${credentials.admin.cpf} senha ${credentials.admin.password}`)
  console.log(`CPPD    CPF ${credentials.cppd.cpf} senha ${credentials.cppd.password}`)
  console.log(`DOCENTE CPF ${credentials.docente.cpf} senha ${credentials.docente.password}`)
  console.log(`Tabela ativa: ${table.name} (#${table.idScoringTable})`)
  const seededItems = await prisma.scoringItem.findMany({
    where: { scoringTableId: table.idScoringTable, active: true, deletedDate: null },
    orderBy: { idScoringItem: "asc" }
  })
  console.log("Marcadores exigidos no modelo da planilha:")
  for (const item of seededItems) {
    console.log(`  [[ID${item.idScoringItem}]] - ${item.description}`)
  }
}

main()
  .catch(error => {
    console.error("Seed failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
