import { Schema } from "joi"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

export enum ParamType {
    BODY = "body",
    PARAMS = "params",
    QUERY = "query"
}

export function validatorMiddleware(paramType: ParamType, schema: Schema) {
    return function (req: any, res: any, next: any) {
        const { error, value } = schema.validate(req[paramType])
        if (error) {
            console.log("Client sent invalid request:", error.message)
            return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
        }
    
        req[paramType] = value
        next()
    }
}