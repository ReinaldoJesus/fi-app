import { API_ROUTES } from "@/lib/api/openapi"

/** Public index of the API. */
export function GET() {
  return Response.json({
    data: {
      name: "Clarifi API",
      version: "v1",
      docs: "/api/docs",
      openapi: "/api/v1/openapi.json",
      resources: API_ROUTES,
    },
  })
}
