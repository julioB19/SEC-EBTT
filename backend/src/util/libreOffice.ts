import { execFile } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { pathToFileURL } from "url"

export function resolveLibreOfficeBinary() {
  const configured = process.env.LIBREOFFICE_BIN?.trim()
  if (configured) return configured

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ]
    const installed = candidates.find(candidate => fs.existsSync(candidate))
    if (installed) return installed
  }

  return "soffice"
}

// Perfil exclusivo do backend: evita disputa com o LibreOffice aberto pelo usuário
// e com o perfil padrão, que faz o soffice sair com código 1 sem mensagem.
const PROFILE_DIR = path.join(os.tmpdir(), "sec-ebtt-libreoffice-profile")
const PROFILE_ARG = `-env:UserInstallation=${pathToFileURL(PROFILE_DIR).href}`

// O LibreOffice não suporta conversões simultâneas no mesmo perfil.
let queue: Promise<unknown> = Promise.resolve()

function runOnce(inputPath: string, outDir: string) {
  return new Promise<void>((resolve, reject) => {
    execFile(
      resolveLibreOfficeBinary(),
      [PROFILE_ARG, "--headless", "--nologo", "--nolockcheck", "--norestore", "--convert-to", "pdf", "--outdir", outDir, inputPath],
      { timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error("[LibreOffice] Falha na conversão:", err.message, { stdout, stderr })
          return reject(err)
        }
        resolve()
      }
    )
  })
}

/** Converte o arquivo para PDF em outDir e devolve o caminho do PDF gerado. */
export function convertFileToPdf(inputPath: string, outDir: string): Promise<string> {
  const expectedPdf = path.join(outDir, `${path.parse(inputPath).name}.pdf`)

  const task = queue.then(async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await runOnce(inputPath, outDir)
        if (fs.existsSync(expectedPdf)) return expectedPdf
        console.error("[LibreOffice] PDF não encontrado em:", expectedPdf)
      } catch {
        // tenta de novo uma vez: a primeira execução pode falhar ao criar o perfil
      }
    }
    throw new Error("Falha ao converter o documento para PDF")
  })

  queue = task.catch(() => undefined)
  return task
}
