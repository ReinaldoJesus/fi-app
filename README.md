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

### Base de datos de desarrollo

Local nunca usa la base de producción. En Neon, la base de desarrollo es una rama (`dev`) del proyecto:

1. Neon → **Branches** → **New branch**, nombre `dev`, padre `main`.
2. Copia la cadena de conexión de esa rama y ponla como `DATABASE_URL` en `.env.local`.
3. `npm run db:dev -- --reset` deja la rama vacía con el esquema actual (o `npm run db:dev` para solo aplicar migraciones pendientes).

`.env.local` guarda `PROD_DB_HOST` (el host de producción, no es secreto): `db:dev` y `test:api` se niegan a correr si `DATABASE_URL` apunta ahí, y el servidor local avisa en la consola.

## Deploy

Vercel publica automáticamente cada push a `main`. El script `vercel-build` corre `prisma migrate deploy` antes del build, así que las migraciones de `prisma/migrations` se aplican solas; si una falla, el deploy se detiene. Para aplicarlas a mano: `npm run db:migrate`.

GitHub Actions (`.github/workflows/ci.yml`) corre lint y build en cada push y pull request.

### Variables de entorno

| Variable | Para qué | Obligatoria |
| --- | --- | --- |
| `DATABASE_URL`, `AUTH_SECRET` | Base de datos y sesiones | Sí |
| `AUTH_GITHUB_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET` | Login social | Para cada proveedor |
| `RESEND_API_KEY`, `EMAIL_FROM` | Emails (recuperar contraseña, alertas). Sin clave, el email se escribe en el log | Para enviar emails |
| `ALERT_EMAIL` | Recibe un aviso cuando hay errores (máx. 1 cada 15 min) | No |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notificaciones push (`npx web-push generate-vapid-keys`) | Para push |
| `VAPID_SUBJECT` | Contacto para los servicios push (`mailto:` o `https://`); por defecto la URL de producción | No |
| `CRON_SECRET` | Protege el job diario `/api/v1/jobs/daily` | Sí, en producción |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Email de contacto en Privacidad y Términos | No |

### Job diario

`vercel.json` programa `GET /api/v1/jobs/daily` a las 12:00 UTC (09:00 en Chile). Genera los movimientos recurrentes de todos, envía las alertas push (cobros de mañana y presupuestos al 90 % y al 100 %, una sola vez cada una) y limpia los registros vencidos: errores de más de 90 días, enlaces de recuperación y límites de intentos.
