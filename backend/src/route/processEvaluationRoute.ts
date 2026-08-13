import { Router } from "express"
import { ProcessEvaluationController } from "../controller/processEvaluationController"
import { ProcessEvaluationService } from "../service/processEvaluationService"
import { ProcessEvaluationRepository } from "../repository/processEvaluationRepository"
import { authMiddleware } from "../middleware/authMiddleware"
import { validatorMiddleware, ParamType } from "../middleware/validatorMiddleware"
import {
  updateItemScoreSchema,
  finalizeEvaluationSchema,
  setEvaluatorsSchema,
  generateParecerSchema
} from "../validator/processEvaluationValidator"

export function processEvaluationRoute() {
  const router = Router()

  const evaluationController = new ProcessEvaluationController(
    new ProcessEvaluationService(new ProcessEvaluationRepository())
  )

  router.get(
    "/processes/:id/evaluation",
    authMiddleware,
    evaluationController.getProcessForEvaluation
  )

  router.get(
    "/processes/:id/evaluation/evidences/:evidenceFileId/conteudo",
    authMiddleware,
    evaluationController.getEvidenceContentForCppd
  )

  router.patch(
    "/processes/:id/evaluation/items",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, updateItemScoreSchema),
    evaluationController.updateItemScores
  )

  router.patch(
    "/processes/:id/evaluation/evaluators",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, setEvaluatorsSchema),
    evaluationController.setEvaluationEvaluators
  )

  router.post(
    "/processes/:id/evaluation/parecer",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, generateParecerSchema),
    evaluationController.generateParecerPreview
  )

  router.post(
    "/processes/:id/evaluation/finalize",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, finalizeEvaluationSchema),
    evaluationController.finalizeEvaluation
  )

router.get(
  "/processes/:id/evaluation/view",
  authMiddleware,
  evaluationController.getProcessForEvaluationReadOnly
)
  

  return router
}
