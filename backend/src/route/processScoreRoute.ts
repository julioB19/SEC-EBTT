import { Router } from "express"
import { ProcessScoreController } from "../controller/processScoreController"
import { ProcessScoreService } from "../service/processScoreService"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { ProcessScoreRepository } from "../repository/processScoreRepository"
import { EvidenceFileRepository } from "../repository/evidenceFileRepository"
import { ProcessNodeScoreRepository } from "../repository/processNodeScoreRepository"

export function processScoreRoute() {
  const router = Router()

  const controller = new ProcessScoreController(
    new ProcessScoreService(
      new ProcessRepository(),
      new ScoringTableRepository(),
      new ProcessScoreRepository(),
      new EvidenceFileRepository(),
      new ProcessNodeScoreRepository()
    )
  )

  router.get(
    "/processos/:id/pontuacao/estrutura",
    controller.listarEstruturaPontuacao
  )

  router.get(
    "/processos/:id/pontuacao/planilha",
    controller.baixarPlanilhaPontuacao
  )

  router.get(
    "/processos/:id/pontuacao/comprovantes",
    controller.baixarComprovantesPontuacao
  )

  router.patch(
    "/processos/:id/itens/:itemId/pontuacao",
    controller.salvarPontuacaoItem
  )

  router.post(
    "/processos/:id/pontuacao/itens/:itemId/evidencias",
    controller.anexarEvidencia
  )

  router.post(
    "/processos/:id/pontuacao/itens/:itemId/evidencias/reusar",
    controller.reusarEvidencia
  )

  router.get("/evidencias/arquivos", controller.listarArquivosUsuario)

  router.get(
    "/evidencias/:evidenceFileId/conteudo",
    controller.obterConteudoEvidencia
  )

  return router
}
