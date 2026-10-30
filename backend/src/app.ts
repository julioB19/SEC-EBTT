import express from "express";
import { requestActor } from "./util/requestActor";
import { caseComplianceRoute } from "./route/caseComplianceRoute";
import "dotenv/config";
import { authMiddleware } from "./middleware/authMiddleware";
import { corsMiddleware } from "./middleware/corsMiddleware";
import { userRoute } from "./route/userRoute";
import { authRoute } from "./route/authRoute";
import { publicRegistrationRoute } from "./route/userRegistrationRoute";
import { meRoute } from "./route/meRoute";
import { processoRoute } from "./route/processoRoute";
import { processScoreRoute } from "./route/processScoreRoute";
import { processEvaluationRoute } from "./route/processEvaluationRoute";
import { cppdProcessoRoute } from "./route/cppdProcessoRoute";
import { scoringTableRoute } from "./route/scoringTableRoute";
import { specialCommissionRoute } from "./route/specialCommissionRoute";
import { cppdManagementRoute } from "./route/cppdManagementRoute";
import { fullProfessorProcedureRoute } from "./route/fullProfessorProcedureRoute";

const app = express();

app.use(corsMiddleware);
app.use(express.json());
app.use("/uploads", (_req, res) => { res.sendStatus(404); });
//app.use(express.urlencoded({ extended: true }))

//rotas publicas
app.use(publicRegistrationRoute());
app.use(authRoute());

app.use(authMiddleware);
app.use((req: any, _res, next) => requestActor.run({ userId: Number(req.user.sub) }, next));
//rotas protegidas
app.use(userRoute());
app.use(meRoute());
app.use(processoRoute());
app.use(processScoreRoute());
app.use(processEvaluationRoute());
app.use(cppdProcessoRoute());
app.use(scoringTableRoute());
app.use(specialCommissionRoute());
app.use(cppdManagementRoute());
app.use(fullProfessorProcedureRoute());
app.use(caseComplianceRoute());
export default app;
