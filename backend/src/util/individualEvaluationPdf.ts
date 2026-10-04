import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"

export interface IndividualEvaluationPdfData {
  processId: number
  externalNumber?: string | null
  processTypeName: string
  teacherName: string
  teacherSiape?: string | null
  campus: string
  cityState: string
  targetLevel?: string | null
  evaluatorName: string
  submittedAt: Date
  result: string
  recognizedPoints?: number | null
  opinionText: string
  scores: Array<{
    description: string
    recognizedQuantity: number
    awardedPoints: number
    evaluatorComment?: string | null
  }>
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = String(text ?? "").split(/\r?\n/)
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push("")
      continue
    }
    let line = words[0]
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

export async function generateIndividualEvaluationPdf(data: IndividualEvaluationPdfData) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const margin = 48
  const pageWidth = 595.28
  const pageHeight = 841.89
  let page!: PDFPage
  let y = 0

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }
  const ensure = (height: number) => {
    if (y - height < margin) newPage()
  }
  const text = (value: string, options: { size?: number; font?: PDFFont; gap?: number } = {}) => {
    const size = options.size ?? 10
    const font = options.font ?? regular
    const lineHeight = size + 4
    const lines = wrap(value, font, size, pageWidth - margin * 2)
    ensure(lines.length * lineHeight + (options.gap ?? 0))
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.12, 0.16, 0.2) })
      y -= lineHeight
    }
    y -= options.gap ?? 0
  }

  newPage()
  text("PARECER INDIVIDUAL DE AVALIAÇÃO", { size: 15, font: bold, gap: 12 })
  text(`Processo: ${data.externalNumber || `#${data.processId}`}`)
  text(`Tipo: ${data.processTypeName}${data.targetLevel ? ` - ${data.targetLevel.replace("_", " ")}` : ""}`)
  text(`Docente: ${data.teacherName}${data.teacherSiape ? ` - SIAPE ${data.teacherSiape}` : ""}`)
  text(`Campus: ${data.campus} - ${data.cityState}`)
  text(`Avaliador: ${data.evaluatorName}`)
  text(`Data do envio: ${data.submittedAt.toLocaleString("pt-BR")}`, { gap: 10 })

  text("RESULTADO", { size: 12, font: bold, gap: 3 })
  text(`${data.result}${data.recognizedPoints == null ? "" : ` - ${data.recognizedPoints.toFixed(2).replace(".", ",")} pontos`}`, { gap: 10 })

  if (data.scores.length > 0) {
    text("ITENS RECONHECIDOS", { size: 12, font: bold, gap: 4 })
    data.scores.forEach((score, index) => {
      text(`${index + 1}. ${score.description}`, { font: bold })
      text(`Quantidade reconhecida: ${score.recognizedQuantity} - Pontos: ${score.awardedPoints.toFixed(2).replace(".", ",")}`)
      if (score.evaluatorComment) text(`Observação: ${score.evaluatorComment}`)
      y -= 4
    })
    y -= 6
  }

  text("PARECER FUNDAMENTADO", { size: 12, font: bold, gap: 4 })
  text(data.opinionText)
  return Buffer.from(await pdf.save())
}
