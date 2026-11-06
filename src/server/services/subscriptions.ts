import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { SubscriptionCreate, SubscriptionUpdate } from "@/lib/api/schemas"
import { notFound } from "../errors"
import { num } from "./guards"

type SubRow = Awaited<ReturnType<typeof prisma.subscription.findFirstOrThrow>>

const serialize = (s: SubRow) => ({ ...s, amount: num(s.amount) })

async function getOwned(userId: string, id: string) {
  const s = await prisma.subscription.findFirst({ where: { id, userId } })
  if (!s) throw notFound("Suscripción")
  return s
}

export async function listSubscriptions(userId: string, opts: { activeOnly?: boolean } = {}) {
  const rows = await prisma.subscription.findMany({
    where: { userId, ...(opts.activeOnly ? { active: true } : {}) },
    orderBy: { createdAt: "asc" },
  })
  return rows.map(serialize)
}

export async function createSubscription(userId: string, input: z.infer<typeof SubscriptionCreate>) {
  const s = await prisma.subscription.create({
    data: {
      userId,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      billingDay: input.billingDay ?? null,
      category: input.category ?? null,
      icon: input.icon ?? null,
    },
  })
  return serialize(s)
}

export async function updateSubscription(userId: string, id: string, input: z.infer<typeof SubscriptionUpdate>) {
  await getOwned(userId, id)
  const s = await prisma.subscription.update({ where: { id }, data: input })
  return serialize(s)
}

export async function deleteSubscription(userId: string, id: string) {
  await getOwned(userId, id)
  await prisma.subscription.delete({ where: { id } })
  return { id }
}
