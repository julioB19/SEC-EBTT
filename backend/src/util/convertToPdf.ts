import fs from "fs"
import os from "os"
import path from "path"
import { BusinessRuleError } from "../service/processoService"
import { convertFileToPdf } from "./libreOffice"

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-ebtt-requerimento-"))
  const inputPath = path.join(tmpDir, "requerimento.docx")

  try {
    fs.writeFileSync(inputPath, docxBuffer)
    const outputPath = await convertFileToPdf(inputPath, tmpDir)
    return fs.readFileSync(outputPath)
  } catch (err) {
    console.error("[PDF] Erro ao gerar PDF do requerimento:", err)
    throw new BusinessRuleError("Não foi possível gerar o PDF do requerimento. Tente novamente em alguns segundos.")
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
