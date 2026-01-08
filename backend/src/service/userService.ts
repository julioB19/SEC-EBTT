import bcrypt from "bcryptjs"
import { RoleName, ClassLevel } from "@prisma/client"
import {
  CreateUserDto,
  UserResponseDto,
  DocenteProfileResponseDto,
  LoginDto,
  RefreshTokenDto,
  UpdateUserDto,
  UpdateMyDocenteProfileDto,
  UpdateDocenteByCppdDto
} from "../type/dto/userDto"
import { UserRepository } from "../repository/userRepository"
import { UserExists } from "../exception/user-exists"
import { DocenteProfileRequired } from "../exception/docente-profile-required"
import { LoginResponseWithRoles } from "../type/response/userResponse"
import { InvalidCredentials } from "../exception/invalid-credentials"
import { generateAccessToken, generateRefreshToken } from "../util/generateToken"
import { decodeRefreshToken } from "../util/decodeToken"
import { isRefreshTokenRevoked } from "../util/tokenBlacklist"
import { InvalidRefreshToken } from "../exception/invalid-refresh-token"
import { UserNotFound } from "../exception/user-not-found"

function normalizeCpf(cpf: string): string {
  return (cpf || "").replace(/\D/g, "")
}

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

export class UserService {
  constructor(
    private readonly userRepository: UserRepository
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseWithRoles> {
    const cleanCpf = onlyDigits(dto.cpf)
    const user = await this.userRepository.findByCpf(cleanCpf)
    if (!user) throw new InvalidCredentials()

    const ok = await bcrypt.compare(dto.password, user.passwordHash)
    if (!ok) throw new InvalidCredentials()

    const roles: RoleName[] = user.roles?.map((r: any) => r.role?.name).filter(Boolean) ?? []
    const hasMultiple = roles.length > 1
    const selectedRole = hasMultiple ? null : (roles[0] ?? null)

    return {
      accessToken: generateAccessToken(roles, user.idUser, selectedRole),
      expiresIn: String(process.env.JWT_ACCESS_EXPIRATION),
      refreshToken: generateRefreshToken(user.idUser, selectedRole),
      refreshExpiresIn: String(process.env.JWT_REFRESH_EXPIRATION),
      firstAccess: false,
      roles,
      selectedRole,
      needsProfileSelection: hasMultiple
    }
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponseWithRoles> {
    if (isRefreshTokenRevoked(dto.refreshToken)) {
      throw new InvalidRefreshToken()
    }

    let decoded: { userId: number; selectedRole: RoleName | null }
    try {
      decoded = decodeRefreshToken(dto.refreshToken)
    } catch {
      throw new InvalidRefreshToken()
    }

    const user = await this.userRepository.findById(decoded.userId)
    if (!user) throw new InvalidRefreshToken()

    const roles: RoleName[] = user.roles?.map((r: any) => r.role?.name).filter(Boolean) ?? []
    const hasMultiple = roles.length > 1

    const selectedRole: RoleName | null =
      decoded.selectedRole && roles.includes(decoded.selectedRole)
        ? decoded.selectedRole
        : (hasMultiple ? null : (roles[0] ?? null))

    return {
      accessToken: generateAccessToken(roles, user.idUser, selectedRole),
      expiresIn: String(process.env.JWT_ACCESS_EXPIRATION),
      refreshToken: generateRefreshToken(user.idUser, selectedRole),
      refreshExpiresIn: String(process.env.JWT_REFRESH_EXPIRATION),
      firstAccess: false,
      roles,
      selectedRole,
      needsProfileSelection: hasMultiple && !selectedRole
    }
  }

  async selectRole(refreshToken: string, role: RoleName): Promise<LoginResponseWithRoles> {
    if (isRefreshTokenRevoked(refreshToken)) {
      throw new InvalidRefreshToken()
    }

    let decoded: { userId: number }
    try {
      decoded = decodeRefreshToken(refreshToken)
    } catch {
      throw new InvalidRefreshToken()
    }

    const user = await this.userRepository.findById(decoded.userId)
    if (!user) throw new InvalidRefreshToken()

    const roles: RoleName[] = user.roles?.map((r: any) => r.role?.name).filter(Boolean) ?? []
    if (!roles.includes(role)) throw new InvalidRefreshToken()

    return {
      accessToken: generateAccessToken(roles, user.idUser, role),
      expiresIn: String(process.env.JWT_ACCESS_EXPIRATION),
      refreshToken: generateRefreshToken(user.idUser, role),
      refreshExpiresIn: String(process.env.JWT_REFRESH_EXPIRATION),
      firstAccess: false,
      roles,
      selectedRole: role,
      needsProfileSelection: false
    }
  }

  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.userRepository.findByCpf(onlyDigits(dto.cpf))
    if (existing) {
      throw new UserExists()
    }

    if (dto.roles.includes("DOCENTE" as RoleName) && !dto.docenteProfile) {
      if (typeof DocenteProfileRequired !== "undefined") {
        throw new DocenteProfileRequired()
      }
      throw new Error('DocenteProfile é obrigatório quando roles inclui "DOCENTE"')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const cleanCpf = onlyDigits(dto.cpf)

    try {
      const created = await this.userRepository.createWithRolesAndDocente({
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        city: dto.city ?? null,
        uf: dto.uf ?? null,
        cpf: cleanCpf,
        passwordHash,
        roles: dto.roles,
        docenteProfile: dto.docenteProfile
          ? {
              siape: dto.docenteProfile.siape,
              classLevel: dto.docenteProfile.classLevel,
              startInterstice: dto.docenteProfile.startInterstice,
              educationLevel: dto.docenteProfile.educationLevel,
              improvement: dto.docenteProfile.improvement ?? null,
              specialization: dto.docenteProfile.specialization ?? null,
              mastersDegree: dto.docenteProfile.mastersDegree ?? null,
              doctorate: dto.docenteProfile.doctorate ?? null,
              assignment: dto.docenteProfile.assignment ?? null,
              department: dto.docenteProfile.department ?? null,
              division: dto.docenteProfile.division ?? null,
              role: dto.docenteProfile.role ?? null,
              immediateSupervisor: dto.docenteProfile.immediateSupervisor ?? null
            }
          : undefined
      })

      return this.toResponse(created)
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new UserExists()
      }
      throw err
    }
  }

  async getUserById(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new UserNotFound()
    return this.toResponse(user)
  }

  async getAllActiveUsers(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findManyActive()
    return users.map(u => this.toResponse(u))
  }

  async updateUser(userId: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const current = await this.userRepository.findById(userId)
    if (!current) throw new UserNotFound()

    const wantsDocente = dto.roles?.includes("DOCENTE" as RoleName) ?? false
    const hasDocente = Boolean(current.docente)

    if (wantsDocente && !hasDocente && !dto.docenteProfile) {
      if (typeof DocenteProfileRequired !== "undefined") throw new DocenteProfileRequired()
      throw new Error("Campos do DocenteProfile são obrigatórios para criar o perfil de docente")
    }

    if (wantsDocente && !hasDocente && dto.docenteProfile) {
      const p = dto.docenteProfile
      const missing: string[] = []
      if (!p.siape) missing.push("siape")
      if (!p.classLevel) missing.push("classLevel")
      if (!p.startInterstice) missing.push("startInterstice")
      if (!p.educationLevel) missing.push("educationLevel")
      if (missing.length) throw new Error(`Campos obrigatórios para criar DocenteProfile ausentes: ${missing.join(", ")}`)
    }

    const normalizedCpf = dto.cpf ? normalizeCpf(dto.cpf) : undefined

    const updated = await this.userRepository.updateWithRolesAndDocente(userId, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? undefined,
      city: dto.city ?? undefined,
      uf: dto.uf ?? undefined,
      cpf: normalizedCpf,
      active: dto.active,
      roles: dto.roles as RoleName[] | undefined,
      docenteProfile: dto.docenteProfile
        ? {
            siape: dto.docenteProfile.siape,
            classLevel: dto.docenteProfile.classLevel as ClassLevel | undefined,
            startInterstice: dto.docenteProfile.startInterstice,
            educationLevel: dto.docenteProfile.educationLevel,
            improvement: dto.docenteProfile.improvement ?? null,
            specialization: dto.docenteProfile.specialization ?? null,
            mastersDegree: dto.docenteProfile.mastersDegree ?? null,
            doctorate: dto.docenteProfile.doctorate ?? null,
            assignment: dto.docenteProfile.assignment ?? null,
            department: dto.docenteProfile.department ?? null,
            division: dto.docenteProfile.division ?? null,
            role: dto.docenteProfile.role ?? null,
            immediateSupervisor: dto.docenteProfile.immediateSupervisor ?? null
          }
        : undefined
    })

    return this.toResponse(updated)
  }

