import { prisma } from "../infra/prismaClient"

export class CppdAccessRepository {
  async findActiveCampusIdsForUser(userId: number, at: Date): Promise<number[]> {
    const user = await prisma.user.findFirst({
      where: {
        idUser: userId,
        active: true,
        deletedDate: null
      },
      select: {
        person: {
          select: {
            cppdMemberships: {
              where: {
                active: true,
                deletedDate: null,
                commission: {
                  is: {
                    deletedDate: null,
                    campusId: { not: null },
                    campus: {
                      is: { active: true, deletedDate: null }
                    },
                    AND: [
                      { OR: [{ validityStart: null }, { validityStart: { lte: at } }] },
                      { OR: [{ validityEnd: null }, { validityEnd: { gte: at } }] }
                    ]
                  }
                }
              },
              select: {
                commission: { select: { campusId: true } }
              }
            }
          }
        }
      }
    })

    const campusIds = user?.person?.cppdMemberships
      .map(membership => membership.commission.campusId)
      .filter((campusId): campusId is number => campusId !== null) ?? []

    return [...new Set(campusIds)]
  }

  async hasProcessInCampuses(processId: number, campusIds: number[]): Promise<boolean> {
    if (!campusIds.length) return false
    const count = await prisma.careerProcess.count({
      where: {
        idProcess: processId,
        deletedDate: null,
        campusId: { in: campusIds }
      }
    })
    return count > 0
  }

  async hasTeacherInCampuses(userId: number, campusIds: number[]): Promise<boolean> {
    if (!campusIds.length) return false
    const count = await prisma.user.count({
      where: {
        idUser: userId,
        active: true,
        deletedDate: null,
        docente: { is: { campusId: { in: campusIds }, deletedDate: null } }
      }
    })
    return count > 0
  }
}
