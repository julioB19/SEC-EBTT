import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import fs from "fs"
import path from "path"

export function renderDocxFromTemplate(
  templatePath: string,
  variables: Record<string, any>
): Buffer {
  const absolute = path.resolve(templatePath)
  console.log("[DOCX] Usando template em:", absolute)

  const content = fs.readFileSync(absolute)
  const zip = new PizZip(content)

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "[[",
      end: "]]"
    }
  })

  try {
    doc.render(variables)
  } catch (error: any) {
    console.error("[DOCX] Erro ao renderizar:", JSON.stringify(error, null, 2))
    throw error
  }

  return doc.getZip().generate({ type: "nodebuffer" })
}
