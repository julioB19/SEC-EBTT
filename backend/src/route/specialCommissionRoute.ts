import { Router } from "express"
import { SpecialCommissionController } from "../controller/specialCommissionController"
import { IndividualEvaluationController } from "../controller/individualEvaluationController"
import { authMiddleware } from "../middleware/authMiddleware"
import { requireCppdAccess, requireCppdProcessAccess } from "../middleware/cppdAccessMiddleware"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import {
  addSpecialCommissionMemberSchema,
  finalizeSpecialCommissionDecisionSchema,
  respondSpecialCommissionInvitationSchema,
  saveSpecialCommissionSchema,
  updateSpecialCommissionStatusSchema
} from "../validator/specialCommissionValidator"
import { saveIndividualEvaluationSchema } from "../validator/individualEvaluationValidator"

export function specialCommissionRoute() {
  const router = Router()
  const controller = new SpecialCommissionController()
  const evaluationController = new IndividualEvaluationController()

  router.get(
    "/processes/:id/special-commission",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    controller.getForProcess
  )
  router.put(
    "/processes/:id/special-commission",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, saveSpecialCommissionSchema),
    controller.save
  )
  router.post(
    "/processes/:id/special-commission/members",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, addSpecialCommissionMemberSchema),
    controller.addMember
  )
  router.delete(
    "/processes/:id/special-commission/members/:memberId",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    controller.removeMember
  )
  router.patch(
    "/processes/:id/special-commission/status",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, updateSpecialCommissionStatusSchema),
    controller.updateStatus
  )
  router.post(
    "/processes/:id/special-commission/decision",
    authMiddleware,
    requireCppdAccess,
    requireCppdProcessAccess(),
    validatorMiddleware(ParamType.BODY, finalizeSpecialCommissionDecisionSchema),
    controller.finalizeDecision
  )
  router.get("/external-evaluator/assignments", authMiddleware, controller.listAssignments)
  router.post(
    "/external-evaluator/assignments/:memberId/respond",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, respondSpecialCommissionInvitationSchema),
    controller.respond
  )
  router.get("/external-evaluator/assignments/:memberId/evaluation", authMiddleware, evaluationController.get)
  router.get(
    "/external-evaluator/assignments/:memberId/evaluation/opinion.pdf",
    authMiddleware,
    evaluationController.getOpinionPdf
  )
  router.put(
    "/external-evaluator/assignments/:memberId/evaluation",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, saveIndividualEvaluationSchema),
    evaluationController.save
  )
  router.post(
    "/external-evaluator/assignments/:memberId/evaluation/submit",
    authMiddleware,
    validatorMiddleware(ParamType.BODY, saveIndividualEvaluationSchema),
    evaluationController.submit
  )
  router.get(
    "/external-evaluator/assignments/:memberId/evidences/:evidenceFileId/content",
    authMiddleware,
    evaluationController.getEvidenceContent
  )

  return router
}
