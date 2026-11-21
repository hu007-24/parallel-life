import { describe, expect, it } from 'vitest'
import {
  assembleUniverse,
  collectionKey,
  collectionsFromUniverse,
  nodeRowKey,
  splitUniverse,
} from '@/database/mapping'
import {
  MAX_AGE,
  autoAdvance,
  createUniverse,
  deriveUniverse,
  getCurrentNode,
  getRoute,
} from '@/engine/ple/simulation-engine'
import { ENDINGS } from '@/data/endings'

function sample() {
  return autoAdvance(
    createUniverse({ id: 'u-map', name: '映射', seed: 2026, archetypeId: 'campus' }),
    12,
  )
}

describe('mapping：split / assemble roundtrip', () => {
  it('拆分后组装还原完整宇宙', () => {
    const universe = sample()
    const { meta, rows } = splitUniverse(universe)
    const assembled = assembleUniverse(meta, rows)
    expect(assembled.id).toBe(universe.id)
    expect(assembled.seed).toBe(universe.seed)
    expect(assembled.nodes).toEqual(universe.nodes)
    expect(assembled.routes).toEqual(universe.routes)
    expect(assembled.currentRouteId).toBe(universe.currentRouteId)
    expect(rows).toHaveLength(Object.keys(universe.nodes).length)
  })

  it('组装产生独立副本：修改组装结果不影响行数据', () => {
    const universe = sample()
    const { meta, rows } = splitUniverse(universe)
    const assembled = assembleUniverse(meta, rows)
    const nodeId = getRoute(assembled).currentNodeId
    const node = assembled.nodes[nodeId]
    const row = rows.find((r) => r.nodeId === nodeId)
    expect(node).not.toBe(row?.data)
    if (node) node.stats.creativity = 1
    expect(row?.data.stats.creativity).not.toBe(1)
  })

  it('同种子派生宇宙不共享可变状态对象', () => {
    const original = autoAdvance(
      createUniverse({ id: 'u-iso-a', name: '甲', seed: 2026, archetypeId: 'campus' }),
      20,
    )
    const originId = getRoute(original).nodeIds[10] as string
    const derived = deriveUniverse(original, originId, { id: 'u-iso-b', name: '乙' })
    const sharedId = getRoute(derived).currentNodeId
    expect(original.nodes[sharedId]).toBeDefined()
    expect(derived.nodes[sharedId]).not.toBe(original.nodes[sharedId])
    expect(derived.nodes[sharedId]?.stats).not.toBe(original.nodes[sharedId]?.stats)
    const derivedNode = derived.nodes[sharedId]
    if (derivedNode) derivedNode.stats.happiness = 3
    expect(original.nodes[sharedId]?.stats.happiness).not.toBe(3)
    // 行主键含 universeId：同 node.id 不冲突
    expect(nodeRowKey(original.id, sharedId)).not.toBe(nodeRowKey(derived.id, sharedId))
  })
})

describe('mapping：collections 推导', () => {
  it('终局宇宙产出结局 / 成就 / 特殊事件 / 收藏记录', () => {
    const ended = autoAdvance(
      createUniverse({ id: 'u-col', name: '图鉴', seed: 2026, archetypeId: 'creator' }),
      MAX_AGE,
    )
    const favorite = { ...ended, favorite: true }
    const records = collectionsFromUniverse(favorite, 1000)
    const endingId = getRoute(favorite).endingId
    expect(endingId).not.toBeNull()
    expect(records.some((r) => r.kind === 'ending' && r.refId === endingId)).toBe(true)
    expect(ENDINGS.map((e) => e.id)).toContain(endingId)
    expect(records.some((r) => r.kind === 'favorite' && r.refId === favorite.id)).toBe(true)
    const node = getCurrentNode(favorite)
    for (const id of node.seenAchievementIds) {
      expect(records.some((r) => r.kind === 'achievement' && r.refId === id)).toBe(true)
    }
    for (const record of records) {
      expect(record.id).toBe(collectionKey(record.kind, record.refId, record.universeId))
      expect(record.unlockedAt).toBe(1000)
    }
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length)
  })

  it('未结束宇宙不产出结局记录', () => {
    const records = collectionsFromUniverse(sample(), 0)
    expect(records.some((r) => r.kind === 'ending')).toBe(false)
  })
})