import {
  ClassLevel,
  PersonType,
  ProcessTypeCategory,
  PrismaClient,
  RoleName,
  ScoringTablePurpose,
  ScoringTableStatus
} from "@prisma/client"
import bcrypt from "bcryptjs"
import { hashCpf, protectCpf } from "../src/util/cpfProtection"

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
  cppdCentral: {
    cpf: "58315013610",
    password: process.env.SEED_CPPD_CENTRAL_PASSWORD ?? "CppdCentral@123456"
  },
  docente: {
    cpf: "65033520008",
    password: process.env.SEED_DOCENTE_PASSWORD ?? "Docente@123456"
  },
  externalEvaluator: {
    cpf: "52998224725",
    password: process.env.SEED_EXTERNAL_EVALUATOR_PASSWORD ?? "Avaliador@123456"
  }
}

async function ensurePersonForUser(
  user: { idUser: number; name: string; email: string; phone: string | null },
  type: PersonType,
  cpf?: string
) {
  const protectedCpf = cpf ? protectCpf(cpf) : null
  const person = await prisma.person.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      phone: user.phone,
      type,
      active: true,
      deletedDate: null,
      ...(protectedCpf
        ? { cpfEncrypted: protectedCpf.cpfEncrypted, cpfHash: protectedCpf.cpfHash }
        : {})
    },
    create: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      type,
      cpfEncrypted: protectedCpf?.cpfEncrypted ?? null,
      cpfHash: protectedCpf?.cpfHash ?? null
    }
  })

  await prisma.user.update({
    where: { idUser: user.idUser },
    data: { personId: person.idPerson }
  })

  return person
}

async function upsertSeedUser(input: {
  cpf: string
  name: string
  email: string
  password: string
  phone?: string | null
  city?: string | null
  uf?: string | null
}) {
  const protectedCpf = protectCpf(input.cpf)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ cpfHash: hashCpf(input.cpf) }, { cpf: input.cpf }]
    }
  })
  const data = {
    name: input.name,
    email: input.email,
    cpf: null,
    cpfEncrypted: protectedCpf.cpfEncrypted,
    cpfHash: protectedCpf.cpfHash,
    passwordHash: await bcrypt.hash(input.password, 10),
    phone: input.phone ?? null,
    city: input.city ?? null,
    uf: input.uf ?? null,
    active: true,
    deletedDate: null
  }

  return existing
    ? prisma.user.update({ where: { idUser: existing.idUser }, data })
    : prisma.user.create({ data })
}

