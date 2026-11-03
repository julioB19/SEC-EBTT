import { describe, expect, jest, test, afterEach } from "@jest/globals"
import { IncomingMessage, ServerResponse } from "http"
import { PassThrough } from "stream"
import fs from "fs"
import os from "os"
import path from "path"
import jwt from "jsonwebtoken"
import { ProcessRepository } from "../../../src/repository/processoRepository"
import { prisma } from "../../../src/infra/prismaClient"

async function dispatch(app: any, url: string, token?: string) {
  const socket = new PassThrough()
  socket.resume()
  const request = new IncomingMessage(socket as any)
  request.method = "GET"
  request.url = url
  request.headers = token ? { authorization: `Bearer ${token}` } : {}
  const response = new ServerResponse(request)
  response.assignSocket(socket as any)
  await new Promise<void>((resolve, reject) => { response.on("finish", resolve); response.on("error", reject); app.handle(request, response) })
  socket.destroy()
  return response.statusCode
}

afterEach(() => { jest.restoreAllMocks() })

describe("Arquivos privados e papel ativo", () => {
  test("a aplicação não entrega uploads por uma URL pública", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sec-ebtt-private-test-"))
    try {
      fs.mkdirSync(path.join(directory, "uploads"))
      fs.writeFileSync(path.join(directory, "uploads", "fixture.txt"), "Documento sintético")
      jest.spyOn(process, "cwd").mockReturnValue(directory)
      const app = (await import("../../../src/app")).default
      expect(await dispatch(app, "/uploads/fixture.txt")).not.toBe(200)
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })

  test("rotas docentes exigem DOCENTE selecionado", async () => {
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue({ idUser: 1, active: true, deletedDate: null,
      roles: [{ role: { name: "ADMIN" } }, { role: { name: "DOCENTE" } }] } as any)
    process.env.JWT_ACCESS_SECRET = "test-private-files-secret"
    jest.spyOn(ProcessRepository.prototype, "listActiveProcessTypeConfigs").mockResolvedValue([])
    const app = (await import("../../../src/app")).default
    const sign = (selectedRole: string) => jwt.sign({ sub: "1", roles: ["ADMIN", "DOCENTE"], selectedRole }, process.env.JWT_ACCESS_SECRET!)
    expect(await dispatch(app, "/processos/tipos", sign("ADMIN"))).toBe(403)
    expect(await dispatch(app, "/processos/tipos", sign("DOCENTE"))).toBe(200)
  })
})
