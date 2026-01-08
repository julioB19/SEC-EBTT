import { execFile } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

export function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  console.log("[PDF] Tamanho do buffer DOCX recebido:", docxBuffer.length)

  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir()

    const baseName = `requerimento_${Date.now()}`
    const inputPath = path.join(tmpDir, `${baseName}.docx`)
    const outputPath = path.join(tmpDir, `${baseName}.pdf`)

    fs.writeFileSync(inputPath, docxBuffer)

    execFile(
      "soffice",
      ["--headless", "--convert-to", "pdf", inputPath, "--outdir", tmpDir],
      (err, stdout, stderr) => {
        if (err) {
          console.error("[PDF] Erro ao chamar soffice:", err)
          console.error("[PDF] STDOUT:", stdout)
          console.error("[PDF] STDERR:", stderr)
          return reject(new Error("Falha ao converter o documento para PDF (CLI)"))
        }

        if (!fs.existsSync(outputPath)) {
          console.error("[PDF] Arquivo PDF não encontrado em:", outputPath)
          return reject(new Error("Falha ao localizar o PDF gerado"))
        }

        const pdfBuffer = fs.readFileSync(outputPath)
        console.log("[PDF] Conversão concluída. Tamanho do PDF:", pdfBuffer.length)

        try {
          fs.unlinkSync(inputPath)
          fs.unlinkSync(outputPath)
        } catch (cleanupErr) {
          console.warn("[PDF] Erro ao remover arquivos temporários:", cleanupErr)
        }

        resolve(pdfBuffer)
      }
    )
  })
}
