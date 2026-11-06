import { auth } from "@/auth"
import { listCategories } from "@/server/services/categories"
import CategoriesClient from "./CategoriesClient"

export default async function CategoriesPage() {
  const session = await auth()
  const cats = await listCategories(session!.user!.id!)
  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <CategoriesClient initialCats={cats} />
    </div>
  )
}
