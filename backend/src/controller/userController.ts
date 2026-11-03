import { AccessError } from "../util/accessPolicy"
import { UserService } from "../service/userService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { createUserSchema } from "../validator/userValidator"
import { UserExists } from "../exception/user-exists"
import { DocenteProfileRequired } from "../exception/docente-profile-required"
import { LoginResponseWithRoles } from "../type/response/userResponse"
import { InvalidCredentials } from "../exception/invalid-credentials"
import { InvalidRefreshToken } from "../exception/invalid-refresh-token"
import { RoleName } from "@prisma/client"
import { UserNotFound } from "../exception/user-not-found"
import { revokeAccessToken, revokeRefreshToken, isLikelyJwt } from "../util/tokenBlacklist"
import { getCppdAccessScope } from "../middleware/cppdAccessMiddleware"

function getAuthUser(req: any): { userId: number; roles: RoleName[] } | null {
  const u = req?.user

  const rawUserId = u?.userId ?? u?.idUser ?? u?.id ?? u?.sub ?? u?.user_id ?? u?.uid

  const userId = Number(rawUserId)

  const roles = Array.isArray(u?.roles) ? u.roles : []
  if (!userId || Number.isNaN(userId)) return null
  return { userId, roles }
}

function hasRole(roles: RoleName[], role: RoleName) {
  return roles.includes(role)
}

export class UserController {
  constructor(private readonly userService: UserService) {}

