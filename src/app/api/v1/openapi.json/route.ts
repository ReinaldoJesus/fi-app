import { buildOpenApi } from "@/lib/api/openapi"

/** Public: the API contract (OpenAPI 3.1). */
export function GET(req: Request) {
  return Response.json(buildOpenApi(new URL(req.url).origin))
}
