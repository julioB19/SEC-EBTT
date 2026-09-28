import {
  AdminListScoringTablesQueryDto,
  CreateScoringItemDto,
  CreateScoringNodeDto,
  CreateScoringTableDto,
  SaveScoringBlockDto,
  UpdateScoringItemDto,
  UpdateScoringNodeDto,
  UpdateScoringNodeParentDto,
  UpdateScoringTableDto
} from "../type/dto/scoringTableDto"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { BusinessRuleError } from "./processoService"
import { ScoringTablePurpose } from "@prisma/client"

type ScoringTableMinimal = {
  idScoringTable: number
  status: "DRAFT" | "ACTIVE" | "INACTIVE"
  startsOn: Date | null
  endsOn: Date | null
}

function parseNullableDate(input: any): Date | null {
  if (input === null || input === undefined) return null
  const s = String(input).trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseNullablePoints(input: unknown): string | null {
  if (input === null || input === undefined || String(input).trim() === "") return null
  const value = Number(String(input).replace(",", "."))
  if (!Number.isFinite(value) || value < 0) {
    throw new BusinessRuleError("Pontuação mínima inválida.")
  }
  return value.toFixed(2)
}

export class ScoringTableService {
  constructor(private readonly repo: ScoringTableRepository) {}

  async criarTabelaPontuacao(dto: CreateScoringTableDto) {
    const startsOn = parseNullableDate(dto.startsOn)
    const endsOn = parseNullableDate(dto.endsOn)
    const purpose = dto.purpose ?? ScoringTablePurpose.PROGRESSION_PROMOTION
    const minRequiredPoints = parseNullablePoints(dto.minRequiredPoints)

    if (startsOn && endsOn && endsOn < startsOn) {
      throw new BusinessRuleError("Data final não pode ser anterior à data inicial.")
    }

    const table = await this.repo.createTable({
      name: dto.name,
      purpose,
      minRequiredPoints,
      startsOn,
      endsOn
    })

    return {
      idScoringTable: table.idScoringTable,
      name: table.name,
      purpose: table.purpose,
      minRequiredPoints: table.minRequiredPoints,
      status: table.status,
      startsOn: table.startsOn,
      endsOn: table.endsOn
    }
  }

  private ensureDraft(table: ScoringTableMinimal | null) {
    if (!table) throw new BusinessRuleError("Tabela de pontuação não encontrada.")
    if (table.status !== "DRAFT") {
      throw new BusinessRuleError("Tabela finalizada. Não é permitido alterar.")
    }
  }


  async obterTabelaVigenteParaConsulta(referenceDate?: Date) {
    const ref = referenceDate ?? new Date()
    const table = await this.repo.findVigente(ref)
    if (!table) throw new BusinessRuleError("Nenhuma tabela vigente encontrada.")

    const estrutura = await this.repo.findByIdWithStructure(table.idScoringTable)
    if (!estrutura) throw new BusinessRuleError("Tabela vigente não encontrada.")

    return estrutura
  }


  async listarTabelasAdmin(query: AdminListScoringTablesQueryDto) {
    const q = query.q ? String(query.q).trim() : null
    const status = query.status ? (String(query.status).trim().toUpperCase() as any) : null

    const startsOnFrom = parseNullableDate(query.startsOnFrom)
    const startsOnTo = parseNullableDate(query.startsOnTo)
    const endsOnFrom = parseNullableDate(query.endsOnFrom)
    const endsOnTo = parseNullableDate(query.endsOnTo)

    const rows = await this.repo.findManyAdmin({
      q: q && q.length ? q : null,
      status: status === "DRAFT" || status === "ACTIVE" || status === "INACTIVE" ? status : null,
      startsOnFrom,
      startsOnTo,
      endsOnFrom,
      endsOnTo
    })

    return rows.map(t => ({
      idScoringTable: t.idScoringTable,
      name: t.name,
      purpose: t.purpose,
      minRequiredPoints: t.minRequiredPoints,
      status: t.status,
      startsOn: t.startsOn,
      endsOn: t.endsOn,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }))
  }

  async obterTabelaAdmin(scoringTableId: number) {
    const estrutura = await this.repo.findByIdWithStructure(scoringTableId)
    if (!estrutura) throw new BusinessRuleError("Tabela de pontuação não encontrada.")
    return estrutura
  }

  async atualizarTabelaAdmin(scoringTableId: number, dto: UpdateScoringTableDto) {
    const current = await this.repo.findById(scoringTableId)
    if (!current) throw new BusinessRuleError("Tabela de pontuação não encontrada.")

    const startsOn = dto.startsOn !== undefined ? parseNullableDate(dto.startsOn) : undefined
    const endsOn = dto.endsOn !== undefined ? parseNullableDate(dto.endsOn) : undefined
    const minRequiredPoints = dto.minRequiredPoints !== undefined
      ? parseNullablePoints(dto.minRequiredPoints)
      : undefined

    const finalStarts = startsOn !== undefined ? startsOn : current.startsOn
    const finalEnds = endsOn !== undefined ? endsOn : current.endsOn

    if (finalStarts && finalEnds && finalEnds < finalStarts) {
      throw new BusinessRuleError("Data final não pode ser anterior à data inicial.")
    }

    const status =
      dto.status !== undefined
        ? (String(dto.status).trim().toUpperCase() as any)
        : undefined

    if (status !== undefined && status !== "DRAFT" && status !== "ACTIVE" && status !== "INACTIVE") {
      throw new BusinessRuleError("Status inválido.")
    }

    if (current.status === "INACTIVE" && status === "ACTIVE") {
      throw new BusinessRuleError("Tabela inativada não pode ser reativada.")
    }

    const updated = await this.repo.updateTable(scoringTableId, {
      name: dto.name !== undefined ? String(dto.name).trim() : undefined,
      purpose: dto.purpose,
      minRequiredPoints,
      startsOn,
      endsOn,
      status
    })

    return {
      idScoringTable: updated.idScoringTable,
      name: updated.name,
      purpose: updated.purpose,
      minRequiredPoints: updated.minRequiredPoints,
      status: updated.status,
      startsOn: updated.startsOn,
      endsOn: updated.endsOn,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    }
  }

  async excluirTabelaRascunhoAdmin(scoringTableId: number) {
    const table = await this.repo.findById(scoringTableId) as any
    if (!table) throw new BusinessRuleError("Tabela de pontuação não encontrada.")

    if (table.status !== "DRAFT") {
      throw new BusinessRuleError("Só é permitido excluir tabelas em rascunho.")
    }

    const linked = await this.repo.countProcessesByTableId(scoringTableId)
    if (linked > 0) {
      throw new BusinessRuleError("Não é permitido excluir: existem processos vinculados a esta tabela.")
    }

    const deleted = await this.repo.softDeleteTable(scoringTableId, new Date())

    return {
      idScoringTable: deleted.idScoringTable,
      deletedDate: deleted.deletedDate
    }
  }

  async inativarTabelaAdmin(scoringTableId: number, now: Date) {
    const table = await this.repo.findById(scoringTableId) as any
    if (!table) throw new BusinessRuleError("Tabela de pontuação não encontrada.")

    if (table.status !== "ACTIVE") {
      throw new BusinessRuleError("Só é permitido inativar tabelas ativas.")
    }

    const linked = await this.repo.countProcessesByTableId(scoringTableId)
    if (linked <= 0) {
      throw new BusinessRuleError("Não há processos vinculados. Se desejar remover, use exclusão apenas para rascunhos.")
    }

    const endsOn = table.endsOn ? new Date(table.endsOn) : null
    const needsEndsOnUpdate = !endsOn || endsOn.getTime() > now.getTime()

    const updated = await this.repo.updateTable(scoringTableId, {
      status: "INACTIVE",
      ...(needsEndsOnUpdate ? { endsOn: now } : {})
    })

    return {
      idScoringTable: updated.idScoringTable,
      status: updated.status,
      startsOn: updated.startsOn,
      endsOn: updated.endsOn
    }
  }


  async criarBloco(scoringTableId: number, dto: CreateScoringNodeDto) {
    const table = await this.repo.findById(scoringTableId) as any
    this.ensureDraft(table)

    const parentId: number | null = dto.parentId ?? null

    if (parentId) {
      const parent = await this.repo.findNodeById(parentId)
      if (!parent) {
        throw new BusinessRuleError("Bloco pai não encontrado.")
      }
      if (parent.scoringTableId !== scoringTableId) {
        throw new BusinessRuleError("Bloco pai não pertence à mesma tabela de pontuação.")
      }
    }

    if ((dto.hasFormula ?? false) && !dto.formulaExpression) {
      throw new BusinessRuleError("formulaExpression é obrigatório quando hasFormula=true.")
    }

    return this.repo.createNode({
      scoringTableId,
      name: dto.name,
      code: dto.code ?? null,
      sortOrder: dto.sortOrder ?? 0,
      parentId,
      hasFormula: dto.hasFormula ?? false,
      formulaExpression: dto.formulaExpression ?? null
    })
  }

  async atualizarPaiDoBloco(nodeId: number, dto: UpdateScoringNodeParentDto) {
    const node = await this.repo.findNodeById(nodeId)
    if (!node) throw new BusinessRuleError("Bloco não encontrado.")

    const table = await this.repo.findById(node.scoringTableId) as any
    this.ensureDraft(table)

    const parentId = dto.parentId ?? null

    if (parentId === nodeId) {
      throw new BusinessRuleError("Um bloco não pode ser pai de si mesmo.")
    }

    if (parentId) {
      const parent = await this.repo.findNodeById(parentId)
      if (!parent) throw new BusinessRuleError("Bloco pai não encontrado.")
      if (parent.scoringTableId !== node.scoringTableId) {
        throw new BusinessRuleError("Bloco pai não pertence à mesma tabela de pontuação.")
      }
    }

    return this.repo.updateNodeParent(nodeId, parentId)
  }

  async criarItem(nodeId: number, dto: CreateScoringItemDto) {
    const node = await this.repo.findNodeById(nodeId)
    if (!node) throw new BusinessRuleError("Bloco não encontrado.")

    const table = await this.repo.findById(node.scoringTableId) as any
    this.ensureDraft(table)

    if ((dto.hasMaxPoints ?? false) && (dto.maxPoints == null || dto.maxPoints === "")) {
      throw new BusinessRuleError("maxPoints é obrigatório quando hasMaxPoints=true.")
    }

    const points = String(dto.points)

    const maxPoints =
      (dto.hasMaxPoints ?? false) && dto.maxPoints != null
        ? String(dto.maxPoints)
        : null

    return this.repo.createItem({
      scoringTableId: node.scoringTableId,
      nodeId: node.idScoringNode,
      description: dto.description,
      unit: dto.unit ?? null,
      points,
      hasMaxPoints: dto.hasMaxPoints ?? false,
      maxPoints,
      formulaKey: dto.formulaKey ?? null
    })
  }

  private validateBlockGraph(dto: SaveScoringBlockDto) {
    const draftSet = new Set<string>()
    const codeSet = new Set<string>()

    for (const n of dto.nodes) {
      const draftId = n.draftId.trim()
      if (!draftId) throw new BusinessRuleError("draftId é obrigatório.")
      if (draftSet.has(draftId)) {
        throw new BusinessRuleError(`draftId duplicado no bloco: "${draftId}".`)
      }
      draftSet.add(draftId)

      const code = n.code.trim().toUpperCase()
      if (!code) throw new BusinessRuleError(`O nó "${n.name}" precisa de código.`)
      if (codeSet.has(code)) {
        throw new BusinessRuleError(`Código duplicado no bloco: "${code}".`)
      }
      codeSet.add(code)

      if ((n.hasFormula ?? false) && !String(n.formulaExpression ?? "").trim()) {
        throw new BusinessRuleError(`O nó "${n.name}" está com hasFormula=true mas sem fórmula.`)
      }
    }

    for (const n of dto.nodes) {
      const parentDraftId = String(n.parentDraftId ?? "").trim()
      if (!parentDraftId) continue

      if (!draftSet.has(parentDraftId)) {
        throw new BusinessRuleError(
          `O nó "${n.name}" referencia parentDraftId "${parentDraftId}" que não existe no bloco.`
        )
      }

      if (parentDraftId === n.draftId) {
        throw new BusinessRuleError(`O nó "${n.name}" não pode ser pai de si mesmo.`)
      }
    }

    const parentBy: Map<string, string | null> = new Map()

    for (const n of dto.nodes) {
      const parentDraftId: string = String(n.parentDraftId ?? "").trim()
      parentBy.set(n.draftId, parentDraftId ? parentDraftId : null)
    }

    for (const n of dto.nodes) {
      const seen = new Set<string>()
      let cur: string | null = n.draftId

      while (cur) {
        const parent: string | null = parentBy.get(cur) ?? null
        if (!parent) break

        if (seen.has(parent)) {
          throw new BusinessRuleError(`Ciclo detectado na hierarquia envolvendo "${n.name}".`)
        }

        seen.add(parent)
        cur = parent
      }
    }
  }

  async salvarBloco(scoringTableId: number, dto: SaveScoringBlockDto) {
    const table = await this.repo.findById(scoringTableId) as any
    this.ensureDraft(table)

    this.validateBlockGraph(dto)

    const nodesNormalized = dto.nodes.map((n, idx) => ({
      draftId: n.draftId.trim(),
      name: n.name.trim(),
      code: n.code.trim().toUpperCase(),
      parentDraftId: String(n.parentDraftId ?? "").trim()
        ? String(n.parentDraftId ?? "").trim()
        : null,
      sortOrder: n.sortOrder ?? idx + 1,
      hasFormula: n.hasFormula ?? false,
      formulaExpression: (n.hasFormula ?? false)
        ? String(n.formulaExpression ?? "").trim()
        : null,
      items: (n.items ?? []).map(i => ({
        description: i.description.trim(),
        unit: String(i.unit ?? "").trim() ? String(i.unit ?? "").trim() : null,
        points: String(i.points),
        hasMaxPoints: i.hasMaxPoints ?? false,
        maxPoints: (i.hasMaxPoints ?? false)
          ? (i.maxPoints ? String(i.maxPoints) : null)
          : null,
        formulaKey: String(i.formulaKey ?? "").trim()
          ? String(i.formulaKey ?? "").trim().toUpperCase()
          : null
      }))
    }))

    return this.repo.saveBlockTransactional({
      scoringTableId,
      nodes: nodesNormalized
    })
  }

  async obterEstruturaTabela(scoringTableId: number) {
    const estrutura = await this.repo.findByIdWithStructure(scoringTableId)
    if (!estrutura) throw new BusinessRuleError("Tabela de pontuação não encontrada.")
    return estrutura
  }

  async atualizarNo(nodeId: number, dto: UpdateScoringNodeDto) {
    const node = await this.repo.findNodeById(nodeId)
    if (!node) throw new BusinessRuleError("Bloco não encontrado.")

    const table = await this.repo.findById(node.scoringTableId) as any
    this.ensureDraft(table)

    const parentId = dto.parentId ?? undefined
    if (parentId !== undefined) {
      if (parentId === nodeId) throw new BusinessRuleError("Um bloco não pode ser pai de si mesmo.")
      if (parentId !== null) {
        const parent = await this.repo.findNodeById(parentId)
        if (!parent) throw new BusinessRuleError("Bloco pai não encontrado.")
        if (parent.scoringTableId !== node.scoringTableId) {
          throw new BusinessRuleError("Bloco pai não pertence à mesma tabela de pontuação.")
        }
      }
    }

    const hasFormula = dto.hasFormula ?? undefined
    const formulaExpression = dto.formulaExpression ?? undefined

    if (hasFormula === true && (formulaExpression === undefined || String(formulaExpression ?? "").trim() === "")) {
      throw new BusinessRuleError("formulaExpression é obrigatório quando hasFormula=true.")
    }

    return this.repo.updateNode(nodeId, {
      name: dto.name,
      code: dto.code ?? undefined,
      sortOrder: dto.sortOrder,
      parentId,
      hasFormula,
      formulaExpression
    })
  }

  async atualizarItem(itemId: number, dto: UpdateScoringItemDto) {
    const item = await this.repo.findItemById(itemId)
    if (!item) throw new BusinessRuleError("Item não encontrado.")

    const table = await this.repo.findById(item.scoringTableId) as any
    this.ensureDraft(table)

    const hasMaxPoints = dto.hasMaxPoints ?? undefined
    const maxPoints = dto.maxPoints ?? undefined

    if (hasMaxPoints === true && (maxPoints === undefined || maxPoints === null || String(maxPoints) === "")) {
      throw new BusinessRuleError("maxPoints é obrigatório quando hasMaxPoints=true.")
    }

    return this.repo.updateItem(itemId, {
      description: dto.description,
      unit: dto.unit ?? undefined,
      points: dto.points !== undefined ? String(dto.points) : undefined,
      hasMaxPoints,
      maxPoints:
        hasMaxPoints === true
          ? (maxPoints != null ? String(maxPoints) : null)
          : undefined,
      formulaKey: dto.formulaKey ?? undefined
    })
  }
}
