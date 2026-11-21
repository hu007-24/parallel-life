import { describe, expect, it } from 'vitest'
import { buildPayload, validateImport, TRANSFER_VERSION } from '@/utils/transfer'
import { collectionsFromUniverse } from '@/database/mapping'
import { autoAdvance, createUniverse } from '@/engine/ple/simulation-engine'
import type { AppSettings } from '@/types'

const SETTINGS: AppSettings = { reduceMotion: false, sound: true }

function sampleUniverse() {
  return autoAdvance(
    createUniverse({ id: 'u-transfer', name: '传输', seed: 2026, archetypeId: 'campus' }),
    12,
  )
}

function payloadWith(mutate: (payload: Record<string, unknown>) => void) {
  const payload = JSON.parse(
    JSON.stringify(buildPayload([sampleUniverse()], SETTINGS)),
  ) as Record<string, unknown>
  mutate(payload)
  return payload
}

describe('transfer：导出与导入校验', () => {
  it('导出 payload 可完整回导（roundtrip）', () => {
    const universe = sampleUniverse()
    const payload = buildPayload([universe], SETTINGS)
    const result = validateImport(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.universes).toHaveLength(1)
    const imported = result.universes[0]
    expect(imported?.id).toBe(universe.id)
    expect(imported?.nodes).toEqual(universe.nodes)
    expect(imported?.routes).toEqual(universe.routes)
    expect(result.settings).toEqual(SETTINGS)
  })

  it('拒绝非对象 / 版本不兼容 / 缺 universes', () => {
    expect(validateImport(null).ok).toBe(false)
    expect(validateImport([]).ok).toBe(false)
    expect(validateImport('x').ok).toBe(false)
    expect(validateImport({ version: TRANSFER_VERSION - 1, universes: [] }).ok).toBe(false)
    expect(validateImport({ version: TRANSFER_VERSION }).ok).toBe(false)
  })

  it('拒绝悬空引用：route.nodeIds / currentNodeId / parentId', () => {
    const danglingNode = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const routes = universes[0]?.routes as Record<string, Record<string, unknown>>
      const root = routes.r_root
      if (root) root.nodeIds = [...(root.nodeIds as string[]), 'n-ghost']
    })
    expect(validateImport(danglingNode).errors.join()).toContain('不存在节点')

    const badCurrent = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const routes = universes[0]?.routes as Record<string, Record<string, unknown>>
      const root = routes.r_root
      if (root) root.currentNodeId = 'n-ghost'
    })
    expect(validateImport(badCurrent).ok).toBe(false)

    const badParent = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const nodes = universes[0]?.nodes as Record<string, Record<string, unknown>>
      const first = Object.values(nodes)[1]
      if (first) first.parentId = 'n-ghost'
    })
    expect(validateImport(badParent).errors.join()).toContain('parentId')
  })

  it('拒绝越界属性与非法结局状态', () => {
    const badStats = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const nodes = universes[0]?.nodes as Record<string, Record<string, unknown>>
      const first = Object.values(nodes)[0]
      if (first) first.stats = { ...(first.stats as object), creativity: 101 }
    })
    expect(validateImport(badStats).errors.join()).toContain('creativity')

    const badEnding = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const routes = universes[0]?.routes as Record<string, Record<string, unknown>>
      const root = routes.r_root
      if (root) {
        root.status = 'ended'
        root.endingId = 'not-an-ending'
      }
    })
    expect(validateImport(badEnding).errors.join()).toContain('endingId')

    const activeWithEnding = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const routes = universes[0]?.routes as Record<string, Record<string, unknown>>
      const root = routes.r_root
      if (root) root.endingId = 'research'
    })
    expect(validateImport(activeWithEnding).ok).toBe(false)
  })

  it('settings 缺省可接受、部分字段可接受、非法类型拒绝', () => {
    const noSettings = payloadWith((p) => {
      delete p.settings
    })
    const result = validateImport(noSettings)
    expect(result.ok).toBe(true)
    expect(result.settings).toBeNull()

    const partial = payloadWith((p) => {
      p.settings = { sound: false }
    })
    expect(validateImport(partial).settings).toEqual({ sound: false })

    const bad = payloadWith((p) => {
      p.settings = { sound: 'yes' }
    })
    expect(validateImport(bad).ok).toBe(false)
  })

  it('空宇宙列表合法（导入 0 个）', () => {
    const result = validateImport(buildPayload([], SETTINGS))
    expect(result.ok).toBe(true)
    expect(result.universes).toHaveLength(0)
  })
})

