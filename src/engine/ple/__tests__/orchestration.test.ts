import { describe, expect, it } from 'vitest'
import {
  MAX_AGE,
  autoAdvance,
  autoChoiceId,
  choose,
  createUniverse,
  deriveUniverse,
  getCurrentNode,
  getRoute,
  getRoutePath,
  pathToNode,
} from '@/engine/ple/simulation-engine'

function make(seed = 2026) {
  return createUniverse({ id: 'u-orch', name: '编排测试', seed, archetypeId: 'campus' })
}

describe('autoAdvance：起始阶段快进', () => {
  it('快进到目标年龄且全部为真实引擎节点', () => {
    const advanced = autoAdvance(make(), 30)
    const node = getCurrentNode(advanced)
    expect(node.age).toBe(30)
    expect(getRoutePath(advanced)).toHaveLength(31)
    expect(getRoute(advanced).status).toBe('active')
  })

  it('同 seed 快进结果完全一致（确定性）', () => {
    const a = autoAdvance(make(), 45)
    const b = autoAdvance(make(), 45)
    expect(a.nodes).toEqual(b.nodes)
    expect(a.routes).toEqual(b.routes)
  })

  it('目标年龄超过寿命时停在终局', () => {
    const advanced = autoAdvance(make(), MAX_AGE + 10)
    expect(getCurrentNode(advanced).age).toBe(MAX_AGE)
    expect(getRoute(advanced).status).toBe('ended')
    expect(getRoute(advanced).endingId).not.toBeNull()
  })

  it('autoChoiceId 始终属于当前合法选项且可复现', () => {
    const universe = autoAdvance(make(), 20)
    const id = autoChoiceId(universe)
    expect(getCurrentNode(universe).options.map((o) => o.id)).toContain(id)
    expect(autoChoiceId(universe)).toBe(id)
  })
})

describe('deriveUniverse：回溯派生独立宇宙', () => {
  it('派生宇宙的历史节点与原宇宙前缀完全一致', () => {
    const played = autoAdvance(make(), 24)
    const originId = getRoute(played).nodeIds[10] as string
    const derived = deriveUniverse(played, originId, { id: 'u-derived', name: '派生' })
    const originalPrefix = pathToNode(played, originId)
    const derivedPath = getRoutePath(derived)
    expect(derivedPath.map((n) => n.id)).toEqual(originalPrefix.map((n) => n.id))
    expect(derivedPath.map((n) => n.stats)).toEqual(originalPrefix.map((n) => n.stats))
    expect(derived.id).toBe('u-derived')
    expect(derived.seed).toBe(played.seed)
  })

  it('派生后两条人生独立推进，互不污染', () => {
    const played = autoAdvance(make(), 24)
    const originId = getRoute(played).nodeIds[10] as string
    const derived = deriveUniverse(played, originId, { id: 'u-derived', name: '派生' })
    const advancedDerived = choose(derived, autoChoiceId(derived))
    const advancedOriginal = choose(played, autoChoiceId(played))
    expect(getCurrentNode(advancedDerived).id).not.toBe(getCurrentNode(advancedOriginal).id)
    expect(advancedOriginal.nodes[originId]).toEqual(played.nodes[originId])
    expect(Object.keys(advancedDerived.nodes)).not.toContain(getCurrentNode(advancedOriginal).id)
  })
})