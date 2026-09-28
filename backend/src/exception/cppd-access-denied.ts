export class CppdAccessDenied extends Error {
  constructor(message = "Acesso da CPPD não autorizado") {
    super(message)
    this.name = "CppdAccessDenied"
  }
}
