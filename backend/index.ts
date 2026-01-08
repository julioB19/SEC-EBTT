import serverless from "serverless-http"
import app from "./src/app"

const serverlessHttp = serverless(app)

export async function handler(event: any, context: any) {
    return await serverlessHttp(event, context)
}