import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { seedBase } from "./seed-base"

const prisma = new PrismaClient()
seedBase(prisma)
  .catch(error => { console.error("Seed failed:", error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
