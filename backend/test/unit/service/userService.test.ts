import { describe, expect, jest, beforeEach, test } from "@jest/globals"
import bcrypt from "bcryptjs"
import { RoleName } from "@prisma/client"
import { UserService } from "../../../src/service/userService"
import { UserRepository } from "../../../src/repository/userRepository"
import { InvalidCredentials } from "../../../src/exception/invalid-credentials"
import { InvalidRefreshToken } from "../../../src/exception/invalid-refresh-token"
import { UserExists } from "../../../src/exception/user-exists"
import { DocenteProfileRequired } from "../../../src/exception/docente-profile-required"
import { UserNotFound } from "../../../src/exception/user-not-found"
import * as tokenGen from "../../../src/util/generateToken"
import * as tokenDecode from "../../../src/util/decodeToken"
import * as blacklist from "../../../src/util/tokenBlacklist"

// mock do módulo bcrypt
jest.mock("bcryptjs", () => {
  return {
    compare: jest.fn(),
    hash: jest.fn()
  }
})

type CompareFn = (data: string | Buffer, encrypted: string) => Promise<boolean>
type HashFn = (data: string | Buffer, saltOrRounds: string | number) => Promise<string>
const bcryptMock = bcrypt as unknown as {
  compare: jest.MockedFunction<CompareFn>
  hash: jest.MockedFunction<HashFn>
}

