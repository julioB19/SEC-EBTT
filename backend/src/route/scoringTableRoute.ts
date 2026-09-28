import { Router } from "express"
import { ScoringTableController } from "../controller/scoringTableController"
import { ScoringTableService } from "../service/scoringTableService"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { RoleName } from "@prisma/client"
import { authMiddleware } from "../middleware/authMiddleware"
import { requireCppdAccess, requireSelectedRole } from "../middleware/cppdAccessMiddleware"

export function scoringTableRoute() {
  const router = Router()

  const controller = new ScoringTableController(
    new ScoringTableService(new ScoringTableRepository())
  )

  const tableAdminAccess = requireSelectedRole(RoleName.ADMIN, RoleName.CPPD_CENTRAL)

  router.get(
    "/cppd/tabelas-pontuacao/vigente",
    authMiddleware,
    requireCppdAccess,
    controller.obterTabelaVigenteParaConsulta
  )

  router.get("/admin/tabelas-pontuacao", authMiddleware, tableAdminAccess, controller.listarTabelasAdmin)
  router.get("/admin/tabelas-pontuacao/:tableId", authMiddleware, tableAdminAccess, controller.obterTabelaAdmin)
  router.patch("/admin/tabelas-pontuacao/:tableId", authMiddleware, tableAdminAccess, controller.atualizarTabelaAdmin)

  router.delete("/admin/tabelas-pontuacao/:tableId", authMiddleware, tableAdminAccess, controller.excluirTabelaRascunhoAdmin)

  router.post("/admin/tabelas-pontuacao/:tableId/inativar", authMiddleware, tableAdminAccess, controller.inativarTabelaAdmin)

  router.post("/admin/tabelas-pontuacao", authMiddleware, tableAdminAccess, controller.criarTabelaPontuacao)

  router.post("/admin/tabelas-pontuacao/:tableId/blocos", authMiddleware, tableAdminAccess, controller.criarBloco)
  router.patch("/admin/tabelas-pontuacao/blocos/:nodeId/pai", authMiddleware, tableAdminAccess, controller.atualizarPaiDoBloco)
  router.post("/admin/tabelas-pontuacao/blocos/:nodeId/itens", authMiddleware, tableAdminAccess, controller.criarItem)

  router.post("/admin/tabelas-pontuacao/:tableId/bloco", authMiddleware, tableAdminAccess, controller.salvarBloco)
  router.get("/admin/tabelas-pontuacao/:tableId/estrutura", authMiddleware, tableAdminAccess, controller.obterEstruturaTabela)
  router.patch("/admin/tabelas-pontuacao/blocos/:nodeId", authMiddleware, tableAdminAccess, controller.atualizarNo)
  router.patch("/admin/tabelas-pontuacao/itens/:itemId", authMiddleware, tableAdminAccess, controller.atualizarItem)

  return router
}
