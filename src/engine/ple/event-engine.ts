import type { ConditionContext, EventDef } from '@/engine/ple/types'
import { evaluateConditions } from '@/engine/ple/narrative-engine'
import { chance, pickWeighted } from '@/engine/ple/random-engine'

export const EVENT_CHANCE = 0.7

/** 候选事件：年龄区间 + 条件满足 + 沿路径未触发过（once 语义） */
export function eligibleEvents(defs: readonly EventDef[], ctx: ConditionContext): EventDef[] {
  return defs.filter(
    (def) =>
      ctx.age >= def.minAge &&
      ctx.age <= def.maxAge &&
      !ctx.seenEventIds.includes(def.id) &&
      evaluateConditions(def.conditions ?? [], ctx),
  )
}

/**
 * 随机事件抽取：先过概率门（不是每年必有事），再在候选中加权抽取。
 * 随机流由调用方按 (seed, pathKey) 派生，保证可复现。
 */
export function rollEvent(
  defs: readonly EventDef[],
  ctx: ConditionContext,
  rng: () => number,
  probability: number = EVENT_CHANCE,
): EventDef | null {
  if (!chance(probability, rng)) return null
  const candidates = eligibleEvents(defs, ctx)
  if (candidates.length === 0) return null
  return pickWeighted(candidates, (def) => def.weight, rng)
}