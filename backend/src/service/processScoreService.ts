import {
  ProcessStatus,
  ProcessTypeCategory,
  Prisma,
  ProcessType,
  ScoringTablePurpose
} from "@prisma/client"
import path from "path"
import fs from "fs"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import ExcelJS from "exceljs"
import { PDFDocument } from "pdf-lib"
import { evidenceDossier } from "../util/processDocuments"
import { convertImageToPdf } from "../util/imageToPdf"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { ProcessScoreRepository } from "../repository/processScoreRepository"
import { EvidenceFileRepository } from "../repository/evidenceFileRepository"
import { ProcessNodeScoreRepository } from "../repository/processNodeScoreRepository"
import { UpdateItemScoreDto } from "../type/dto/processScoreDto"
import { BusinessRuleError, NotFoundError } from "./processoService"
import { calculateRscItemPoints, capScore } from "../util/rscScoring"
import { resolveLibreOfficeBinary } from "../util/libreOffice"

const execFileAsync = promisify(execFile)

type DecimalLike = Prisma.Decimal | string | number | null | undefined

function decimalToNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return NaN
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as any).toNumber === "function"
  ) {
    return (value as any).toNumber()
  }
  return Number(value)
}

function evaluateNodeFormula(formulaExpression: string, variables: Record<string, number>): number {
  try {
    const argNames = Object.keys(variables)
    const argValues = Object.values(variables)

    const fn = new Function(...argNames, `return ${formulaExpression};`) as (...args: number[]) => number

    const result = fn(...argValues)
    const num = Number(result)

    if (!Number.isFinite(num)) {
      throw new Error("Resultado não numérico")
    }

    return num
  } catch (err) {
    console.error("Erro ao avaliar fórmula do nó:", err)
    throw new BusinessRuleError("Fórmula de cálculo inválida para o bloco de pontuação.")
  }
}

function formatDateBR(date: Date | null | undefined) {
  if (!date) return ""
  const d = new Date(date)
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const yyyy = String(d.getUTCFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function columnNumberToName(col: number) {
  let name = ""
  let n = col

  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }

  return name || "A"
}

async function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath, { recursive: true })
  }
}

async function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
    }
  } catch {
    // A limpeza é de melhor esforço; o arquivo temporário pode já ter sido removido.
  }
}

type RepoNode = {
  idScoringNode: number
  scoringTableId: number
  name: string
  code: string | null
  parentId: number | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
  maxPoints: DecimalLike
  deletedDate: Date | null
  active: boolean
}

type RepoItem = {
  idScoringItem: number
  scoringTableId: number
  nodeId: number
  description: string
  unit: string | null
  points: DecimalLike
  hasMaxPoints: boolean
  maxPoints: DecimalLike
  active: boolean
  deletedDate: Date | null
  formulaKey: string | null
  factor: DecimalLike
  weight: DecimalLike
  maxQuantity: number | null
  table?: { purpose: ScoringTablePurpose }
}

type RepoEvidence = {
  idEvidenceFile: number
  userId: number
  originalName: string
  storedName: string
  url: string
  mimeType: string | null
  sizeBytes: bigint | null
  uploadedAt: Date
  deletedDate: Date | null
}

type RepoScore = {
  idProcessScore: number
  processId: number
  itemId: number
  quantity: number
  awardedPoints: DecimalLike
  evidenceFileId: number | null
  evidenceFile?: RepoEvidence | null
}

type RepoNodeScore = {
  nodeId: number
  totalPoints: DecimalLike
}

export class ProcessScoreService {
  constructor(
    private readonly processRepo: ProcessRepository,
    private readonly tableRepo: ScoringTableRepository,
    private readonly scoreRepo: ProcessScoreRepository,
    private readonly evidenceFileRepo: EvidenceFileRepository,
    private readonly nodeScoreRepo: ProcessNodeScoreRepository
  ) {}

  private requireScoringTableId(process: { scoringTableId: number | null }) {
    if (!process.scoringTableId) {
      throw new BusinessRuleError("Este tipo de processo não utiliza tabela de pontuação.")
    }
    return process.scoringTableId
  }

