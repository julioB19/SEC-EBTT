import { PrismaClient, RoleName, ClassLevel } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // 🔹 1) Roles base do sistema
  await prisma.role.createMany({
    data: [
      { name: RoleName.ADMIN },
      { name: RoleName.CPPD_MEMBER },
      { name: RoleName.DOCENTE }
    ],
    skipDuplicates: true
  })

  // 🔹 2) Usuário ADMIN
  const adminPasswordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456",
    10
  )

  await prisma.user.upsert({
    where: { cpf: "81188057006" },
    update: {},
    create: {
      name: "Administrador do Sistema",
      email: "admin@if.edu.br",
      cpf: "81188057006",
      passwordHash: adminPasswordHash,
      active: true,
      roles: {
        create: [
          {
            role: { connect: { name: RoleName.ADMIN } }
          }
        ]
      }
    }
  })

  // 🔹 3) Usuária Marina (DOCENTE + CPPD_MEMBER)
  const marinaPasswordHash = await bcrypt.hash("senhaSegura123", 10)

  await prisma.user.upsert({
    where: { cpf: "51756662070" },
    update: {},
    create: {
      name: "Marina Lopes",
      email: "marina.lopes@if.edu.br",
      cpf: "51756662070",
      passwordHash: marinaPasswordHash,
      active: true,
      roles: {
        create: [
          { role: { connect: { name: RoleName.DOCENTE } } },
          { role: { connect: { name: RoleName.CPPD_MEMBER } } }
        ]
      },
      docente: {
        create: {
          siape: "1234567",
          classLevel: ClassLevel.D1,
          start_interstice: new Date("2023-03-01T00:00:00.000Z"),
          educationLevel: "Mestrado",
          improvement: "Aperfeiçoamento em Metodologias de Ensino",
          specialization: "Ensino de Computação",
          mastersDegree: "Mestrado em Ciência da Computação",
          doctorate: null,
          assignment: "Coordenação de Curso",
          department: "Ciência da Computação",
          division: "Tecnologia da Informação",
          role: "Professor EBTT",
          immediate_supervisor: "Carlos Pereira"
        }
      }
    }
  })

  // 🔹 4) Docente de teste (o CPF/senha que você usou no Postman)
  const docenteTestePasswordHash = await bcrypt.hash("Senha12345678", 10)

  await prisma.user.upsert({
    where: { cpf: "03676144058" },
    update: {},
    create: {
      name: "Docente Teste",
      email: "docente.teste@if.edu.br",
      cpf: "03676144058",
      passwordHash: docenteTestePasswordHash,
      active: true,
      roles: {
        create: [
          { role: { connect: { name: RoleName.DOCENTE } } }
        ]
      },
      docente: {
        create: {
          siape: "7654321",
          classLevel: ClassLevel.D1,
          start_interstice: new Date("2024-01-01T00:00:00.000Z"),
          educationLevel: "Graduação",
          improvement: null,
          specialization: null,
          mastersDegree: null,
          doctorate: null,
          assignment: "Docente",
          department: "Ensino",
          division: "Campus X",
          role: "Professor EBTT",
          immediate_supervisor: "Chefia Imediata"
        }
      }
    }
  })
}

main()
  .catch(e => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
