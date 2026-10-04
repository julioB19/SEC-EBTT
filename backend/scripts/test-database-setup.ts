import "dotenv/config"
import { spawnSync } from "child_process"
import { PrismaClient } from "@prisma/client"

const DEFAULT_TEST_DATABASE_URL = "mysql://root:root123@localhost:3306/TCC_TEST"
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL
const parsedTestUrl = new URL(testDatabaseUrl)
const databaseName = parsedTestUrl.pathname.replace(/^\//, "")

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("TEST_DATABASE_URL contém um nome de banco inválido")
}
if (databaseName.toUpperCase() === "TCC") {
  throw new Error("O banco principal TCC não pode ser usado pelos testes de integração")
}

const administrativeUrl = new URL(testDatabaseUrl)
administrativeUrl.pathname = "/mysql"
const administrativeClient = new PrismaClient({
  datasources: { db: { url: administrativeUrl.toString() } },
})

function runNode(modulePath: string, args: string[]) {
  const result = spawnSync(process.execPath, [modulePath, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  })
  if (result.status !== 0) {
    throw result.error ?? new Error(`Falha ao executar: node ${modulePath} ${args.join(" ")}`)
  }
}

async function main() {
  await administrativeClient.$executeRawUnsafe(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await administrativeClient.$disconnect()

  runNode("node_modules/prisma/build/index.js", ["migrate", "deploy"])
  runNode("node_modules/ts-node/dist/bin.js", ["scripts/seeds.ts"])
  console.log(`Banco de integração pronto: ${databaseName}`)
}

main().catch(async (error) => {
  await administrativeClient.$disconnect().catch(() => undefined)
  console.error(error)
  process.exit(1)
})
