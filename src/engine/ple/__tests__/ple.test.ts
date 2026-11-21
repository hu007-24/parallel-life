import { describe, expect, it } from 'vitest'
import {
  EngineError,
  type LifeNode,
  type LifeStats,
  type Universe,
} from '@/engine/ple/types'
import { applyDelta, createStats, mergeDeltas, validateStats, STAT_KEYS } from '@/engine/ple/state-engine'
import { createRng, rngFor } from '@/engine/ple/random-engine'
import { eligibleEvents, rollEvent } from '@/engine/ple/event-engine'
import { triggerNarratives } from '@/engine/ple/narrative-engine'
import { computeEnding } from '@/engine/ple/ending-engine'
import {
  MAX_AGE,
  branch,
  choose,
  createUniverse,
  getCurrentNode,
  getRoute,
  getRoutePath,
  replay,
  selectRoute,
} from '@/engine/ple/simulation-engine'
import { LIFE_EVENTS } from '@/data/events'
import { NARRATIVES } from '@/data/narratives'
import { ENDINGS } from '@/data/endings'

const SEED = 2026

function makeUniverse(seed = SEED): Universe {
  return createUniverse({ id: 'u-test', name: '测试宇宙', seed, archetypeId: 'campus' })
}

function firstChoiceId(universe: Universe): string {
  const option = getCurrentNode(universe).options[0]
  if (!option) throw new Error('node has no options')
  return option.id
}

