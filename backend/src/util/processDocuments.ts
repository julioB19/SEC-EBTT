import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

function printable(value: string) { return value.replace(/[^\x20-\x7e\xa0-\xff\n]/g, " ") }

export async function textDocumentPdf(title: string, paragraphs: string[]) {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  let page = document.addPage([595.28, 841.89])
  let y = 790
  const line = (text: string, heading = false) => {
    if (y < 60) { page = document.addPage([595.28, 841.89]); y = 790 }
    page.drawText(printable(text), { x: 48, y, size: heading ? 14 : 10, font: heading ? bold : font })
    y -= heading ? 24 : 15
  }
  const wrap = (value: string, heading = false) => {
    const size = heading ? 14 : 10
    const selected = heading ? bold : font
    let current = ""
    for (const word of printable(value).split(/\s+/)) {
      for (let offset = 0; offset < Math.max(word.length, 1); offset += 70) {
        const piece = word.slice(offset, offset + 70)
        if (current && selected.widthOfTextAtSize(`${current} ${piece}`, size) > 499) { line(current, heading); current = "" }
        current += `${current ? " " : ""}${piece}`
      }
    }
    if (current) line(current, heading)
  }
  wrap(title, true)
  for (const paragraph of paragraphs) { for (const part of paragraph.split(/\r?\n/)) wrap(part); y -= 9 }
  const pages = document.getPages()
  pages.forEach((sheet, index) => sheet.drawText(`${index + 1} / ${pages.length}`, { x: 500, y: 25, size: 9, font, color: rgb(.3, .3, .3) }))
  return Buffer.from(await document.save())
}

export async function evidenceDossier(title: string, entries: Array<{ label: string; bytes: Buffer }>) {
  const loaded = await Promise.all(entries.map(async entry => ({ ...entry, pdf: await PDFDocument.load(entry.bytes) })))
  let tocPages = 1
  let cover: PDFDocument
  for (;;) {
    let nextPage = tocPages + 1
    const index = loaded.map(entry => { const row = `${entry.label} - página ${nextPage}`; nextPage += 1 + entry.pdf.getPageCount(); return row })
    cover = await PDFDocument.load(await textDocumentPdf(`${title} - Índice`, index))
    if (cover.getPageCount() === tocPages) break
    tocPages = cover.getPageCount()
  }
  const result = await PDFDocument.create()
  for (const page of await result.copyPages(cover, cover.getPageIndices())) result.addPage(page)
  for (const entry of loaded) {
    const divider = await PDFDocument.load(await textDocumentPdf(entry.label, ["Documentação comprobatória", "As páginas seguintes integram este item do dossiê."]))
    for (const page of await result.copyPages(divider, divider.getPageIndices())) result.addPage(page)
    for (const page of await result.copyPages(entry.pdf, entry.pdf.getPageIndices())) result.addPage(page)
  }
  const font = await result.embedFont(StandardFonts.Helvetica)
  result.getPages().forEach((page, i, pages) => page.drawText(`Dossiê ${i + 1}/${pages.length}`, { x: Math.max(20, page.getWidth() - 120), y: 12, size: 9, font }))
  return Buffer.from(await result.save())
}
