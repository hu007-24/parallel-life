import type { AppSettings, LifeNode, Route, Universe } from '@/types'
import type { CollectionRecord } from '@/database/mapping'
import { STAT_KEYS } from '@/engine/ple/state-engine'
import { MAX_AGE } from '@/engine/ple/timeline-engine'
import { parseStoryChoice } from '@/engine/ple/story-engine'
import { ENDINGS } from '@/data/endings'
import { ACHIEVEMENTS } from '@/data/achievements'
import { LIFE_EVENTS } from '@/data/events'
import { STORY_NODES } from '@/data/stories'
import { CHOICE_POOL } from '@/data/choices'

export const TRANSFER_VERSION = 4

export interface TransferPayload {
  version: number
  exportedAt: number
  universes: Universe[]
  collections: CollectionRecord[]
  settings: AppSettings
}

export function buildPayload(
  universes: Universe[],
  settings: AppSettings,
  collections: CollectionRecord[] = [],
): TransferPayload {
  return { version: TRANSFER_VERSION, exportedAt: Date.now(), universes, collections, settings }
}

export interface ImportValidation {
  ok: boolean
  errors: string[]
  universes: Universe[]
  collections: CollectionRecord[]
  settings: Partial<AppSettings> | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const STORY_IDS = new Set(STORY_NODES.map((s) => s.id))
const STORY_OPTIONS = new Map(STORY_NODES.map((s) => [s.id, new Set(s.options.map((o) => o.id))]))
const POOL_IDS = new Set(CHOICE_POOL.map((c) => c.id))
const ENDING_IDS = new Set(ENDINGS.map((e) => e.id))
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id))
const SPECIAL_IDS = new Set(LIFE_EVENTS.filter((e) => e.tier === 'special').map((e) => e.id))
const COLLECTION_KINDS = new Set(['ending', 'achievement', 'specialEvent', 'favorite'])

/**
 * 导入校验（纯函数）：文件版本、数据结构、主键重复、父节点存在、子节点关系、
 * 宇宙引用、剧情引用、图鉴引用。任何一条错误即整包拒绝，绝不触碰当前数据库。
 */
