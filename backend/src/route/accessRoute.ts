import { CampusEmailPolicyService } from "../service/campusEmailPolicyService"
import { Router, RequestHandler } from "express"
import { RoleName } from "@prisma/client"
import { AccessService } from "../service/accessService"
import { AccessError } from "../util/accessPolicy"
import { requireSelectedRole as requireAnyRole, requireCppdAccess } from "../middleware/cppdAccessMiddleware"

const service = new AccessService()
const policy = new CampusEmailPolicyService()
function handle(action: (req: any) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try { res.json({ data: await action(req) }) }
    catch (error) {
      if (error instanceof AccessError) res.status(error.status).json({ message: error.message })
      else res.status(500).json({ message: "Não foi possível concluir a operação. Tente novamente" })
    }
  }
}
const secret = (req: any) => typeof req.body?.attemptSecret === "string" ? req.body.attemptSecret : ""
const actor = (req: any) => ({ id: Number(req.user.sub), role: req.user.selectedRole as RoleName, campusIds: req.cppdAccess?.campusIds })
const id = (req: any) => String(req.params.id)

export function publicAccessRoute() {
  const router = Router()
  router.get("/auth/access/config", (_req, res) => { res.json({ data: {
    googleEnabled: process.env.GOOGLE_LOGIN_ENABLED === "true" && !!process.env.GOOGLE_CLIENT_ID
  } }) })
  router.get("/auth/access/campuses", handle(() => policy.campuses()))
  router.post("/auth/google/start", handle(req => service.start(req.body ?? {}, req.ip || "unknown")))
  router.post("/auth/google/complete", handle(req => service.completeGoogle(secret(req), req.body?.credential)))
  router.post("/auth/access/send-code", handle(req => service.sendCode(secret(req))))
  router.post("/auth/access/verify-email", handle(req => service.verifyEmail(secret(req), req.body?.code)))
  router.post("/auth/access/status", handle(req => service.status(secret(req))))
  router.post("/auth/access/complete", handle(req => service.completeRegistration(secret(req), req.body?.profile)))
  router.post("/auth/access/password", handle(req => service.passwordAccess(secret(req), req.body?.password)))
  router.post("/auth/access/update-pending", handle(req => service.updatePending(secret(req), req.body?.profile)))
  return router
}

export function managedAccessRoute() {
  const router = Router()
  router.use("/access/invitations", requireAnyRole(RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL, RoleName.ADMIN))
  router.use("/access/invitations", (req: any, res, next) => {
    if (req.user.selectedRole === RoleName.ADMIN) next()
    else void requireCppdAccess(req, res, next)
  })
  router.use("/access/campus-policy", requireAnyRole(RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL, RoleName.ADMIN))
  router.use("/access/campus-policy", (req: any, res, next) => {
    if (req.user.selectedRole === RoleName.ADMIN) next()
    else void requireCppdAccess(req, res, next)
  })
  router.get("/access/campus-policy/campuses", handle(req => policy.campuses(actor(req))))
  router.get("/access/campus-policy/:campusId/domains", handle(req => policy.list(actor(req), Number(req.params.campusId))))
  router.post("/access/campus-policy/:campusId/domains", handle(req => policy.add(actor(req), Number(req.params.campusId), req.body ?? {})))
  router.post("/access/campus-policy/:campusId/domains/:ruleId", handle(req => policy.update(actor(req), Number(req.params.campusId), String(req.params.ruleId), req.body ?? {})))
  router.get("/access/invitations", handle(req => service.invitations(actor(req))))
  router.post("/access/invitations", handle(req => service.invite(actor(req), req.body ?? {})))
  router.post("/access/invitations/:id/resend", handle(req => service.resend(actor(req), id(req))))
  router.post("/access/invitations/:id/cancel", handle(req => service.cancel(actor(req), id(req))))
  router.post("/access/invitations/:id/approve", handle(req => service.approve(actor(req), id(req))))
  router.get("/access/invitations/:id/review", handle(req => service.reviewDetails(actor(req), id(req))))
  return router
}
