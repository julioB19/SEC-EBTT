import fs from "fs"
import path from "path"
import { PDFDocument } from "pdf-lib"

export async function convertImageToPdf(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const imageBytes = fs.readFileSync(inputPath)

  const pdfDoc = await PDFDocument.create()

  const ext = path.extname(inputPath).toLowerCase()

  let image
  if (ext === ".png") {
    image = await pdfDoc.embedPng(imageBytes)
  } else {
    image = await pdfDoc.embedJpg(imageBytes)
  }

  const imgWidth = image.width
  const imgHeight = image.height

  const a4Width = 595.28
  const a4Height = 841.89

  const page = pdfDoc.addPage([a4Width, a4Height])

  const scale = Math.min(a4Width / imgWidth, a4Height / imgHeight)

  const drawWidth = imgWidth * scale
  const drawHeight = imgHeight * scale

  const x = (a4Width - drawWidth) / 2
  const y = (a4Height - drawHeight) / 2

  page.drawImage(image, {
    x,
    y,
    width: drawWidth,
    height: drawHeight
  })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(outputPath, pdfBytes)
}
