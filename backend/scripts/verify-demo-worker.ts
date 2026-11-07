import "dotenv/config"
import assert from "assert/strict"
import fs from "fs/promises"
import path from "path"
import type { Server } from "http"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { PDFDocument } from "pdf-lib"
import { assertResetTarget, fileInventory, tableCounts } from "./demo-database"
import { disconnectDemo, seedDemo, services } from "./demo-data"
import { IndividualEvaluationService } from "../src/service/individualEvaluationService"
import { CppdAccessService } from "../src/service/cppdAccessService"

const prisma = new PrismaClient()
let server: Server | undefined

async function snapshot() {
  const counts = await tableCounts(prisma)
  const content: Record<string, unknown> = {}
  for (const name of Object.keys(counts).sort()) {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM \`${name}\``)
    content[name] = rows.map(row => JSON.stringify(row, (_, value) => typeof value === "bigint" ? value.toString() : value)).sort()
  }
  return JSON.stringify(content)
}

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/TCC_DEMO_TEST_[a-f0-9]+$/)
  for (const bad of ["mysql://root:test@example.org:3306/TCC", "mysql://root:test@localhost:3307/TCC", "mysql://root:test@localhost:3306/TCC_TEST", "mysql://root:test@localhost:3306/TCC?schema=other"]) {
    assert.throws(() => assertResetTarget(bad))
  }
  // Falhar imediatamente se algum fluxo da carga tentar enviar e-mail.
  const mailer = await import("../src/util/mailer")
  mailer.sendMail = async () => { throw new Error("A demonstração não pode enviar e-mails") }
  const demo = await seedDemo(prisma)
  assert.equal(demo.accounts.length, 22)
  assert.equal(await prisma.user.count(), 22)
  assert.equal(await prisma.careerProcess.count(), 12)
  const states = await prisma.careerProcess.groupBy({ by: ["status"], _count: true })
  assert.deepEqual(Object.fromEntries(states.map(state => [state.status, state._count])), { DRAFT: 4, SUBMITTED: 4, UNDER_REVIEW: 2, IN_EVALUATION: 2 })
  const rsc = await prisma.scoringTable.findFirstOrThrow({ where: { purpose: "RSC", status: "ACTIVE" } })
  assert.equal(await prisma.scoringItem.count({ where: { scoringTableId: rsc.idScoringTable, active: true, deletedDate: null } }), 82)
  const commissions = await prisma.specialCommission.findMany({ include: { members: true } })
  assert.equal(commissions.length, 2)
  for (const commission of commissions) {
    assert.equal(commission.status, "ACTIVE")
    assert.equal(commission.members.length, 4)
    assert.equal(commission.members.filter(member => member.origin === "INTERNAL").length, 1)
    assert(commission.members.every(member => member.acceptanceStatus === "ACCEPTED" && member.conflictDeclarationAt))
    assert(commission.evaluationDeadlineAt! > new Date())
  }
  assert.equal(await prisma.processNominee.count(), 21)
  assert.equal(await prisma.signedProcessArtifact.count(), 0)
  const files = await prisma.evidenceFile.findMany()
  for (const file of files) {
    const bytes = await fs.readFile(path.join(process.cwd(), file.url.replace(/^\//, "")))
    assert.equal(BigInt(bytes.length), file.sizeBytes)
    assert((await PDFDocument.load(bytes)).getPageCount() > 0)
  }
  for (const user of await prisma.user.findMany()) {
    assert.equal(user.cpf, null)
    assert(user.cpfHash && user.cpfEncrypted)
  }
  const app = (await import("../src/app")).default
  server = app.listen(0, "127.0.0.1")
  await new Promise<void>(resolve => server!.once("listening", resolve))
  const address = server.address()
  assert(address && typeof address !== "string")
  const root = `http://127.0.0.1:${address.port}`
  const tokens = new Map<number, string>()
  for (const account of demo.accounts) {
    const response = await fetch(`${root}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpf: account.cpf, password: account.password }) })
    const body = await response.json() as any
    assert.equal(response.status, 200, `Login falhou para ${account.name}: ${JSON.stringify(body)}`)
    tokens.set(account.id, body.data?.accessToken ?? body.accessToken)
    assert(tokens.get(account.id))
  }
  const cppd = demo.accounts.find(account => account.role === "CPPD_MEMBER")!
  const cppdToken = tokens.get(cppd.id)!
  for (const row of demo.scenarios) {
    const token = tokens.get(row.userId)!
    const response = await fetch(`${root}/processos/${row.processId}`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(response.status, 200)
    if (row.stage > 0) {
      const result = await fetch(`${root}/cppd/processos/${row.processId}`, { headers: { Authorization: `Bearer ${cppdToken}` } })
      assert.equal(result.status, 200)
    }
    const evidence = files.find(file => file.userId === row.userId)!
    const download = await fetch(`${root}/evidencias/${evidence.idEvidenceFile}/conteudo`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(download.status, 200)
    assert((await PDFDocument.load(await download.arrayBuffer())).getPageCount() > 0)
  }
  assert.equal((await fetch(`${root}${files[0].url}`)).status, 404)
  const wrongToken = tokens.get(demo.scenarios[1].userId)!
  assert.notEqual((await fetch(`${root}/processos/${demo.scenarios[0].processId}`, { headers: { Authorization: `Bearer ${wrongToken}` } })).status, 200)
  const scope = await new CppdAccessService().resolveScope(cppd.id, "CPPD_MEMBER")
  const otherCampus = await prisma.campus.findFirstOrThrow({ where: { acronym: "FW" } })
  const first = demo.scenarios[0]
  await prisma.careerProcess.update({ where: { idProcess: first.processId }, data: { campusId: otherCampus.idCampus } })
  await assert.rejects(new CppdAccessService().assertProcessAccess(scope, first.processId))
  await prisma.careerProcess.update({ where: { idProcess: first.processId }, data: { campusId: scope.campusIds[0] } })
  // O teste altera de fato um rascunho, uma senha e pareceres, antes de repetir a seed.
  await prisma.user.update({ where: { idUser: first.userId }, data: { passwordHash: await bcrypt.hash("SenhaAlterada@123", 10) } })
  const api = services()
  for (const row of demo.scenarios.filter(scenario => scenario.stage === 0)) await api.processes.enviarParaAvaliacao(row.processId, row.userId)
  const evaluator = new IndividualEvaluationService()
  for (const commission of commissions) {
    const member = commission.members.find(value => value.origin === "EXTERNAL")!
    const account = await prisma.user.findFirstOrThrow({ where: { personId: member.personId } })
    const scores = await prisma.processScore.findMany({ where: { processId: commission.processId, quantity: { gt: 0 } } })
    const input = { opinionText: "DEMONSTRAÇÃO: parecer alterado durante a validação.", result: "DEFERRED" as const,
      ...(commission.type === "RSC" ? { scores: scores.map(score => ({ itemId: score.itemId, recognizedQuantity: score.quantity })) } : {}) }
    await evaluator.saveDraft(account.idUser, member.idSpecialCommissionMember, input)
    await evaluator.submit(account.idUser, member.idSpecialCommissionMember, input)
    const tasks = await fetch(`${root}/external-evaluator/assignments`, { headers: { Authorization: `Bearer ${tokens.get(account.idUser)}` } })
    assert.equal(tasks.status, 200)
  }
  const before = await snapshot(), uploadsBefore = fileInventory(path.join(process.cwd(), "uploads"))
  await seedDemo(prisma)
  assert.equal(await snapshot(), before, "A reexecução modificou dados existentes")
  assert.deepEqual(fileInventory(path.join(process.cwd(), "uploads")), uploadsBefore)
  const report = { success: true, verifiedAt: new Date().toISOString(), users: demo.accounts.length, processes: 12, pdfs: files.length,
    assertions: ["destino do reset protegido", "22 logins HTTP", "12 processos acessíveis", "82 critérios RSC", "4 rascunhos enviados pelas regras reais", "2 comissões ativas 1+3", "21 indicados", "PDFs válidos e privados", "controle de campus", "pareceres salvos e enviados", "reexecução preserva todo o banco e uploads", "nenhum e-mail enviado"] }
  await fs.writeFile("RESULTADO.json", JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
  await prisma.$disconnect()
  await disconnectDemo()
})
