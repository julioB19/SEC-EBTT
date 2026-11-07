import "dotenv/config"
import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { assertResetTarget, databaseUrl, run, withMysqlTools } from "./demo-database"

async function main() {
  const url = assertResetTarget()
  const name = `TCC_DEMO_TEST_${randomUUID().replace(/-/g, "")}`
  const directory = path.join(process.cwd(), "tmp", "demo-tests", name)
  fs.mkdirSync(directory, { recursive: true })
  const testUrl = new URL(databaseUrl(url, name))
  testUrl.hostname = "127.0.0.1"
  testUrl.searchParams.set("connection_limit", "5")
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: testUrl.toString(), JWT_ACCESS_SECRET: randomUUID(), JWT_REFRESH_SECRET: randomUUID(), JWT_ACCESS_EXPIRATION: "1h", JWT_REFRESH_EXPIRATION: "1d", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" }
  await withMysqlTools(url, directory, async mysql => {
    mysql(["mysql", "-e", `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`])
    try {
      const migrated = run(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(process.cwd(), "prisma", "schema.prisma")], { env, cwd: directory })
      fs.writeFileSync(path.join(directory, "migrations.log"), migrated)
      const seeded = run(process.execPath, [require.resolve("ts-node/dist/bin.js"), "--project", path.join(process.cwd(), "tsconfig.json"), path.join(__dirname, "seed-demo.ts")], { env, cwd: directory })
      fs.writeFileSync(path.join(directory, "seed-command.log"), seeded)
      const result = run(process.execPath, [require.resolve("ts-node/dist/bin.js"), "--project", path.join(process.cwd(), "tsconfig.json"), path.join(__dirname, "verify-demo-worker.ts")], { env, cwd: directory })
      fs.writeFileSync(path.join(directory, "verification.log"), result)
      console.log(result)
      fs.copyFileSync(path.join(directory, "RESULTADO.json"), path.join(process.cwd(), "tmp", "demo-validation.json"))
      console.log(`Evidências da validação: ${directory}`)
    } finally {
      mysql(["mysql", "-e", `DROP DATABASE \`${name}\``])
    }
  })
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na validação demonstrativa"); process.exitCode = 1 })