async function ensureUserRoles(userId: number, roles: RoleName[]) {
  const roleRows = await prisma.role.findMany({
    where: { name: { in: roles } }
  })
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

  const santaMariaCampus = await prisma.campus.upsert({
    where: { acronym: "SM" },
    update: {
      name: "Campus Santa Maria",
      active: true,
      deletedDate: null
    },
    create: {
      name: "Campus Santa Maria",
      acronym: "SM"
    }
  })

  await prisma.campus.upsert({
    where: { acronym: "FW" },
    update: {
      name: "Campus Frederico Westphalen",
      active: true,
      deletedDate: null
    },
    create: {
      name: "Campus Frederico Westphalen",
      acronym: "FW"
    }
  })

  const processTypeConfigs = [
    {
      code: "PROGRESSION",
      name: "Progression",
      category: ProcessTypeCategory.CAREER,
      requiresScoring: true,
      requiresCommittee: false,
      requiresGecc: false
    },
    {
      code: "PROMOTION",
      name: "Promotion",
      category: ProcessTypeCategory.CAREER,
      requiresScoring: true,
      requiresCommittee: false,
      requiresGecc: false
    },
    {
      code: "RSC",
      name: "RSC",
      category: ProcessTypeCategory.RSC,
      requiresScoring: true,
      requiresCommittee: true,
      requiresGecc: true
    },
    {
      code: "FULL_PROFESSOR",
      name: "Full Professor",
      category: ProcessTypeCategory.FULL_PROFESSOR,
      requiresScoring: false,
      requiresCommittee: true,
      requiresGecc: true
    },
    {
      code: "TRAINING_LEAVE",
      name: "Training Leave",
      category: ProcessTypeCategory.SIMPLE,
      requiresScoring: false,
      requiresCommittee: false,
      requiresGecc: false
    },
    {
      code: "QUALIFICATION_PAY",
      name: "Qualification Pay",
      category: ProcessTypeCategory.SIMPLE,
      requiresScoring: false,
      requiresCommittee: false,
      requiresGecc: false
    },
    {
      code: "IN_SERVICE_DEVELOPMENT",
      name: "In-Service Development",
      category: ProcessTypeCategory.SIMPLE,
      requiresScoring: false,
      requiresCommittee: false,
      requiresGecc: false
    }
  ]

  for (const config of processTypeConfigs) {
    const existing = await prisma.processTypeConfig.findFirst({
      where: { code: config.code },
      orderBy: { version: "desc" }
    })

    if (!existing) {
      await prisma.processTypeConfig.create({
        data: { ...config, version: 1 }
      })
    }
  }

  const admin = await upsertSeedUser({
    cpf: credentials.admin.cpf,
    name: "Administrador do Sistema",
    email: `seed.admin.${credentials.admin.cpf}@if.edu.br`,
    password: credentials.admin.password
  })
  await ensureUserRoles(admin.idUser, [RoleName.ADMIN])
  await ensurePersonForUser(admin, PersonType.OTHER, credentials.admin.cpf)

  const cppd = await upsertSeedUser({
    cpf: credentials.cppd.cpf,
    name: "Marina Lopes",
    email: `seed.cppd.${credentials.cppd.cpf}@if.edu.br`,
    password: credentials.cppd.password
  })
  await ensureUserRoles(cppd.idUser, [RoleName.CPPD_MEMBER])
  const cppdPerson = await ensurePersonForUser(cppd, PersonType.CPPD_MEMBER, credentials.cppd.cpf)

  const existingCppdCommission = await prisma.cppdCommission.findFirst({
    where: {
      campusId: santaMariaCampus.idCampus,
      ordinance: "SEED-CPPD-SM"
    }
  })
  const cppdCommission = existingCppdCommission
    ? await prisma.cppdCommission.update({
        where: { idCppdCommission: existingCppdCommission.idCppdCommission },
        data: {
          validityStart: new Date("2020-01-01T00:00:00.000Z"),
          validityEnd: new Date("2099-12-31T23:59:59.999Z"),
          deletedDate: null
        }
      })
    : await prisma.cppdCommission.create({
        data: {
          campusId: santaMariaCampus.idCampus,
          ordinance: "SEED-CPPD-SM",
          validityStart: new Date("2020-01-01T00:00:00.000Z"),
          validityEnd: new Date("2099-12-31T23:59:59.999Z")
        }
      })

  await prisma.cppdCommissionMember.upsert({
    where: {
      commissionId_personId: {
        commissionId: cppdCommission.idCppdCommission,
        personId: cppdPerson.idPerson
      }
    },
    update: { active: true, deletedDate: null },
    create: {
      commissionId: cppdCommission.idCppdCommission,
      personId: cppdPerson.idPerson
    }
  })

  const cppdCentral = await upsertSeedUser({
    cpf: credentials.cppdCentral.cpf,
    name: "CPPD Central Teste",
    email: `seed.cppd.central.${credentials.cppdCentral.cpf}@if.edu.br`,
    password: credentials.cppdCentral.password
  })
  await ensureUserRoles(cppdCentral.idUser, [RoleName.CPPD_CENTRAL])
  await ensurePersonForUser(cppdCentral, PersonType.CPPD_MEMBER, credentials.cppdCentral.cpf)

  const docente = await upsertSeedUser({
    cpf: credentials.docente.cpf,
    name: "Docente Teste",
    email: `seed.docente.${credentials.docente.cpf}@if.edu.br`,
    phone: "(55) 99999-0000",
    city: "Santa Maria",
    uf: "RS",
    password: credentials.docente.password
  })
  await ensureUserRoles(docente.idUser, [RoleName.DOCENTE])
  await ensurePersonForUser(docente, PersonType.TEACHER, credentials.docente.cpf)

  await prisma.docenteProfile.upsert({
    where: { userId: docente.idUser },
    update: {
      campusId: santaMariaCampus.idCampus,
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
      campusId: santaMariaCampus.idCampus,
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

  const externalEvaluator = await upsertSeedUser({
    cpf: credentials.externalEvaluator.cpf,
    name: "Avaliador Externo Teste",
    email: `seed.evaluator.${credentials.externalEvaluator.cpf}@if.edu.br`,
    phone: "(55) 99999-0001",
    city: "Santa Maria",
    uf: "RS",
    password: credentials.externalEvaluator.password
  })
  await ensureUserRoles(externalEvaluator.idUser, [RoleName.EXTERNAL_EVALUATOR])
  await ensurePersonForUser(externalEvaluator, PersonType.EXTERNAL_EVALUATOR, credentials.externalEvaluator.cpf)

  await prisma.externalEvaluatorProfile.upsert({
    where: { userId: externalEvaluator.idUser },
    update: {
      title: "Doutor",
      institution: "Instituto Federal Farroupilha",
      active: true,
      deletedDate: null
    },
    create: {
      userId: externalEvaluator.idUser,
      title: "Doutor",
      institution: "Instituto Federal Farroupilha"
    }
  })

  const tableName = "Tabela EBTT 2025"
  let table = await prisma.scoringTable.findFirst({
    where: {
      OR: [{ idScoringTable: 1 }, { name: tableName, deletedDate: null }]
    },
    orderBy: { idScoringTable: "asc" }
  })
  if (!table) {
    table = await prisma.scoringTable.create({
      data: {
        name: tableName,
        purpose: ScoringTablePurpose.PROGRESSION_PROMOTION,
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
        purpose: ScoringTablePurpose.PROGRESSION_PROMOTION,
        startsOn: new Date("2026-01-01T00:00:00.000Z"),
        endsOn: null,
        minRequiredPoints: null,
        status: ScoringTableStatus.ACTIVE,
        deletedDate: null
      }
    })
  }

  const nodeDefinitions = [
    {
      name: "Docência",
      code: "DOC",
      sortOrder: 0,
      parent: null,
      hasFormula: false,
      formulaExpression: null
    },
    {
      name: "Número de horas aula",
      code: "NHA",
      sortOrder: 2,
      parent: "DOC",
      hasFormula: true,
      formulaExpression: "(MNP + (MND * 2) + NT) * NSI"
    },
    {
      name: "Atividade regular de docência em diferentes modalidades e níveis de ensino, por semestre",
      code: "ATVR",
      sortOrder: 3,
      parent: "DOC",
      hasFormula: false,
      formulaExpression: null
    },
    {
      name: "Modalidade de Ensino",
      code: "MDE",
      sortOrder: 4,
      parent: "ATVR",
      hasFormula: false,
      formulaExpression: null
    }
  ]
  const nodes = new Map<string, number>()
  for (const definition of nodeDefinitions) {
    const existing = await prisma.scoringNode.findFirst({
      where: {
        scoringTableId: table.idScoringTable,
        code: definition.code,
        deletedDate: null
      }
    })
    const node = existing
      ? await prisma.scoringNode.update({
          where: { idScoringNode: existing.idScoringNode },
          data: {
            name: definition.name,
            code: definition.code,
            sortOrder: definition.sortOrder,
            parentId: definition.parent ? (nodes.get(definition.parent) ?? null) : null,
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
            parentId: definition.parent ? (nodes.get(definition.parent) ?? null) : null,
            hasFormula: definition.hasFormula,
            formulaExpression: definition.formulaExpression,
            active: true
          }
        })
    nodes.set(definition.code, node.idScoringNode)
  }

  const itemDefinitions = [
    {
      node: "NHA",
      description: "Número médio de períodos semanais",
      unit: "período de aula",
      points: "1.00",
      formulaKey: "MNP"
    },
    {
      node: "NHA",
      description: "Número médio de disciplinas semanais",
      unit: "disciplina",
      points: "2.00",
      formulaKey: "MND"
    },
    {
      node: "NHA",
      description: "Número médio de turmas semestrais",
      unit: "turma",
      points: "1.00",
      formulaKey: "NT"
    },
    {
      node: "NHA",
      description: "Semestres",
      unit: "semestre",
      points: "1.00",
      formulaKey: "NSI"
    },
    {
      node: "MDE",
      description: "Total de semestres - modalidade PROEJA",
      unit: "modalidade de ensino",
      points: "5.00",
      formulaKey: null
    },
    {
      node: "MDE",
      description: "Total de semestres - modalidade PROCampo",
      unit: "modalidade de ensino",
      points: "5.00",
      formulaKey: null
    }
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
      await prisma.scoringItem.update({
        where: { idScoringItem: existing.idScoringItem },
        data
      })
    } else {
      await prisma.scoringItem.create({ data })
    }
  }

  console.log("Seed concluído. Credenciais de teste:")
  console.log(`ADMIN   CPF ${credentials.admin.cpf} senha ${credentials.admin.password}`)
  console.log(`CPPD    CPF ${credentials.cppd.cpf} senha ${credentials.cppd.password}`)
  console.log(`CPPD CENTRAL CPF ${credentials.cppdCentral.cpf} senha ${credentials.cppdCentral.password}`)
  console.log(`DOCENTE CPF ${credentials.docente.cpf} senha ${credentials.docente.password}`)
  console.log(`AVALIADOR CPF ${credentials.externalEvaluator.cpf} senha ${credentials.externalEvaluator.password}`)
  console.log(`Tabela ativa: ${table.name} (#${table.idScoringTable})`)
  const seededItems = await prisma.scoringItem.findMany({
    where: {
      scoringTableId: table.idScoringTable,
      active: true,
      deletedDate: null
    },
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
