import { RoleName, ClassLevel, PersonType } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { hashCpf, protectCpf } from "../util/cpfProtection"

function personTypeForRoles(roles: RoleName[]): PersonType {
  if (roles.includes(RoleName.EXTERNAL_EVALUATOR)) return PersonType.EXTERNAL_EVALUATOR
  if (roles.includes(RoleName.CPPD_MEMBER) || roles.includes(RoleName.CPPD_CENTRAL)) return PersonType.CPPD_MEMBER
  if (roles.includes(RoleName.DOCENTE)) return PersonType.TEACHER
  return PersonType.OTHER
}

export interface CreateWithRolesAndDocenteInput {
  name: string
  email: string
  cpf: string | null
  phone: string | null
  city: string | null
  uf: string | null
  passwordHash: string | null
  roles: RoleName[]
  docenteProfile?: {
    siape: string
    classLevel: ClassLevel
    startInterstice: Date
    educationLevel: string
    improvement?: string | null
    specialization?: string | null
    mastersDegree?: string | null
    doctorate?: string | null
    assignment?: string | null
    department?: string | null
    division?: string | null
    role?: string | null
    immediateSupervisor?: string | null
  }
  externalEvaluatorProfile?: {
    title?: string | null
    institution?: string | null
  }
}

export interface UpdateDocenteProfileInput {
  siape?: string
  classLevel?: ClassLevel
  startInterstice?: Date
  educationLevel?: string
  improvement?: string | null
  specialization?: string | null
  mastersDegree?: string | null
  doctorate?: string | null
  assignment?: string | null
  department?: string | null
  division?: string | null
  role?: string | null
  immediateSupervisor?: string | null
}

export interface UpdateUserWithRolesAndDocenteInput {
  name?: string
  email?: string
  cpf?: string
  phone?: string | null
  city?: string | null
  uf?: string | null
  active?: boolean
  roles?: RoleName[]
  docenteProfile?: UpdateDocenteProfileInput
  externalEvaluatorProfile?: {
    title?: string | null
    institution?: string | null
  }
}

