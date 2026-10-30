import type { Server } from "http"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import { PDFDocument } from "pdf-lib"

type JsonResponse<T = any> = {
  status: number
  data: T
}

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root:root123@localhost:3306/TCC_TEST"
const DOCENTE_CREDENTIALS = {
  cpf: "65033520008",
  password: "Docente@123456",
}

describe("API HTTP - fluxos funcionais de processos", () => {
  let server: Server
  let baseUrl: string
  let docenteAccessToken: string
  let createdProcessId: number | null = null
  let adminAccessToken: string | null = null
  let rscFixture: { processId: number; teacherToken: string; cppdToken: string } | undefined
  const temporaryUserIds: number[] = []

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL
    process.env.JWT_ACCESS_SECRET = "integration-access-secret"
    process.env.JWT_REFRESH_SECRET = "integration-refresh-secret"
    process.env.JWT_ACCESS_EXPIRATION = "1h"
    process.env.JWT_REFRESH_EXPIRATION = "7d"

    const { default: app } = await import("../../src/app")

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Não foi possível iniciar o servidor HTTP de teste")
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    if (createdProcessId && docenteAccessToken) {
      await request(`/processos/${createdProcessId}`, {
        method: "DELETE",
        token: docenteAccessToken,
      })
    }
    if (adminAccessToken) {
      for (const userId of temporaryUserIds) {
        await request(`/users/${userId}`, {
          method: "DELETE",
          token: adminAccessToken,
        })
      }
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })

    const { prisma } = await import("../../src/infra/prismaClient")
    await prisma.$disconnect()
  })

  async function request<T = any>(
    path: string,
    options: {
      method?: string
      token?: string
      body?: unknown | FormData
    } = {},
  ): Promise<JsonResponse<T>> {
    const headers: Record<string, string> = {}
    if (options.token) headers.Authorization = `Bearer ${options.token}`
    const isFormData = options.body instanceof FormData
    if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json"

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    })
    const contentType = response.headers.get("content-type") ?? ""
    const data = contentType.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer())

    return { status: response.status, data: data as T }
  }

  async function attachSigned(processId: number, cppdToken: string, kind: string, bytes: Buffer | Uint8Array, memberId?: number) {
    const form = new FormData()
    form.set("file", new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }), `${kind}.pdf`)
    form.set("documentKind", kind)
    if (memberId) form.set("memberId", String(memberId))
    form.set("signer", "Signatário sintético de integração")
    form.set("provider", "TESTE_ISOLADO")
    form.set("signedAt", new Date().toISOString())
    const upload = await request<any>(`/cases/${processId}/signatures`, { method: "POST", token: cppdToken, body: form })
    expect(upload.data.message).not.toMatch(/erro interno/i)
    expect(upload.status).toBe(200)
    expect(upload.data.data.contentSha256).toMatch(/^[a-f0-9]{64}$/)
    const check = await request<any>(`/cases/${processId}/signatures/${upload.data.data.idArtifact}/validate`, { method: "POST", token: cppdToken, body: { approved: true, note: "Conferência sintética de metadados e integridade em banco isolado" } })
    expect(check.status).toBe(200)
  }

  async function prepareTitular(processId: number, teacherToken: string, externalEmails: string[], internalEmail: string, thesis = false) {
    const form = new FormData()
    form.set("file", new Blob([await createPdfBytes("Avaliação de desempenho com 120 pontos")], { type: "application/pdf" }), "desempenho.pdf")
    const file = await request<any>("/teacher/evidence", { method: "POST", token: teacherToken, body: form })
    expect(file.status).toBe(200)
    const claim = await request(`/cases/${processId}/compliance`, { method: "POST", token: teacherToken, body: { action: "SET_PERFORMANCE_CLAIM", points: 120, evidenceFileId: file.data.data.idEvidenceFile } })
    expect(claim.status).toBe(200)
    const emails = [...Array.from({ length: 3 }, (_, i) => externalEmails[i] || `externo-${processId}-${i}@federal.edu.br`), `suplente-${processId}-1@federal.edu.br`, `suplente-${processId}-2@federal.edu.br`, internalEmail, `interno-${processId}-suplente@iffarroupilha.edu.br`]
    const nominees = emails.map((email, i) => ({ name: `Indicado ${i}`, email, phone: "55999999999", origin: i < 5 ? "EXTERNAL" : "INTERNAL", membership: i < 3 || i === 5 ? "PRIMARY" : "SUBSTITUTE", doctorateTitle: "Doutor em Educação", institution: "Instituição Federal de Ensino", federalInstitution: true, careerLevel: "C4", knowledgeArea: "Educação", sameKnowledgeArea: true, priorConsentAt: new Date(Date.now() - 86400000).toISOString() }))
    const saved = await request(`/cases/${processId}/compliance`, { method: "POST", token: teacherToken, body: { action: "SAVE_NOMINEES", nominees } })
    expect(saved.status).toBe(200)
    if (thesis) {
      const declaration = await request(`/cases/${processId}/compliance`, { method: "POST", token: teacherToken, body: { action: "DECLARE_ORIGINALITY", accepted: true } })
      expect(declaration.status).toBe(200)
    }
  }

  async function reviewTitular(processId: number, cppdToken: string) {
    const reviewed = await request(`/cases/${processId}/compliance`, { method: "POST", token: cppdToken, body: { action: "REVIEW_ELIGIBILITY", points: 120, requirementsMetAt: "2026-09-01", doctorateApproved: true, opinion: "Doutorado e desempenho conferidos pela CPPD." } })
    expect(reviewed.status).toBe(200)
    const nominees = await request(`/cases/${processId}/compliance`, { method: "POST", token: cppdToken, body: { action: "REVIEW_NOMINEES", confirmed: true } })
    expect(nominees.status).toBe(200)
    const state = await request<any>(`/cases/${processId}/compliance`, { token: cppdToken })
    for (const kind of ["CPPD_ELIGIBILITY_OPINION", ...(state.data.data.evaluationMode === "THESIS" ? ["THESIS_ORIGINALITY"] : [])]) {
      const file = await request(`/cases/${processId}/documents/${kind}`, { token: cppdToken })
      expect(file.status).toBe(200)
      await attachSigned(processId, cppdToken, kind, file.data as Buffer)
    }
  }

  async function signCommission(processId: number, cppdToken: string, members: Array<{ id: number }>, titular = false, thesis = false) {
    for (const member of members) {
      const file = await request(`/external-evaluator/assignments/${member.id}/evaluation/opinion.pdf`, { token: (member as any).token })
      expect(file.status).toBe(200)
      await attachSigned(processId, cppdToken, "INDIVIDUAL_OPINION", file.data as Buffer, member.id)
    }
    for (const kind of ["CONSOLIDATED_OPINION", ...(titular ? ["PRESIDENT_OPINION"] : []), ...(thesis ? ["THESIS_DEFENSE_MINUTES"] : [])]) {
      const file = await request(`/cases/${processId}/documents/${kind}`, { token: cppdToken })
      expect(file.status).toBe(200)
      await attachSigned(processId, cppdToken, kind, file.data as Buffer)
    }
  }

  it("protege as rotas privadas e rejeita credenciais inválidas", async () => {
    const withoutToken = await request("/users/me")
    expect(withoutToken.status).toBe(400)
    expect(withoutToken.data).toMatchObject({
      status: "INVALID_INPUT",
      data: null,
    })

    const invalidLogin = await request("/login", {
      method: "POST",
      body: { cpf: DOCENTE_CREDENTIALS.cpf, password: "senha-incorreta" },
    })
    expect(invalidLogin.status).toBe(400)
    expect(invalidLogin.data).toMatchObject({
      status: "INVALID_CREDENTIALS",
      data: null,
    })
  })

  it("autentica o docente e expõe apenas seu perfil pela API", async () => {
    const login = await request("/login", {
      method: "POST",
      body: DOCENTE_CREDENTIALS,
    })

    expect(login.status).toBe(200)
    expect(login.data).toMatchObject({
      status: "SUCCESS",
      data: {
        roles: expect.arrayContaining(["DOCENTE"]),
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      },
    })
    docenteAccessToken = login.data.data.accessToken

    const me = await request("/users/me", { token: docenteAccessToken })
    expect(me.status).toBe(200)
    expect(me.data).toMatchObject({
      status: "SUCCESS",
      data: {
        name: "Docente Teste",
        roles: expect.arrayContaining(["DOCENTE"]),
        docenteProfile: expect.objectContaining({ educationLevel: expect.any(String) }),
      },
    })
  })

  it("abre, lista, consulta, edita e exclui um RSC válido", async () => {
    const existingDrafts = await request("/processos?status=DRAFT", {
      token: docenteAccessToken,
    })
    for (const process of existingDrafts.data.data ?? []) {
      await request(`/processos/${process.processId}`, {
        method: "DELETE",
        token: docenteAccessToken,
      })
    }

    const processTypes = await request("/processos/tipos", {
      token: docenteAccessToken,
    })
    expect(processTypes.status).toBe(200)
    expect(processTypes.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "RSC", category: "RSC" }),
      ]),
    )

    const invalidOpening = await request("/processos/abrir", {
      method: "POST",
      token: docenteAccessToken,
      body: {
        processo: {
          processTypeCode: "RSC",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          rscDetails: {
            targetLevel: "RSC_I",
            careerEntryDateISO: "2018-01-01",
            activityPeriodStartISO: "2012-12-31",
            activityPeriodEndISO: "2026-09-30",
            truthDeclarationAccepted: true,
          },
        },
      },
    })
    expect(invalidOpening.status).toBe(400)
    expect(invalidOpening.data).toMatchObject({ status: "INVALID_INPUT" })
    expect(invalidOpening.data.message).toMatch(/cinco anos/i)

    const externalNumber = `RSC-INTEGRATION-${Date.now()}`
    const opening = await request("/processos/abrir", {
      method: "POST",
      token: docenteAccessToken,
      body: {
        processo: {
          processTypeCode: "RSC",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          externalNumber,
          rscDetails: {
            targetLevel: "RSC_I",
            careerEntryDateISO: "2018-01-01",
            activityPeriodStartISO: "2013-01-01",
            activityPeriodEndISO: "2026-09-30",
            truthDeclarationAccepted: true,
          },
        },
      },
    })

    expect(opening.status).toBe(201)
    expect(opening.data).toMatchObject({
      status: "CREATED",
      data: {
        status: "DRAFT",
        processTypeCode: "RSC",
        processTypeCategory: "RSC",
        rscDetails: expect.objectContaining({ targetLevel: "RSC_I" }),
      },
    })
    createdProcessId = opening.data.data.processId

    const listing = await request("/processos?status=DRAFT", {
      token: docenteAccessToken,
    })
    expect(listing.status).toBe(200)
    expect(listing.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ processId: createdProcessId, externalNumber }),
      ]),
    )

    const details = await request(`/processos/${createdProcessId}`, {
      token: docenteAccessToken,
    })
    expect(details.status).toBe(200)
    expect(details.data.data).toMatchObject({
      processId: createdProcessId,
      externalNumber,
      rscDetails: expect.objectContaining({ targetLevel: "RSC_I" }),
    })

    const update = await request(`/processos/${createdProcessId}`, {
      method: "PATCH",
      token: docenteAccessToken,
      body: {
        processo: {
          campus: "Campus Jaguari",
          cidadeUF: "Jaguari/RS",
        },
      },
    })
    expect(update.status).toBe(200)
    expect(update.data.data).toMatchObject({
      processId: createdProcessId,
      campus: "Campus Jaguari",
      cidadeUF: "Jaguari/RS",
    })

    const deletion = await request(`/processos/${createdProcessId}`, {
      method: "DELETE",
      token: docenteAccessToken,
    })
    expect(deletion.status).toBe(200)
    expect(deletion.data.data).toMatchObject({
      processId: createdProcessId,
      status: "DRAFT",
    })
    createdProcessId = null

    const deleted = await request(`/processos/${opening.data.data.processId}`, {
      token: docenteAccessToken,
    })
    expect(deleted.status).toBe(400)
    expect(deleted.data.message).toMatch(/não encontrado/i)
  })

  it("conclui o fluxo RSC oficial da abertura até a decisão da CPPD", async () => {
    const adminLogin = await request("/login", {
      method: "POST",
      body: { cpf: "81188057006", password: "Admin@123456" },
    })
    expect(adminLogin.status).toBe(200)
    adminAccessToken = adminLogin.data.data.accessToken

    const runId = Date.now().toString().slice(-8)
    const password = "Integration@123456"
    const createUser = async (input: {
      name: string
      roles: string[]
      index: number
      docente?: boolean
    }) => {
      const cpf = validCpf(Number(runId) + input.index)
      const email = `integration.${runId}.${input.index}@example.com`
      const response = await request("/users", {
        method: "POST",
        token: adminAccessToken!,
        body: {
          name: input.name,
          email,
          cpf,
          password,
          phone: "55999990000",
          city: "Santa Maria",
          uf: "RS",
          roles: input.roles,
          ...(input.docente
            ? {
                docenteProfile: {
                  siape: `9${runId.slice(-6)}${input.index}`,
                  classLevel: "D1",
                  startInterstice: "2024-01-01",
                  educationLevel: "Graduação",
                  assignment: "Campus Santa Maria",
                },
              }
            : {}),
          ...(input.roles.includes("EXTERNAL_EVALUATOR")
            ? {
                externalEvaluatorProfile: {
                  title: "Doutor",
                  institution: "Instituição de Teste",
                },
              }
            : {}),
        },
      })
      expect(response.status).toBe(201)
      temporaryUserIds.push(response.data.data.idUser)
      return { cpf, email, password, userId: response.data.data.idUser }
    }

    const teacher = await createUser({
      name: "Docente Integração RSC",
      roles: ["DOCENTE"],
      index: 1,
      docente: true,
    })
    const internalEvaluator = await createUser({
      name: "Avaliador Interno Integração",
      roles: ["DOCENTE", "EXTERNAL_EVALUATOR"],
      index: 2,
      docente: true,
    })
    const externalEvaluators = await Promise.all(
      [3, 4, 5].map((index) =>
        createUser({
          name: `Avaliador Externo Integração ${index}`,
          roles: ["EXTERNAL_EVALUATOR"],
          index,
        }),
      ),
    )

    const teacherLogin = await loginAs(teacher.cpf, teacher.password)
    const teacherToken = teacherLogin.accessToken
    const opening = await request("/processos/abrir", {
      method: "POST",
      token: teacherToken,
      body: {
        processo: {
          processTypeCode: "RSC",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          externalNumber: `RSC-FULL-${runId}`,
          rscDetails: {
            targetLevel: "RSC_I",
            careerEntryDateISO: "2018-01-01",
            activityPeriodStartISO: "2013-01-01",
            activityPeriodEndISO: "2026-09-30",
            truthDeclarationAccepted: true,
          },
        },
      },
    })
    expect(opening.status).toBe(201)
    const processId = opening.data.data.processId as number

    const structure = await request(`/processos/${processId}/pontuacao/estrutura`, {
      token: teacherToken,
    })
    expect(structure.status).toBe(200)
    const targetBlocks = ["RSC_I_D1", "RSC_I_D2", "RSC_I_D3", "RSC_I_D4"].map(
      (code) => structure.data.data.blocks.find((block: any) => block.code === code),
    )
    expect(targetBlocks.every(Boolean)).toBe(true)
    const selectedItems = targetBlocks.map((block: any) => block.items[0])

    const pdf = await createPdfBytes("Comprovante oficial de integração RSC")
    const firstEvidenceForm = new FormData()
    firstEvidenceForm.append(
      "file",
      new Blob([pdf], { type: "application/pdf" }),
      "comprovante-rsc.pdf",
    )
    const firstEvidence = await request(
      `/processos/${processId}/pontuacao/itens/${selectedItems[0].itemId}/evidencias`,
      { method: "POST", token: teacherToken, body: firstEvidenceForm },
    )
    expect(firstEvidence.status).toBe(200)
    const evidenceFileId = firstEvidence.data.data.evidence.evidenceFileId as number

    for (let index = 0; index < selectedItems.length; index += 1) {
      const item = selectedItems[index]
      if (index > 0) {
        const reuse = await request(
          `/processos/${processId}/pontuacao/itens/${item.itemId}/evidencias/reusar`,
          {
            method: "POST",
            token: teacherToken,
            body: { evidenceFileId },
          },
        )
        expect(reuse.status).toBe(200)
      }
      const score = await request(`/processos/${processId}/itens/${item.itemId}/pontuacao`, {
        method: "PATCH",
        token: teacherToken,
        body: { quantity: item.maxQuantity },
      })
      expect(score.status).toBe(200)
      expect(score.data.data.awardedPoints).toBeGreaterThan(0)
    }

    const files = await request("/evidencias/arquivos", { token: teacherToken })
    expect(files.status).toBe(200)
    expect(files.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ evidenceFileId })]),
    )
    const evidenceContent = await request(`/evidencias/${evidenceFileId}/conteudo`, {
      token: teacherToken,
    })
    expect(evidenceContent.status).toBe(200)
    expect((evidenceContent.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")

    const mergedEvidence = await request(`/processos/${processId}/pontuacao/comprovantes`, {
      token: teacherToken,
    })
    expect(mergedEvidence.status).toBe(200)
    expect((mergedEvidence.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")

    const reportForm = new FormData()
    reportForm.append(
      "file",
      new Blob([pdf], { type: "application/pdf" }),
      "memorial-rsc.pdf",
    )
    const report = await request(`/processos/${processId}/documentos/RSC_REPORT`, {
      method: "POST",
      token: teacherToken,
      body: reportForm,
    })
    expect(report.status).toBe(200)
    expect(report.data.data.rscDetails.reportFile).toMatchObject({
      originalName: "memorial-rsc.pdf",
      mimeType: "application/pdf",
    })

    const submission = await request(`/processos/${processId}/enviar`, {
      method: "POST",
      token: teacherToken,
    })
    expect(submission.status).toBe(200)
    expect(submission.data.data).toMatchObject({
      processId,
      status: "SUBMITTED",
      totalPoints: 60,
    })

    const cppdLogin = await loginAs("58315013610", "CppdCentral@123456")
    const cppdToken = cppdLogin.accessToken
    const cppdList = await request("/cppd/processos", { token: cppdToken })
    expect(cppdList.status).toBe(200)
    expect(cppdList.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ idProcess: processId })]),
    )
    const cppdDetails = await request(`/cppd/processos/${processId}`, {
      token: cppdToken,
    })
    expect(cppdDetails.status).toBe(200)

    const commissionSave = await request(`/processes/${processId}/special-commission`, {
      method: "PUT",
      token: cppdToken,
      body: { ordinance: `PORTARIA-${runId}`, ordinanceDate: "2026-09-01" },
    })
    expect(commissionSave.status).toBe(200)

    const memberInputs = [
      { ...internalEvaluator, origin: "INTERNAL", role: "PRESIDENT" },
      ...externalEvaluators.map((evaluator) => ({
        ...evaluator,
        origin: "EXTERNAL",
        role: "MEMBER",
      })),
    ]
    const members: Array<{ id: number; credentials: typeof memberInputs[number] }> = []
    for (const member of memberInputs) {
      const added = await request(`/processes/${processId}/special-commission/members`, {
        method: "POST",
        token: cppdToken,
        body: { email: member.email, origin: member.origin, role: member.role },
      })
      expect(added.status).toBe(201)
      const savedMember = added.data.data.commission.members.find(
        (candidate: any) => candidate.email === member.email,
      )
      members.push({ id: savedMember.idSpecialCommissionMember, credentials: member })
    }

    for (const member of members) {
      const rawLogin = await loginAs(member.credentials.cpf, member.credentials.password)
      const evaluatorToken = rawLogin.roles.length > 1
        ? await selectRole(rawLogin.refreshToken, "EXTERNAL_EVALUATOR")
        : rawLogin.accessToken
      ;(member as any).token = evaluatorToken
      const assignments = await request("/external-evaluator/assignments", {
        token: evaluatorToken,
      })
      expect(assignments.status).toBe(200)
      expect(assignments.data.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ memberId: member.id })]),
      )
      const accepted = await request(
        `/external-evaluator/assignments/${member.id}/respond`,
        {
          method: "POST",
          token: evaluatorToken,
          body: { response: "ACCEPTED", absenceOfConflictDeclared: true },
        },
      )
      expect(accepted.status).toBe(200)
    }

    const activation = await request(`/processes/${processId}/special-commission/status`, {
      method: "PATCH",
      token: cppdToken,
      body: { status: "ACTIVE" },
    })
    expect(activation.status).toBe(200)
    expect(activation.data.data).toMatchObject({
      process: { status: "IN_EVALUATION" },
      commission: { status: "ACTIVE" },
    })

    for (const member of members) {
      const evaluatorToken = (member as any).token as string
      const evaluation = await request(
        `/external-evaluator/assignments/${member.id}/evaluation`,
        { token: evaluatorToken },
      )
      expect(evaluation.status).toBe(200)
      const claimedItems = evaluation.data.data.scoringTable.items
      const scores = claimedItems.map((item: any) => ({
        itemId: item.idScoringItem,
        recognizedQuantity: item.claimedQuantity,
        evaluatorComment: "Comprovante conferido",
      }))
      const evaluatorEvidence = await request(
        `/external-evaluator/assignments/${member.id}/evidences/${evidenceFileId}/content`,
        { token: evaluatorToken },
      )
      expect(evaluatorEvidence.status).toBe(200)
      expect((evaluatorEvidence.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")
      const draft = await request(
        `/external-evaluator/assignments/${member.id}/evaluation`,
        {
          method: "PUT",
          token: evaluatorToken,
          body: { opinionText: "Parecer em elaboração", scores },
        },
      )
      expect(draft.status).toBe(200)
      expect(draft.data.data.evaluation.status).toBe("DRAFT")
      const submitted = await request(
        `/external-evaluator/assignments/${member.id}/evaluation/submit`,
        {
          method: "POST",
          token: evaluatorToken,
          body: { opinionText: "Parecer favorável após conferência integral", scores },
        },
      )
      expect(submitted.status).toBe(200)
      expect(submitted.data.data.evaluation).toMatchObject({
        status: "SUBMITTED",
        result: "DEFERRED",
        recognizedPoints: 60,
      })
      const opinionPdf = await request(
        `/external-evaluator/assignments/${member.id}/evaluation/opinion.pdf`,
        { token: evaluatorToken },
      )
      expect(opinionPdf.status).toBe(200)
      expect((opinionPdf.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")
    }

    const completion = await request(`/processes/${processId}/special-commission/status`, {
      method: "PATCH",
      token: cppdToken,
      body: { status: "COMPLETED" },
    })
    expect(completion.status).toBe(200)
    expect(completion.data.data).toMatchObject({
      process: { status: "UNDER_REVIEW" },
      commission: {
        status: "COMPLETED",
        consolidation: { allSubmitted: true, averageRecognizedPoints: 60 },
      },
    })

    await signCommission(processId, cppdToken, members)
    const decision = await request(`/processes/${processId}/special-commission/decision`, {
      method: "POST",
      token: cppdToken,
      body: {
        decision: "APPROVED",
        opinionText: "Processo deferido conforme avaliações individuais.",
      },
    })
    expect(decision.status).toBe(200)
    expect(decision.data.data.process).toMatchObject({
      idProcess: processId,
      status: "APPROVED",
      finalPoints: 60,
    })

    const evaluationDetails = await request(
      `/cppd/processos/${processId}/avaliacao/detalhes`,
      { token: cppdToken },
    )
    expect(evaluationDetails.status).toBe(200)
    rscFixture = { processId, teacherToken, cppdToken }
  }, 60000)

  it("impede abrir Progressão com classe de origem diferente do perfil funcional", async () => {
    const admin = await loginAs("81188057006", "Admin@123456")
    adminAccessToken = admin.accessToken
    const runId = `${Date.now()}`.slice(-8)
    const cpf = validCpf(Number(runId) + 101)
    const password = "Integration@123456"
    const created = await request("/users", {
      method: "POST",
      token: adminAccessToken!,
      body: {
        name: "Docente Progressão Origem",
        email: `progressao.origem.${runId}@example.com`,
        cpf,
        password,
        roles: ["DOCENTE"],
        docenteProfile: {
          siape: `81${runId.slice(-5)}`,
          classLevel: "B1",
          startInterstice: "2024-09-01",
          educationLevel: "Graduação",
          assignment: "Campus Santa Maria",
        },
      },
    })
    expect(created.status).toBe(201)
    temporaryUserIds.push(created.data.data.idUser)
    const teacher = await loginAs(cpf, password)

    const mismatched = await request("/processos/abrir", {
      method: "POST",
      token: teacher.accessToken,
      body: {
        processo: {
          processTypeCode: "PROGRESSION",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          intersticioInicioISO: "2024-09-01",
          intersticioFimISO: "2026-09-01",
          classeOrigem: "C",
          nivelOrigem: "1",
          classeDestino: "C",
          nivelDestino: "2",
        },
      },
    })
    if (mismatched.status === 201) {
      await request(`/processos/${mismatched.data.data.processId}`, {
        method: "DELETE",
        token: teacher.accessToken,
      })
    }
    expect(mismatched.status).toBe(400)
    expect(mismatched.data.message).toMatch(/perfil funcional|classe.*origem/i)
  })

  it("conclui Progressão e Promoção com downloads, pontuação e decisão da CPPD", async () => {
    const admin = await loginAs("81188057006", "Admin@123456")
    adminAccessToken = admin.accessToken
    const cppd = await loginAs("58315013610", "CppdCentral@123456")
    const runId = `${Date.now()}`.slice(-8)
    const password = "Integration@123456"
    const pdf = await createPdfBytes("Comprovante de carreira")

    const scenarios = [
      {
        code: "PROGRESSION",
        label: "Progressão",
        index: 201,
        originClass: "B",
        originLevel: "1",
        originCode: "B1",
        destinationClass: "B",
        destinationLevel: "2",
        destinationCode: "B2",
        intersticeStart: "2024-09-01",
        intersticeEnd: "2026-09-01",
      },
      {
        code: "PROMOTION",
        label: "Promoção",
        index: 202,
        originClass: "B",
        originLevel: "4",
        originCode: "B4",
        destinationClass: "C",
        destinationLevel: "1",
        destinationCode: "C1",
        intersticeStart: "2024-09-01",
        intersticeEnd: "2026-09-01",
      },
    ]

    for (const scenario of scenarios) {
      const cpf = validCpf(Number(runId) + scenario.index)
      const email = `carreira.${scenario.code.toLowerCase()}.${runId}@example.com`
      const created = await request("/users", {
        method: "POST",
        token: adminAccessToken!,
        body: {
          name: `Docente ${scenario.label} Integração`,
          email,
          cpf,
          password,
          phone: "55999991111",
          city: "Santa Maria",
          uf: "RS",
          roles: ["DOCENTE"],
          docenteProfile: {
            siape: `82${runId.slice(-5)}${scenario.index}`,
            classLevel: scenario.originCode,
            startInterstice: scenario.intersticeStart,
            educationLevel: "Graduação",
            assignment: "Campus Santa Maria",
          },
        },
      })
      expect(created.status).toBe(201)
      temporaryUserIds.push(created.data.data.idUser)
      const teacher = await loginAs(cpf, password)

      const opening = await request("/processos/abrir", {
        method: "POST",
        token: teacher.accessToken,
        body: {
          processo: {
            processTypeCode: scenario.code,
            campus: "Campus Santa Maria",
            cidadeUF: "Santa Maria/RS",
            externalNumber: `${scenario.code}-${runId}`,
            intersticioInicioISO: scenario.intersticeStart,
            intersticioFimISO: scenario.intersticeEnd,
            classeOrigem: scenario.originClass,
            nivelOrigem: scenario.originLevel,
            classeDestino: scenario.destinationClass,
            nivelDestino: scenario.destinationLevel,
          },
        },
      })
      expect(opening.status).toBe(201)
      const processId = opening.data.data.processId as number
      expect(opening.data.data).toMatchObject({
        processTypeCode: scenario.code,
        processTypeCategory: "CAREER",
        status: "DRAFT",
      })

      const structure = await request(`/processos/${processId}/pontuacao/estrutura`, {
        token: teacher.accessToken,
      })
      expect(structure.status).toBe(200)
      const items = structure.data.data.blocks
        .flatMap((block: any) => block.items)
        .filter((item: any) => ["MNP", "MND", "NT", "NSI"].includes(item.formulaKey))
      expect(items).toHaveLength(4)
      const quantities: Record<string, number> = { MNP: 20, MND: 20, NT: 20, NSI: 2 }

      const evidenceForm = new FormData()
      evidenceForm.append(
        "file",
        new Blob([pdf], { type: "application/pdf" }),
        `comprovante-${scenario.code.toLowerCase()}.pdf`,
      )
      const firstEvidence = await request(
        `/processos/${processId}/pontuacao/itens/${items[0].itemId}/evidencias`,
        { method: "POST", token: teacher.accessToken, body: evidenceForm },
      )
      expect(firstEvidence.status).toBe(200)
      const evidenceFileId = firstEvidence.data.data.evidence.evidenceFileId as number

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        if (index > 0) {
          const reuse = await request(
            `/processos/${processId}/pontuacao/itens/${item.itemId}/evidencias/reusar`,
            {
              method: "POST",
              token: teacher.accessToken,
              body: { evidenceFileId },
            },
          )
          expect(reuse.status).toBe(200)
        }
        const score = await request(`/processos/${processId}/itens/${item.itemId}/pontuacao`, {
          method: "PATCH",
          token: teacher.accessToken,
          body: { quantity: quantities[item.formulaKey] },
        })
        expect(score.status).toBe(200)
      }

      const requestPdf = await request(`/processos/requerimento/${processId}`, {
        method: "POST",
        token: teacher.accessToken,
      })
      expect(requestPdf.status).toBe(200)
      expect((requestPdf.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")

      const spreadsheetPdf = await request(`/processos/${processId}/pontuacao/planilha`, {
        token: teacher.accessToken,
      })
      expect(spreadsheetPdf.status).toBe(200)
      expect((spreadsheetPdf.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")

      const evidencePdf = await request(`/processos/${processId}/pontuacao/comprovantes`, {
        token: teacher.accessToken,
      })
      expect(evidencePdf.status).toBe(200)
      expect((evidencePdf.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")

      const submission = await request(`/processos/${processId}/enviar`, {
        method: "POST",
        token: teacher.accessToken,
      })
      expect(submission.status).toBe(200)
      expect(submission.data.data).toMatchObject({
        processId,
        status: "SUBMITTED",
        totalPoints: 160,
      })

      const forbidden = await request(`/processes/${processId}/evaluation`, {
        token: teacher.accessToken,
      })
      expect(forbidden.status).toBe(403)

      const evaluation = await request(`/processes/${processId}/evaluation`, {
        token: cppd.accessToken,
      })
      expect(evaluation.status).toBe(200)
      expect(evaluation.data.data.process).toMatchObject({
        idProcess: processId,
        type: scenario.code === "PROGRESSION" ? "PROGRESSAO" : "PROMOCAO",
        status: "SUBMITTED",
      })
      const filledScores = evaluation.data.data.scores.filter(
        (score: any) => score.quantity > 0 || score.awardedPoints > 0,
      )
      expect(filledScores).toHaveLength(4)

      const cppdEvidence = await request(
        `/processes/${processId}/evaluation/evidences/${evidenceFileId}/conteudo`,
        { token: cppd.accessToken },
      )
      expect(cppdEvidence.status).toBe(200)
      expect((cppdEvidence.data as Buffer).subarray(0, 4).toString()).toBe("%PDF")

      const recognized = await request(`/processes/${processId}/evaluation/items`, {
        method: "PATCH",
        token: cppd.accessToken,
        body: {
          scores: filledScores.map((score: any) => ({
            itemId: score.itemId,
            evaluatorAwardedPoints: String(score.awardedPoints),
            evaluatorComment: "Pontuação conferida pela CPPD",
          })),
        },
      })
      expect(recognized.status).toBe(200)

      const evaluators = await request(`/processes/${processId}/evaluation/evaluators`, {
        method: "PATCH",
        token: cppd.accessToken,
        body: { evaluatorUserIds: [] },
      })
      expect(evaluators.status).toBe(200)

      const preview = await request(`/processes/${processId}/evaluation/parecer`, {
        method: "POST",
        token: cppd.accessToken,
        body: { overrideOpinion: `Parecer favorável à ${scenario.label}.` },
      })
      expect(preview.status).toBe(200)
      expect(preview.data.data).toMatchObject({
        totals: { docenteTotal: 160, cppdTotal: 160 },
        suggestedOpinion: expect.stringContaining(`Parecer favorável à ${scenario.label}.`),
      })

      const finalized = await request(`/processes/${processId}/evaluation/finalize`, {
        method: "POST",
        token: cppd.accessToken,
        body: {
          decision: "APPROVED",
          overrideOpinion: `${scenario.label} aprovada após conferência integral.`,
        },
      })
      expect(finalized.status).toBe(200)
      expect(finalized.data.data).toMatchObject({
        idProcess: processId,
        status: "APPROVED",
        finalPoints: 160,
      })

      const compliance = await request(`/cases/${processId}/compliance`, { token: cppd.accessToken })
      expect(compliance.status).toBe(200)
      const officialDate = new Date(compliance.data.data.financialEffectsAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      expect(finalized.data.data.evaluationOpinion).toContain(`Data oficial de efeitos financeiros: ${officialDate}.`)
      const profile = await request("/users/me", { token: teacher.accessToken })
      expect(profile.status).toBe(200)
      expect(profile.data.data.docenteProfile.classLevel).toBe(scenario.destinationCode)
    }
  }, 120000)

  it("conclui a Classe Titular por memorial com comissão 1+3 e quatro pareceres favoráveis", async () => {
    const admin = await loginAs("81188057006", "Admin@123456")
    adminAccessToken = admin.accessToken
    const cppd = await loginAs("58315013610", "CppdCentral@123456")
    const runId = `${Date.now()}`.slice(-8)
    const password = "Integration@123456"
    const pdf = await createPdfBytes("Documentação da Classe Titular por memorial")

    const createParticipant = async (input: {
      index: number
      name: string
      roles: string[]
      docente?: boolean
    }) => {
      const cpf = validCpf(Number(runId) + input.index)
      const email = `titular.memorial.${runId}.${input.index}@example.com`
      const created = await request("/users", {
        method: "POST",
        token: adminAccessToken!,
        body: {
          name: input.name,
          email,
          cpf,
          password,
          phone: "55999992222",
          city: "Santa Maria",
          uf: "RS",
          roles: input.roles,
          ...(input.docente
            ? {
                docenteProfile: {
                  siape: `83${runId.slice(-5)}${input.index}`,
                  classLevel: "C4",
                  startInterstice: "2024-01-01",
                  educationLevel: "Doutorado",
                  assignment: "Campus Santa Maria",
                },
              }
            : {}),
          ...(input.roles.includes("EXTERNAL_EVALUATOR")
            ? {
                externalEvaluatorProfile: {
                  title: "Doutor",
                  institution: "Instituição de Teste",
                },
              }
            : {}),
        },
      })
      expect(created.status).toBe(201)
      temporaryUserIds.push(created.data.data.idUser)
      return { cpf, email, password }
    }

    const teacher = await createParticipant({
      index: 301,
      name: "Docente Classe Titular Memorial",
      roles: ["DOCENTE"],
      docente: true,
    })
    const internal = await createParticipant({
      index: 302,
      name: "Presidente Interno Classe Titular",
      roles: ["DOCENTE", "EXTERNAL_EVALUATOR"],
      docente: true,
    })
    const externals = await Promise.all(
      [303, 304, 305].map((index) =>
        createParticipant({
          index,
          name: `Avaliador Externo Classe Titular ${index}`,
          roles: ["EXTERNAL_EVALUATOR"],
        }),
      ),
    )
    const teacherLogin = await loginAs(teacher.cpf, teacher.password)

    const opening = await request("/processos/abrir", {
      method: "POST",
      token: teacherLogin.accessToken,
      body: {
        processo: {
          processTypeCode: "FULL_PROFESSOR",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          externalNumber: `TITULAR-MEMORIAL-${runId}`,
          fullProfessorDetails: { evaluationMode: "MEMORIAL" },
        },
      },
    })
    expect(opening.status).toBe(201)
    const processId = opening.data.data.processId as number
    expect(opening.data.data).toMatchObject({
      processTypeCode: "FULL_PROFESSOR",
      processTypeCategory: "FULL_PROFESSOR",
      status: "DRAFT",
      fullProfessorDetails: { evaluationMode: "MEMORIAL" },
    })

    const memorialForm = new FormData()
    memorialForm.append("file", new Blob([pdf], { type: "application/pdf" }), "memorial-titular.pdf")
    const memorial = await request(`/processos/${processId}/documentos/FULL_PROFESSOR_MEMORIAL`, {
      method: "POST",
      token: teacherLogin.accessToken,
      body: memorialForm,
    })
    expect(memorial.status).toBe(200)
    expect(memorial.data.data.fullProfessorDetails.memorialFile).toMatchObject({
      originalName: "memorial-titular.pdf",
      mimeType: "application/pdf",
    })

    const doctorateForm = new FormData()
    doctorateForm.append("file", new Blob([pdf], { type: "application/pdf" }), "diploma-doutorado.pdf")
    doctorateForm.append("course", "Doutorado em Educação")
    doctorateForm.append("institution", "Universidade de Integração")
    doctorateForm.append("conclusionDate", "2023-12-15")
    const doctorate = await request(`/processos/${processId}/documentos/DOCTORATE_DEGREE`, {
      method: "POST",
      token: teacherLogin.accessToken,
      body: doctorateForm,
    })
    expect(doctorate.status).toBe(200)
    expect(doctorate.data.data.fullProfessorDetails.doctorateDegree).toMatchObject({
      course: "Doutorado em Educação",
      institution: "Universidade de Integração",
    })

    await prepareTitular(processId, teacherLogin.accessToken, externals.map(value => value.email), internal.email, false)
    const submission = await request(`/processos/${processId}/enviar`, {
      method: "POST",
      token: teacherLogin.accessToken,
    })
    expect(submission.status).toBe(200)
    await reviewTitular(processId, cppd.accessToken)
    expect(submission.data.data).toMatchObject({ processId, status: "SUBMITTED", totalPoints: null })

    const savedCommission = await request(`/processes/${processId}/special-commission`, {
      method: "PUT",
      token: cppd.accessToken,
      body: { ordinance: `PORTARIA-TITULAR-${runId}`, ordinanceDate: "2026-09-01" },
    })
    expect(savedCommission.status).toBe(200)

    const memberInputs = [
      { ...internal, origin: "INTERNAL", role: "PRESIDENT" },
      ...externals.map((evaluator) => ({ ...evaluator, origin: "EXTERNAL", role: "MEMBER" })),
    ]
    const members: Array<{ id: number; token: string }> = []
    for (const member of memberInputs) {
      const added = await request(`/processes/${processId}/special-commission/members`, {
        method: "POST",
        token: cppd.accessToken,
        body: { email: member.email, origin: member.origin, role: member.role },
      })
      expect(added.status).toBe(201)
      const saved = added.data.data.commission.members.find(
        (candidate: any) => candidate.email === member.email,
      )
      const rawLogin = await loginAs(member.cpf, member.password)
      const token = rawLogin.roles.length > 1
        ? await selectRole(rawLogin.refreshToken, "EXTERNAL_EVALUATOR")
        : rawLogin.accessToken
      const accepted = await request(`/external-evaluator/assignments/${saved.idSpecialCommissionMember}/respond`, {
        method: "POST",
        token,
        body: { response: "ACCEPTED", absenceOfConflictDeclared: true },
      })
      expect(accepted.status).toBe(200)
      members.push({ id: saved.idSpecialCommissionMember, token })
    }

    const activation = await request(`/processes/${processId}/special-commission/status`, {
      method: "PATCH",
      token: cppd.accessToken,
      body: { status: "ACTIVE" },
    })
    expect(activation.status).toBe(200)
    expect(activation.data.data).toMatchObject({
      process: { status: "IN_EVALUATION" },
      commission: { status: "ACTIVE" },
    })

    for (const member of members) {
      const evaluation = await request(`/external-evaluator/assignments/${member.id}/evaluation`, {
        token: member.token,
      })
      expect(evaluation.status).toBe(200)
      expect(evaluation.data.data).toMatchObject({
        process: { idProcess: processId },
        evaluation: { status: "DRAFT" },
      })
      const submitted = await request(`/external-evaluator/assignments/${member.id}/evaluation/submit`, {
        method: "POST",
        token: member.token,
        body: {
          result: "APPROVED",
          opinionText: "Memorial aprovado após análise integral.",
          scores: [],
        },
      })
      expect(submitted.status).toBe(200)
      expect(submitted.data.data.evaluation).toMatchObject({
        status: "SUBMITTED",
        result: "APPROVED",
        recognizedPoints: null,
      })
    }

    const completion = await request(`/processes/${processId}/special-commission/status`, {
      method: "PATCH",
      token: cppd.accessToken,
      body: { status: "COMPLETED" },
    })
    expect(completion.status).toBe(200)
    expect(completion.data.data).toMatchObject({
      process: { status: "UNDER_REVIEW" },
      commission: { status: "COMPLETED", consolidation: { allSubmitted: true } },
    })

    const cppdProcedure = await request(`/processes/${processId}/full-professor-procedure`, {
      token: cppd.accessToken,
    })
    expect(cppdProcedure.status).toBe(200)
    expect(cppdProcedure.data.data).toMatchObject({
      processId,
      evaluationMode: "MEMORIAL",
      stage: "COMPLETED",
      currentOutcome: "APPROVED",
    })
    const teacherProcedure = await request(`/processos/${processId}/classe-titular/rito`, {
      token: teacherLogin.accessToken,
    })
    expect(teacherProcedure.status).toBe(200)
    expect(teacherProcedure.data.data.availableActions).toEqual([])

    await signCommission(processId, cppd.accessToken, members, true, false)
    const decision = await request(`/processes/${processId}/special-commission/decision`, {
      method: "POST",
      token: cppd.accessToken,
      body: {
        decision: "APPROVED",
        opinionText: "Promoção à Classe Titular deferida por unanimidade.",
      },
    })
    expect(decision.status).toBe(200)
    expect(decision.data.data.process).toMatchObject({
      idProcess: processId,
      status: "APPROVED",
      finalPoints: null,
    })

    const profile = await request("/users/me", { token: teacherLogin.accessToken })
    expect(profile.status).toBe(200)
    expect(profile.data.data.docenteProfile.classLevel).toBe("D1")
  }, 120000)

  it("conclui a Classe Titular por tese após agendamento e registro da defesa", async () => {
    const admin = await loginAs("81188057006", "Admin@123456")
    adminAccessToken = admin.accessToken
    const cppd = await loginAs("58315013610", "CppdCentral@123456")
    const runId = `${Date.now()}`.slice(-8)
    const password = "Integration@123456"
    const pdf = await createPdfBytes("Tese acadêmica inédita para Classe Titular")

    const createParticipant = async (input: {
      index: number
      name: string
      roles: string[]
      docente?: boolean
    }) => {
      const cpf = validCpf(Number(runId) + input.index)
      const email = `titular.tese.${runId}.${input.index}@example.com`
      const created = await request("/users", {
        method: "POST",
        token: adminAccessToken!,
        body: {
          name: input.name,
          email,
          cpf,
          password,
          phone: "55999993333",
          city: "Santa Maria",
          uf: "RS",
          roles: input.roles,
          ...(input.docente
            ? {
                docenteProfile: {
                  siape: `84${runId.slice(-5)}${input.index}`,
                  classLevel: "C4",
                  startInterstice: "2024-01-01",
                  educationLevel: "Doutorado",
                  assignment: "Campus Santa Maria",
                },
              }
            : {}),
          ...(input.roles.includes("EXTERNAL_EVALUATOR")
            ? {
                externalEvaluatorProfile: {
                  title: "Doutor",
                  institution: "Instituição de Teste",
                },
              }
            : {}),
        },
      })
      expect(created.status).toBe(201)
      temporaryUserIds.push(created.data.data.idUser)
      return { cpf, email, password }
    }

    const teacher = await createParticipant({
      index: 401,
      name: "Docente Classe Titular Tese",
      roles: ["DOCENTE"],
      docente: true,
    })
    const internal = await createParticipant({
      index: 402,
      name: "Presidente Interno Defesa de Tese",
      roles: ["DOCENTE", "EXTERNAL_EVALUATOR"],
      docente: true,
    })
    const externals = await Promise.all(
      [403, 404, 405].map((index) =>
        createParticipant({
          index,
          name: `Avaliador Externo Defesa de Tese ${index}`,
          roles: ["EXTERNAL_EVALUATOR"],
        }),
      ),
    )
    const teacherLogin = await loginAs(teacher.cpf, teacher.password)

    const opening = await request("/processos/abrir", {
      method: "POST",
      token: teacherLogin.accessToken,
      body: {
        processo: {
          processTypeCode: "FULL_PROFESSOR",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          externalNumber: `TITULAR-TESE-${runId}`,
          fullProfessorDetails: { evaluationMode: "THESIS" },
        },
      },
    })
    expect(opening.status).toBe(201)
    const processId = opening.data.data.processId as number

    const thesisForm = new FormData()
    thesisForm.append("file", new Blob([pdf], { type: "application/pdf" }), "tese-inedita.pdf")
    const thesis = await request(`/processos/${processId}/documentos/FULL_PROFESSOR_THESIS`, {
      method: "POST",
      token: teacherLogin.accessToken,
      body: thesisForm,
    })
    expect(thesis.status).toBe(200)
    expect(thesis.data.data.fullProfessorDetails.thesisFile).toMatchObject({
      originalName: "tese-inedita.pdf",
    })

    const doctorateForm = new FormData()
    doctorateForm.append("file", new Blob([pdf], { type: "application/pdf" }), "diploma-doutorado.pdf")
    doctorateForm.append("course", "Doutorado em Ensino")
    doctorateForm.append("institution", "Universidade de Integração")
    doctorateForm.append("conclusionDate", "2023-12-15")
    const doctorate = await request(`/processos/${processId}/documentos/DOCTORATE_DEGREE`, {
      method: "POST",
      token: teacherLogin.accessToken,
      body: doctorateForm,
    })
    expect(doctorate.status).toBe(200)

    await prepareTitular(processId, teacherLogin.accessToken, externals.map(value => value.email), internal.email, true)
    const submission = await request(`/processos/${processId}/enviar`, {
      method: "POST",
      token: teacherLogin.accessToken,
    })
    expect(submission.status).toBe(200)
    await reviewTitular(processId, cppd.accessToken)
    expect(submission.data.data.status).toBe("SUBMITTED")

    const ordinanceDate = new Date().toISOString().slice(0, 10)
    const savedCommission = await request(`/processes/${processId}/special-commission`, {
      method: "PUT",
      token: cppd.accessToken,
      body: { ordinance: `PORTARIA-TESE-${runId}`, ordinanceDate },
    })
    expect(savedCommission.status).toBe(200)

    const memberInputs = [
      { ...internal, origin: "INTERNAL", role: "PRESIDENT" },
      ...externals.map((evaluator) => ({ ...evaluator, origin: "EXTERNAL", role: "MEMBER" })),
    ]
    const members: Array<{ id: number; token: string }> = []
    for (const member of memberInputs) {
      const added = await request(`/processes/${processId}/special-commission/members`, {
        method: "POST",
        token: cppd.accessToken,
        body: { email: member.email, origin: member.origin, role: member.role },
      })
      expect(added.status).toBe(201)
      const saved = added.data.data.commission.members.find(
        (candidate: any) => candidate.email === member.email,
      )
      const rawLogin = await loginAs(member.cpf, member.password)
      const token = rawLogin.roles.length > 1
        ? await selectRole(rawLogin.refreshToken, "EXTERNAL_EVALUATOR")
        : rawLogin.accessToken
      const accepted = await request(`/external-evaluator/assignments/${saved.idSpecialCommissionMember}/respond`, {
        method: "POST",
        token,
        body: { response: "ACCEPTED", absenceOfConflictDeclared: true },
      })
      expect(accepted.status).toBe(200)
      members.push({ id: saved.idSpecialCommissionMember, token })
    }

    const activation = await request(`/processes/${processId}/special-commission/status`, {
      method: "PATCH",
      token: cppd.accessToken,
      body: { status: "ACTIVE" },
    })
    expect(activation.status).toBe(200)

    const procedureBeforeDefense = await request(`/processes/${processId}/full-professor-procedure`, {
      token: cppd.accessToken,
    })
    expect(procedureBeforeDefense.status).toBe(200)
    expect(procedureBeforeDefense.data.data).toMatchObject({
      evaluationMode: "THESIS",
      stage: "INITIAL_EVALUATION",
      availableActions: expect.arrayContaining(["SCHEDULE_ORAL_DEFENSE"]),
    })

    const scheduledAt = new Date(Date.now() + 700)
    const scheduled = await request(`/processes/${processId}/full-professor-procedure/actions`, {
      method: "POST",
      token: cppd.accessToken,
      body: {
        action: "SCHEDULE_ORAL_DEFENSE",
        scheduledAt: scheduledAt.toISOString(),
        accessUrl: "https://meet.example.com/defesa-tese",
      },
    })
    expect(scheduled.status).toBe(200)
    expect(scheduled.data.data.stage).toBe("ORAL_DEFENSE_SCHEDULED")

    await new Promise((resolve) => setTimeout(resolve, 900))
    const heldAt = new Date()
    const recorded = await request(`/processes/${processId}/full-professor-procedure/actions`, {
      method: "POST",
      token: cppd.accessToken,
      body: {
        action: "RECORD_ORAL_DEFENSE",
        heldAt: heldAt.toISOString(),
        recordingUrl: "https://video.example.com/gravacao-tese",
        notes: "Defesa pública realizada e ata conferida.",
      },
    })
    expect(recorded.status).toBe(200)
    expect(recorded.data.data.stage).toBe("THESIS_DEFENSE_RECORDED")

    for (const member of members) {
      const submitted = await request(`/external-evaluator/assignments/${member.id}/evaluation/submit`, {
        method: "POST",
        token: member.token,
        body: {
          result: "APPROVED",
          opinionText: "Tese aprovada após defesa pública e arguição.",
          scores: [],
        },
      })
      expect(submitted.status).toBe(200)
      expect(submitted.data.data.evaluation).toMatchObject({
        status: "SUBMITTED",
        result: "APPROVED",
      })
    }

    const completion = await request(`/processes/${processId}/special-commission/status`, {
      method: "PATCH",
      token: cppd.accessToken,
      body: { status: "COMPLETED" },
    })
    expect(completion.status).toBe(200)

    const procedureAfterCommission = await request(`/processes/${processId}/full-professor-procedure`, {
      token: cppd.accessToken,
    })
    expect(procedureAfterCommission.status).toBe(200)
    expect(procedureAfterCommission.data.data).toMatchObject({
      evaluationMode: "THESIS",
      stage: "COMPLETED",
      currentOutcome: "APPROVED",
    })

    await signCommission(processId, cppd.accessToken, members, true, true)
    const decision = await request(`/processes/${processId}/special-commission/decision`, {
      method: "POST",
      token: cppd.accessToken,
      body: {
        decision: "APPROVED",
        opinionText: "Promoção à Classe Titular por tese deferida.",
      },
    })
    expect(decision.status).toBe(200)
    expect(decision.data.data.process.status).toBe("APPROVED")

    const profile = await request("/users/me", { token: teacherLogin.accessToken })
    expect(profile.status).toBe(200)
    expect(profile.data.data.docenteProfile.classLevel).toBe("D1")
  }, 120000)

  it("impede a inclusão concorrente do mesmo membro na comissão especial", async () => {
    const admin = await loginAs("81188057006", "Admin@123456")
    adminAccessToken = admin.accessToken
    const cppd = await loginAs("58315013610", "CppdCentral@123456")
    const runId = `${Date.now()}`.slice(-8)
    const password = "Integration@123456"
    const pdf = await createPdfBytes("Documentos para teste concorrente de comissão")

    const teacherCpf = validCpf(Number(runId) + 501)
    const teacherCreated = await request("/users", {
      method: "POST",
      token: adminAccessToken!,
      body: {
        name: "Docente Concorrência Comissão",
        email: `concorrencia.docente.${runId}@example.com`,
        cpf: teacherCpf,
        password,
        roles: ["DOCENTE"],
        docenteProfile: {
          siape: `85${runId.slice(-5)}501`,
          classLevel: "C4",
          startInterstice: "2024-01-01",
          educationLevel: "Doutorado",
          assignment: "Campus Santa Maria",
        },
      },
    })
    expect(teacherCreated.status).toBe(201)
    temporaryUserIds.push(teacherCreated.data.data.idUser)

    const evaluatorEmail = `concorrencia.avaliador.${runId}@example.com`
    const evaluatorCreated = await request("/users", {
      method: "POST",
      token: adminAccessToken!,
      body: {
        name: "Avaliador Concorrência Comissão",
        email: evaluatorEmail,
        cpf: validCpf(Number(runId) + 502),
        password,
        roles: ["EXTERNAL_EVALUATOR"],
        externalEvaluatorProfile: {
          title: "Doutor",
          institution: "Instituição de Teste",
        },
      },
    })
    expect(evaluatorCreated.status).toBe(201)
    temporaryUserIds.push(evaluatorCreated.data.data.idUser)

    const teacher = await loginAs(teacherCpf, password)
    const opening = await request("/processos/abrir", {
      method: "POST",
      token: teacher.accessToken,
      body: {
        processo: {
          processTypeCode: "FULL_PROFESSOR",
          campus: "Campus Santa Maria",
          cidadeUF: "Santa Maria/RS",
          externalNumber: `TITULAR-CONCORRENCIA-${runId}`,
          fullProfessorDetails: { evaluationMode: "MEMORIAL" },
        },
      },
    })
    expect(opening.status).toBe(201)
    const processId = opening.data.data.processId as number

    const memorialForm = new FormData()
    memorialForm.append("file", new Blob([pdf], { type: "application/pdf" }), "memorial.pdf")
    const memorial = await request(`/processos/${processId}/documentos/FULL_PROFESSOR_MEMORIAL`, {
      method: "POST",
      token: teacher.accessToken,
      body: memorialForm,
    })
    expect(memorial.status).toBe(200)

    const doctorateForm = new FormData()
    doctorateForm.append("file", new Blob([pdf], { type: "application/pdf" }), "diploma.pdf")
    doctorateForm.append("course", "Doutorado em Educação")
    doctorateForm.append("institution", "Universidade de Integração")
    doctorateForm.append("conclusionDate", "2023-12-15")
    const doctorate = await request(`/processos/${processId}/documentos/DOCTORATE_DEGREE`, {
      method: "POST",
      token: teacher.accessToken,
      body: doctorateForm,
    })
    expect(doctorate.status).toBe(200)
    await prepareTitular(processId, teacher.accessToken, [evaluatorEmail], `interno-concorrencia-${processId}@iffarroupilha.edu.br`, false)
    const submission = await request(`/processos/${processId}/enviar`, {
      method: "POST",
      token: teacher.accessToken,
    })
    expect(submission.status).toBe(200)
    await reviewTitular(processId, cppd.accessToken)

    const commission = await request(`/processes/${processId}/special-commission`, {
      method: "PUT",
      token: cppd.accessToken,
      body: { ordinance: `PORTARIA-CONCORRENCIA-${runId}`, ordinanceDate: new Date().toISOString() },
    })
    expect(commission.status).toBe(200)

    const duplicateRequests = await Promise.all([
      request(`/processes/${processId}/special-commission/members`, {
        method: "POST",
        token: cppd.accessToken,
        body: { email: evaluatorEmail, origin: "EXTERNAL", role: "MEMBER" },
      }),
      request(`/processes/${processId}/special-commission/members`, {
        method: "POST",
        token: cppd.accessToken,
        body: { email: evaluatorEmail, origin: "EXTERNAL", role: "MEMBER" },
      }),
    ])
    expect(duplicateRequests.map((response) => response.status).sort()).toEqual([201, 400])
    expect(duplicateRequests.find((response) => response.status === 400)?.data.message).toMatch(
      /já pertence/i,
    )

    const persisted = await request(`/processes/${processId}/special-commission`, {
      token: cppd.accessToken,
    })
    expect(persisted.status).toBe(200)
    expect(persisted.data.data.commission.members).toHaveLength(1)
    expect(persisted.data.data.commission.members[0].email).toBe(evaluatorEmail)
  }, 60000)

  it("preserva provas e comissão anterior nos dois recursos do RSC", async () => {
    const { prisma } = await import("../../src/infra/prismaClient")
    const { processId, teacherToken, cppdToken } = rscFixture!
    const current = await prisma.careerProcess.findUniqueOrThrow({ where: { idProcess: processId }, include: { specialCommissions: { include: { members: { include: { person: true } } } }, scores: true } })
    const original = current.specialCommissions[0]
    // A fixture sintética representa uma decisão inicial desfavorável. O fluxo normal já é exercitado acima.
    await prisma.careerProcess.update({ where: { idProcess: processId }, data: { status: "REJECTED" } })
    await prisma.processStatusHistory.create({ data: { processId, fromStatus: "UNDER_REVIEW", toStatus: "REJECTED", changedById: current.userId } })
    const wrongStage = await request(`/cases/${processId}/appeals`, { method: "POST", token: teacherToken, body: { stage: "CPRSC", reason: "Revisão" } })
    expect(wrongStage.status).toBe(400)
    const submitted = await request<any>(`/cases/${processId}/appeals`, { method: "POST", token: teacherToken, body: { stage: "CPPD", reason: "Reanálise das mesmas provas, sem novos documentos" } })
    expect(submitted.status).toBe(200)
    const appeal = submitted.data.data.appeals[0]
    expect(appeal.originalCommissionId).toBe(original.idSpecialCommission)
    expect(appeal.evidenceSnapshot.scores).toHaveLength(current.scores.length)
    expect((await request(`/cases/${processId}/appeals`, { method: "POST", token: teacherToken, body: { stage: "CPPD", reason: "Duplicado" } })).status).toBe(400)
    const sameMember = await request(`/processes/${processId}/special-commission/members`, { method: "POST", token: cppdToken, body: { email: original.members[0].person.email, origin: original.members[0].origin, role: "MEMBER" } })
    expect(sameMember.status).toBe(400)
    expect(sameMember.data.message).toMatch(/diferentes/)
    const replaceProof = new FormData()
    replaceProof.set("file", new Blob([await createPdfBytes("Prova nova proibida")], { type: "application/pdf" }), "nova.pdf")
    expect((await request(`/processos/${processId}/documentos/RSC_REPORT`, { method: "POST", token: teacherToken, body: replaceProof })).status).toBe(400)
    // Preparação dos quatro pareceres da segunda comissão, todos desfavoráveis.
    await prisma.specialCommission.update({ where: { idSpecialCommission: appeal.newCommissionId }, data: { status: "ACTIVE", ordinance: "PORTARIA-RECURSO-TESTE", ordinanceDate: new Date() } })
    await prisma.careerProcess.update({ where: { idProcess: processId }, data: { status: "IN_EVALUATION" } })
    for (let i = 0; i < 4; i++) {
      const person = await prisma.person.create({ data: { name: `Novo avaliador de recurso ${i}`, email: `recurso-${processId}-${i}@federal.edu.br` } })
      const member = await prisma.specialCommissionMember.create({ data: { specialCommissionId: appeal.newCommissionId, personId: person.idPerson, origin: i ? "EXTERNAL" : "INTERNAL", role: "MEMBER", acceptanceStatus: "ACCEPTED", acceptedAt: new Date(), conflictDeclarationAt: new Date() } })
      await prisma.individualEvaluation.create({ data: { processId, memberId: member.idSpecialCommissionMember, type: "RSC", status: "SUBMITTED", result: "DENIED", recognizedPoints: 0, opinionText: "Recurso indeferido por insuficiência das provas existentes", submittedAt: new Date() } })
      await attachSigned(processId, cppdToken, "INDIVIDUAL_OPINION", await createPdfBytes("Parecer de recurso sintético"), member.idSpecialCommissionMember)
    }
    expect((await request(`/processes/${processId}/special-commission/status`, { method: "PATCH", token: cppdToken, body: { status: "COMPLETED" } })).status).toBe(200)
    const consolidated = await request(`/cases/${processId}/documents/CONSOLIDATED_OPINION`, { token: cppdToken })
    expect(consolidated.status).toBe(200)
    await attachSigned(processId, cppdToken, "CONSOLIDATED_OPINION", consolidated.data as Buffer)
    expect((await request(`/processes/${processId}/special-commission/decision`, { method: "POST", token: cppdToken, body: { decision: "REJECTED", opinionText: "Mantido o indeferimento após nova comissão" } })).status).toBe(200)
    const finalAppeal = await request<any>(`/cases/${processId}/appeals`, { method: "POST", token: teacherToken, body: { stage: "CPRSC", reason: "Pedido final à CPRSC" } })
    expect(finalAppeal.status).toBe(200)
    const finalId = finalAppeal.data.data.appeals[1].idAppeal
    const decisionBody = { decision: "APPROVED", decisionText: "Decisão oficial externa da CPRSC", externalReference: "CPRSC-TESTE-001" }
    expect((await request(`/cases/${processId}/appeals/${finalId}/decision`, { method: "POST", token: cppdToken, body: decisionBody })).status).toBe(400)
    await attachSigned(processId, cppdToken, "CPRSC_DECISION", await createPdfBytes("Decisão externa sintética"))
    const recorded = await request<any>(`/cases/${processId}/appeals/${finalId}/decision`, { method: "POST", token: cppdToken, body: decisionBody })
    expect(recorded.status).toBe(200)
    expect(recorded.data.data.status).toBe("APPROVED")
    expect(recorded.data.data.appeals.every((value: any) => value.status === "DECIDED")).toBe(true)
    expect(await prisma.specialCommission.count({ where: { processId } })).toBe(2)
    expect(await prisma.processScore.findMany({ where: { processId } })).toEqual(current.scores)
    expect((await request(`/cases/${processId}/compliance`, { method: "POST", token: teacherToken, body: { action: "SAVE_REFERENCES", simecReference: "Alteração proibida" } })).status).toBe(400)
  }, 60000)

  it("gerencia calendário e versões de modelos sem expor administração ao docente", async () => {
    const admin = await loginAs("81188057006", "Admin@123456")
    const configPath = "/management/regulatory-configuration"
    expect((await request(configPath, { token: docenteAccessToken })).status).toBe(400)
    const calendar = await request<any>(configPath, { method: "POST", token: admin.accessToken, body: { action: "SAVE_CALENDAR", kind: "RECESS", description: "Calendário sintético de verificação", startsOn: "2038-01-01", endsOn: "2038-01-05" } })
    expect(calendar.status).toBe(200)
    const period = calendar.data.data.calendar.find((value: any) => value.description === "Calendário sintético de verificação")
    expect((await request(configPath, { method: "POST", token: admin.accessToken, body: { action: "REMOVE_CALENDAR", idPeriod: period.idPeriod } })).status).toBe(200)
    const code = `MODEL_TEST_${Date.now()}`
    for (const version of ["1", "2"]) {
      expect((await request(configPath, { method: "POST", token: admin.accessToken, body: { action: "SAVE_TEMPLATE", code, name: "Modelo de teste", version, text: `Versão ${version}: {{nome}} / {{processo}}` } })).status).toBe(200)
    }
    const state = await request<any>(configPath, { token: admin.accessToken })
    expect(state.data.data.templates.filter((value: any) => value.code.startsWith(code))).toHaveLength(2)
    expect(state.data.data.templates.find((value: any) => value.code === code).bodyText).toContain("Versão 2")
    expect((await request(configPath, { method: "POST", token: admin.accessToken, body: { action: "SAVE_TEMPLATE", code, name: "Reutilização proibida", version: "2", text: "Não pode sobrescrever" } })).status).toBe(400)
    const type = state.data.data.processTypes.find((value: any) => value.code === "RSC")
    expect((await request(configPath, { method: "POST", token: admin.accessToken, body: { action: "SAVE_REQUIREMENT", processTypeId: type.idProcessType, code: "NOVO", name: "Documento", required: true } })).status).toBe(400)
    const versioned = await request<any>(configPath, { method: "POST", token: admin.accessToken, body: { action: "VERSION_PROCESS_TYPE", processTypeId: type.idProcessType } })
    expect(versioned.status).toBe(200)
    const fresh = versioned.data.data.processTypes.find((value: any) => value.code === "RSC")
    expect(fresh.idProcessType).not.toBe(type.idProcessType)
    expect((await request(configPath, { method: "POST", token: admin.accessToken, body: { action: "SAVE_REQUIREMENT", processTypeId: fresh.idProcessType, code: "NOVO", name: "Documento de teste", required: false } })).status).toBe(200)
  })

  it("cadastra diploma estrangeiro somente com reconhecimento e arquivos do próprio docente", async () => {
    const upload = new FormData()
    upload.set("file", new Blob([await createPdfBytes("Diploma sintético")], { type: "application/pdf" }), "diploma.pdf")
    const file = await request<any>("/teacher/evidence", { method: "POST", token: docenteAccessToken, body: upload })
    expect(file.status).toBe(200)
    const body = { degreeType: "DOCTORATE", course: "Doutorado em Educação", institution: "Universidade estrangeira", conclusionDate: "2023-01-01", countryCode: "PT", evidenceFileId: file.data.data.idEvidenceFile }
    expect((await request("/teacher/degrees", { method: "POST", token: docenteAccessToken, body })).status).toBe(400)
    const saved = await request<any>("/teacher/degrees", { method: "POST", token: docenteAccessToken, body: { ...body, recognitionFileId: file.data.data.idEvidenceFile } })
    expect(saved.status).toBe(200)
    expect(saved.data.data).toEqual(expect.arrayContaining([expect.objectContaining({ countryCode: "PT", recognitionFileId: file.data.data.idEvidenceFile })]))
    expect((await request("/teacher/degrees", { method: "POST", token: docenteAccessToken, body: { ...body, evidenceFileId: 2147483647, countryCode: "BR" } })).status).toBe(400)
  })

  async function loginAs(cpf: string, password: string) {
    const response = await request("/login", {
      method: "POST",
      body: { cpf, password },
    })
    expect(response.status).toBe(200)
    return response.data.data
  }

  async function selectRole(refreshToken: string, role: string) {
    const response = await request("/select-role", {
      method: "POST",
      body: { refreshToken, role },
    })
    expect(response.status).toBe(200)
    return response.data.data.accessToken as string
  }

  async function createPdfBytes(label: string) {
    const document = await PDFDocument.create()
    const page = document.addPage([595, 842])
    page.drawText(label, { x: 48, y: 790, size: 12 })
    return document.save()
  }

  function validCpf(seed: number) {
    const base = String(100000000 + (Math.abs(seed) % 899999999)).slice(0, 9)
    const calculateDigit = (digits: string, factor: number) => {
      const total = digits
        .split("")
        .reduce((sum, digit) => sum + Number(digit) * factor--, 0)
      const remainder = (total * 10) % 11
      return remainder === 10 ? 0 : remainder
    }
    const first = calculateDigit(base, 10)
    const second = calculateDigit(`${base}${first}`, 11)
    return `${base}${first}${second}`
  }
})
