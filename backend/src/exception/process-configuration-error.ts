export class ProcessConfigurationError extends Error {
  constructor(
    message: string,
    public readonly kind: "INVALID" | "NOT_FOUND" | "CONFLICT" = "INVALID",
  ) {
    super(message);
    this.name = "ProcessConfigurationError";
  }
}
