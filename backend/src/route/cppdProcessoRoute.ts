import { Router } from "express"
import { CppdProcessoController } from "../controller/cppdProcessoController"
import { ProcessoService } from "../service/processoService"
import { ProcessRepository } from "../repository/processoRepository"
import { ScoringTableRepository } from "../repository/scoringTableRepository"
import { UserRepository } from "../repository/userRepository"
import { authMiddleware } from "../middleware/authMiddleware"

export function cppdProcessoRoute() {
  const router = Router()

  const controller = new CppdProcessoController(
    new ProcessoService(
      new ProcessRepository(),
      new ScoringTableRepository(),
      new UserRepository()
    )
  )

  router.get("/cppd/processos", authMiddleware, controller.listar)
  router.get("/cppd/processos/:id", authMiddleware, controller.obter)
  router.get("/cppd/processos/:id/avaliacao/detalhes", authMiddleware, controller.obterDetalhesAvaliacao)

  return router
}