describe("UserService", () => {
  let repo: jest.Mocked<UserRepository>
  let service: UserService
  const now = new Date()

  const dbUser = {
    idUser: 10,
    name: "Fulano",
    email: "fulano@if.edu.br",
    cpf: "11122233344",
    passwordHash: "hashed",
    phone: "(11) 99888-7766",
    city: null,
    uf: null,
    active: true,
    createdAt: now,
    deletedDate: null,
    roles: [{ role: { name: RoleName.ADMIN } }, { role: { name: RoleName.DOCENTE } }],
    docente: {
      idDocente: 7,
      siape: "1234567",
      classLevel: "D1",
      start_interstice: new Date("2024-01-01T00:00:00Z"),
      educationLevel: "Mestrado",
      improvement: null,
      specialization: null,
      mastersDegree: "Mestrado X",
      doctorate: null,
      assignment: "Ensino",
      department: "Computação",
      division: null,
      role: null,
      immediate_supervisor: null
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    repo = {
      findByCpf: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findManyActive: jest.fn(),
      createWithRolesAndDocente: jest.fn(),
      updateWithRolesAndDocente: jest.fn(),
      deleteUserById: jest.fn()
    } as any

    service = new UserService(repo)

    repo.findByEmail.mockResolvedValue(null)

    jest.spyOn(tokenGen, "generateAccessToken").mockReturnValue("access")
    jest.spyOn(tokenGen, "generateRefreshToken").mockReturnValue("refresh")
    jest
      .spyOn(tokenDecode, "decodeRefreshToken")
      .mockReturnValue({ userId: dbUser.idUser, selectedRole: RoleName.ADMIN })
    jest.spyOn(blacklist, "isRefreshTokenRevoked").mockReturnValue(false)

    process.env.JWT_ACCESS_EXPIRATION = "3600s"
    process.env.JWT_REFRESH_EXPIRATION = "7d"

    bcryptMock.compare.mockResolvedValue(true)
    bcryptMock.hash.mockResolvedValue("hashedpwd")
  })

  // 👇 Atualizado para incluir phone no DTO esperado
  const mapResponse = (u: any) => ({
    idUser: u.idUser,
    name: u.name,
    email: u.email,
    cpf: u.cpf,
    phone: u.phone ?? null,
    city: u.city ?? null,
    uf: u.uf ?? null,
    active: Boolean(u.active),
    createdAt: u.createdAt,
    deletedDate: u.deletedDate ?? null,
    roles: u.roles.map((r: any) => r.role.name),
    docenteProfile: u.docente
      ? {
          idDocente: u.docente.idDocente,
          siape: u.docente.siape,
          classLevel: u.docente.classLevel,
          startInterstice: u.docente.start_interstice,
          educationLevel: u.docente.educationLevel,
          improvement: u.docente.improvement,
          specialization: u.docente.specialization,
          mastersDegree: u.docente.mastersDegree,
          doctorate: u.docente.doctorate,
          assignment: u.docente.assignment,
          department: u.docente.department,
          division: u.docente.division,
          role: u.docente.role,
          immediateSupervisor: u.docente.immediate_supervisor
        }
      : null,
    externalEvaluatorProfile: u.externalEvaluator
      ? {
          idExternalEvaluator: u.externalEvaluator.idExternalEvaluator,
          title: u.externalEvaluator.title ?? null,
          institution: u.externalEvaluator.institution ?? null,
          active: Boolean(u.externalEvaluator.active)
        }
      : null
  })

  describe("login", () => {
    test("lança InvalidCredentials se usuário não existe", async () => {
      repo.findByCpf.mockResolvedValue(null)

      await expect(service.login({ cpf: "000", password: "x" })).rejects.toThrow(InvalidCredentials)
      expect(repo.findByCpf).toHaveBeenCalledWith("000")
    })

    test("lança InvalidCredentials se senha inválida", async () => {
      repo.findByCpf.mockResolvedValue(dbUser as any)
      bcryptMock.compare.mockResolvedValue(false)

      await expect(service.login({ cpf: dbUser.cpf, password: "errada" })).rejects.toThrow(InvalidCredentials)
      expect(bcryptMock.compare).toHaveBeenCalledWith("errada", dbUser.passwordHash)
    })

    test("retorna tokens e roles, com selectedRole = null quando múltiplas", async () => {
      repo.findByCpf.mockResolvedValue(dbUser as any)
      const result = await service.login({ cpf: dbUser.cpf, password: "ok" })

      expect(result.accessToken).toBe("access")
      expect(result.refreshToken).toBe("refresh")
      expect(result.roles).toEqual([RoleName.ADMIN, RoleName.DOCENTE])
      expect(result.selectedRole).toBeNull()
      expect(result.needsProfileSelection).toBe(true)
      expect(tokenGen.generateAccessToken).toHaveBeenCalledWith([RoleName.ADMIN, RoleName.DOCENTE], dbUser.idUser, null)
      expect(tokenGen.generateRefreshToken).toHaveBeenCalledWith(dbUser.idUser, null)
    })

    test("com uma role apenas, selectedRole definido e needsProfileSelection false", async () => {
      const oneRoleUser = {
        ...dbUser,
        roles: [{ role: { name: RoleName.ADMIN } }]
      }
      repo.findByCpf.mockResolvedValue(oneRoleUser as any)

      const result = await service.login({
        cpf: oneRoleUser.cpf,
        password: "ok"
      })

      expect(result.roles).toEqual([RoleName.ADMIN])
      expect(result.selectedRole).toBe(RoleName.ADMIN)
      expect(result.needsProfileSelection).toBe(false)
    })
  })

  describe("refreshToken", () => {
    test("revogado → lança InvalidRefreshToken", async () => {
      ;(blacklist.isRefreshTokenRevoked as jest.Mock).mockReturnValue(true)

      await expect(service.refreshToken({ refreshToken: "x" })).rejects.toThrow(InvalidRefreshToken)
    })

    test("token inválido no decode → lança InvalidRefreshToken", async () => {
      jest.spyOn(tokenDecode, "decodeRefreshToken").mockImplementation(() => {
        throw new Error("bad")
      })

      await expect(service.refreshToken({ refreshToken: "x" })).rejects.toThrow(InvalidRefreshToken)
    })

    test("usuário não encontrado → lança InvalidRefreshToken", async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.refreshToken({ refreshToken: "ok" })).rejects.toThrow(InvalidRefreshToken)
    })

    test("selectedRole do token não pertence ao usuário → recalcula selectedRole", async () => {
      const userWithTwo = {
        ...dbUser,
        roles: [{ role: { name: RoleName.ADMIN } }, { role: { name: RoleName.DOCENTE } }]
      }
      repo.findById.mockResolvedValue(userWithTwo as any)
      jest.spyOn(tokenDecode, "decodeRefreshToken").mockReturnValue({
        userId: dbUser.idUser,
        selectedRole: RoleName.CPPD_MEMBER
      })

      const out = await service.refreshToken({ refreshToken: "ok" })
      expect(out.roles).toEqual([RoleName.ADMIN, RoleName.DOCENTE])
      expect(out.selectedRole).toBeNull()
      expect(out.needsProfileSelection).toBe(true)
    })

    test("fluxo ok mantendo selectedRole válido", async () => {
      repo.findById.mockResolvedValue(dbUser as any)
      jest.spyOn(tokenDecode, "decodeRefreshToken").mockReturnValue({
        userId: dbUser.idUser,
        selectedRole: RoleName.ADMIN
      })

      const out = await service.refreshToken({ refreshToken: "ok" })
      expect(out.selectedRole).toBe(RoleName.ADMIN)
      expect(out.accessToken).toBe("access")
      expect(out.refreshToken).toBe("refresh")
    })
  })

  describe("selectRole", () => {
    test("revogado → lança InvalidRefreshToken", async () => {
      ;(blacklist.isRefreshTokenRevoked as jest.Mock).mockReturnValue(true)

      await expect(service.selectRole("x", RoleName.ADMIN)).rejects.toThrow(InvalidRefreshToken)
    })

    test("decode inválido → lança InvalidRefreshToken", async () => {
      jest.spyOn(tokenDecode, "decodeRefreshToken").mockImplementation(() => {
        throw new Error("bad")
      })

      await expect(service.selectRole("x", RoleName.ADMIN)).rejects.toThrow(InvalidRefreshToken)
    })

    test("usuário não encontrado → lança InvalidRefreshToken", async () => {
      repo.findById.mockResolvedValue(null)

      await expect(service.selectRole("x", RoleName.ADMIN)).rejects.toThrow(InvalidRefreshToken)
    })

    test("role não pertence ao usuário → lança InvalidRefreshToken", async () => {
      const user = { ...dbUser, roles: [{ role: { name: RoleName.ADMIN } }] }
      repo.findById.mockResolvedValue(user as any)

      await expect(service.selectRole("x", RoleName.DOCENTE)).rejects.toThrow(InvalidRefreshToken)
    })

    test("fluxo ok selecionando role válida", async () => {
      repo.findById.mockResolvedValue(dbUser as any)

      const out = await service.selectRole("x", RoleName.ADMIN)
      expect(out.selectedRole).toBe(RoleName.ADMIN)
      expect(out.needsProfileSelection).toBe(false)
      expect(tokenGen.generateAccessToken).toHaveBeenCalledWith(
        [RoleName.ADMIN, RoleName.DOCENTE],
        dbUser.idUser,
        RoleName.ADMIN
      )
    })
  })

  describe("createUser", () => {
    test("lança UserExists se CPF já cadastrado", async () => {
      repo.findByCpf.mockResolvedValue(dbUser as any)

      await expect(
        service.createUser({
          name: "a",
          email: "b",
          cpf: dbUser.cpf,
          password: "123",
          phone: "(11) 90000-0000", // 👈 incluir phone
          roles: [RoleName.ADMIN]
        } as any)
      ).rejects.toThrow(UserExists)
    })

    test("lança DocenteProfileRequired quando roles inclui DOCENTE e não vem docenteProfile", async () => {
      repo.findByCpf.mockResolvedValue(null)

      await expect(
        service.createUser({
          name: "a",
          email: "b",
          cpf: "000",
          password: "123",
          phone: "(11) 90000-0000", // 👈 incluir phone
          roles: [RoleName.DOCENTE]
        } as any)
      ).rejects.toThrow(DocenteProfileRequired)
    })

    test("mapeia erro P2002 para UserExists", async () => {
      repo.findByCpf.mockResolvedValue(null)
      bcryptMock.hash.mockResolvedValue("hash")
      repo.createWithRolesAndDocente.mockRejectedValue({ code: "P2002" })

      await expect(
        service.createUser({
          name: "a",
          email: "b",
          cpf: "000",
          password: "123",
          phone: "(11) 90000-0000", // 👈 incluir phone
          roles: [RoleName.ADMIN],
          docenteProfile: undefined
        } as any)
      ).rejects.toThrow(UserExists)
    })

    test("cria usuário com docenteProfile e retorna DTO mapeado (inclui phone)", async () => {
      repo.findByCpf.mockResolvedValue(null)
      bcryptMock.hash.mockResolvedValue("hash")
      repo.createWithRolesAndDocente.mockResolvedValue(dbUser as any)

      const dto = {
        name: dbUser.name,
        email: dbUser.email,
        cpf: dbUser.cpf,
        password: "123",
        phone: dbUser.phone, // 👈 incluir phone
        roles: [RoleName.ADMIN, RoleName.DOCENTE],
        docenteProfile: {
          siape: "1234567",
          classLevel: "D1",
          startInterstice: new Date("2024-01-01T00:00:00Z"),
          educationLevel: "Mestrado"
        }
      } as any

      const out = await service.createUser(dto)

      expect(repo.createWithRolesAndDocente).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          email: dto.email,
          cpf: dto.cpf,
          passwordHash: "hash",
          phone: dto.phone, // 👈 verificação
          roles: dto.roles,
          docenteProfile: expect.objectContaining({
            siape: "1234567",
            classLevel: "D1"
          })
        })
      )
      expect(out).toEqual(mapResponse(dbUser))
    })

    test("cria avaliador externo pendente sem CPF e senha", async () => {
      const externalUser = {
        ...dbUser,
        cpf: null,
        passwordHash: null,
        roles: [{ role: { name: RoleName.EXTERNAL_EVALUATOR } }],
        docente: null,
        externalEvaluator: {
          idExternalEvaluator: 15,
          title: "Doutor",
          institution: "Instituto Federal",
          active: true
        }
      }
      repo.createWithRolesAndDocente.mockResolvedValue(externalUser as any)

      const out = await service.createUser({
        name: externalUser.name,
        email: externalUser.email,
        roles: [RoleName.EXTERNAL_EVALUATOR],
        externalEvaluatorProfile: {
          title: "Doutor",
          institution: "Instituto Federal"
        }
      })

      expect(repo.createWithRolesAndDocente).toHaveBeenCalledWith(
        expect.objectContaining({
          cpf: null,
          passwordHash: null,
          roles: [RoleName.EXTERNAL_EVALUATOR]
        })
      )
      expect(out.cpf).toBeNull()
      expect(out.externalEvaluatorProfile?.institution).toBe("Instituto Federal")
    })
  })

  describe("getUserById", () => {
    test("lança UserNotFound se não encontrado", async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.getUserById(999)).rejects.toThrow(UserNotFound)
    })

    test("retorna DTO mapeado (inclui phone)", async () => {
      repo.findById.mockResolvedValue(dbUser as any)
      const out = await service.getUserById(dbUser.idUser)
      expect(out).toEqual(mapResponse(dbUser))
    })
  })

  describe("getAllActiveUsers", () => {
    test("mapeia lista para DTO", async () => {
      repo.findManyActive.mockResolvedValue([dbUser] as any)

      const out = await service.getAllActiveUsers()
      expect(out).toEqual([mapResponse(dbUser)])
      expect(repo.findManyActive).toHaveBeenCalled()
    })
  })

  describe("updateUser", () => {
    test("lança UserNotFound se usuário não existe", async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.updateUser(1, { userId: 1, name: "X" } as any)).rejects.toThrow(UserNotFound)
    })

    test("adicionar DOCENTE sem docenteProfile quando não possui docente → DocenteProfileRequired", async () => {
      const noDocente = {
        ...dbUser,
        docente: null,
        roles: [{ role: { name: RoleName.ADMIN } }]
      }
      repo.findById.mockResolvedValue(noDocente as any)

      await expect(
        service.updateUser(noDocente.idUser, {
          userId: noDocente.idUser,
          roles: [RoleName.ADMIN, RoleName.DOCENTE]
        } as any)
      ).rejects.toThrow(DocenteProfileRequired)
    })

    test("adicionar DOCENTE com docenteProfile faltando campos obrigatórios → erro com lista", async () => {
      const noDocente = {
        ...dbUser,
        docente: null,
        roles: [{ role: { name: RoleName.ADMIN } }]
      }
      repo.findById.mockResolvedValue(noDocente as any)

      await expect(
        service.updateUser(noDocente.idUser, {
          userId: noDocente.idUser,
          roles: [RoleName.ADMIN, RoleName.DOCENTE],
          docenteProfile: {
            siape: "",
            classLevel: "" as any,
            startInterstice: undefined as any,
            educationLevel: ""
          } as any
        } as any)
      ).rejects.toThrow("Campos obrigatórios para criar DocenteProfile ausentes")
    })

    test("fluxo ok atualizando dados e retornando DTO", async () => {
      repo.findById.mockResolvedValue(dbUser as any)
      const updated = { ...dbUser, name: "Novo Nome" }
      repo.updateWithRolesAndDocente.mockResolvedValue(updated as any)

      const out = await service.updateUser(dbUser.idUser, {
        userId: dbUser.idUser,
        name: "Novo Nome"
      } as any)

      expect(repo.updateWithRolesAndDocente).toHaveBeenCalledWith(dbUser.idUser, {
        name: "Novo Nome",
        email: undefined,
        cpf: undefined,
        active: undefined,
        phone: undefined, // 👈 permanece undefined se não veio no DTO
        roles: undefined,
        docenteProfile: undefined
      })
      expect(out).toEqual(mapResponse(updated))
    })
  })

  describe("deleteUserById", () => {
    test("lança UserNotFound se não existe", async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.deleteUserById(1)).rejects.toThrow(UserNotFound)
    })

    test("deleta (soft) e retorna DTO", async () => {
      repo.findById.mockResolvedValue(dbUser as any)
      const deleted = { ...dbUser, active: false, deletedDate: now }
      repo.deleteUserById.mockResolvedValue(deleted as any)

      const out = await service.deleteUserById(dbUser.idUser)

      expect(repo.deleteUserById).toHaveBeenCalledWith(dbUser.idUser)
      expect(out).toEqual(mapResponse(deleted))
    })
  })
})
