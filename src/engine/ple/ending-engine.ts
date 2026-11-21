import type { EndingDef, LifeNode, StatKey } from '@/engine/ple/types'
import { STAT_KEYS, statMean, statMin } from '@/engine/ple/state-engine'
import { evaluateConditions } from '@/engine/ple/narrative-engine'
import { nodeContext } from '@/engine/ple/timeline-engine'

/**
 * 多维加权评分：score = Σ(weight_i × stat_i) / Σweight_i，值域 0–100。
 * balanced 模式 = 0.6×最低维 + 0.4×均值：只有真正均衡（短板高）的人生才能胜出，
 * 避免单维刷分，也避免均衡模式无条件压制专业型结局。
 */
function baseScore(def: EndingDef, node: LifeNode): number {
  if (def.scoring === 'balanced') {
    return statMin(node.stats) * 0.6 + statMean(node.stats) * 0.4
  }
  let weightSum = 0
  let acc = 0
  for (const key of STAT_KEYS) {
    const weight = def.weights[key] ?? 0
    weightSum += weight
    acc += weight * node.stats[key as StatKey]
  }
  return weightSum === 0 ? 0 : acc / weightSum
}

export function scoreEnding(def: EndingDef, node: LifeNode): number | null {
  const ctx = nodeContext(node)
  if (def.requirements && !evaluateConditions(def.requirements, ctx)) return null
  let score = baseScore(def, node)
  for (const bonus of def.bonuses ?? []) {
    if (evaluateConditions(bonus.conditions, ctx)) score += bonus.points
  }
  return score + (def.priority ?? 0)
}

/**
 * 结局判定：纯函数，只依赖终局节点快照（含沿路径的经历集合）。
 * 取最高分；同分时按定义顺序取先者，保证结果稳定可复现。
 */
export function computeEnding(defs: readonly EndingDef[], node: LifeNode): string {
  let bestId: string | null = null
  let bestScore = -Infinity
  for (const def of defs) {
    const score = scoreEnding(def, node)
    if (score !== null && score > bestScore) {
      bestScore = score
      bestId = def.id
    }
  }
  if (bestId === null) throw new Error('ending-engine: 没有任何可用结局定义')
  return bestId
}

export function getEndingDef(defs: readonly EndingDef[], id: string): EndingDef | null {
  return defs.find((def) => def.id === id) ?? null
}