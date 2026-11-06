import { ok, readJson, readQuery, withUser } from "@/server/http"
import { CategoryCreate, CategoryType } from "@/lib/api/schemas"
import { createCategory, listCategories } from "@/server/services/categories"

export const GET = withUser(async ({ req, userId }) => {
  const type = CategoryType.optional().parse(readQuery(req).type || undefined)
  return ok(await listCategories(userId, type))
})

export const POST = withUser(async ({ req, userId }) =>
  ok(await createCategory(userId, CategoryCreate.parse(await readJson(req))), 201),
)