  async listarEstruturaPontuacao(processId: number, userId: number) {
    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    const tableId = this.requireScoringTableId(process)

    const [nodes, items, scores, nodeScores] = await Promise.all([
      this.tableRepo.findNodesByTableId(tableId) as Promise<RepoNode[]>,
      this.tableRepo.findItemsByTableId(tableId) as Promise<RepoItem[]>,
      this.scoreRepo.listByProcess(processId) as Promise<RepoScore[]>,
      this.nodeScoreRepo.listByProcess(processId) as Promise<RepoNodeScore[]>
    ])

    const scoreByItemId = new Map<number, RepoScore>()
    for (const score of scores) {
      scoreByItemId.set(score.itemId, score)
    }

    const nodeScoreByNodeId = new Map<number, RepoNodeScore>()
    for (const ns of nodeScores) {
      nodeScoreByNodeId.set(ns.nodeId, ns)
    }

    const itemsByNodeId = new Map<number, Array<Record<string, unknown>>>()

    for (const item of items) {
      const nodeId = item.nodeId
      const existing = itemsByNodeId.get(nodeId) ?? []

      const score = scoreByItemId.get(item.idScoringItem)

      const evidences =
        score?.evidenceFile
          ? [{
              evidenceFileId: score.evidenceFile.idEvidenceFile,
              originalName: score.evidenceFile.originalName,
              url: score.evidenceFile.url,
              mimeType: score.evidenceFile.mimeType,
              sizeBytes: score.evidenceFile.sizeBytes != null ? Number(score.evidenceFile.sizeBytes) : null
            }]
          : []

      existing.push({
        itemId: item.idScoringItem,
        description: item.description,
        unit: item.unit,
        points: item.points,
        hasMaxPoints: item.hasMaxPoints,
        maxPoints: item.maxPoints,
        active: item.active,
        formulaKey: item.formulaKey,
        factor: item.factor,
        weight: item.weight,
        maxQuantity: item.maxQuantity,
        currentScore: score
          ? {
              processScoreId: score.idProcessScore,
              quantity: score.quantity,
              awardedPoints: score.awardedPoints,
              evidences
            }
          : null
      })

      itemsByNodeId.set(nodeId, existing)
    }

    const blocks = nodes.map(node => {
      const nodeScore = nodeScoreByNodeId.get(node.idScoringNode)

      return {
        nodeId: node.idScoringNode,
        name: node.name,
        code: node.code,
        parentId: node.parentId,
        sortOrder: node.sortOrder,
        hasFormula: node.hasFormula,
        formulaExpression: node.formulaExpression,
        maxPoints: node.maxPoints,
        totalPoints: nodeScore ? decimalToNumber(nodeScore.totalPoints) : null,
        items: itemsByNodeId.get(node.idScoringNode) ?? []
      }
    })

    return {
      processId: process.idProcess,
      scoringTableId: tableId,
      type: process.type,
      processTypeCategory: process.processTypeConfig?.category ?? null,
      status: process.status,
      blocks
    }
  }

