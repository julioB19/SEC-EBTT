import { Router } from "express"
import { ScoringTableController } from "../controller/scoringTableController"
import { ScoringTableService } from "../service/scoringTableService"
import { ScoringTableRepository } from "../repository/scoringTableRepository"

export function scoringTableRoute() {
  const router = Router()

  const controller = new ScoringTableController(
    new ScoringTableService(new ScoringTableRepository())
  )

  router.get("/cppd/tabelas-pontuacao/vigente", controller.obterTabelaVigenteParaConsulta)

  router.get("/admin/tabelas-pontuacao", controller.listarTabelasAdmin)
  router.get("/admin/tabelas-pontuacao/:tableId", controller.obterTabelaAdmin)
  router.patch("/admin/tabelas-pontuacao/:tableId", controller.atualizarTabelaAdmin)

  router.delete("/admin/tabelas-pontuacao/:tableId", controller.excluirTabelaRascunhoAdmin)

  router.post("/admin/tabelas-pontuacao/:tableId/inativar", controller.inativarTabelaAdmin)

  router.post("/admin/tabelas-pontuacao", controller.criarTabelaPontuacao)

  router.post("/admin/tabelas-pontuacao/:tableId/blocos", controller.criarBloco)
  router.patch("/admin/tabelas-pontuacao/blocos/:nodeId/pai", controller.atualizarPaiDoBloco)
  router.post("/admin/tabelas-pontuacao/blocos/:nodeId/itens", controller.criarItem)

  router.post("/admin/tabelas-pontuacao/:tableId/bloco", controller.salvarBloco)
  router.get("/admin/tabelas-pontuacao/:tableId/estrutura", controller.obterEstruturaTabela)
  router.patch("/admin/tabelas-pontuacao/blocos/:nodeId", controller.atualizarNo)
  router.patch("/admin/tabelas-pontuacao/itens/:itemId", controller.atualizarItem)

  return router
}