function play(universe: Universe, years: number): { universe: Universe; choices: string[] } {
  const choices: string[] = []
  let current = universe
  for (let i = 0; i < years; i++) {
    const id = firstChoiceId(current)
    choices.push(id)
    current = choose(current, id)
  }
  return { universe: current, choices }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function statsFixture(partial: Partial<LifeStats>): LifeStats {
  return { creativity: 50, exploration: 50, social: 50, influence: 50, happiness: 50, ...partial }
}

function nodeFixture(
  stats: LifeStats,
  seenEventIds: string[] = [],
  seenNarrativeIds: string[] = [],
  age = 60,
): LifeNode {
  return {
    id: 'fixture',
    parentId: null,
    age,
    stats,
    pathKey: 'fixture',
    identityId: 'campus',
    choiceId: null,
    choiceLabel: null,
    eventId: null,
    narrativeIds: [],
    achievementIds: [],
    seenEventIds,
    seenNarrativeIds,
    seenAchievementIds: [],
    story: { currentStoryId: null, flags: [], resolvedStoryIds: [] },
    options: [],
  }
}

describe('state-engine：属性上下限与校验（要求 1、2）', () => {
  it('属性不会超过 100', () => {
    const base = statsFixture({ creativity: 95 })
    const next = applyDelta(base, { creativity: 50, happiness: 200 })
    expect(next.creativity).toBe(100)
    expect(next.happiness).toBe(100)
  })

  it('属性不会低于 0', () => {
    const base = statsFixture({ happiness: 5 })
    const next = applyDelta(base, { happiness: -80, influence: -500 })
    expect(next.happiness).toBe(0)
    expect(next.influence).toBe(0)
  })

  it('非法增量被拒绝而不是静默忽略', () => {
    expect(() => applyDelta(statsFixture({}), { creativity: Number.NaN })).toThrow(EngineError)
    expect(() => applyDelta(statsFixture({}), { social: Number.POSITIVE_INFINITY })).toThrow(
      EngineError,
    )
  })

  it('非法状态被拒绝', () => {
    expect(() => validateStats({ creativity: 10 } as LifeStats)).toThrow(EngineError)
  })

  it('多来源增量先求和再钳制', () => {
    const merged = mergeDeltas({ creativity: 60 }, { creativity: 60 }, { happiness: -10 })
    const next = applyDelta(statsFixture({ creativity: 50 }), merged)
    expect(next.creativity).toBe(100)
    expect(next.happiness).toBe(40)
  })

  it('createStats 对初始值钳制', () => {
    const stats = createStats(statsFixture({ creativity: 150, social: -20 }))
    expect(stats.creativity).toBe(100)
    expect(stats.social).toBe(0)
  })
})

describe('random-engine：种子可复现（要求 7）', () => {
  it('相同 seed 的随机流完全一致', () => {
    const a = createRng(SEED)
    const b = createRng(SEED)
    for (let i = 0; i < 200; i++) expect(a()).toBe(b())
  })

  it('相同 seed + 相同 pathKey 的派生流一致，不同 pathKey 相互独立', () => {
    const a = rngFor(SEED, 'event', 'root>c-play')
    const b = rngFor(SEED, 'event', 'root>c-play')
    const c = rngFor(SEED, 'event', 'root>c-library')
    const same = Array.from({ length: 50 }, () => a() === b()).every(Boolean)
    expect(same).toBe(true)
    const diverge = Array.from({ length: 50 }, () => a() === c()).some(Boolean)
    expect(diverge).toBe(false)
  })
})

describe('simulation-engine：选择处理（要求 3、4）', () => {
  it('合法选择能够更新状态并建立父子关系', () => {
    const universe = makeUniverse()
    const parent = getCurrentNode(universe)
    const choiceId = firstChoiceId(universe)
    const next = choose(universe, choiceId)
    const child = getCurrentNode(next)
    expect(child.age).toBe(parent.age + 1)
    expect(child.parentId).toBe(parent.id)
    expect(child.choiceId).toBe(choiceId)
    expect(child.stats).not.toEqual(parent.stats)
    for (const key of STAT_KEYS) {
      expect(child.stats[key]).toBeGreaterThanOrEqual(0)
      expect(child.stats[key]).toBeLessThanOrEqual(100)
    }
    expect(getRoute(next).currentNodeId).toBe(child.id)
  })

  it('非法选择会被拒绝', () => {
    const universe = makeUniverse()
    expect(() => choose(universe, 'c-does-not-exist')).toThrow(EngineError)
    try {
      choose(universe, 'c-does-not-exist')
    } catch (error) {
      expect((error as EngineError).code).toBe('INVALID_CHOICE')
    }
  })

  it('不存在的路线会被拒绝', () => {
    const universe = makeUniverse()
    expect(() => choose(universe, firstChoiceId(universe), 'r-nope')).toThrow(EngineError)
  })
})

describe('timeline-engine：分支不可变与独立（要求 5、6、11）', () => {
  it('分支不会污染原节点（原宇宙被深度冻结仍可分支推进）', () => {
    const { universe: played } = play(makeUniverse(), 6)
    const frozen = deepFreeze(played)
    const originId = getRoute(frozen).nodeIds[3] as string
    const branched = branch(frozen, originId, '如果当年选了另一条')
    const advanced = choose(branched, firstChoiceId(branched))
    expect(advanced).not.toBe(frozen)
    // 原宇宙所有节点快照保持原样
    for (const [id, node] of Object.entries(frozen.nodes)) {
      expect(advanced.nodes[id]).toEqual(node)
    }
    expect(getRoute(frozen).currentNodeId).toBe(played.routes.r_root?.currentNodeId)
  })

  it('新旧时间线能够独立存在', () => {
    const { universe: played } = play(makeUniverse(), 6)
    const originId = getRoute(played).nodeIds[3] as string
    const branched = branch(played, originId, '分支 A')
    const diverged = choose(branched, firstChoiceId(branched))

    expect(Object.keys(diverged.routes)).toHaveLength(2)
    const originalRoute = getRoute(diverged, 'r_root')
    const branchRoute = getRoute(diverged)
    expect(originalRoute.nodeIds).toEqual(played.routes.r_root?.nodeIds)
    expect(branchRoute.originNodeId).toBe(originId)
    expect(branchRoute.currentNodeId).not.toBe(originalRoute.currentNodeId)
    // 分支路径的前缀 = 原点路径（共享不可变祖先）
    const branchPath = getRoutePath(diverged)
    expect(branchPath.slice(0, 4).map((n) => n.id)).toEqual(
      (played.routes.r_root?.nodeIds ?? []).slice(0, 4),
    )
  })

  it('不同路线的当前节点互不干扰，指针可切换', () => {
    const { universe: played } = play(makeUniverse(), 5)
    const originId = getRoute(played).nodeIds[2] as string
    const branched = branch(played, originId, '分支 B')
    const branchCurrent = getCurrentNode(branched)
    const advanced = choose(branched, firstChoiceId(branched))

    expect(getCurrentNode(advanced, 'r_root').id).toBe(played.routes.r_root?.currentNodeId)
    expect(getCurrentNode(advanced).id).not.toBe(branchCurrent.id)

    const switched = selectRoute(advanced, 'r_root')
    expect(getCurrentNode(switched).id).toBe(played.routes.r_root?.currentNodeId)
    expect(getRoute(switched).id).toBe('r_root')
  })

  it('回溯分支保留原路线对象与全部历史节点', () => {
    const { universe: played } = play(makeUniverse(), 8)
    const before = JSON.stringify(played.routes.r_root)
    const branched = branch(played, getRoute(played).nodeIds[4] as string, '回溯')
    expect(JSON.stringify(branched.routes.r_root)).toBe(before)
    expect(Object.keys(branched.nodes).length).toBe(Object.keys(played.nodes).length)
  })
})

describe('可复现模拟（要求 7）', () => {
  it('相同 seed + 相同决策路径重建出完全一致的宇宙', () => {
    const { universe: interactive, choices } = play(makeUniverse(), 25)
    const rebuilt = replay(
      { id: 'u-test', name: '测试宇宙', seed: SEED, archetypeId: 'campus' },
      choices,
    )
    expect(rebuilt.nodes).toEqual(interactive.nodes)
    expect(rebuilt.routes).toEqual(interactive.routes)
    expect(rebuilt.currentRouteId).toBe(interactive.currentRouteId)
  })

  it('不同 seed 产生不同的人生轨迹', () => {
    const a = play(makeUniverse(1), 20).universe
    const b = play(makeUniverse(999), 20).universe
    const eventsA = getRoutePath(a).map((n) => n.eventId)
    const eventsB = getRoutePath(b).map((n) => n.eventId)
    expect(eventsA).not.toEqual(eventsB)
  })
})

describe('narrative-engine / event-engine：条件与去重（要求 8、9）', () => {
  it('不满足条件的剧情不会触发', () => {
    const ctx = {
      stats: statsFixture({ creativity: 10, exploration: 10, social: 10, influence: 10, happiness: 40 }),
      age: 30,
      seenEventIds: [],
      seenNarrativeIds: [],
      identityId: 'campus',
      flags: [],
    }
    expect(triggerNarratives(NARRATIVES, ctx)).toHaveLength(0)
  })

  it('满足条件的剧情才会触发', () => {
    const ctx = {
      stats: statsFixture({ social: 70 }),
      age: 30,
      seenEventIds: [],
      seenNarrativeIds: [],
      identityId: 'campus',
      flags: [],
    }
    const ids = triggerNarratives(NARRATIVES, ctx).map((n) => n.id)
    expect(ids).toContain('n-belonging')
    expect(ids).not.toContain('n-recognition')
  })

  it('已触发剧情不会重复执行', () => {
    const ctx = {
      stats: statsFixture({ social: 70 }),
      age: 30,
      seenEventIds: [],
      seenNarrativeIds: ['n-belonging'],
      identityId: 'campus',
      flags: [],
    }
    expect(triggerNarratives(NARRATIVES, ctx).map((n) => n.id)).not.toContain('n-belonging')
  })

  it('已触发事件不会进入候选池', () => {
    const ctx = {
      stats: statsFixture({ exploration: 80 }),
      age: 40,
      seenEventIds: ['e-lab-discovery'],
      seenNarrativeIds: [],
      identityId: 'campus',
      flags: [],
    }
    expect(eligibleEvents(LIFE_EVENTS, ctx).map((e) => e.id)).not.toContain('e-lab-discovery')
  })

  it('不满足条件的事件不会进入候选池', () => {
    const ctx = {
      stats: statsFixture({ influence: 80, creativity: 80 }),
      age: 40,
      seenEventIds: [],
      seenNarrativeIds: [],
      identityId: 'campus',
      flags: [],
    }
    expect(eligibleEvents(LIFE_EVENTS, ctx).map((e) => e.id)).not.toContain('e-anonymous-master')
  })

  it('完整人生路径中事件不重复执行', () => {
    const { universe } = play(makeUniverse(), MAX_AGE)
    const eventIds = getRoutePath(universe)
      .map((n) => n.eventId)
      .filter((id): id is string => id !== null)
    expect(new Set(eventIds).size).toBe(eventIds.length)
  })

  it('概率门为 0 时不产生随机事件', () => {
    const ctx = {
      stats: statsFixture({}),
      age: 30,
      seenEventIds: [],
      seenNarrativeIds: [],
      identityId: 'campus',
      flags: [],
    }
    expect(rollEvent(LIFE_EVENTS, ctx, createRng(1), 0)).toBeNull()
  })
})

describe('ending-engine：多维判定与稳定性（要求 10）', () => {
  it('结局计算结果稳定（重复调用与复现路径一致）', () => {
    const { universe } = play(makeUniverse(), MAX_AGE)
    const node = getCurrentNode(universe)
    const first = computeEnding(ENDINGS, node)
    for (let i = 0; i < 5; i++) expect(computeEnding(ENDINGS, node)).toBe(first)
    const { universe: rebuilt, choices } = play(makeUniverse(), MAX_AGE)
    const replayed = replay(
      { id: 'u-test', name: '测试宇宙', seed: SEED, archetypeId: 'campus' },
      choices,
    )
    expect(rebuilt.nodes).toEqual(replayed.nodes)
    expect(computeEnding(ENDINGS, getCurrentNode(replayed))).toBe(first)
  })

  it('创业结局需要经历条件，而非单维属性', () => {
    const stats = statsFixture({ influence: 65, creativity: 55, social: 60 })
    const withExperience = nodeFixture(stats, ['e-startup-launch'])
    const withoutExperience = nodeFixture(stats, [])
    expect(computeEnding(ENDINGS, withExperience)).toBe('founder')
    expect(computeEnding(ENDINGS, withoutExperience)).not.toBe('founder')
  })

  it('高影响但无创业经历 → 领域引领者而非创业实践者', () => {
    const node = nodeFixture(statsFixture({ influence: 85, social: 60 }))
    expect(computeEnding(ENDINGS, node)).toBe('leader')
  })

  it('隐藏传奇需要特殊事件组合', () => {
    const stats = statsFixture({ creativity: 80, influence: 40, happiness: 70, exploration: 60 })
    expect(computeEnding(ENDINGS, nodeFixture(stats, ['e-anonymous-master']))).toBe('hidden')
    expect(computeEnding(ENDINGS, nodeFixture(stats, []))).not.toBe('hidden')
  })

  it('均衡人生 → 多元跨界者；低维人生也有归宿', () => {
    const balanced = nodeFixture(
      statsFixture({ creativity: 80, exploration: 80, social: 80, influence: 80, happiness: 80 }),
      [],
      ['n-balance'],
    )
    expect(computeEnding(ENDINGS, balanced)).toBe('polymath')
    const low = nodeFixture(statsFixture({ creativity: 10, exploration: 10, social: 10, influence: 10, happiness: 10 }))
    expect(ENDINGS.map((e) => e.id)).toContain(computeEnding(ENDINGS, low))
  })
})

describe('simulation-engine：终局保存（要求 12）', () => {
  it('模拟完成后正确保存最终状态与结局', () => {
    const { universe } = play(makeUniverse(), MAX_AGE)
    const route = getRoute(universe)
    const finalNode = getCurrentNode(universe)
    expect(route.status).toBe('ended')
    expect(route.endingId).not.toBeNull()
    expect(ENDINGS.map((e) => e.id)).toContain(route.endingId)
    expect(route.nodeIds).toHaveLength(MAX_AGE + 1)
    expect(finalNode.age).toBe(MAX_AGE)
    expect(finalNode.id).toBe(route.nodeIds[route.nodeIds.length - 1])
    for (const key of STAT_KEYS) {
      expect(finalNode.stats[key]).toBeGreaterThanOrEqual(0)
      expect(finalNode.stats[key]).toBeLessThanOrEqual(100)
    }
    expect(() => choose(universe, firstChoiceId(universe))).toThrow(EngineError)
  })

  it('分支路线可以独立走完一生并得到自己的结局', () => {
    const { universe: played } = play(makeUniverse(), 10)
    const branched = branch(played, getRoute(played).nodeIds[5] as string, '第二人生')
    let current = branched
    while (getRoute(current).status === 'active') {
      current = choose(current, firstChoiceId(current))
    }
    expect(getRoute(current, 'r_root').status).toBe('active')
    expect(getRoute(current).status).toBe('ended')
    expect(getRoute(current).endingId).not.toBeNull()
  })
})