export function validateImport(raw: unknown): ImportValidation {
  const errors: string[] = []
  const fail = (message: string): ImportValidation => ({
    ok: false,
    errors: [...errors, message],
    universes: [],
    collections: [],
    settings: null,
  })

  if (!isRecord(raw)) return fail('文件不是合法的 JSON 对象')
  if (raw.version !== TRANSFER_VERSION) {
    return fail(`版本不兼容：期望 ${TRANSFER_VERSION}，实际 ${String(raw.version)}`)
  }
  if (!Array.isArray(raw.universes)) return fail('缺少 universes 数组')
  if (raw.universes.length > 500) return fail('宇宙数量超过上限 500')

  const universes: Universe[] = []
  const universeIds = new Set<string>()
  let totalNodes = 0
  for (const [index, item] of raw.universes.entries()) {
    const where = `universes[${index}]`
    if (!isRecord(item)) return fail(`${where} 不是对象`)
    const u = item as Record<string, unknown>
    if (typeof u.id !== 'string' || u.id.length === 0) return fail(`${where}.id 缺失`)
    if (universeIds.has(u.id)) return fail(`主键重复：宇宙 ${u.id}`)
    universeIds.add(u.id)
    if (typeof u.name !== 'string') return fail(`${where}.name 缺失`)
    if (typeof u.seed !== 'number' || !Number.isFinite(u.seed)) return fail(`${where}.seed 非法`)
    if (typeof u.archetypeId !== 'string') return fail(`${where}.archetypeId 缺失`)
    if (typeof u.createdAt !== 'number' || !Number.isFinite(u.createdAt)) {
      return fail(`${where}.createdAt 非法`)
    }
    if (!isRecord(u.nodes) || !isRecord(u.routes)) return fail(`${where} 缺少 nodes/routes`)
    if (typeof u.currentRouteId !== 'string') return fail(`${where}.currentRouteId 缺失`)

    const nodes = u.nodes as Record<string, unknown>
    const routes = u.routes as Record<string, unknown>
    totalNodes += Object.keys(nodes).length
    if (totalNodes > 20000) return fail('节点总量超过上限 20000')

    for (const [nodeId, nodeRaw] of Object.entries(nodes)) {
      const nw = `${where}.nodes.${nodeId}`
      if (!isRecord(nodeRaw)) return fail(`${nw} 不是对象`)
      const n = nodeRaw as Record<string, unknown>
      if (n.id !== nodeId) return fail(`${nw}.id 与键不一致`)
      if (n.parentId !== null && typeof n.parentId !== 'string') return fail(`${nw}.parentId 非法`)
      if (typeof n.parentId === 'string' && !nodes[n.parentId]) {
        return fail(`${nw}.parentId 指向不存在节点 ${n.parentId}`)
      }
      if (typeof n.age !== 'number' || n.age < 0 || n.age > MAX_AGE) return fail(`${nw}.age 越界`)
      if (typeof n.pathKey !== 'string') return fail(`${nw}.pathKey 缺失`)
      if (typeof n.identityId !== 'string') return fail(`${nw}.identityId 缺失`)
      if (!isRecord(n.stats)) return fail(`${nw}.stats 缺失`)
      for (const key of STAT_KEYS) {
        const value = (n.stats as Record<string, unknown>)[key]
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
          return fail(`${nw}.stats.${key} 越界或非法`)
        }
      }
      if (!Array.isArray(n.options) || n.options.length === 0) return fail(`${nw}.options 为空`)
      for (const option of n.options) {
        if (!isRecord(option) || typeof option.id !== 'string' || typeof option.label !== 'string') {
          return fail(`${nw}.options 存在非法选项`)
        }
        if (!isRecord(option.effects)) return fail(`${nw}.options.effects 非法`)
        for (const value of Object.values(option.effects)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return fail(`${nw}.options.effects 含非法增量`)
          }
        }
      }
      if (!isStringArray(n.seenEventIds) || !isStringArray(n.seenNarrativeIds)) {
        return fail(`${nw} seen 集合非法`)
      }
      if (!isStringArray(n.seenAchievementIds) || !isStringArray(n.achievementIds)) {
        return fail(`${nw} 成就集合非法`)
      }
      if (!isRecord(n.story)) return fail(`${nw}.story 缺失`)
      const story = n.story as Record<string, unknown>
      if (story.currentStoryId !== null && typeof story.currentStoryId !== 'string') {
        return fail(`${nw}.story.currentStoryId 非法`)
      }
      if (typeof story.currentStoryId === 'string' && !STORY_IDS.has(story.currentStoryId)) {
        return fail(`${nw}.story 引用不存在剧情 ${story.currentStoryId}`)
      }
      if (!isStringArray(story.flags) || !isStringArray(story.resolvedStoryIds)) {
        return fail(`${nw}.story 集合非法`)
      }
      for (const id of story.resolvedStoryIds) {
        if (!STORY_IDS.has(id)) return fail(`${nw}.story  resolvedStoryIds 引用不存在剧情 ${id}`)
      }
      if (n.choiceId !== null && typeof n.choiceId !== 'string') return fail(`${nw}.choiceId 非法`)
      if (typeof n.choiceId === 'string') {
        const parsed = parseStoryChoice(n.choiceId)
        if (parsed) {
          if (!STORY_IDS.has(parsed.storyId)) {
            return fail(`${nw}.choiceId 引用不存在剧情 ${parsed.storyId}`)
          }
          if (!STORY_OPTIONS.get(parsed.storyId)?.has(parsed.optionId)) {
            return fail(`${nw}.choiceId 引用不存在选项 ${parsed.optionId}`)
          }
        } else if (!POOL_IDS.has(n.choiceId)) {
          return fail(`${nw}.choiceId 引用不存在选择 ${n.choiceId}`)
        }
      }
    }

    for (const [routeId, routeRaw] of Object.entries(routes)) {
      const rw = `${where}.routes.${routeId}`
      if (!isRecord(routeRaw)) return fail(`${rw} 不是对象`)
      const r = routeRaw as Record<string, unknown>
      if (r.id !== routeId) return fail(`${rw}.id 与键不一致`)
      if (typeof r.name !== 'string') return fail(`${rw}.name 缺失`)
      if (!isStringArray(r.nodeIds) || r.nodeIds.length === 0) return fail(`${rw}.nodeIds 为空`)
      for (const nodeId of r.nodeIds) {
        if (!nodes[nodeId]) return fail(`${rw}.nodeIds 指向不存在节点 ${nodeId}`)
      }
      // 子节点关系：路径必须是一条 parentId 链，且当前节点为链尾
      const chain = r.nodeIds.map((id) => nodes[id] as Record<string, unknown>)
      if (chain[0]?.parentId !== null) return fail(`${rw} 根节点 parentId 应为 null`)
      for (let i = 1; i < chain.length; i++) {
        if (chain[i]?.parentId !== chain[i - 1]?.id) {
          return fail(`${rw} 父子关系断裂于第 ${i} 个节点`)
        }
      }
      if (typeof r.currentNodeId !== 'string' || !r.nodeIds.includes(r.currentNodeId)) {
        return fail(`${rw}.currentNodeId 不在 nodeIds 中`)
      }
      if (r.currentNodeId !== r.nodeIds[r.nodeIds.length - 1]) {
        return fail(`${rw}.currentNodeId 应为路径链尾`)
      }
      if (r.originNodeId !== null && typeof r.originNodeId !== 'string') {
        return fail(`${rw}.originNodeId 非法`)
      }
      if (typeof r.originNodeId === 'string' && !nodes[r.originNodeId]) {
        return fail(`${rw}.originNodeId 指向不存在节点`)
      }
      if (r.status !== 'active' && r.status !== 'ended') return fail(`${rw}.status 非法`)
      if (r.status === 'ended') {
        if (typeof r.endingId !== 'string' || !ENDING_IDS.has(r.endingId)) {
          return fail(`${rw}.endingId 不是合法结局`)
        }
      } else if (r.endingId !== null) {
        return fail(`${rw} 未结束但携带 endingId`)
      }
      if (typeof r.createdAt !== 'number') return fail(`${rw}.createdAt 非法`)
    }
    if (!routes[u.currentRouteId]) return fail(`${where}.currentRouteId 指向不存在路线`)

    universes.push({
      id: u.id,
      name: u.name,
      seed: u.seed,
      archetypeId: u.archetypeId,
      createdAt: u.createdAt,
      nodes: nodes as unknown as Record<string, LifeNode>,
      routes: routes as unknown as Record<string, Route>,
      currentRouteId: u.currentRouteId,
      favorite: u.favorite === true,
      mode: u.mode === 'auto' ? 'auto' : 'manual',
    })
  }

  const collections: CollectionRecord[] = []
  if (!Array.isArray(raw.collections)) return fail('缺少 collections 数组')
  const collectionIds = new Set<string>()
  for (const [index, item] of raw.collections.entries()) {
    const cw = `collections[${index}]`
    if (!isRecord(item)) return fail(`${cw} 不是对象`)
    const c = item as Record<string, unknown>
    if (typeof c.kind !== 'string' || !COLLECTION_KINDS.has(c.kind)) {
      return fail(`${cw}.kind 非法`)
    }
    if (typeof c.refId !== 'string') return fail(`${cw}.refId 缺失`)
    if (typeof c.universeId !== 'string' || !universeIds.has(c.universeId)) {
      return fail(`${cw}.universeId 引用不存在宇宙`)
    }
    if (typeof c.unlockedAt !== 'number' || !Number.isFinite(c.unlockedAt)) {
      return fail(`${cw}.unlockedAt 非法`)
    }
    if (c.kind === 'ending' && !ENDING_IDS.has(c.refId)) return fail(`${cw} 引用不存在结局`)
    if (c.kind === 'achievement' && !ACHIEVEMENT_IDS.has(c.refId)) {
      return fail(`${cw} 引用不存在成就`)
    }
    if (c.kind === 'specialEvent' && !SPECIAL_IDS.has(c.refId)) {
      return fail(`${cw} 引用不存在特殊事件`)
    }
    const id = `${c.kind}:${c.refId}:${c.universeId}`
    if (collectionIds.has(id)) return fail(`主键重复：图鉴记录 ${id}`)
    collectionIds.add(id)
    collections.push({
      id,
      kind: c.kind as CollectionRecord['kind'],
      refId: c.refId,
      universeId: c.universeId,
      unlockedAt: c.unlockedAt,
    })
  }

  let settings: Partial<AppSettings> | null = null
  if (raw.settings !== undefined) {
    if (!isRecord(raw.settings)) return fail('settings 不是对象')
    const s = raw.settings as Record<string, unknown>
    if (s.reduceMotion !== undefined && typeof s.reduceMotion !== 'boolean') {
      return fail('settings.reduceMotion 非法')
    }
    if (s.sound !== undefined && typeof s.sound !== 'boolean') return fail('settings.sound 非法')
    settings = {
      ...(typeof s.reduceMotion === 'boolean' ? { reduceMotion: s.reduceMotion } : {}),
      ...(typeof s.sound === 'boolean' ? { sound: s.sound } : {}),
    }
  }

  return { ok: true, errors, universes, collections, settings }
}