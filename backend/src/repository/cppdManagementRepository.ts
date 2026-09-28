import {
  CommissionMembershipType,
  CppdMemberFunction,
  Prisma,
  RoleName
} from "@prisma/client"
import { prisma } from "../infra/prismaClient"

const commissionInclude = {
  campus: {
    select: {
      idCampus: true,
      name: true,
      acronym: true,
      active: true
    }
  },
  members: {
    where: { deletedDate: null },
    include: {
      person: {
        select: {
          idPerson: true,
          name: true,
          email: true,
          active: true,
          users: {
            where: { deletedDate: null },
            select: { idUser: true }
          }
        }
      }
    },
    orderBy: [{ active: "desc" as const }, { createdAt: "asc" as const }]
  }
} satisfies Prisma.CppdCommissionInclude

export class CppdManagementRepository {
  listCampuses() {
    return prisma.campus.findMany({
      where: { deletedDate: null },
      include: {
        _count: {
          select: {
            docentes: true,
            processes: true,
            cppdCommissions: true
          }
        }
      },
      orderBy: [{ active: "desc" }, { name: "asc" }]
    })
  }

  findCampus(campusId: number) {
    return prisma.campus.findFirst({
      where: { idCampus: campusId, deletedDate: null }
    })
  }

  createCampus(data: { name: string; acronym: string; cppdEmail: string | null; active: boolean }) {
    return prisma.campus.create({ data })
  }

  updateCampus(campusId: number, data: Prisma.CampusUpdateInput) {
    return prisma.campus.update({ where: { idCampus: campusId }, data })
  }

  listCommissions(campusId?: number) {
    return prisma.cppdCommission.findMany({
      where: {
        deletedDate: null,
        ...(campusId ? { campusId } : {})
      },
      include: commissionInclude,
      orderBy: [{ validityEnd: "desc" }, { createdAt: "desc" }]
    })
  }

  findCommission(commissionId: number) {
    return prisma.cppdCommission.findFirst({
      where: { idCppdCommission: commissionId, deletedDate: null },
      include: commissionInclude
    })
  }

  createCommission(data: Prisma.CppdCommissionUncheckedCreateInput) {
    return prisma.cppdCommission.create({ data, include: commissionInclude })
  }

  updateCommission(commissionId: number, data: Prisma.CppdCommissionUncheckedUpdateInput) {
    return prisma.cppdCommission.update({
      where: { idCppdCommission: commissionId },
      data,
      include: commissionInclude
    })
  }

  listMemberCandidates() {
    return prisma.person.findMany({
      where: {
        active: true,
        deletedDate: null,
        users: {
          some: {
            active: true,
            deletedDate: null,
            roles: {
              some: {
                deletedDate: null,
                role: { name: RoleName.CPPD_MEMBER }
              }
            }
          }
        }
      },
      select: {
        idPerson: true,
        name: true,
        email: true,
        users: {
          where: { active: true, deletedDate: null },
          select: { idUser: true }
        }
      },
      orderBy: { name: "asc" }
    })
  }

  findMemberCandidate(personId: number) {
    return prisma.person.findFirst({
      where: {
        idPerson: personId,
        active: true,
        deletedDate: null,
        users: {
          some: {
            active: true,
            deletedDate: null,
            roles: {
              some: {
                deletedDate: null,
                role: { name: RoleName.CPPD_MEMBER }
              }
            }
          }
        }
      }
    })
  }

  upsertMember(data: {
    commissionId: number
    personId: number
    function: CppdMemberFunction
    membershipType: CommissionMembershipType
    active: boolean
  }) {
    return prisma.cppdCommissionMember.upsert({
      where: {
        commissionId_personId: {
          commissionId: data.commissionId,
          personId: data.personId
        }
      },
      update: {
        function: data.function,
        membershipType: data.membershipType,
        active: data.active,
        deletedDate: null
      },
      create: data
    })
  }

  updateMember(
    commissionId: number,
    personId: number,
    data: {
      function?: CppdMemberFunction
      membershipType?: CommissionMembershipType
      active?: boolean
    }
  ) {
    return prisma.cppdCommissionMember.update({
      where: { commissionId_personId: { commissionId, personId } },
      data
    })
  }

  findMember(commissionId: number, personId: number) {
    return prisma.cppdCommissionMember.findFirst({
      where: { commissionId, personId, deletedDate: null }
    })
  }

  removeMember(commissionId: number, personId: number) {
    return prisma.cppdCommissionMember.update({
      where: { commissionId_personId: { commissionId, personId } },
      data: { active: false, deletedDate: new Date() }
    })
  }
}
