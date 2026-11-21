import { describe, expect, it } from 'vitest'
import { buildSide, compareSides } from '@/engine/ple/comparison-engine'
import {
  MAX_AGE,
  autoAdvance,
  branch,
  choose,
  createUniverse,
} from '@/engine/ple/simulation-engine'
import { getCurrentNode, getRoute } from '@/engine/ple/timeline-engine'
import { STAT_KEYS } from '@/engine/ple/state-engine'
import { ENDINGS } from '@/data/endings'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function divergedFixture() {
  const played = autoAdvance(
    createUniverse({ id: 'u-cmp', name: '对照', seed: 2026, archetypeId: 'campus' }),
    30,
  )
  const originId = getRoute(played).nodeIds[20] as string
  const branched = branch(played, originId, '分支对照')
  // 同节点同自动选择会复现同路径（确定性）；显式选不同选项才构成真实分岔
  const leftOption = getCurrentNode(played).options[0]
  const rightOption = getCurrentNode(branched).options[1]
  if (!leftOption || !rightOption) throw new Error('fixture: 节点选项不足')
  const left = choose(played, leftOption.id)
  const right = choose(branched, rightOption.id)
  return { left, right }
}

describe('comparison-engine：两条路线数据隔离', () => {
  it('深度冻结的宇宙仍可推导对照报告（纯函数、零突变）', () => {
    const { left, right } = divergedFixture()
    const frozenLeft = deepFreeze(left)
    const frozenRight = deepFreeze(right)
    const report = compareSides(
      buildSide(frozenLeft, 'r_root'),
      buildSide(frozenRight, getRoute(frozenRight).id),
    )
    expect(report.left.stats).toEqual(getCurrentNode(left).stats)
    expect(report.right.stats).toEqual(getCurrentNode(right).stats)
    expect(report.left.routeId).toBe('r_root')
    expect(report.right.routeId).not.toBe('r_root')
    expect(report.left.path.length).toBe(32)
    expect(report.right.path.length).toBe(22)
  })

  it('同宇宙不同路线与跨宇宙路线都能对照', () => {
    const { left, right } = divergedFixture()
    const sameUniverse = compareSides(buildSide(left, 'r_root'), buildSide(right))
    expect(sameUniverse.sameRoute).toBe(false)
    expect(sameUniverse.left.universeId).toBe(sameUniverse.right.universeId)

    const other = autoAdvance(
      createUniverse({ id: 'u-other', name: '其他', seed: 99, archetypeId: 'traveler' }),
      30,
    )
    const cross = compareSides(buildSide(left, 'r_root'), buildSide(other))
    expect(cross.left.universeId).not.toBe(cross.right.universeId)
    expect(cross.divergenceAge).toBe(0)
  })
})

describe('comparison-engine：对照数据正确', () => {
  it('Δ 等于左右属性差；事件三分区互斥且完备', () => {
    const { left, right } = divergedFixture()
    const report = compareSides(buildSide(left, 'r_root'), buildSide(right))
    for (const key of STAT_KEYS) {
      expect(report.statDelta[key]).toBe(report.left.stats[key] - report.right.stats[key])
    }
    const leftIds = report.left.events.map((e) => e.id)
    const rightIds = report.right.events.map((e) => e.id)
    const sharedIds = report.sharedEvents.map((e) => e.id)
    const leftOnlyIds = report.leftOnlyEvents.map((e) => e.id)
    const rightOnlyIds = report.rightOnlyEvents.map((e) => e.id)
    for (const id of sharedIds) {
      expect(leftIds).toContain(id)
      expect(rightIds).toContain(id)
    }
    for (const id of leftOnlyIds) {
      expect(leftIds).toContain(id)
      expect(rightIds).not.toContain(id)
    }
    for (const id of rightOnlyIds) {
      expect(rightIds).toContain(id)
      expect(leftIds).not.toContain(id)
    }
    expect(new Set([...sharedIds, ...leftOnlyIds]).size).toBe(new Set(leftIds).size)
  })

  it('分岔年龄 = 分支原点下一年；关键选择只含主线节点', () => {
    const { left, right } = divergedFixture()
    const report = compareSides(buildSide(left, 'r_root'), buildSide(right))
    expect(report.divergenceAge).toBe(21)
    for (const choice of [...report.left.keyChoices, ...report.right.keyChoices]) {
      expect(choice.storyId.startsWith('s')).toBe(true)
      expect(choice.label.length).toBeGreaterThan(0)
    }
    expect(report.left.keyChoices.length).toBeGreaterThan(report.right.keyChoices.length)
  })

  it('交换左右：Δ 反号、分岔年龄不变、共同经历不变', () => {
    const { left, right } = divergedFixture()
    const a = buildSide(left, 'r_root')
    const b = buildSide(right)
    const forward = compareSides(a, b)
    const swapped = compareSides(b, a)
    for (const key of STAT_KEYS) {
      expect(swapped.statDelta[key]).toBe(-forward.statDelta[key])
    }
    expect(swapped.divergenceAge).toBe(forward.divergenceAge)
    expect(swapped.sharedEvents.map((e) => e.id)).toEqual(forward.sharedEvents.map((e) => e.id))
    expect(swapped.leftOnlyEvents.map((e) => e.id)).toEqual(forward.rightOnlyEvents.map((e) => e.id))
  })

  it('同路线对照：零差异、无分岔', () => {
    const { left } = divergedFixture()
    const side = buildSide(left, 'r_root')
    const report = compareSides(side, side)
    expect(report.sameRoute).toBe(true)
    expect(report.divergenceAge).toBeNull()
    for (const key of STAT_KEYS) expect(report.statDelta[key]).toBe(0)
  })

  it('终局路线携带结局名称与编号', () => {
    const ended = autoAdvance(
      createUniverse({ id: 'u-end', name: '终局', seed: 2026, archetypeId: 'creator' }),
      MAX_AGE,
    )
    const side = buildSide(ended)
    expect(side.status).toBe('ended')
    expect(side.endingName).not.toBeNull()
    expect(side.endingNumber).toBeGreaterThanOrEqual(1)
    expect(side.endingNumber).toBeLessThanOrEqual(ENDINGS.length)
    expect(ENDINGS[(side.endingNumber ?? 1) - 1]?.id).toBe(side.endingId)
  })
})