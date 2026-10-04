import fs from "fs"

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
