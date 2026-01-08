// src/infra/upload.ts
import multer from "multer"
import path from "path"
import fs from "fs"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import type { Request } from "express"

function getUserIdFromReq(req: Request): number | null {
  const auth = req.header("Authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

  if (!token) return null

  try {
    const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
    const userId = Number(payload?.sub)
    if (!userId || Number.isNaN(userId)) return null
    return userId
  } catch {
    return null
  }
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const userId = getUserIdFromReq(req)
    const processId = Number(req.params.id)

    const userFolder = userId ? String(userId) : "anon"
    const processFolder =
      !Number.isNaN(processId) && processId ? String(processId) : "no-process"

    const baseDir = path.join(process.cwd(), "uploads", userFolder, processFolder)

    fs.mkdirSync(baseDir, { recursive: true })

    cb(null, baseDir)
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    const timestamp = Date.now()

    const hashInput = `${file.mimetype}|${file.size}|${timestamp}|${Math.random()}`
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 12)

    const finalName = `${timestamp}_${hash}${ext}`

    cb(null, finalName)
  }
})

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"]

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Tipo de arquivo não permitido. Envie PDF ou imagem JPG/PNG."))
    }

    cb(null, true)
  }
})