  async gerarPlanilhaPontuacao(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findByIdForScoreSpreadsheet(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    const scoringTableId = this.requireScoringTableId(careerProcess)

    const [scores, items] = await Promise.all([
      this.scoreRepo.listByProcess(processId) as Promise<RepoScore[]>,
      this.tableRepo.findItemsByTableId(scoringTableId) as Promise<RepoItem[]>
    ])

    const quantityByItemId = new Map<number, number>()

    for (const score of scores) {
      const itemId = Number(score.itemId)
      const quantity = Number(score.quantity ?? 0)

      if (!itemId || Number.isNaN(itemId)) continue

      quantityByItemId.set(
        itemId,
        Number.isNaN(quantity) ? 0 : quantity
      )
    }

    if (careerProcess.table?.purpose === ScoringTablePurpose.RSC) {
      return this.gerarPlanilhaRsc(careerProcess, items, scores)
    }
    const envPath = process.env.SCORE_SPREADSHEET_TEMPLATE_PATH

    const candidatePaths = [
      envPath ? path.resolve(envPath) : null,
      path.resolve(process.cwd(), "templates", "planilha-pontuacao.xlsx"),
      path.resolve(process.cwd(), "src", "templates", "planilha-pontuacao.xlsx")
    ].filter((p): p is string => Boolean(p))

    const templatePath = candidatePaths.find(p => fs.existsSync(p))

    if (!templatePath) {
      throw new BusinessRuleError(
        "Template de planilha de pontuação não encontrado no servidor. Coloque o arquivo em /templates/planilha-pontuacao.xlsx ou defina SCORE_SPREADSHEET_TEMPLATE_PATH apontando para o arquivo."
      )
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(templatePath)

    const templateItemIds = this.extrairItemIdsDoTemplate(workbook)
    const missingItems = items.filter(item => !templateItemIds.has(item.idScoringItem))

    if (missingItems.length > 0) return this.gerarPlanilhaAtual(careerProcess, items, scores)

    const tags = this.montarTagsIdentificacao(careerProcess)
    this.preencherTagsIdentificacaoNaPlanilha(workbook, tags)

    this.preencherQuantidadesNaPlanilha(workbook, quantityByItemId)

    workbook.calcProperties.fullCalcOnLoad = true

    this.configurarImpressaoA4UmaFolhaPorAba(workbook)

    const out = await workbook.xlsx.writeBuffer()
    const xlsxBuffer = Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)

    const pdfBuffer = await this.converterXlsxBufferParaPdfBuffer(xlsxBuffer, `pontuacao_processo_${processId}`)

    return {
      fileName: `pontuacao_processo_${processId}.pdf`,
      fileBuffer: pdfBuffer
    }
  }

  private async gerarPlanilhaRsc(careerProcess: any, items: RepoItem[], scores: RepoScore[]) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path.resolve(process.cwd(), "..", "Documentacao", "reference", "rsc", "formulario-oficial-avaliacao-rsc-iffar-2025.xlsx"))
    const quantities = new Map(scores.map(score => [score.itemId, score]))
    const byCode = new Map(items.map(item => [Number(item.formulaKey?.replace("RSC_", "")), item]))
    for (const sheet of workbook.worksheets) {
      if (!/^RSC (I|II|III)$/.test(sheet.name) && sheet.name !== "Dados Pessoais") { workbook.removeWorksheet(sheet.id); continue }
      if (sheet.name === "Dados Pessoais") {
        sheet.getCell("B2").value = careerProcess.externalNumber || String(careerProcess.idProcess)
        sheet.getCell("B3").value = careerProcess.user.name
        sheet.getCell("B4").value = careerProcess.user.docente?.siape ?? ""
        sheet.getCell("B5").value = careerProcess.rscDetail?.targetLevel?.replace(/_/g, " ") ?? ""
        sheet.getCell("B8").value = careerProcess.campus
      } else {
        sheet.eachRow(row => {
          const code = Number(row.getCell(1).value)
          const item = byCode.get(code)
          if (!item) return
          const score = quantities.get(item.idScoringItem)
          row.getCell(7).value = score?.quantity ?? 0
          row.getCell(8).value = { formula: `ROUND(G${row.number}*C${row.number}*F${row.number},0)`, result: Number(score?.awardedPoints ?? 0) }
        })
      }
    }
    workbook.calcProperties.fullCalcOnLoad = true
    const raw = await workbook.xlsx.writeBuffer()
    return { fileName: `pontuacao_rsc_${careerProcess.idProcess}.pdf`, fileBuffer: await this.converterXlsxBufferParaPdfBuffer(Buffer.from(raw), `rsc_${careerProcess.idProcess}`) }
  }

  private async gerarPlanilhaAtual(careerProcess: any, items: RepoItem[], scores: RepoScore[]) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Avaliação de desempenho")
    sheet.columns = [{ header: "Critério", key: "code", width: 14 }, { header: "Descrição", key: "description", width: 65 }, { header: "Unidade", key: "unit", width: 15 }, { header: "Pontos", key: "points", width: 12 }, { header: "Quantidade", key: "quantity", width: 12 }, { header: "Pontuação", key: "score", width: 14 }]
    const byId = new Map(scores.map(score => [score.itemId, score]))
    for (const item of items) { const score = byId.get(item.idScoringItem); sheet.addRow({ code: item.formulaKey || item.idScoringItem, description: item.description, unit: item.unit, points: Number(item.points), quantity: score?.quantity ?? 0, score: Number(score?.awardedPoints ?? 0) }) }
    sheet.eachRow(row => { row.alignment = { wrapText: true, vertical: "middle" }; row.height = 42 })
    sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" }
    sheet.headerFooter.oddHeader = `${careerProcess.user.name} - ${careerProcess.table.name}`
    sheet.headerFooter.oddFooter = "Página &P de &N"
    const raw = await workbook.xlsx.writeBuffer()
    return { fileName: `pontuacao_${careerProcess.idProcess}.pdf`, fileBuffer: await this.converterXlsxBufferParaPdfBuffer(Buffer.from(raw), `pontuacao_${careerProcess.idProcess}`) }
  }

  async gerarPdfComprovantesPontuacao(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findByIdForScoreSpreadsheet(processId)
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    const scoringTableId = this.requireScoringTableId(careerProcess)

    const [nodes, items, scores] = await Promise.all([
      this.tableRepo.findNodesByTableId(scoringTableId) as Promise<RepoNode[]>,
      this.tableRepo.findItemsByTableId(scoringTableId) as Promise<RepoItem[]>,
      this.scoreRepo.listByProcess(processId) as Promise<RepoScore[]>
    ])

    // A ordem e os IDs devem vir da tabela vinculada ao processo. Os IDs gravados
    // no template podem ficar desatualizados quando uma tabela é recriada/clonada.
    const itemsByNodeId = new Map<number, RepoItem[]>()
    for (const item of items) {
      const nodeItems = itemsByNodeId.get(item.nodeId) ?? []
      nodeItems.push(item)
      itemsByNodeId.set(item.nodeId, nodeItems)
    }

    const orderedItemIds = nodes.flatMap(node =>
      (itemsByNodeId.get(node.idScoringNode) ?? []).map(item => item.idScoringItem)
    )

    const scoreByItemId = new Map<number, RepoScore>()
    for (const s of scores) {
      scoreByItemId.set(Number(s.itemId), s)
    }

    const pdfBuffers: Buffer[] = []
    const entries: Array<{ label: string; bytes: Buffer }> = []
    const report = careerProcess.rscDetail?.reportFile
    if (report && !report.deletedDate) {
      const reportPath = path.resolve(process.cwd(), "uploads", report.url.replace(/^\/uploads\//, ""))
      if (!reportPath.startsWith(path.resolve(process.cwd(), "uploads") + path.sep)) throw new BusinessRuleError("Caminho inválido do memorial")
      entries.push({ label: "Memorial docente", bytes: await fs.promises.readFile(reportPath) })
    }

    for (const itemId of orderedItemIds) {
      const score = scoreByItemId.get(itemId)
      const evidence = score?.evidenceFile

      if (!evidence || evidence.deletedDate) continue
      if (!evidence.url || !evidence.url.startsWith("/uploads/")) continue

      const uploadsRoot = path.join(process.cwd(), "uploads")
      const relativePath = evidence.url.replace("/uploads/", "")
      const filePath = path.join(uploadsRoot, relativePath)

      if (!fs.existsSync(filePath)) throw new BusinessRuleError("Um comprovante vinculado não foi localizado; o dossiê não pode ser gerado incompleto")

      const buf = await fs.promises.readFile(filePath)
      pdfBuffers.push(buf)
      const item = items.find(value => value.idScoringItem === itemId)
      entries.push({ label: `${item?.formulaKey || itemId} - ${item?.description || "Comprovante"}`, bytes: buf })
    }

    if (pdfBuffers.length === 0) {
      throw new BusinessRuleError(
        "Não há comprovantes vinculados aos itens desta planilha para gerar o PDF único."
      )
    }

    const merged = await evidenceDossier(`Processo ${processId}`, entries)

    return {
      fileName: `comprovantes_pontuacao_processo_${processId}.pdf`,
      fileBuffer: merged
    }
  }

  private async mergePdfBuffers(buffers: Buffer[]) {
    const mergedPdf = await PDFDocument.create()

    for (const buf of buffers) {
      const doc = await PDFDocument.load(buf)
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
      for (const p of pages) {
        mergedPdf.addPage(p)
      }
    }

    const bytes = await mergedPdf.save()
    return Buffer.from(bytes)
  }

  private montarTagsIdentificacao(careerProcess: any) {
    const user = careerProcess.user
    const docente = careerProcess.user?.docente

    const nomeCompleto = user?.name ?? ""
    const siape = docente?.siape ?? ""
    const nivelCapacitacao = docente?.classLevel ?? ""

    const escolaridade = docente?.educationLevel ?? ""
    const aperfeicoamento = docente?.improvement ?? ""
    const especializacao = docente?.specialization ?? ""
    const mestrado = docente?.mastersDegree ?? ""
    const doutorado = docente?.doctorate ?? ""

    const lotacao = docente?.assignment ?? ""
    const diretoria = docente?.division ?? ""
    const coordenadorSetor = docente?.department ?? ""
    const cargoFuncao = docente?.role ?? ""
    const chefiaImediata = docente?.immediate_supervisor ?? ""

    const periodoAvaliado = `${formatDateBR(careerProcess.intersticeStart)} a ${formatDateBR(careerProcess.intersticeEnd)}`

    const dataProgressao =
      careerProcess.type === ProcessType.PROGRESSAO
        ? formatDateBR(careerProcess.intersticeEnd)
        : ""

    return new Map<string, string>([
      ["NOME_COMPLETO", String(nomeCompleto)],
      ["SIAPE", String(siape)],
      ["NIVEL_CAPACITACAO", String(nivelCapacitacao)],
      ["DATA_PROGRESSAO", String(dataProgressao)],
      ["ESCOLARIDADE", String(escolaridade)],
      ["APERFEICOAMENTO", String(aperfeicoamento)],
      ["ESPECIALIZACAO", String(especializacao)],
      ["MESTRADO", String(mestrado)],
      ["DOUTORADO", String(doutorado)],
      ["LOTACAO", String(lotacao)],
      ["DIRETORIA", String(diretoria)],
      ["COORDENADOR_SETOR", String(coordenadorSetor)],
      ["CARGO_FUNCAO", String(cargoFuncao)],
      ["CHEFIA_IMEDIATA", String(chefiaImediata)],
      ["PERIODO_AVALIADO", String(periodoAvaliado)]
    ])
  }

  private preencherTagsIdentificacaoNaPlanilha(workbook: ExcelJS.Workbook, tags: Map<string, string>) {
    const tagRegex = /\[\[([A-Z0-9_]+)\]\]/g

    for (const worksheet of workbook.worksheets) {
      worksheet.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, cell => {
          const raw = cell.value
          const formulaResult =
            typeof raw === "object" && raw !== null && "formula" in raw && "result" in raw
              ? (raw as ExcelJS.CellFormulaValue).result
              : undefined

          const text = typeof raw === "string"
            ? raw
            : typeof formulaResult === "string"
              ? formulaResult
              : null

          if (text === null || !text.includes("[[")) return

          const replaced = text.replace(tagRegex, (_m, key: string) => {
            if (key.startsWith("ID")) return `[[${key}]]`

            const value = tags.get(key)
            if (value === undefined) return `[[${key}]]`
            return value
          })

          if (replaced === text) return

          if (typeof raw === "string") {
            cell.value = replaced
          } else {
            // Mantém a fórmula da aba Resumo e atualiza o resultado em cache.
            // O LibreOffice usa esse resultado na conversão quando a referência
            // textual ainda não foi recalculada.
            cell.value = {
              ...(raw as ExcelJS.CellFormulaValue),
              result: replaced
            }
          }
        })
      })
    }
  }

  private extrairItemIdsDoTemplate(workbook: ExcelJS.Workbook) {
    const placeholderRegex = /\[\[ID(\d+)\]\]/g
    const itemIds = new Set<number>()

    for (const worksheet of workbook.worksheets) {
      worksheet.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, cell => {
          const raw = cell.value
          if (typeof raw !== "string" || !raw.includes("[[ID")) return

          for (const match of raw.matchAll(placeholderRegex)) {
            const itemId = Number(match[1])
            if (Number.isInteger(itemId) && itemId > 0) itemIds.add(itemId)
          }
        })
      })
    }

    return itemIds
  }

  private preencherQuantidadesNaPlanilha(workbook: ExcelJS.Workbook, quantityByItemId: Map<number, number>) {
    const placeholderRegex = /\[\[ID(\d+)\]\]/g

    for (const worksheet of workbook.worksheets) {
      worksheet.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, cell => {
          const raw = cell.value

          if (typeof raw !== "string") return
          if (!raw.includes("[[ID")) return

          const onlyOne = raw.match(/^\[\[ID(\d+)\]\]$/)
          if (onlyOne) {
            const itemId = Number(onlyOne[1])
            const qty = quantityByItemId.get(itemId) ?? 0
            cell.value = qty
            return
          }

          const replaced = raw.replace(placeholderRegex, (_m, itemIdStr: string) => {
            const itemId = Number(itemIdStr)
            const qty = quantityByItemId.get(itemId) ?? 0
            return String(qty)
          })

          cell.value = replaced
        })
      })
    }
  }

  private getUsedRange(worksheet: ExcelJS.Worksheet) {
    let lastRow = 0
    let lastCol = 0

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      let rowHasSomething = false

      row.eachCell({ includeEmpty: false }, cell => {
        const v: any = cell.value
        const hasValue =
          v !== null &&
          v !== undefined &&
          !(typeof v === "string" && v.trim() === "")

        const hasFormula = typeof v === "object" && v && "formula" in v && Boolean((v as any).formula)

        if (hasValue || hasFormula) {
          rowHasSomething = true

          const colNumber = typeof cell.col === "number" ? cell.col : Number(cell.col)

          if (!Number.isNaN(colNumber) && colNumber > lastCol) lastCol = colNumber
        }
      })

      if (rowHasSomething) {
        if (rowNumber > lastRow) lastRow = rowNumber
      }
    })

    if (lastRow === 0) lastRow = 1
    if (lastCol === 0) lastCol = 1

    return { lastRow, lastCol }
  }

  private configurarImpressaoA4UmaFolhaPorAba(workbook: ExcelJS.Workbook) {
    for (const worksheet of workbook.worksheets) {
      const { lastRow, lastCol } = this.getUsedRange(worksheet)

      const orientation: "portrait" | "landscape" = lastCol > 8 ? "landscape" : "portrait"

      worksheet.pageSetup = {
        paperSize: 9,
        orientation,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: false,
        verticalCentered: false,
        showGridLines: false
      }

      worksheet.pageSetup.margins = {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      }

      const lastColName = columnNumberToName(lastCol)
      worksheet.pageSetup.printArea = `A1:${lastColName}${lastRow}`
    }
  }

  private async converterXlsxBufferParaPdfBuffer(xlsxBuffer: Buffer, baseName: string) {
    const sofficeBin = resolveLibreOfficeBinary()

    const tmpRoot = path.join(os.tmpdir(), "sec-ebtt-score-spreadsheets")
    await ensureDir(tmpRoot)

    const safeBase = baseName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const inputPath = path.join(tmpRoot, `${safeBase}_${Date.now()}.xlsx`)
    const outDir = tmpRoot

    const expectedPdf = path.join(outDir, `${path.basename(inputPath, ".xlsx")}.pdf`)

    await fs.promises.writeFile(inputPath, xlsxBuffer)

    try {
      await execFileAsync(sofficeBin, [
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        inputPath
      ])

      if (!fs.existsSync(expectedPdf)) {
        throw new Error("PDF não gerado pelo LibreOffice")
      }

      const pdfBuffer = await fs.promises.readFile(expectedPdf)
      return pdfBuffer
    } catch (err) {
      console.error("Erro ao converter XLSX para PDF:", err)

      throw new BusinessRuleError(
        "Falha ao converter a planilha para PDF. Verifique se o LibreOffice está instalado e acessível (PATH) ou configure LIBREOFFICE_BIN."
      )
    } finally {
      await safeUnlink(inputPath)
      await safeUnlink(expectedPdf)
    }
  }

  async salvarPontuacaoItem(processId: number, userId: number, itemId: number, dto: UpdateItemScoreDto) {
    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      process.status !== ProcessStatus.DRAFT &&
      process.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Só é permitido alterar pontuações de processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const item = await this.tableRepo.findItemById(itemId) as RepoItem | null
    if (!item || item.deletedDate || !item.active) {
      throw new NotFoundError("Item de pontuação não encontrado")
    }

    if (item.scoringTableId !== process.scoringTableId) {
      throw new BusinessRuleError("Item de pontuação não pertence à tabela vinculada a este processo.")
    }

    const existingScore = await this.scoreRepo.findByProcessAndItem(processId, itemId) as RepoScore | null

    const rawQuantity = dto.quantity ?? 0
    let finalQuantity = rawQuantity
    let finalPointsNumber = 0

    const isRscItem = item.table?.purpose === ScoringTablePurpose.RSC

    if (isRscItem) {
      const quantityNumber = Number(rawQuantity)
      try {
        finalPointsNumber = calculateRscItemPoints({
          quantity: quantityNumber,
          basePoints: decimalToNumber(item.points),
          factor: decimalToNumber(item.factor),
          weight: decimalToNumber(item.weight),
          maxQuantity: item.maxQuantity
        })
      } catch (error) {
        throw new BusinessRuleError(
          error instanceof Error ? error.message : "Pontuação RSC inválida"
        )
      }
      finalQuantity = quantityNumber
    } else if (!item.hasMaxPoints) {
      const quantityNumber = Number(rawQuantity)

      if (Number.isNaN(quantityNumber) || quantityNumber < 0) {
        throw new BusinessRuleError("A quantidade deve ser um número maior ou igual a zero.")
      }

      const basePoints = decimalToNumber(item.points)
      if (Number.isNaN(basePoints)) {
        throw new BusinessRuleError("Configuração de pontos inválida para este item.")
      }

      finalQuantity = quantityNumber
      finalPointsNumber = quantityNumber * basePoints
    } else {
      if (dto.awardedPoints === undefined || dto.awardedPoints === null || dto.awardedPoints === "") {
        throw new BusinessRuleError("Informe a pontuação para este item (até o máximo permitido).")
      }

      const requested = Number(dto.awardedPoints)
      if (Number.isNaN(requested) || requested < 0) {
        throw new BusinessRuleError("A pontuação deve ser um número maior ou igual a zero.")
      }

      let maxAllowed = NaN
      if (item.maxPoints != null) {
        maxAllowed = decimalToNumber(item.maxPoints)
      } else {
        maxAllowed = decimalToNumber(item.points)
      }

      if (!Number.isNaN(maxAllowed) && requested > maxAllowed) {
        throw new BusinessRuleError(
          `Pontuação informada (${requested}) excede o máximo permitido (${maxAllowed}) para este item.`
        )
      }

      finalQuantity = rawQuantity ?? 0
      finalPointsNumber = requested
    }

    const awardedPoints = finalPointsNumber.toFixed(2)

    const hadEvidenceBefore = existingScore?.evidenceFileId != null
    const isNonZeroScore = finalPointsNumber > 0

    if (isNonZeroScore && !hadEvidenceBefore) {
      throw new BusinessRuleError(
        "Não é permitido lançar pontuação neste item sem anexar pelo menos um documento de comprovação."
      )
    }

    const score = await this.scoreRepo.upsertScore(
      processId,
      itemId,
      finalQuantity,
      awardedPoints,
      existingScore?.evidenceFileId ?? null
    )

    await this.recalcularPontuacoesDaTabela(processId)

    return {
      processScoreId: score.idProcessScore,
      itemId: score.itemId,
      quantity: score.quantity,
      awardedPoints: decimalToNumber(score.awardedPoints),
      evidence:
        score.evidenceFile
          ? {
              evidenceFileId: score.evidenceFile.idEvidenceFile,
              originalName: score.evidenceFile.originalName,
              url: score.evidenceFile.url,
              mimeType: score.evidenceFile.mimeType,
              sizeBytes: score.evidenceFile.sizeBytes != null ? Number(score.evidenceFile.sizeBytes) : null
            }
          : null
    }
  }

  private async recalcularPontuacoesDaTabela(processId: number) {
    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    const tableId = this.requireScoringTableId(process)

    const [nodes, items, scores] = await Promise.all([
      this.tableRepo.findNodesByTableId(tableId) as Promise<RepoNode[]>,
      this.tableRepo.findItemsByTableId(tableId) as Promise<RepoItem[]>,
      this.scoreRepo.listByProcess(processId) as Promise<RepoScore[]>
    ])

    const nodeById = new Map<number, RepoNode>()
    const childrenByParentId = new Map<number | null, number[]>()
    const itemsByNodeId = new Map<number, RepoItem[]>()
    const scoreByItemId = new Map<number, RepoScore>()

    for (const node of nodes) {
      nodeById.set(node.idScoringNode, node)

      const parentId = node.parentId ?? null
      const list = childrenByParentId.get(parentId) ?? []
      list.push(node.idScoringNode)
      childrenByParentId.set(parentId, list)
    }

    for (const item of items) {
      const list = itemsByNodeId.get(item.nodeId) ?? []
      list.push(item)
      itemsByNodeId.set(item.nodeId, list)
    }

    for (const score of scores) {
      scoreByItemId.set(score.itemId, score)
    }

    const totalByNodeId = new Map<number, number>()

    const computeTotalForNode = (nodeId: number): number => {
      const memo = totalByNodeId.get(nodeId)
      if (memo != null) return memo

      const node = nodeById.get(nodeId)
      if (!node) {
        totalByNodeId.set(nodeId, 0)
        return 0
      }

      const nodeItems = itemsByNodeId.get(nodeId) ?? []

      let baseSum = 0
      for (const item of nodeItems) {
        const score = scoreByItemId.get(item.idScoringItem)
        if (!score) continue

        const pts = decimalToNumber(score.awardedPoints)
        if (!Number.isNaN(pts)) baseSum += pts
      }

      let ownTotal = baseSum

      if (node.hasFormula && node.formulaExpression) {
        const vars: Record<string, number> = {}

        for (const item of nodeItems) {
          if (!item.formulaKey) continue

          const score = scoreByItemId.get(item.idScoringItem)
          const rawQuantity = score ? score.quantity : 0
          const q = decimalToNumber(rawQuantity)

          vars[item.formulaKey] = Number.isNaN(q) ? 0 : q
        }

        ownTotal = Object.keys(vars).length === 0 ? 0 : evaluateNodeFormula(node.formulaExpression, vars)
      }

      const childrenIds = childrenByParentId.get(nodeId) ?? []
      let childrenTotal = 0
      for (const childId of childrenIds) {
        childrenTotal += computeTotalForNode(childId)
      }

      const maxPoints = decimalToNumber(node.maxPoints)
      const total = capScore(
        ownTotal + childrenTotal,
        Number.isNaN(maxPoints) ? null : maxPoints
      )
      totalByNodeId.set(nodeId, total)
      return total
    }

    for (const node of nodes) {
      computeTotalForNode(node.idScoringNode)
    }

    await Promise.all(
      nodes.map(node => {
        const total = totalByNodeId.get(node.idScoringNode) ?? 0
        return this.nodeScoreRepo.upsertNodeScore(processId, node.idScoringNode, total.toFixed(2))
      })
    )
  }

  async anexarEvidencia(params: {
    processId: number
    userId: number
    itemId: number
    originalName: string
    storedName: string
    filePath: string
    webBasePath: string
    mimeType?: string | null
    sizeBytes?: number | null
  }) {
    const { processId, userId, itemId } = params

    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      process.status !== ProcessStatus.DRAFT &&
      process.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Só é permitido anexar comprovações em processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const item = await this.tableRepo.findItemById(itemId) as RepoItem | null
    if (!item || item.deletedDate || !item.active) {
      throw new NotFoundError("Item de pontuação não encontrado")
    }

    if (item.scoringTableId !== process.scoringTableId) {
      throw new BusinessRuleError("Item de pontuação não pertence à tabela vinculada a este processo.")
    }

    if (
      process.processTypeConfig?.category === ProcessTypeCategory.RSC &&
      params.mimeType !== "application/pdf"
    ) {
      await safeUnlink(params.filePath)
      throw new BusinessRuleError("Os comprovantes do RSC devem ser enviados em arquivo PDF.")
    }

    let score = await this.scoreRepo.findByProcessAndItem(processId, itemId) as RepoScore | null

    if (!score) {
      score = await this.scoreRepo.upsertScore(processId, itemId, 0, "0.00", null)
    }

    const isImage = params.mimeType?.startsWith("image/") ?? false

    let finalStoredName = params.storedName
    let finalMimeType = params.mimeType ?? null
    let finalSizeBytes = params.sizeBytes ?? null
    let finalUrl: string

    if (isImage) {
      const dir = path.dirname(params.filePath)
      const base = path.basename(params.storedName, path.extname(params.storedName))
      const pdfName = `${base}.pdf`
      const pdfPath = path.join(dir, pdfName)

      await convertImageToPdf(params.filePath, pdfPath)

      const stat = fs.statSync(pdfPath)

      try {
        fs.unlinkSync(params.filePath)
      } catch (e) {
        console.warn("Falha ao remover imagem original:", e)
      }

      finalStoredName = pdfName
      finalMimeType = "application/pdf"
      finalSizeBytes = stat.size
      finalUrl = `${params.webBasePath}/${pdfName}`
    } else {
      finalUrl = `${params.webBasePath}/${params.storedName}`
    }

    const file = await this.evidenceFileRepo.create({
      userId,
      originalName: params.originalName,
      storedName: finalStoredName,
      url: finalUrl,
      mimeType: finalMimeType,
      sizeBytes: finalSizeBytes ?? undefined
    })

    const updatedScore = await this.scoreRepo.updateEvidence(processId, itemId, file.idEvidenceFile)

    return {
      processScoreId: updatedScore.idProcessScore,
      itemId: updatedScore.itemId,
      evidence: {
        evidenceFileId: file.idEvidenceFile,
        originalName: file.originalName,
        url: file.url,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null
      }
    }
  }

  async vincularEvidenciaExistente(params: {
    processId: number
    userId: number
    itemId: number
    evidenceFileId: number
  }) {
    const { processId, userId, itemId, evidenceFileId } = params

    const process = await this.processRepo.findById(processId)
    if (!process || process.deletedDate) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (process.userId !== userId) {
      throw new NotFoundError("Processo não encontrado")
    }

    if (
      process.status !== ProcessStatus.DRAFT &&
      process.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Só é permitido vincular comprovações em processos nos status DRAFT, RETURNED ou REJECTED."
      )
    }

    const file = await this.evidenceFileRepo.findById(evidenceFileId) as RepoEvidence | null
    if (!file || file.deletedDate) {
      throw new NotFoundError("Arquivo de evidência não encontrado")
    }

    if (
      process.processTypeConfig?.category === ProcessTypeCategory.RSC &&
      file.mimeType !== "application/pdf"
    ) {
      throw new BusinessRuleError("Somente comprovantes em PDF podem ser reutilizados no RSC.")
    }

    if (file.userId !== userId) {
      throw new BusinessRuleError("Você não tem permissão para usar este arquivo")
    }

    const item = await this.tableRepo.findItemById(itemId) as RepoItem | null
    if (!item || item.deletedDate || !item.active) {
      throw new NotFoundError("Item de pontuação não encontrado")
    }

    if (item.scoringTableId !== process.scoringTableId) {
      throw new BusinessRuleError("Item de pontuação não pertence à tabela vinculada a este processo.")
    }

    let score = await this.scoreRepo.findByProcessAndItem(processId, itemId) as RepoScore | null

    if (!score) {
      score = await this.scoreRepo.upsertScore(processId, itemId, 0, "0.00", evidenceFileId)
    } else {
      score = await this.scoreRepo.updateEvidence(processId, itemId, evidenceFileId)
    }

    return {
      processScoreId: score.idProcessScore,
      itemId: score.itemId,
      evidence: {
        evidenceFileId: file.idEvidenceFile,
        originalName: file.originalName,
        url: file.url,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null
      }
    }
  }

  async listarArquivosDoUsuario(userId: number) {
    const files = await this.evidenceFileRepo.listByUser(userId) as RepoEvidence[]

    return files.map(file => ({
      evidenceFileId: file.idEvidenceFile,
      originalName: file.originalName,
      url: file.url,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes != null ? Number(file.sizeBytes) : null,
      uploadedAt: file.uploadedAt
    }))
  }

  async obterEvidenciaConteudo(evidenceFileId: number, userId: number) {
    const file = await this.evidenceFileRepo.findById(evidenceFileId) as RepoEvidence | null

    if (!file || file.deletedDate) {
      throw new NotFoundError("Arquivo de evidência não encontrado")
    }

    if (file.userId !== userId) {
      throw new BusinessRuleError("Você não tem permissão para acessar este arquivo de evidência.")
    }

    if (!file.url || !file.url.startsWith("/uploads/")) {
      throw new BusinessRuleError("Caminho do arquivo de evidência inválido.")
    }

    const uploadsRoot = path.join(process.cwd(), "uploads")
    const relativePath = file.url.replace("/uploads/", "")
    const filePath = path.join(uploadsRoot, relativePath)

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("Arquivo de evidência não encontrado no servidor.")
    }

    return {
      filePath,
      originalName: file.originalName,
      mimeType: file.mimeType ?? "application/pdf"
    }
  }
}
