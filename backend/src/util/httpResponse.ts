import { Response } from "express"
interface HttpResponseBody<T> {
    status: StatusCodeDescription,
    message: string,
    data: T | null
}

export class HttpResponse {
    static INTERNAL_SERVER_ERROR(res: any) {
        throw new Error("Method not implemented.")
    }
    static ok<T>(res: any, message: string, data: T | null) {
        const body: HttpResponseBody<T> = {
            status: StatusCodeDescription.SUCCESS,
            message: message,
            data: data,
        }
        res.status(200).json(body)
    }

    static created<T>(res: any, message: string, data: T | null) {
        const body: HttpResponseBody<T> = {
            status: StatusCodeDescription.CREATED,
            message: message,
            data: data,
        }
        res.status(201).json(body)
    }

    static badRequest<T>(res: any, status: StatusCodeDescription, message: string, data: T | null) {
        const body: HttpResponseBody<T> = {
            status: status,
            message: message,
            data: data,
        }
        res.status(400).json(body)
    }

    static unauthorized<T>(res: any) {
        const body: HttpResponseBody<T> = {
            status: StatusCodeDescription.UNAUTHORIZED,
            message: "Unauthorized",
            data: null,
        }
        res.status(401).json(body)
    }

    static internalError<T>(res: any) {
        const body: HttpResponseBody<T> = {
            status: StatusCodeDescription.INTERNAL_ERROR,
            message: "Internal error",
            data: null,
        }
        res.status(500).json(body)
    }
    static notFound(res: Response, code: string, message: string, data: any): void {
        if (!res.headersSent) {
            res.status(404).json({
                status: code,
                message,
                data,
            })
        }
    }

    static blocked<T>(res: any, message: string, data: T) {
        const body: HttpResponseBody<T> = {
            status: StatusCodeDescription.FEATURE_TEMPORARILY_BLOCKED,
            message: message,
            data: data,
        }
        res.status(423).json(body)
    }
}

export enum StatusCodeDescription {
    SUCCESS = "SUCCESS",
    CREATED = "CREATED",
    BAD_REQUEST = "BAD_REQUEST",
    INVALID_INPUT = "INVALID_INPUT",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    FORBIDDEN = "FORBIDDEN",
    UNAUTHORIZED = "UNAUTHORIZED",
    //Custom
    USER_NOT_FOUND = "USER_NOT_FOUND",
    USER_EXISTS = "USER_EXISTS",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    TEACHER_EXISTS = "TEACHER_EXISTS",
    TEACHER_NOT_FOUND = "TEACHER_NOT_FOUND",
    INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN",
    EXISTING_CLASS = "EXISTING_CLASS",
    RESTRICTION_NOT_FOUND = "RESTRICTION_NOT_FOUND",
    SCHOOL_CLASS_NOT_FOUND = "SCHOOL_CLASS_NOT_FOUND",
    PERIOD_NOT_FOUND = "PERIOD_NOT_FOUND",
    AFTERNOON_START_TIME = "AFTERNOON_START_TIME",
    INVALID_PERIOD_ID = "INVALID_PERIOD_ID",
    NOT_ENOUGH_PERIODS_FOR_THE_WORKLOAD = "NOT_ENOUGH_PERIODS_FOR_THE_WORKLOAD",
    ACTIVITIES_NOT_YET_REGISTERED = "ACTIVITIES_NOT_YET_REGISTERED",
    PERIODS_NOT_YET_REGISTERED = "PERIODS_NOT_YET_REGISTERED",
    BLOCKED_OPERATIONS = "BLOCKED_OPERATIONS",
    FEATURE_TEMPORARILY_BLOCKED = "FEATURE_TEMPORARILY_BLOCKED",
    EXISTING_RESOURCE = "EXISTING_RESOURCE",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    DUPLICATE_RESTRICTION = "DUPLICATE_RESTRICTION",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
}