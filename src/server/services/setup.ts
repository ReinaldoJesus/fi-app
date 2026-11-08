import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { AccountSetup } from "@/lib/api/schemas"
import { conflict } from "../errors"
import { createAccount } from "./accounts"
import { createSubscription } from "./subscriptions"
import { createSavingsGoal } from "./savings"
import { upsertBudget } from "./budgets"
import { ensureDefaultCategories } from "./categories"

/**
 * Applies what the person built in the step-by-step signup (first account,
 * subscriptions, savings goal, monthly spending limit). Runs once: a user that
 * already has accounts gets 409, so a retried request never duplicates data.
 */
export async function applySetup(userId: string, input: z.infer<typeof AccountSetup>) {
  if (await prisma.finAccount.count({ where: { userId } })) {
    throw conflict("Tu Clarifi ya está configurado")
  }
  if (input.country) await prisma.user.updateMany({ where: { id: userId, country: null }, data: { country: input.country } })
  const account = input.account ? await createAccount(userId, input.account) : null

  for (const s of input.subscriptions) await createSubscription(userId, s)
  const goal = input.goal ? await createSavingsGoal(userId, input.goal) : null

  let budgets = 0
  if (input.budgets.length) {
    await ensureDefaultCategories(userId)
    const now = new Date()
    // Default categories exist once an account was created; match by name.
    const cats = await prisma.category.findMany({ where: { userId, type: "EXPENSE" }, select: { id: true, name: true } })
    for (const b of input.budgets) {
      const cat = cats.find(c => c.name.toLowerCase() === b.category.toLowerCase())
      if (!cat) continue
      await upsertBudget(userId, { categoryId: cat.id, amount: b.amount, month: now.getMonth() + 1, year: now.getFullYear() })
      budgets++
    }
  }

  return { account: account?.id ?? null, subscriptions: input.subscriptions.length, goal: goal?.id ?? null, budgets }
}
