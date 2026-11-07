import "dotenv/config"
import { PrismaClient } from "@prisma/client"

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada")
  const url = new URL(process.env.DATABASE_URL)
  if (url.hostname === "localhost") url.hostname = "127.0.0.1"
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5")
  process.env.DATABASE_URL = url.toString()
  const { disconnectDemo, seedDemo } = await import("./demo-data")
  const prisma = new PrismaClient()
  try { await seedDemo(prisma) }
  finally { await prisma.$disconnect(); await disconnectDemo() }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na seed demonstrativa"); process.exitCode = 1 })