export class UserRepository {
  async findByCpf(cpf: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ cpfHash: hashCpf(cpf) }, { cpf }]
      },
      include: {
        roles: { include: { role: true } },
        docente: true,
        externalEvaluator: true,
        person: true
      }
    })
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        roles: { include: { role: true } },
        docente: true,
        externalEvaluator: true,
        person: true
      }
    })
  }

  async findById(idUser: number) {
    if (!Number.isInteger(idUser)) {
      throw new Error("idUser inválido em findById")
    }

    return prisma.user.findFirst({
      where: { idUser, deletedDate: null },
      include: {
        roles: { include: { role: true } },
        docente: true,
        externalEvaluator: true,
        person: true
      }
    })
  }

  async findManyActive() {
    return prisma.user.findMany({
      where: { deletedDate: null, active: true },
      include: {
        roles: { include: { role: true } },
        docente: true,
        externalEvaluator: true,
        person: true
      },
      orderBy: { createdAt: "desc" }
    })
  }

  async findSummariesByIds(userIds: number[]) {
    if (userIds.length === 0) return []
    return prisma.user.findMany({
      where: { idUser: { in: userIds }, deletedDate: null },
      select: { idUser: true, name: true, email: true }
    })
  }

  async findManyDocentesActive(campusIds: number[] | null = null) {
    return prisma.user.findMany({
      where: {
        deletedDate: null,
        active: true,
        docente:
          campusIds === null
            ? { isNot: null }
            : { is: { campusId: { in: campusIds }, deletedDate: null } }
      },
      include: {
        roles: { include: { role: true } },
        docente: true,
        externalEvaluator: true,
        person: true
      },
      orderBy: { createdAt: "desc" }
    })
  }

  async createWithRolesAndDocente(input: CreateWithRolesAndDocenteInput) {
    return prisma.$transaction(async tx => {
      const protectedCpf = input.cpf ? protectCpf(input.cpf) : null
      const person = await tx.person.upsert({
        where: { email: input.email },
        update: {
          name: input.name,
          phone: input.phone,
          type: personTypeForRoles(input.roles),
          active: true,
          deletedDate: null,
          ...(protectedCpf
            ? {
                cpfEncrypted: protectedCpf.cpfEncrypted,
                cpfHash: protectedCpf.cpfHash
              }
            : {})
        },
        create: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          type: personTypeForRoles(input.roles),
          cpfEncrypted: protectedCpf?.cpfEncrypted ?? null,
          cpfHash: protectedCpf?.cpfHash ?? null
        }
      })

      return tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          cpf: null,
          cpfEncrypted: protectedCpf?.cpfEncrypted ?? null,
          cpfHash: protectedCpf?.cpfHash ?? null,
          phone: input.phone,
          city: input.city,
          uf: input.uf,
          passwordHash: input.passwordHash,
          person: { connect: { idPerson: person.idPerson } },
          roles: {
            create: input.roles.map(name => ({
              role: { connect: { name } }
            }))
          },
          docente: input.docenteProfile
            ? {
                create: {
                  siape: input.docenteProfile.siape,
                  classLevel: input.docenteProfile.classLevel,
                  start_interstice: input.docenteProfile.startInterstice,
                  educationLevel: input.docenteProfile.educationLevel,
                  improvement: input.docenteProfile.improvement ?? null,
                  specialization: input.docenteProfile.specialization ?? null,
                  mastersDegree: input.docenteProfile.mastersDegree ?? null,
                  doctorate: input.docenteProfile.doctorate ?? null,
                  assignment: input.docenteProfile.assignment ?? null,
                  department: input.docenteProfile.department ?? null,
                  division: input.docenteProfile.division ?? null,
                  role: input.docenteProfile.role ?? null,
                  immediate_supervisor: input.docenteProfile.immediateSupervisor ?? null
                }
              }
            : undefined,
          externalEvaluator: input.roles.includes(RoleName.EXTERNAL_EVALUATOR)
            ? {
                create: {
                  title: input.externalEvaluatorProfile?.title ?? null,
                  institution: input.externalEvaluatorProfile?.institution ?? null
                }
              }
            : undefined
        },
        include: {
          roles: { include: { role: true } },
          docente: true,
          externalEvaluator: true,
          person: true
        }
      })
    })
  }

  async updateWithRolesAndDocente(userId: number, input: UpdateUserWithRolesAndDocenteInput) {
    return prisma.$transaction(async tx => {
      const current = await tx.user.findUnique({
        where: { idUser: userId },
        include: {
          roles: { include: { role: true } },
          externalEvaluator: true,
          person: true
        }
      })
      if (!current) throw new Error("User not found")

      const data: any = {}

      if (input.name !== undefined) data.name = input.name
      if (input.email !== undefined) data.email = input.email
      if (input.phone !== undefined) data.phone = input.phone
      if (input.city !== undefined) data.city = input.city
      if (input.uf !== undefined) data.uf = input.uf
      const protectedCpf = input.cpf !== undefined ? protectCpf(input.cpf) : null
      if (protectedCpf) {
        data.cpf = null
        data.cpfEncrypted = protectedCpf.cpfEncrypted
        data.cpfHash = protectedCpf.cpfHash
      }
      if (input.active !== undefined) data.active = input.active

      const effectiveRoles = input.roles ?? current.roles.map(item => item.role.name)
      const personData = {
        name: input.name ?? current.name,
        email: input.email ?? current.email,
        phone: input.phone !== undefined ? input.phone : current.phone,
        type: personTypeForRoles(effectiveRoles),
        active: input.active ?? current.active,
        deletedDate: null,
        ...(protectedCpf
          ? {
              cpfEncrypted: protectedCpf.cpfEncrypted,
              cpfHash: protectedCpf.cpfHash
            }
          : {})
      }

      if (current.personId) {
        await tx.person.update({
          where: { idPerson: current.personId },
          data: personData
        })
      } else {
        const person = await tx.person.upsert({
          where: { email: personData.email },
          update: personData,
          create: personData
        })
        data.person = { connect: { idPerson: person.idPerson } }
      }

      if (input.roles) {
        data.roles = {
          deleteMany: {},
          create: input.roles.map(name => ({
            role: { connect: { name } }
          }))
        }
      }

      if (input.docenteProfile) {
        const p = input.docenteProfile
        const docenteUpdate: any = {}
        if (p.siape !== undefined) docenteUpdate.siape = p.siape
        if (p.classLevel !== undefined) docenteUpdate.classLevel = p.classLevel
        if (p.startInterstice !== undefined) docenteUpdate.start_interstice = p.startInterstice
        if (p.educationLevel !== undefined) docenteUpdate.educationLevel = p.educationLevel
        if (p.improvement !== undefined) docenteUpdate.improvement = p.improvement
        if (p.specialization !== undefined) docenteUpdate.specialization = p.specialization
        if (p.mastersDegree !== undefined) docenteUpdate.mastersDegree = p.mastersDegree
        if (p.doctorate !== undefined) docenteUpdate.doctorate = p.doctorate
        if (p.assignment !== undefined) docenteUpdate.assignment = p.assignment
        if (p.department !== undefined) docenteUpdate.department = p.department
        if (p.division !== undefined) docenteUpdate.division = p.division
        if (p.role !== undefined) docenteUpdate.role = p.role
        if (p.immediateSupervisor !== undefined) docenteUpdate.immediate_supervisor = p.immediateSupervisor

        data.docente = {
          upsert: {
            update: docenteUpdate,
            create: {
              siape: p.siape!,
              classLevel: p.classLevel!,
              start_interstice: p.startInterstice!,
              educationLevel: p.educationLevel!,
              improvement: p.improvement ?? null,
              specialization: p.specialization ?? null,
              mastersDegree: p.mastersDegree ?? null,
              doctorate: p.doctorate ?? null,
              assignment: p.assignment ?? null,
              department: p.department ?? null,
              division: p.division ?? null,
              role: p.role ?? null,
              immediate_supervisor: p.immediateSupervisor ?? null
            }
          }
        }
      }

      const hasExternalEvaluatorRole = effectiveRoles.includes(RoleName.EXTERNAL_EVALUATOR)
      if (hasExternalEvaluatorRole) {
        data.externalEvaluator = {
          upsert: {
            update: {
              title: input.externalEvaluatorProfile?.title,
              institution: input.externalEvaluatorProfile?.institution,
              active: true,
              deletedDate: null
            },
            create: {
              title: input.externalEvaluatorProfile?.title ?? null,
              institution: input.externalEvaluatorProfile?.institution ?? null
            }
          }
        }
      } else if (input.roles && current.externalEvaluator) {
        data.externalEvaluator = {
          update: { active: false, deletedDate: new Date() }
        }
      }

      return tx.user.update({
        where: { idUser: userId },
        data,
        include: {
          roles: { include: { role: true } },
          docente: true,
          externalEvaluator: true,
          person: true
        }
      })
    })
  }

  async deleteUserById(userId: number) {
    return prisma.user.update({
      where: { idUser: userId },
      data: { active: false, deletedDate: new Date() },
      include: {
        roles: { include: { role: true } },
        docente: true,
        externalEvaluator: true,
        person: true
      }
    })
  }
}