  async login(req: any, res: any): Promise<void> {
    try {
      const dto = { cpf: req.body.cpf, password: req.body.password }
      const response = await this.userService.login(dto)
      return HttpResponse.ok<LoginResponseWithRoles>(res, "Login successful", response)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      console.log("Request failed:", error?.message)
      if (error instanceof InvalidCredentials) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_CREDENTIALS, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async logout(req: any, res: any): Promise<void> {
    try {
      const header: string | undefined = req.headers?.authorization || req.header("Authorization")
      let revokedAccess = false
      if (header) {
        let t = header.trim().replace(/^bearer[:=]?\s+/i, "")
        if (/^bearer/i.test(t)) {
          const parts = t.split(/\s+/)
          if (parts.length >= 2) t = parts.slice(1).join(" ")
        }
        t = t.replace(/^['"]+|['"]+$/g, "").trim()
        if (isLikelyJwt(t)) {
          revokeAccessToken(t)
          revokedAccess = true
        }
      }

      const refreshToken: string | undefined = req.body?.refreshToken
      let revokedRefresh = false
      if (refreshToken && isLikelyJwt(refreshToken)) {
        revokeRefreshToken(refreshToken)
        revokedRefresh = true
      }

      return HttpResponse.ok(res, "Logged out", {
        revokedAccess,
        revokedRefresh
      })
    } catch {
      return HttpResponse.internalError(res)
    }
  }

  async refreshToken(req: any, res: any): Promise<void> {
    try {
      const dto = { refreshToken: req.body.refreshToken }
      const response = await this.userService.refreshToken(dto)
      return HttpResponse.ok<LoginResponseWithRoles>(res, "Refresh token successful", response)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      console.log("Request failed:", error?.message)
      if (error instanceof InvalidRefreshToken) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_REFRESH_TOKEN, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async selectRole(req: any, res: any): Promise<void> {
    try {
      const refreshToken: string | undefined = req.body?.refreshToken
      const role: RoleName | undefined = req.body?.role

      if (!refreshToken || !role) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "refreshToken e role são obrigatórios",
          null
        )
      }

      const response = await this.userService.selectRole(refreshToken, role)
      return HttpResponse.ok<LoginResponseWithRoles>(res, "Role selected", response)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      console.log("Request failed:", error?.message)
      if (error instanceof InvalidRefreshToken) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_REFRESH_TOKEN, error.message, null)
      }
      return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid role selection", null)
    }
  }

  async createUser(req: any, res: any): Promise<void> {
    try {
      const { error, value } = createUserSchema.validate(req.body, {
        abortEarly: false
      })
      if (error) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Validation failed",
          error.details.map(d => d.message)
        )
      }

      const dto = {
        campusId: value.campusId,
        name: value.name,
        email: value.email,
        phone: value.phone,
        city: value.city ?? null,
        uf: value.uf ?? null,
        cpf: value.cpf,
        password: value.password,
        roles: value.roles,
        docenteProfile: value.docenteProfile
          ? {
              campusId: value.docenteProfile.campusId,
              siape: value.docenteProfile.siape,
              classLevel: value.docenteProfile.classLevel,
              startInterstice: value.docenteProfile.startInterstice,
              educationLevel: value.docenteProfile.educationLevel,
              improvement: value.docenteProfile.improvement,
              specialization: value.docenteProfile.specialization,
              mastersDegree: value.docenteProfile.mastersDegree,
              doctorate: value.docenteProfile.doctorate,
              assignment: value.docenteProfile.assignment,
              department: value.docenteProfile.department,
              division: value.docenteProfile.division,
              role: value.docenteProfile.role,
              immediateSupervisor: value.docenteProfile.immediateSupervisor
            }
          : undefined,
        externalEvaluatorProfile: value.externalEvaluatorProfile
          ? {
              title: value.externalEvaluatorProfile.title ?? null,
              institution: value.externalEvaluatorProfile.institution ?? null
            }
          : undefined
      }

      const user = await this.userService.createUser(dto)

      return HttpResponse.created(res, "User created", {
        idUser: user.idUser,
        name: user.name,
        phone: user.phone,
        cpf: user.cpf,
        email: user.email,
        city: user.city,
        uf: user.uf,
        active: user.active,
        createdAt: user.createdAt,
        deletedDate: user.deletedDate ?? null,
        roles: user.roles,
        docenteProfile: user.docenteProfile
          ? {
              idDocente: user.docenteProfile.idDocente,
              siape: user.docenteProfile.siape,
              classLevel: user.docenteProfile.classLevel,
              startInterstice: user.docenteProfile.startInterstice,
              educationLevel: user.docenteProfile.educationLevel,
              improvement: user.docenteProfile.improvement ?? null,
              specialization: user.docenteProfile.specialization ?? null,
              mastersDegree: user.docenteProfile.mastersDegree ?? null,
              doctorate: user.docenteProfile.doctorate ?? null,
              assignment: user.docenteProfile.assignment ?? null,
              department: user.docenteProfile.department ?? null,
              division: user.docenteProfile.division ?? null,
              role: user.docenteProfile.role ?? null,
              immediateSupervisor: user.docenteProfile.immediateSupervisor ?? null
            }
          : null,
        externalEvaluatorProfile: user.externalEvaluatorProfile
      })
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      console.log("Request failed:", error?.message)

      if (error instanceof UserExists) {
        return HttpResponse.badRequest(res, StatusCodeDescription.USER_EXISTS, error.message, null)
      }

      if (typeof DocenteProfileRequired !== "undefined" && error instanceof DocenteProfileRequired) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      }

      if (error?.code === "P2002") {
        const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(", ") : "unique field"
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.USER_EXISTS,
          `Violação de unicidade em: ${target}`,
          null
        )
      }

