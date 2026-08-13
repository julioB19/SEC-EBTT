import { describe, expect, jest, test } from "@jest/globals"
import { HttpResponse, StatusCodeDescription } from "../../../src/util/httpResponse"

function responseMock(headersSent = false) {
  const res: any = { status: jest.fn(), json: jest.fn(), headersSent }
  res.status.mockReturnValue(res)
  return res
}

describe("HttpResponse", () => {
  test.each([
    ["ok", 200, StatusCodeDescription.SUCCESS],
    ["created", 201, StatusCodeDescription.CREATED],
    ["unauthorized", 401, StatusCodeDescription.UNAUTHORIZED],
    ["internalError", 500, StatusCodeDescription.INTERNAL_ERROR]
  ])("%s monta status e corpo", (method, status, code) => {
    const res = responseMock()
    if (method === "ok") HttpResponse.ok(res, "ok", { id: 1 })
    if (method === "created") HttpResponse.created(res, "ok", { id: 1 })
    if (method === "unauthorized") HttpResponse.unauthorized(res)
    if (method === "internalError") HttpResponse.internalError(res)
    expect(res.status).toHaveBeenCalledWith(status)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: code }))
  })

  test("notFound não escreve depois dos headers", () => {
    const res = responseMock(true)
    HttpResponse.notFound(res, "X", "não", null)
    expect(res.status).not.toHaveBeenCalled()
  })
})
