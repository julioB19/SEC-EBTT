import { PersonType, PrismaClient, RoleName } from "@prisma/client"
import { protectCpf, readProtectedCpf } from "../src/util/cpfProtection"

const prisma = new PrismaClient()

function personTypeForRoles(roles: RoleName[]): PersonType {
  if (roles.includes(RoleName.EXTERNAL_EVALUATOR)) return PersonType.EXTERNAL_EVALUATOR
  if (roles.includes(RoleName.CPPD_MEMBER) || roles.includes(RoleName.CPPD_CENTRAL)) {
    return PersonType.CPPD_MEMBER
  }
  if (roles.includes(RoleName.DOCENTE)) return PersonType.TEACHER
  return PersonType.OTHER
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { cpf: { not: null } },
        { AND: [{ cpfEncrypted: { not: null } }, { cpfHash: null }] }
      ]
    },
    include: {
      roles: { include: { role: true } }
    }
  })

  let migrated = 0
  for (const user of users) {
    const cpf = readProtectedCpf(user)
    if (!cpf) continue
    const protectedCpf = protectCpf(cpf)
    const roles = user.roles.map(item => item.role.name)

    await prisma.$transaction(async tx => {
      let personId = user.personId
      if (personId) {
        await tx.person.update({
          where: { idPerson: personId },
          data: {
            cpfEncrypted: protectedCpf.cpfEncrypted,
            cpfHash: protectedCpf.cpfHash
          }
        })
      } else {
        const person = await tx.person.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            phone: user.phone,
            type: personTypeForRoles(roles),
            cpfEncrypted: protectedCpf.cpfEncrypted,
            cpfHash: protectedCpf.cpfHash,
            active: user.active,
            deletedDate: user.deletedDate
          },
          create: {
            name: user.name,
            email: user.email,
            phone: user.phone,
            type: personTypeForRoles(roles),
            cpfEncrypted: protectedCpf.cpfEncrypted,
            cpfHash: protectedCpf.cpfHash,
            active: user.active,
            deletedDate: user.deletedDate
          }
        })
        personId = person.idPerson
      }

      await tx.user.update({
        where: { idUser: user.idUser },
        data: {
          cpf: null,
          cpfEncrypted: protectedCpf.cpfEncrypted,
          cpfHash: protectedCpf.cpfHash,
          personId
        }
      })
    })
    migrated += 1
  }

  console.log(`Migração de CPF concluída: ${migrated} usuário(s) atualizado(s).`)
}

main()
  .catch(error => {
    console.error("Falha na migração de CPF:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
