import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { assertResetTarget, databaseUrl, fileInventory, run, stopLocalApplication, tableCounts, withMysqlTools } from "./demo-database"

async function main() {
  const url = assertResetTarget()
  const directory = path.join(process.cwd(), "tmp", "demo-backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`)
  fs.mkdirSync(directory, { recursive: true })
  const lock = path.join(process.cwd(), "tmp", "demo-reset.lock")
  const lockFd = fs.openSync(lock, "wx")
  const client = new PrismaClient()
  try {
    stopLocalApplication()
    await withMysqlTools(url, directory, async mysql => {
      const countBefore = await tableCounts(client)
      const dump = path.join(directory, "TCC.sql")
      mysql(["mysqldump", "--single-transaction", "--routines", "--triggers", "--no-tablespaces", "--set-gtid-purged=OFF", "TCC"], { stdoutFile: dump })
      if (fs.statSync(dump).size < 100 || !fs.readFileSync(dump).subarray(0, 300).toString().includes("MySQL dump")) throw new Error("Backup SQL inválido")
      const uploads = path.resolve(process.cwd(), "uploads"), uploadCopy = path.join(directory, "uploads")
      const inventory = fileInventory(uploads)
      if (fs.existsSync(uploads)) fs.cpSync(uploads, uploadCopy, { recursive: true, errorOnExist: true })
      if (JSON.stringify(inventory) !== JSON.stringify(fileInventory(uploadCopy))) throw new Error("A cópia dos uploads não confere")
      const temporary = `TCC_DEMO_RESTORE_${randomUUID().replace(/-/g, "")}`
      mysql(["mysql", "-e", `CREATE DATABASE \`${temporary}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`])
      const restored = new PrismaClient({ datasources: { db: { url: databaseUrl(url, temporary) } } })
      let verified = false
      try {
        mysql(["mysql", temporary], { stdinFile: dump })
        const countRestored = await tableCounts(restored)
        if (JSON.stringify(countBefore) !== JSON.stringify(countRestored)) throw new Error("A restauração do backup não preservou todas as contagens")
        const canonical = ["mysqldump", "--no-create-info", "--skip-comments", "--compact", "--skip-extended-insert", "--skip-add-locks", "--skip-disable-keys", "--order-by-primary", "--hex-blob", "--no-tablespaces", "--set-gtid-purged=OFF"]
        const originalRows = mysql([...canonical, "TCC"])
        const restoredRows = mysql([...canonical, temporary])
        if (originalRows !== restoredRows) throw new Error("O conteúdo restaurado difere do banco original")
        fs.writeFileSync(path.join(directory, "VERIFICACAO.json"), JSON.stringify({ database: "localhost:3306/TCC", restoredAndVerified: true, verifiedAt: new Date().toISOString(), tables: countBefore, uploads: inventory }, null, 2))
        verified = true
      } finally {
        await restored.$disconnect()
        mysql(["mysql", "-e", `DROP DATABASE \`${temporary}\``])
      }
      if (!verified) throw new Error("Backup não validado; limpeza cancelada")
      // Apenas este caminho absoluto, conferido dentro do backend, pode ser movido.
      if (path.dirname(uploads) !== process.cwd() || path.basename(uploads) !== "uploads") throw new Error("Diretório de uploads inesperado")
      await client.$disconnect()
      console.log(`Backup restaurado e conferido: ${directory}`)
      const originalUploads = path.join(directory, "uploads-original")
      const hadUploads = fs.existsSync(uploads)
      if (hadUploads) fs.renameSync(uploads, originalUploads)
      try {
        run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "reset", "--force", "--skip-seed", "--skip-generate"])
        const seedOutput = run(process.execPath, ["node_modules/ts-node/dist/bin.js", "scripts/seed-demo.ts"])
        console.log(seedOutput)
        fs.writeFileSync(path.join(process.cwd(), "tmp", "demo", "ultimo-backup.txt"), directory + "\n")
        console.log("Base local preparada. A aplicação pode ser iniciada novamente.")
      } catch (error) {
        // Se a recriação falhar, devolver a base e os uploads anteriores.
        mysql(["mysql", "-e", "DROP DATABASE IF EXISTS `TCC`; CREATE DATABASE `TCC` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"])
        mysql(["mysql", "TCC"], { stdinFile: dump })
        if (fs.existsSync(uploads)) fs.renameSync(uploads, path.join(directory, "uploads-carga-incompleta"))
        if (hadUploads) fs.renameSync(originalUploads, uploads)
        throw new Error(`A carga falhou e o banco anterior foi restaurado. Backup: ${directory}. Causa: ${error instanceof Error ? error.message : "falha desconhecida"}`)
      }
    })
  } finally {
    await client.$disconnect()
    fs.closeSync(lockFd)
    fs.unlinkSync(lock)
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Falha ao preparar a base local"); process.exitCode = 1 })