      return HttpResponse.internalError(res)
    }
  }

  async getUserById(req: any, res: any): Promise<void> {
    try {
      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }
      const user = await this.userService.getUserById(userId)
      return HttpResponse.ok(res, "User found", user)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async getMyProfile(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)

      const me = await this.userService.getUserById(auth.userId)
      return HttpResponse.ok(res, "Perfil recuperado", me)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async updateMyProfile(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)

      if (!hasRole(auth.roles, RoleName.DOCENTE) && req.body?.docenteProfile) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Apenas DOCENTE pode editar docenteProfile",
          null
        )
      }

      const updated = await this.userService.updateOwnProfile(auth.userId, req.body)
      return HttpResponse.ok(res, "Perfil atualizado", updated)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      if (error?.code === "P2002") {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Email já utilizado", null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async getAllActiveUsers(_req: any, res: any): Promise<void> {
    try {
      const users = await this.userService.getAllActiveUsers()
      return HttpResponse.ok(res, "Active users retrieved", users)
    } catch {
      return HttpResponse.internalError(res)
    }
  }

  async updateUser(req: any, res: any): Promise<void> {
    try {
      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }
      const updated = await this.userService.updateUser(userId, req.body)
      return HttpResponse.ok(res, "User updated", updated)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      if (error instanceof DocenteProfileRequired) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      }
      if (error?.code === "P2002") {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Email/CPF já utilizado", null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async deleteUser(req: any, res: any): Promise<void> {
    try {
      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }
      const deleted = await this.userService.deleteUserById(userId)
      return HttpResponse.ok(res, "User deleted", deleted)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async registerDocente(req: any, res: any): Promise<void> {
    try {
      const dto = {
        name: String(req.body.name),
        email: String(req.body.email),
        phone: req.body.phone ? String(req.body.phone) : null,
        city: req.body.city ? String(req.body.city) : null,
        uf: req.body.uf ? String(req.body.uf) : null,
        cpf: String(req.body.cpf),
        password: String(req.body.password),
        roles: [RoleName.DOCENTE] as RoleName[],
        docenteProfile: req.body.docenteProfile
      }
      const user = await this.userService.createUser(dto)
      return HttpResponse.created(res, "Docente registered", user)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      console.error("Erro em registerDocente:", error)

      if (error instanceof UserExists) {
        return HttpResponse.badRequest(res, StatusCodeDescription.USER_EXISTS, error.message, null)
      }
      if (error instanceof DocenteProfileRequired) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      }
      if (error?.code === "P2002") {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Email/CPF já utilizado", null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async updateMyDocenteProfile(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)
      if (!hasRole(auth.roles, RoleName.DOCENTE)) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Apenas DOCENTE pode editar o próprio perfil",
          null
        )
      }

      const updated = await this.userService.updateOwnDocenteProfile(auth.userId, req.body)
      return HttpResponse.ok(res, "Perfil atualizado", updated)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      if (error?.code === "P2002") {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Email já utilizado", null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async listDocentes(req: any, res: any): Promise<void> {
    try {
      const scope = getCppdAccessScope(req)
      if (!scope) return HttpResponse.unauthorized(res)
      const docentes = await this.userService.listDocentes(scope.isCentral ? null : scope.campusIds)
      return HttpResponse.ok(res, "Docentes recuperados", docentes)
    } catch {
      return HttpResponse.internalError(res)
    }
  }

  async updateDocenteByCppd(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)
      if (!hasRole(auth.roles, RoleName.CPPD_MEMBER) && !hasRole(auth.roles, RoleName.CPPD_CENTRAL)) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Apenas perfis da CPPD podem editar por esta rota",
          null
        )
      }

      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }

      const updated = await this.userService.updateDocenteLimitedByCppd(userId, req.body)
      return HttpResponse.ok(res, "Docente atualizado", updated)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      if (error?.code === "P2002") {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Email/CPF já utilizado", null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async updateDocenteByAdmin(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)
      if (!hasRole(auth.roles, RoleName.ADMIN)) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Apenas ADMIN pode editar por esta rota",
          null
        )
      }

      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }

      const updated = await this.userService.updateDocenteByAdmin(userId, req.body)
      return HttpResponse.ok(res, "Docente atualizado", updated)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      if (error instanceof DocenteProfileRequired) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      }
      if (error?.code === "P2002") {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Email/CPF já utilizado", null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async deleteDocenteByAdmin(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)
      if (!hasRole(auth.roles, RoleName.ADMIN)) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Apenas ADMIN pode excluir docente",
          null
        )
      }

      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }

      const deleted = await this.userService.deleteUserById(userId)
      return HttpResponse.ok(res, "Docente excluído", deleted)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }

  async setUserRolesByAdmin(req: any, res: any): Promise<void> {
    try {
      const auth = getAuthUser(req)
      if (!auth)
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Usuário não autenticado", null)
      if (!hasRole(auth.roles, RoleName.ADMIN)) {
        return HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Apenas ADMIN pode alterar roles",
          null
        )
      }

      const userId = Number(req.params.userId)
      if (isNaN(userId)) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid ID format", null)
      }

      const roles: RoleName[] = Array.isArray(req.body?.roles) ? req.body.roles : []
      if (!roles.length) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "roles é obrigatório", null)
      }

      const updated = await this.userService.setUserRoles(userId, roles)
      return HttpResponse.ok(res, "Roles atualizadas", updated)
    } catch (error: any) {
      if (error instanceof AccessError) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      if (error instanceof UserNotFound) {
        return HttpResponse.notFound(res, StatusCodeDescription.USER_NOT_FOUND, error.message, null)
      }
      return HttpResponse.internalError(res)
    }
  }
}
