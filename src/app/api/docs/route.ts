/** Interactive API reference (Scalar) rendering /api/v1/openapi.json. */
export function GET() {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Clarifi API</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/v1/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.0"></script>
  </body>
</html>`
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
}
