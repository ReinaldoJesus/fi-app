/** Domain error carrying an HTTP status; route handlers turn it into a JSON error body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const unauthorized = () => new ApiError(401, "unauthorized", "No autorizado")
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} no encontrada`)
export const badRequest = (message: string, fields?: Record<string, string[]>) =>
  new ApiError(400, "bad_request", message, fields)
export const conflict = (message: string, fields?: Record<string, string[]>) =>
  new ApiError(409, "conflict", message, fields)
