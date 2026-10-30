import { RoleName } from "@prisma/client"
import { requireSelectedRole } from "../middleware/cppdAccessMiddleware"
import { Router } from "express";
import { ProcessoController } from "../controller/processoController";
import { ProcessoService } from "../service/processoService";
import { ProcessRepository } from "../repository/processoRepository";
import { ScoringTableRepository } from "../repository/scoringTableRepository";
import { UserRepository } from "../repository/userRepository";

export function processoRoute() {
  const router = Router()
  router.use(["/processos"], requireSelectedRole(RoleName.DOCENTE));

  const controller = new ProcessoController(
    new ProcessoService(
      new ProcessRepository(),
      new ScoringTableRepository(),
      new UserRepository(),
    ),
  );

  router.post("/processos/abrir", controller.abrirProcesso);

  router.get("/processos", controller.listarProcessos);

  router.get("/processos/tipos", controller.listarTiposProcesso);

  router.get("/processos/:id", controller.obterProcesso);

  router.patch("/processos/:id", controller.editarProcesso);

  router.delete("/processos/:id", controller.excluirProcesso);

  router.post("/processos/requerimento/:id", controller.gerarRequerimento);

  router.post("/processos/:id/enviar", controller.enviarProcesso);

  router.post(
    "/processos/:id/documentos/:kind",
    controller.anexarDocumentoEspecifico,
  );

  router.post(
    "/processos/:id/documentos-configurados/:requirementCode",
    controller.anexarDocumentoConfigurado,
  );

  router.delete(
    "/processos/:id/documentos-configurados/:documentId",
    controller.removerDocumentoConfigurado,
  );

  return router;
}
