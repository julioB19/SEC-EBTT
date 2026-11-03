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
import {
  OFFICIAL_RSC_ITEM_COUNT,
  OFFICIAL_RSC_LEVELS,
  OFFICIAL_RSC_MIN_TOTAL_POINTS,
  OFFICIAL_RSC_SOURCE,
  OFFICIAL_RSC_TABLE_NAME
} from "./official-rsc-criteria"

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

async function ensureOfficialRscScoringTable() {
  if (OFFICIAL_RSC_ITEM_COUNT !== 82) {
    throw new Error(`Catálogo oficial RSC inválido: esperados 82 critérios, encontrados ${OFFICIAL_RSC_ITEM_COUNT}`)
  }

  const existing = await prisma.scoringTable.findFirst({
    where: { name: OFFICIAL_RSC_TABLE_NAME },
    orderBy: { idScoringTable: "asc" }
  })
  const table = existing
    ? await prisma.scoringTable.update({
        where: { idScoringTable: existing.idScoringTable },
        data: {
          purpose: ScoringTablePurpose.RSC,
          startsOn: new Date("2025-07-17T00:00:00.000Z"),
          endsOn: null,
          minRequiredPoints: String(OFFICIAL_RSC_MIN_TOTAL_POINTS),
          status: ScoringTableStatus.ACTIVE,
          deletedDate: null
        }
      })
    : await prisma.scoringTable.create({
        data: {
          name: OFFICIAL_RSC_TABLE_NAME,
          purpose: ScoringTablePurpose.RSC,
          startsOn: new Date("2025-07-17T00:00:00.000Z"),
          minRequiredPoints: String(OFFICIAL_RSC_MIN_TOTAL_POINTS),
          status: ScoringTableStatus.ACTIVE
        }
      })

  await prisma.scoringTable.updateMany({
    where: {
      purpose: ScoringTablePurpose.RSC,
      status: ScoringTableStatus.ACTIVE,
      idScoringTable: { not: table.idScoringTable }
    },
    data: { status: ScoringTableStatus.INACTIVE }
  })

  const retainedNodeIds: number[] = []
  const retainedItemIds: number[] = []
  for (const level of OFFICIAL_RSC_LEVELS) {
    const existingLevel = await prisma.scoringNode.findFirst({
      where: { scoringTableId: table.idScoringTable, code: level.code }
    })
    const levelNode = existingLevel
      ? await prisma.scoringNode.update({
          where: { idScoringNode: existingLevel.idScoringNode },
          data: {
            parentId: null,
            name: level.name,
            sortOrder: level.sortOrder,
            maxPoints: String(level.maxPoints),
            active: true,
            deletedDate: null
          }
        })
      : await prisma.scoringNode.create({
          data: {
            scoringTableId: table.idScoringTable,
            code: level.code,
            name: level.name,
            sortOrder: level.sortOrder,
            maxPoints: String(level.maxPoints)
          }
        })
    retainedNodeIds.push(levelNode.idScoringNode)

    for (const directive of level.directives) {
      const directiveCode = `${level.code}_D${directive.sortOrder}`
      const existingDirective = await prisma.scoringNode.findFirst({
        where: { scoringTableId: table.idScoringTable, code: directiveCode }
      })
      const directiveNode = existingDirective
        ? await prisma.scoringNode.update({
            where: { idScoringNode: existingDirective.idScoringNode },
            data: {
              parentId: levelNode.idScoringNode,
              name: directive.name,
              sortOrder: directive.sortOrder,
              maxPoints: String(directive.maxPoints),
              active: true,
              deletedDate: null
            }
          })
        : await prisma.scoringNode.create({
            data: {
              scoringTableId: table.idScoringTable,
              parentId: levelNode.idScoringNode,
              code: directiveCode,
              name: directive.name,
              sortOrder: directive.sortOrder,
              maxPoints: String(directive.maxPoints)
            }
          })
      retainedNodeIds.push(directiveNode.idScoringNode)

      for (const item of directive.items) {
        const formulaKey = `RSC_${item.code.padStart(3, "0")}`
        const existingItem = await prisma.scoringItem.findFirst({
          where: { scoringTableId: table.idScoringTable, formulaKey }
        })
        const data = {
          scoringTableId: table.idScoringTable,
          nodeId: directiveNode.idScoringNode,
          description: item.description,
          unit: item.unit,
          points: "1.00",
          factor: String(item.factor),
          weight: String(item.weight),
          maxQuantity: item.maxQuantity,
          hasMaxPoints: false,
          maxPoints: null,
          formulaKey,
          active: true,
          deletedDate: null
        }
        const saved = existingItem
          ? await prisma.scoringItem.update({
              where: { idScoringItem: existingItem.idScoringItem },
              data
            })
          : await prisma.scoringItem.create({ data })
        retainedItemIds.push(saved.idScoringItem)
      }
    }
  }

  await prisma.scoringItem.updateMany({
    where: {
      scoringTableId: table.idScoringTable,
      idScoringItem: { notIn: retainedItemIds }
    },
    data: { active: false, deletedDate: new Date() }
  })
  await prisma.scoringNode.updateMany({
    where: {
      scoringTableId: table.idScoringTable,
      idScoringNode: { notIn: retainedNodeIds }
    },
    data: { active: false, deletedDate: new Date() }
  })

  console.log(`Tabela RSC ativa: ${table.name} (#${table.idScoringTable}), ${OFFICIAL_RSC_ITEM_COUNT} critérios`)
  console.log(`Fonte: ${OFFICIAL_RSC_SOURCE}`)
  return table
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
      requiresCommittee: false
    },
    {
      code: "PROMOTION",
      name: "Promotion",
      category: ProcessTypeCategory.CAREER,
      requiresScoring: true,
      requiresCommittee: false
    },
    {
      code: "RSC",
      name: "RSC",
      category: ProcessTypeCategory.RSC,
      requiresScoring: true,
      requiresCommittee: true
    },
    {
      code: "FULL_PROFESSOR",
      name: "Full Professor",
      category: ProcessTypeCategory.FULL_PROFESSOR,
      requiresScoring: false,
      requiresCommittee: true
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

  await ensureOfficialRscScoringTable()

  if (process.env.NODE_ENV === "test") {
    await prisma.campusEmailDomain.upsert({ where: { campusId_domain: { campusId: santaMariaCampus.idCampus, domain: "iffar.edu.br" } },
      create: { campusId: santaMariaCampus.idCampus, domain: "iffar.edu.br", includeSubdomains: true },
      update: { active: true, includeSubdomains: true, deletedDate: null } })
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
