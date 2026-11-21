import type { LifeStats, StatDelta, StatKey } from '@/engine/ple/types'
import { EngineError } from '@/engine/ple/types'

export const STAT_KEYS: readonly StatKey[] = [
  'creativity',
  'exploration',
  'social',
  'influence',
  'happiness',
]

export const STAT_LABELS: Record<StatKey, string> = {
  creativity: '创造',
  exploration: '探索',
  social: '联结',
  influence: '影响',
  happiness: '幸福',
}

export const STAT_MIN = 0
export const STAT_MAX = 100

export function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value))
}

/** 输入校验：五个维度必须齐全且为有限数，否则拒绝（不静默吞掉坏数据） */
export function validateStats(stats: LifeStats): LifeStats {
  for (const key of STAT_KEYS) {
    const value = stats[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new EngineError('INVALID_STATS', `属性 ${key} 不是有限数：${String(value)}`)
    }
  }
  return stats
}

export function createStats(base: LifeStats): LifeStats {
  validateStats(base)
  const result = {} as LifeStats
  for (const key of STAT_KEYS) result[key] = clampStat(base[key])
  return result
}

/** 校验增量：只接受有限数；缺省维度视为 0 */
export function validateDelta(delta: StatDelta): StatDelta {
  for (const key of STAT_KEYS) {
    const value = delta[key]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new EngineError('INVALID_DELTA', `属性增量 ${key} 非法：${String(value)}`)
    }
  }
  return delta
}

/** 统一属性更新入口：事件加成 + 上下限钳制，纯函数、不修改输入 */
export function applyDelta(stats: LifeStats, delta: StatDelta): LifeStats {
  validateStats(stats)
  validateDelta(delta)
  const next = {} as LifeStats
  for (const key of STAT_KEYS) {
    next[key] = clampStat(stats[key] + (delta[key] ?? 0))
  }
  return next
}

/** 合并多来源增量（选择 / 剧情 / 事件），按维度求和后再统一钳制 */
export function mergeDeltas(...deltas: readonly StatDelta[]): StatDelta {
  const merged: StatDelta = {}
  for (const delta of deltas) {
    validateDelta(delta)
    for (const key of STAT_KEYS) {
      const value = delta[key]
      if (value !== undefined) merged[key] = (merged[key] ?? 0) + value
    }
  }
  return merged
}

export function statMean(stats: LifeStats): number {
  return STAT_KEYS.reduce((sum, key) => sum + stats[key], 0) / STAT_KEYS.length
}

export function statMin(stats: LifeStats): number {
  return Math.min(...STAT_KEYS.map((key) => stats[key]))
}