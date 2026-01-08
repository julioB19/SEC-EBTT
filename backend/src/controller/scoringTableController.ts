import { RequestHandler } from "express"
import { ScoringTableService } from "../service/scoringTableService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError } from "../service/processoService"
import {
  adminListScoringTablesQuerySchema,
  createScoringItemSchema,
  createScoringNodeSchema,
  createScoringTableSchema,
  saveScoringBlockSchema,
  updateScoringItemSchema,
  updateScoringNodeParentSchema,
  updateScoringNodeSchema,
  updateScoringTableSchema
} from "../validator/scoringTableValidation"

export class ScoringTableController {
  constructor(private readonly service: ScoringTableService) {}


  public obterTabelaVigenteParaConsulta: RequestHandler = async (_req, res) => {
    try {
      const result = await this.service.obterTabelaVigenteParaConsulta(new Date())
      HttpResponse.ok(res, "Tabela vigente carregada com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao obter tabela vigente:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }


  public listarTabelasAdmin: RequestHandler = async (req, res) => {
    try {
      const { error, value } = adminListScoringTablesQuerySchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Filtros inválidos.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.listarTabelasAdmin(value)
      HttpResponse.ok(res, "Tabelas carregadas com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao listar tabelas (admin):", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public obterTabelaAdmin: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const result = await this.service.obterTabelaAdmin(scoringTableId)
      HttpResponse.ok(res, "Tabela carregada com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao obter tabela (admin):", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public atualizarTabelaAdmin: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const { error, value } = updateScoringTableSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para atualização da tabela.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.atualizarTabelaAdmin(scoringTableId, value)
      HttpResponse.ok(res, "Tabela atualizada com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao atualizar tabela (admin):", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public excluirTabelaRascunhoAdmin: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const result = await this.service.excluirTabelaRascunhoAdmin(scoringTableId)
      HttpResponse.ok(res, "Tabela excluída com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao excluir tabela (admin):", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public inativarTabelaAdmin: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const result = await this.service.inativarTabelaAdmin(scoringTableId, new Date())
      HttpResponse.ok(res, "Tabela inativada com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao inativar tabela (admin):", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }


  public criarTabelaPontuacao: RequestHandler = async (req, res) => {
    try {
      const { error, value } = createScoringTableSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para cadastro da tabela de pontuação.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.criarTabelaPontuacao(value)

      HttpResponse.created(res, "Tabela de pontuação criada com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao criar tabela de pontuação:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public criarBloco: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const { error, value } = createScoringNodeSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para cadastro do bloco.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.criarBloco(scoringTableId, value)

      HttpResponse.created(res, "Bloco criado com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao criar bloco:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public salvarBloco: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const { error, value } = saveScoringBlockSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para salvar o bloco.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.salvarBloco(scoringTableId, value)

      HttpResponse.created(res, "Bloco salvo com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao salvar bloco:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public atualizarPaiDoBloco: RequestHandler = async (req, res) => {
    try {
      const nodeId = Number(req.params.nodeId)

      if (!nodeId || Number.isNaN(nodeId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "nodeId inválido.", null)
        return
      }

      const { error, value } = updateScoringNodeParentSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para atualizar o pai do bloco.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.atualizarPaiDoBloco(nodeId, value)

      HttpResponse.ok(res, "Pai do bloco atualizado com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao atualizar pai do bloco:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public criarItem: RequestHandler = async (req, res) => {
    try {
      const nodeId = Number(req.params.nodeId)

      if (!nodeId || Number.isNaN(nodeId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "nodeId inválido.", null)
        return
      }

      const { error, value } = createScoringItemSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para cadastro do item.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.criarItem(nodeId, value)

      HttpResponse.created(res, "Item criado com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao criar item:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public obterEstruturaTabela: RequestHandler = async (req, res) => {
    try {
      const scoringTableId = Number(req.params.tableId)

      if (!scoringTableId || Number.isNaN(scoringTableId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "tableId inválido.", null)
        return
      }

      const result = await this.service.obterEstruturaTabela(scoringTableId)

      HttpResponse.ok(res, "Estrutura carregada com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao obter estrutura:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public atualizarNo: RequestHandler = async (req, res) => {
    try {
      const nodeId = Number(req.params.nodeId)

      if (!nodeId || Number.isNaN(nodeId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "nodeId inválido.", null)
        return
      }

      const { error, value } = updateScoringNodeSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para atualizar o bloco.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.atualizarNo(nodeId, value)

      HttpResponse.ok(res, "Bloco atualizado com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao atualizar bloco:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public atualizarItem: RequestHandler = async (req, res) => {
    try {
      const itemId = Number(req.params.itemId)

      if (!itemId || Number.isNaN(itemId)) {
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "itemId inválido.", null)
        return
      }

      const { error, value } = updateScoringItemSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      if (error) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Dados inválidos para atualizar o item.",
          error.details.map(d => d.message)
        )
        return
      }

      const result = await this.service.atualizarItem(itemId, value)

      HttpResponse.ok(res, "Item atualizado com sucesso", result)
      return
    } catch (err) {
      console.error("Erro ao atualizar item:", err)

      if (err instanceof BusinessRuleError) {
        const details = (err as any).details ?? null
        HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, err.message, details)
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }
}
