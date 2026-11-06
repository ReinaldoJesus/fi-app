import { ok, readJson, withUser } from "@/server/http"
import { CategoryUpdate } from "@/lib/api/schemas"
import { deleteCategory, updateCategory } from "@/server/services/categories"

type P = { id: string }

export const PATCH = withUser<P>(async ({ req, userId, params }) =>
  ok(await updateCategory(userId, params.id, CategoryUpdate.parse(await readJson(req)))),
)

export const DELETE = withUser<P>(async ({ userId, params }) => ok(await deleteCategory(userId, params.id)))
