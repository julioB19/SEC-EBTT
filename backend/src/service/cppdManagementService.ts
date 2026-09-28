import {
  CommissionMembershipType,
  CppdMemberFunction
} from "@prisma/client"
import { CppdManagementError } from "../exception/cppd-management-error"
import { CppdManagementRepository } from "../repository/cppdManagementRepository"
import {
  SaveCampusDto,
  SaveCppdCommissionDto,
  SaveCppdCommissionMemberDto,
  UpdateCppdCommissionMemberDto
} from "../type/dto/cppdManagementDto"

export class CppdManagementService {
  constructor(private readonly repository = new CppdManagementRepository()) {}

  listCampuses() {
    return this.repository.listCampuses()
  }

  async createCampus(dto: SaveCampusDto) {
    return this.repository.createCampus({
      name: dto.name!.trim(),
      acronym: dto.acronym!.trim().toUpperCase(),
      cppdEmail: dto.cppdEmail?.trim().toLowerCase() || null,
      active: dto.active ?? true
    })
  }

  async updateCampus(campusId: number, dto: SaveCampusDto) {
    await this.requireCampus(campusId)
    return this.repository.updateCampus(campusId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.acronym !== undefined ? { acronym: dto.acronym.trim().toUpperCase() } : {}),
      ...(dto.cppdEmail !== undefined
        ? { cppdEmail: dto.cppdEmail?.trim().toLowerCase() || null }
        : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {})
    })
  }

  listCommissions(campusId?: number) {
    return this.repository.listCommissions(campusId)
  }

  listMemberCandidates() {
    return this.repository.listMemberCandidates()
  }

  async createCommission(dto: SaveCppdCommissionDto) {
    const campus = await this.requireCampus(dto.campusId!)
    if (!campus.active) throw new CppdManagementError("O campus selecionado está inativo")
    this.validateDates(dto)

    return this.repository.createCommission({
      campusId: dto.campusId!,
      ordinance: dto.ordinance?.trim() || null,
      mandateStart: dto.mandateStart ?? null,
      mandateEnd: dto.mandateEnd ?? null,
      validityStart: dto.validityStart ?? null,
      validityEnd: dto.validityEnd ?? null
    })
  }

  async updateCommission(commissionId: number, dto: SaveCppdCommissionDto) {
    const current = await this.requireCommission(commissionId)
    const campusId = dto.campusId ?? current.campusId
    if (!campusId) throw new CppdManagementError("A comissão deve possuir um campus")
    const campus = await this.requireCampus(campusId)
    if (!campus.active) throw new CppdManagementError("O campus selecionado está inativo")

    const dates = {
      mandateStart: dto.mandateStart === undefined ? current.mandateStart : dto.mandateStart,
      mandateEnd: dto.mandateEnd === undefined ? current.mandateEnd : dto.mandateEnd,
      validityStart: dto.validityStart === undefined ? current.validityStart : dto.validityStart,
      validityEnd: dto.validityEnd === undefined ? current.validityEnd : dto.validityEnd
    }
    this.validateDates(dates)

    return this.repository.updateCommission(commissionId, {
      ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
      ...(dto.ordinance !== undefined ? { ordinance: dto.ordinance?.trim() || null } : {}),
      ...(dto.mandateStart !== undefined ? { mandateStart: dto.mandateStart } : {}),
      ...(dto.mandateEnd !== undefined ? { mandateEnd: dto.mandateEnd } : {}),
      ...(dto.validityStart !== undefined ? { validityStart: dto.validityStart } : {}),
      ...(dto.validityEnd !== undefined ? { validityEnd: dto.validityEnd } : {})
    })
  }

  async addMember(commissionId: number, dto: SaveCppdCommissionMemberDto) {
    await this.requireCommission(commissionId)
    const person = await this.repository.findMemberCandidate(dto.personId)
    if (!person) {
      throw new CppdManagementError(
        "A pessoa selecionada não possui um usuário ativo com perfil de membro da CPPD"
      )
    }

    await this.repository.upsertMember({
      commissionId,
      personId: dto.personId,
      function: dto.function ?? CppdMemberFunction.MEMBER,
      membershipType: dto.membershipType ?? CommissionMembershipType.PRIMARY,
      active: dto.active ?? true
    })
    return this.requireCommission(commissionId)
  }

  async updateMember(
    commissionId: number,
    personId: number,
    dto: UpdateCppdCommissionMemberDto
  ) {
    await this.requireCommission(commissionId)
    await this.requireMember(commissionId, personId)
    await this.repository.updateMember(commissionId, personId, dto)
    return this.requireCommission(commissionId)
  }

  async removeMember(commissionId: number, personId: number) {
    await this.requireCommission(commissionId)
    await this.requireMember(commissionId, personId)
    await this.repository.removeMember(commissionId, personId)
    return this.requireCommission(commissionId)
  }

  private validateDates(dto: SaveCppdCommissionDto) {
    if (dto.mandateStart && dto.mandateEnd && dto.mandateStart > dto.mandateEnd) {
      throw new CppdManagementError("O início do mandato não pode ser posterior ao término")
    }
    if (dto.validityStart && dto.validityEnd && dto.validityStart > dto.validityEnd) {
      throw new CppdManagementError("O início da vigência não pode ser posterior ao término")
    }
  }

  private async requireCampus(campusId: number) {
    const campus = await this.repository.findCampus(campusId)
    if (!campus) throw new CppdManagementError("Campus não encontrado", "NOT_FOUND")
    return campus
  }

  private async requireCommission(commissionId: number) {
    const commission = await this.repository.findCommission(commissionId)
    if (!commission) throw new CppdManagementError("Comissão da CPPD não encontrada", "NOT_FOUND")
    return commission
  }

  private async requireMember(commissionId: number, personId: number) {
    const member = await this.repository.findMember(commissionId, personId)
    if (!member) throw new CppdManagementError("Membro da comissão não encontrado", "NOT_FOUND")
    return member
  }
}
