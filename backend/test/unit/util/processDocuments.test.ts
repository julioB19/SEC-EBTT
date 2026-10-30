import { describe, expect, test } from "@jest/globals"
import { PDFDocument } from "pdf-lib"
import { evidenceDossier, textDocumentPdf } from "../../../src/util/processDocuments"
describe("Documentos e dossiê",()=>{
 test("parecer longo mantém todas as linhas em páginas separadas",async()=>{
  const bytes=await textDocumentPdf("PARECER",Array.from({length:200},(_,i)=>`Parágrafo ${i}: avaliação fundamentada do processo.`))
  const pdf=await PDFDocument.load(bytes)
  expect(pdf.getPageCount()).toBeGreaterThan(4)
  expect(pdf.getPages().every(p=>p.getHeight()>800)).toBe(true)
 })
 test("dossiê inclui índice, separadores e todas as páginas dos comprovantes",async()=>{
  const proof=await textDocumentPdf("COMPROVANTE",["Conteúdo comprobatório"])
  const bytes=await evidenceDossier("RSC",[{label:"Memorial",bytes:proof},{label:"Critério 1",bytes:proof}])
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(5)
 })
})
