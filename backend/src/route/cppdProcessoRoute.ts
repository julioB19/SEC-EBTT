import { Router } from "express";
import { CppdProcessoController } from "../controller/cppdProcessoController";
import { ProcessoService } from "../service/processoService";
import { ProcessRepository } from "../repository/processoRepository";
import { ScoringTableRepository } from "../repository/scoringTableRepository";
import { UserRepository } from "../repository/userRepository";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  requireCppdAccess,
  requireCppdProcessAccess,
} from "../middleware/cppdAccessMiddleware";
import {
  validatorMiddleware,
  ParamType,
} from "../middleware/validatorMiddleware";
import { documentReviewDecisionSchema } from "../validator/processEvaluationValidator";

export function cppdProcessoRoute() {
  const router = Router();

  const controller = new CppdProcessoController(
    new ProcessoService(
      new ProcessRepository(),
      new ScoringTableRepository(),
      new UserRepository(),
    ),
  );

  router.get(
    "/cppd/processos",
    authMiddleware,
    requireCppdAccess,
    controller.listar,
  );
  router.get(
    "/cppd/processos/:id",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    controller.obter,
  );
  router.post(
    "/cppd/processos/:id/analise-documental/decisao",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, documentReviewDecisionSchema),
    controller.finalizarAnaliseDocumental,
  );
  router.get(
    "/cppd/processos/:id/avaliacao/detalhes",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    controller.obterDetalhesAvaliacao,
  );

  return router;
}
