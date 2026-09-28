import { Router } from "express"
import { ProcessEvaluationController } from "../controller/processEvaluationController"
import { ProcessEvaluationService } from "../service/processEvaluationService"
import { ProcessEvaluationRepository } from "../repository/processEvaluationRepository"
import { authMiddleware } from "../middleware/authMiddleware"
import { requireCppdAccess, requireCppdProcessAccess } from "../middleware/cppdAccessMiddleware"
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
    requireCppdAccess,
    requireCppdProcessAccess(),
    evaluationController.getProcessForEvaluation
  )

  router.get(
    "/processes/:id/evaluation/evidences/:evidenceFileId/conteudo",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    evaluationController.getEvidenceContentForCppd
  )

  router.patch(
    "/processes/:id/evaluation/items",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, updateItemScoreSchema),
    evaluationController.updateItemScores
  )

  router.patch(
    "/processes/:id/evaluation/evaluators",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, setEvaluatorsSchema),
    evaluationController.setEvaluationEvaluators
  )

  router.post(
    "/processes/:id/evaluation/parecer",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, generateParecerSchema),
    evaluationController.generateParecerPreview
  )

  router.post(
    "/processes/:id/evaluation/finalize",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, finalizeEvaluationSchema),
    evaluationController.finalizeEvaluation
  )

router.get(
  "/processes/:id/evaluation/view",
  authMiddleware,
  requireCppdAccess,
  requireCppdProcessAccess(),
  evaluationController.getProcessForEvaluationReadOnly
)
  

  return router
}
