import type { CompareOp, Condition, ConditionContext, NarrativeDef, StatDelta } from '@/engine/ple/types'
import { mergeDeltas } from '@/engine/ple/state-engine'

function compare(op: CompareOp, a: number, b: number): boolean {
  switch (op) {
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    case '>':
      return a > b
    case '<':
      return a < b
  }
}

export function evaluateCondition(condition: Condition, ctx: ConditionContext): boolean {
  switch (condition.kind) {
    case 'stat':
      return compare(condition.op, ctx.stats[condition.stat], condition.value)
    case 'age':
      return compare(condition.op, ctx.age, condition.value)
    case 'event':
      return ctx.seenEventIds.includes(condition.eventId)
    case 'narrative':
      return ctx.seenNarrativeIds.includes(condition.narrativeId)
    case 'identity':
      return ctx.identityId === condition.identityId
    case 'flag':
      return ctx.flags.includes(condition.flag)
  }
}

export function evaluateConditions(conditions: readonly Condition[], ctx: ConditionContext): boolean {
  return conditions.every((condition) => evaluateCondition(condition, ctx))
}

/**
 * 条件剧情触发：只返回「条件满足且沿当前路径尚未触发」的剧情。
 * seenNarrativeIds 随节点快照传递，因此分支继承历史、不会重复触发。
 */
export function triggerNarratives(
  defs: readonly NarrativeDef[],
  ctx: ConditionContext,
): NarrativeDef[] {
  return defs.filter(
    (def) => !ctx.seenNarrativeIds.includes(def.id) && evaluateConditions(def.conditions, ctx),
  )
}

export function narrativeDelta(narratives: readonly NarrativeDef[]): StatDelta {
  return mergeDeltas(...narratives.map((n) => n.effects ?? {}))
}