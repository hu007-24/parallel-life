import type { AchievementDef, ConditionContext } from '@/engine/ple/types'
import { evaluateConditions } from '@/engine/ple/narrative-engine'

/** 隐藏成就：条件满足且沿路径未解锁过时触发，once 语义与剧情/事件一致 */
export function triggerAchievements(
  defs: readonly AchievementDef[],
  ctx: ConditionContext & { seenAchievementIds: readonly string[] },
): AchievementDef[] {
  return defs.filter(
    (def) => !ctx.seenAchievementIds.includes(def.id) && evaluateConditions(def.conditions, ctx),
  )
}