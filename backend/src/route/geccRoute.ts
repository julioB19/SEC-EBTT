import { Router } from "express"
import { GeccController } from "../controller/geccController"
import { authMiddleware } from "../middleware/authMiddleware"
import { requireCppdAccess, requireCppdProcessAccess } from "../middleware/cppdAccessMiddleware"
import { ParamType, validatorMiddleware } from "../middleware/validatorMiddleware"
import { addGeccInterestedSchema, saveGeccSchema, updateGeccStatusSchema } from "../validator/geccValidator"

export function geccRoute() {
  const router = Router()
  const controller = new GeccController()

  const processAccess = [authMiddleware, requireCppdAccess, requireCppdProcessAccess()]

  router.get("/processes/:id/gecc", ...processAccess, controller.get)
  router.put(
    "/processes/:id/gecc",
    ...processAccess,
    validatorMiddleware(ParamType.BODY, saveGeccSchema),
    controller.save
  )
  router.post(
    "/processes/:id/gecc/interested",
    ...processAccess,
    validatorMiddleware(ParamType.BODY, addGeccInterestedSchema),
    controller.addInterested
  )
  router.delete(
    "/processes/:id/gecc/interested/:personId/:type",
    ...processAccess,
    controller.removeInterested
  )
  router.post("/processes/:id/gecc/documents", ...processAccess, controller.addDocument)
  router.delete("/processes/:id/gecc/documents/:documentId", ...processAccess, controller.removeDocument)
  router.get(
    "/processes/:id/gecc/documents/:evidenceFileId/content",
    ...processAccess,
    controller.getDocumentContent
  )
  router.post("/processes/:id/gecc/checklist", ...processAccess, controller.generateChecklist)
  router.patch(
    "/processes/:id/gecc/status",
    ...processAccess,
    validatorMiddleware(ParamType.BODY, updateGeccStatusSchema),
    controller.updateStatus
  )

  return router
}