  async deleteUserById(userId: number): Promise<UserResponseDto> {
    const current = await this.userRepository.findById(userId)
    if (!current) throw new UserNotFound()

    const deleted = await this.userRepository.deleteUserById(userId)
    return this.toResponse(deleted)
  }


  async updateOwnDocenteProfile(authUserId: number, dto: UpdateMyDocenteProfileDto): Promise<UserResponseDto> {
    const current = await this.userRepository.findById(authUserId)
    if (!current) throw new UserNotFound()

    const updated = await this.userRepository.updateWithRolesAndDocente(authUserId, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? undefined,
      city: dto.city ?? undefined,
      uf: dto.uf ?? undefined,
      cpf: undefined,
      roles: undefined,
      active: undefined,
      docenteProfile: dto.docenteProfile
        ? {
            siape: dto.docenteProfile.siape,
            classLevel: dto.docenteProfile.classLevel as ClassLevel | undefined,
            startInterstice: dto.docenteProfile.startInterstice,
            educationLevel: dto.docenteProfile.educationLevel,
            improvement: dto.docenteProfile.improvement ?? null,
            specialization: dto.docenteProfile.specialization ?? null,
            mastersDegree: dto.docenteProfile.mastersDegree ?? null,
            doctorate: dto.docenteProfile.doctorate ?? null,
            assignment: dto.docenteProfile.assignment ?? null,
            department: dto.docenteProfile.department ?? null,
            division: dto.docenteProfile.division ?? null,
            role: dto.docenteProfile.role ?? null,
            immediateSupervisor: dto.docenteProfile.immediateSupervisor ?? null
          }
        : undefined
    })

