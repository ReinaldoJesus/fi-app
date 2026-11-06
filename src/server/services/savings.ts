import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { SavingsGoalCreate, SavingsGoalUpdate } from "@/lib/api/schemas"
import { notFound } from "../errors"
import { parseDateInput } from "../dates"
import { num } from "./guards"

type GoalRow = Awaited<ReturnType<typeof prisma.savingsGoal.findFirstOrThrow>>

function serialize(g: GoalRow) {
  return {
    ...g,
    targetAmount: num(g.targetAmount),
    currentAmount: num(g.currentAmount),
    deadline: g.deadline ? g.deadline.toISOString() : null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }
}

async function getOwned(userId: string, id: string) {
  const g = await prisma.savingsGoal.findFirst({ where: { id, userId } })
  if (!g) throw notFound("Meta")
  return g
}

export async function listSavingsGoals(userId: string) {
  const rows = await prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
  return rows.map(serialize)
}

export async function createSavingsGoal(userId: string, input: z.infer<typeof SavingsGoalCreate>) {
  const g = await prisma.savingsGoal.create({
    data: {
      userId,
      name: input.name,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount,
      icon: input.icon ?? null,
      color: input.color,
      deadline: input.deadline ? parseDateInput(input.deadline) : null,
      completed: input.currentAmount >= input.targetAmount,
    },
  })
  return serialize(g)
}

export async function updateSavingsGoal(userId: string, id: string, input: z.infer<typeof SavingsGoalUpdate>) {
  const old = await getOwned(userId, id)
  const targetAmount = input.targetAmount ?? num(old.targetAmount)
  const g = await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline ? parseDateInput(input.deadline) : null } : {}),
      targetAmount,
      completed: num(old.currentAmount) >= targetAmount,
    },
  })
  return serialize(g)
}

/** Adds (or withdraws, if negative) money; the saved amount never goes below 0. */
export async function contributeToGoal(userId: string, id: string, amount: number) {
  const goal = await getOwned(userId, id)
  const currentAmount = Math.max(0, num(goal.currentAmount) + amount)
  const g = await prisma.savingsGoal.update({
    where: { id },
    data: { currentAmount, completed: currentAmount >= num(goal.targetAmount) },
  })
  return serialize(g)
}

export async function deleteSavingsGoal(userId: string, id: string) {
  await getOwned(userId, id)
  await prisma.savingsGoal.delete({ where: { id } })
  return { id }
}
