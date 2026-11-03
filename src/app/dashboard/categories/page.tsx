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
    <div className="max-w-2xl mx-auto px-5 lg:px-10 py-10">
      <CategoriesClient initialCats={cats} />
    </div>
  )
}
