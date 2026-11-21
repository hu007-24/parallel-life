import { describe, expect, it } from 'vitest'
import type { Choice } from '@/engine/ple/types'
import { validateContent } from '@/engine/ple/content-validator'
import {
  MAX_AGE,
  branch,
  choose,
  createUniverse,
  getCurrentNode,
  getRoute,
  getRoutePath,
  replay,
} from '@/engine/ple/simulation-engine'
import { STORY_NODES } from '@/data/stories'
import { ARCHETYPES } from '@/data/archetypes'
import { ENDINGS } from '@/data/endings'
import { ACHIEVEMENTS } from '@/data/achievements'
import { createRng } from '@/engine/ple/random-engine'

type Strategy = (options: readonly Choice[]) => Choice

const first: Strategy = (options) => options[0] as Choice
const last: Strategy = (options) => options[options.length - 1] as Choice
const seeded = (seed: number): Strategy => {
  const rng = createRng(seed)
  return (options) => options[Math.floor(rng() * options.length)] as Choice
}
const solo: Strategy = (options) =>
  options.find((o) => o.tags.includes('story') && /独立|独自/.test(o.label)) ??
  options.find((o) => o.id.includes('solo') || o.id.includes('indie')) ??
  first(options)

function autoplay(identityId: string, strategy: Strategy, seed = 2026) {
  let universe = createUniverse({ id: 'u-content', name: '内容测试', seed, archetypeId: identityId })
  const choices: string[] = []
  while (getRoute(universe).status === 'active') {
    const option = strategy(getCurrentNode(universe).options)
    choices.push(option.id)
    universe = choose(universe, option.id)
  }
  return { universe, choices }
}

describe('content-validator：结构校验', () => {
  it('内容库通过全部结构校验', () => {
    const report = validateContent()
    expect(report.errors).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.unreachableStories).toEqual([])
    expect(report.noEndingStories).toEqual([])
  })

  it('数量目标达成：25 主线 / 15 普通 / 10 特殊 / 8 结局 / 12 成就', () => {
    const { counts } = validateContent()
    expect(counts.stories).toBe(25)
    expect(counts.normalEvents).toBe(15)
    expect(counts.specialEvents).toBe(10)
    expect(counts.endings).toBe(8)
    expect(counts.achievements).toBe(12)
    expect(counts.chapters).toBe(5)
    expect(counts.identities).toBe(4)
  })
})

describe('剧情图运行时：每种身份都能完整推进', () => {
  for (const identity of ARCHETYPES) {
    for (const [label, strategy] of [
      ['首选', first],
      ['末选', last],
      ['随机', seeded(7)],
    ] as const) {
      it(`${identity.name} · ${label}策略走完一生并抵达结局`, () => {
        const { universe } = autoplay(identity.id, strategy)
        const route = getRoute(universe)
        const node = getCurrentNode(universe)
        expect(route.status).toBe('ended')
        expect(node.age).toBe(MAX_AGE)
        expect(ENDINGS.map((e) => e.id)).toContain(route.endingId)
        expect(node.story.currentStoryId).toBeNull()
        expect(node.story.resolvedStoryIds).toHaveLength(23)
        expect(new Set(node.story.resolvedStoryIds).size).toBe(23)
      })
    }
  }

  it('任何年份都不会出现死路节点（选项 ≥ 2）', () => {
    const { universe } = autoplay('campus', seeded(11))
    for (const node of getRoutePath(universe)) {
      expect(node.options.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('里程碑年份选项来自剧情，且事件限定在节点 eventIds 内', () => {
    const { universe } = autoplay('traveler', seeded(3))
    for (const node of getRoutePath(universe)) {
      if (node.age === 0) {
        expect(node.options.every((o) => o.id.startsWith('st:s01:'))).toBe(true)
        continue
      }
      if (node.choiceId?.startsWith('st:')) {
        const storyId = node.choiceId.split(':')[1]
        const def = STORY_NODES.find((s) => s.id === storyId)
        expect(def).toBeDefined()
        if (def) {
          expect(node.age).toBe(def.minAge + 1)
          if (node.eventId) expect(def.eventIds).toContain(node.eventId)
        }
      }
    }
  })
})

describe('剧情分支：选择影响后续剧情且互不污染', () => {
  it('s07 分岔：主路线深耕 → s08，分支跨界 → s09', () => {
    let universe = createUniverse({ id: 'u-fork', name: '分岔', seed: 2026, archetypeId: 'campus' })
    while (getCurrentNode(universe).age < 21) {
      universe = choose(universe, first(getCurrentNode(universe).options).id)
    }
    const forkNode = getCurrentNode(universe)
    expect(forkNode.options.every((o) => o.id.startsWith('st:s07:'))).toBe(true)

    const main = choose(universe, (forkNode.options[0] as Choice).id)
    const branched = branch(universe, forkNode.id, '如果当年跨界')
    const branchNode = getCurrentNode(branched)
    const diverged = choose(branched, (branchNode.options[1] as Choice).id)

    let mainAt24 = main
    while (getCurrentNode(mainAt24).age < 24) {
      mainAt24 = choose(mainAt24, first(getCurrentNode(mainAt24).options).id)
    }
    let branchAt24 = diverged
    while (getCurrentNode(branchAt24).age < 24) {
      branchAt24 = choose(branchAt24, first(getCurrentNode(branchAt24).options).id)
    }
    expect(getCurrentNode(mainAt24).options[0]?.id.startsWith('st:s08:')).toBe(true)
    expect(getCurrentNode(branchAt24).options[0]?.id.startsWith('st:s09:')).toBe(true)
    expect(getCurrentNode(mainAt24).story.flags).toContain('deep-study')
    expect(getCurrentNode(branchAt24).story.flags).toContain('cross-study')
    expect(getCurrentNode(mainAt24, 'r_root').story.flags).toContain('deep-study')
    const originalIds = getRoute(universe, 'r_root').nodeIds
    expect(getRoute(mainAt24, 'r_root').nodeIds.slice(0, originalIds.length)).toEqual(originalIds)
    expect(getRoute(branched, 'r_root').nodeIds).toEqual(originalIds)
  })

  it('相同 seed + 相同决策路径复现剧情进度与 flags', () => {
    const { universe, choices } = autoplay('creator', solo)
    const rebuilt = replay({ id: 'u-content', name: '内容测试', seed: 2026, archetypeId: 'creator' }, choices)
    expect(rebuilt.nodes).toEqual(universe.nodes)
    expect(getCurrentNode(rebuilt).story).toEqual(getCurrentNode(universe).story)
  })
})

describe('隐藏成就：条件解锁与 once 语义', () => {
  it('独立创造路径解锁「第一个完整作品」与「独立建造者」', () => {
    const { universe } = autoplay('creator', solo)
    const seen = getCurrentNode(universe).seenAchievementIds
    expect(seen).toContain('a-first-project')
    expect(seen).toContain('a-solo-builder')
    expect(new Set(seen).size).toBe(seen.length)
    for (const id of seen) {
      expect(ACHIEVEMENTS.map((a) => a.id)).toContain(id)
    }
  })

  it('多身份多策略下成就集合始终合法且无重复', () => {
    for (const identity of ARCHETYPES) {
      const { universe } = autoplay(identity.id, seeded(42))
      const seen = getCurrentNode(universe).seenAchievementIds
      expect(new Set(seen).size).toBe(seen.length)
      for (const id of seen) {
        expect(ACHIEVEMENTS.map((a) => a.id)).toContain(id)
      }
    }
  })
})