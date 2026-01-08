import express from "express"
import "dotenv/config"
import path from "path"
import { authMiddleware } from "./middleware/authMiddleware"
import { corsMiddleware } from "./middleware/corsMiddleware"
import { userRoute } from "./route/userRoute"
import { authRoute } from "./route/authRoute"
import { publicRegistrationRoute } from "./route/userRegistrationRoute"
import { meRoute } from "./route/meRoute"
import { processoRoute } from "./route/processoRoute"
import { processScoreRoute } from "./route/processScoreRoute"
import { processEvaluationRoute } from "./route/processEvaluationRoute"
import { cppdProcessoRoute } from "./route/cppdProcessoRoute"
import { scoringTableRoute } from "./route/scoringTableRoute"

const app = express()

app.use(corsMiddleware)
app.use(express.json())
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))
//app.use(express.urlencoded({ extended: true }))

//rotas publicas
app.use(publicRegistrationRoute())
app.use(authRoute())



app.use(authMiddleware)
//rotas protegidas
app.use(userRoute())
app.use(meRoute())
app.use(processoRoute())
app.use(processScoreRoute())
app.use(processEvaluationRoute())
app.use(cppdProcessoRoute())
app.use(scoringTableRoute())
export default app