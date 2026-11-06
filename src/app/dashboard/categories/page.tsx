import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import CategoriesClient from "./CategoriesClient"

export default async function CategoriesPage() {
  const session = await auth()
  const cats = await prisma.category.findMany({
    where: { userId: session!.user!.id! },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } },
  })
  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <CategoriesClient initialCats={cats} />
    </div>
  )
}
