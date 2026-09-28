export class CppdManagementError extends Error {
  constructor(
    message: string,
    public readonly kind: "INVALID" | "NOT_FOUND" = "INVALID"
  ) {
    super(message)
    this.name = "CppdManagementError"
  }
}