describe('transfer v4：主键 / 父子链 / 剧情引用 / 图鉴引用', () => {
  it('roundtrip 携带 collections', () => {
    const universe = { ...sampleUniverse(), favorite: true }
    const collections = collectionsFromUniverse(universe, 1000)
    expect(collections.length).toBeGreaterThan(0)
    const payload = buildPayload([universe], SETTINGS, collections)
    const result = validateImport(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
    expect(result.collections).toHaveLength(collections.length)
    expect(result.collections[0]?.unlockedAt).toBe(1000)
  })

  it('拒绝宇宙主键重复', () => {
    const universe = sampleUniverse()
    const payload = buildPayload([universe, universe], SETTINGS)
    const result = validateImport(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toContain('主键重复')
  })

  it('拒绝父子链断裂与当前节点非链尾', () => {
    const brokenChain = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const routes = universes[0]?.routes as Record<string, Record<string, unknown>>
      const root = routes.r_root
      if (root) {
        const ids = [...(root.nodeIds as string[])]
        const tmp = ids[1]
        ids[1] = ids[2] as string
        ids[2] = tmp as string
        root.nodeIds = ids
      }
    })
    expect(validateImport(brokenChain).errors.join()).toContain('父子关系断裂')

    const badCurrent = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const routes = universes[0]?.routes as Record<string, Record<string, unknown>>
      const root = routes.r_root
      if (root) root.currentNodeId = (root.nodeIds as string[])[0]
    })
    expect(validateImport(badCurrent).errors.join()).toContain('链尾')
  })

  it('拒绝剧情引用错误：currentStoryId / choiceId / 选项', () => {
    const badStory = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const nodes = universes[0]?.nodes as Record<string, Record<string, unknown>>
      const first = Object.values(nodes)[0]
      if (first) first.story = { ...(first.story as object), currentStoryId: 's99' }
    })
    expect(validateImport(badStory).errors.join()).toContain('不存在剧情')

    const badChoice = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const nodes = universes[0]?.nodes as Record<string, Record<string, unknown>>
      const second = Object.values(nodes)[1]
      if (second) second.choiceId = 'st:s99:o-ghost'
    })
    expect(validateImport(badChoice).errors.join()).toContain('不存在剧情')

    const badPool = payloadWith((p) => {
      const universes = p.universes as Array<Record<string, unknown>>
      const nodes = universes[0]?.nodes as Record<string, Record<string, unknown>>
      const second = Object.values(nodes)[1]
      if (second) second.choiceId = 'c-ghost'
    })
    expect(validateImport(badPool).errors.join()).toContain('不存在选择')
  })

  it('拒绝图鉴非法引用与主键重复', () => {
    const universe = sampleUniverse()
    const base = buildPayload([universe], SETTINGS)
    const badKind = JSON.parse(
      JSON.stringify({
        ...base,
        collections: [
          { id: 'x', kind: 'bogus', refId: 'r', universeId: universe.id, unlockedAt: 1 },
        ],
      }),
    )
    expect(validateImport(badKind).ok).toBe(false)

    const badRef = JSON.parse(
      JSON.stringify({
        ...base,
        collections: [
          {
            id: 'ending:ghost:u',
            kind: 'ending',
            refId: 'ghost',
            universeId: universe.id,
            unlockedAt: 1,
          },
        ],
      }),
    )
    expect(validateImport(badRef).errors.join()).toContain('不存在结局')

    const badUniverse = JSON.parse(
      JSON.stringify({
        ...base,
        collections: [
          {
            id: 'favorite:u-ghost:u-ghost',
            kind: 'favorite',
            refId: 'u-ghost',
            universeId: 'u-ghost',
            unlockedAt: 1,
          },
        ],
      }),
    )
    expect(validateImport(badUniverse).errors.join()).toContain('不存在宇宙')

    const dup = JSON.parse(
      JSON.stringify({
        ...base,
        collections: [
          {
            id: 'a',
            kind: 'favorite',
            refId: universe.id,
            universeId: universe.id,
            unlockedAt: 1,
          },
          {
            id: 'b',
            kind: 'favorite',
            refId: universe.id,
            universeId: universe.id,
            unlockedAt: 2,
          },
        ],
      }),
    )
    expect(validateImport(dup).errors.join()).toContain('主键重复')
  })
})