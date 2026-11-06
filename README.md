# Clarifi · Finanzas personales

App de finanzas personales (Next.js 16 + Prisma + Neon + NextAuth), instalable como PWA.

## Arquitectura: API-first

Toda la lógica de negocio vive detrás de una API REST versionada, y la app web es un cliente más de esa API.

```
src/lib/api/schemas.ts    Contrato: esquemas Zod de cada request (validación + OpenAPI)
src/lib/api/client.ts     Cliente tipado que usa la UI para todas las mutaciones
src/lib/api/openapi.ts    Documento OpenAPI 3.1 generado desde los esquemas
src/server/services/*     Lógica de negocio (saldos, presupuestos, recurrentes, reportes)
src/server/http.ts        Wrapper de rutas: sesión, errores y formato de respuesta
src/app/api/v1/**         Endpoints REST (delgados: validan y llaman a un servicio)
```

- **Escrituras**: los componentes cliente llaman a `/api/v1` mediante `api.*` y luego hacen `router.refresh()`.
- **Lecturas**: las páginas del servidor llaman a los mismos servicios que usan los endpoints. Next.js recomienda no hacer HTTP al propio servidor durante el render.
- **Login y logout** siguen siendo server actions (`src/app/actions/auth.ts`), porque NextAuth tiene que fijar la cookie de sesión. El registro usa el mismo servicio que `POST /api/v1/auth/register`.

### Documentación

- Referencia interactiva: `/api/docs`
- Contrato OpenAPI: `/api/v1/openapi.json`
- Índice: `/api/v1`

Las respuestas son `{ "data": ... }` en caso de éxito y `{ "error": { "code", "message", "fields"? } }` en caso de error. Códigos posibles: 401 sin sesión, 404 si el recurso no existe o es de otra persona, 409 en conflicto y 422 si los datos son inválidos.

Para autenticarse se usa la cookie de sesión de NextAuth: inicia sesión en `/login` o con `POST /api/auth/callback/credentials`.

## Desarrollo

```bash
npm install          # también ejecuta prisma generate
npm run dev          # http://localhost:3000
npm run test:api     # prueba end-to-end de /api/v1 contra el servidor de desarrollo
```

`npm run test:api [baseUrl]` necesita `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` en `.env.local`; si esa cuenta no existe, la crea. Usa por defecto `http://localhost:3001`.

## Deploy

Vercel publica automáticamente cada push a `main`. Los cambios en `prisma/schema.prisma` no se aplican solos: las migraciones hay que correrlas aparte contra Neon.