    return this.toResponse(updated)
  }

  async listDocentes(): Promise<UserResponseDto[]> {
    const docentes = await this.userRepository.findManyDocentesActive()
    return docentes.map(d => this.toResponse(d))
  }

  async updateDocenteLimitedByCppd(userId: number, dto: UpdateDocenteByCppdDto): Promise<UserResponseDto> {
    const current = await this.userRepository.findById(userId)
    if (!current) throw new UserNotFound()
    if (!current.docente) throw new UserNotFound()

    const updated = await this.userRepository.updateWithRolesAndDocente(userId, {
      email: dto.email,
      cpf: dto.cpf ? onlyDigits(dto.cpf) : undefined,
      docenteProfile: dto.siape
        ? {
            siape: dto.siape
          }
        : undefined
    })

    return this.toResponse(updated)
  }

  async updateDocenteByAdmin(userId: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const current = await this.userRepository.findById(userId)
    if (!current) throw new UserNotFound()
    if (!current.docente) throw new UserNotFound()

    return this.updateUser(userId, dto)
  }

  async setUserRoles(userId: number, roles: RoleName[]): Promise<UserResponseDto> {
    const current = await this.userRepository.findById(userId)
    if (!current) throw new UserNotFound()

    const updated = await this.userRepository.updateWithRolesAndDocente(userId, {
      roles
    })

    return this.toResponse(updated)
  }

  private toResponse(user: any): UserResponseDto {
    const roles = user.roles?.map((r: any) => r.role?.name).filter(Boolean) ?? []

    const docente: DocenteProfileResponseDto | null = user.docente
      ? {
          idDocente: user.docente.idDocente,
          siape: user.docente.siape,
          classLevel: user.docente.classLevel as ClassLevel,
          startInterstice: user.docente.start_interstice,
          educationLevel: user.docente.educationLevel,
          improvement: user.docente.improvement ?? null,
          specialization: user.docente.specialization ?? null,
          mastersDegree: user.docente.mastersDegree ?? null,
          doctorate: user.docente.doctorate ?? null,
          assignment: user.docente.assignment ?? null,
          department: user.docente.department ?? null,
          division: user.docente.division ?? null,
          role: user.docente.role ?? null,
          immediateSupervisor: user.docente.immediate_supervisor ?? null
        }
      : null

    return {
      idUser: user.idUser,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      cpf: user.cpf,
      city: user.city ?? null,
      uf: user.uf ?? null,
      active: Boolean(user.active),
      createdAt: user.createdAt,
      deletedDate: user.deletedDate ?? null,
      roles,
      docenteProfile: docente
    }
  }
}
