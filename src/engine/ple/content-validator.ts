import type { Condition, StatDelta } from '@/engine/ple/types'
import { STAT_KEYS } from '@/engine/ple/state-engine'
import { MAX_AGE } from '@/engine/ple/timeline-engine'
import { INITIAL_STORY_ID } from '@/engine/ple/story-engine'
import { STORY_NODES } from '@/data/stories'
import { LIFE_EVENTS } from '@/data/events'
import { NARRATIVES } from '@/data/narratives'
import { ENDINGS } from '@/data/endings'
import { ACHIEVEMENTS } from '@/data/achievements'
import { ARCHETYPES } from '@/data/archetypes'
import { CHAPTERS } from '@/data/chapters'
import { CHOICE_POOL } from '@/data/choices'

export interface ContentCounts {
  chapters: number
  stories: number
  normalEvents: number
  specialEvents: number
  endings: number
  achievements: number
  narratives: number
  identities: number
}

export interface ContentReport {
  ok: boolean
  errors: string[]
  warnings: string[]
  counts: ContentCounts
  unreachableStories: string[]
  noEndingStories: string[]
}

const OPS = ['>=', '<=', '>', '<'] as const
const TARGET_COUNTS = { stories: 25, normalEvents: 15, specialEvents: 10, endings: 8, achievements: 12 }

function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) dups.add(id)
    seen.add(id)
  }
  return [...dups]
}

function deltaProblem(effects: StatDelta, where: string): string | null {
  const entries = Object.entries(effects)
  if (entries.length === 0) return `${where}：effects 为空`
  for (const [key, value] of entries) {
    if (!STAT_KEYS.includes(key as (typeof STAT_KEYS)[number])) return `${where}：未知属性 ${key}`
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${where}：非法增量 ${key}`
  }
  return null
}

function optionSignature(option: { effects: StatDelta; nextStoryId?: string | null; flags?: readonly string[] }): string {
  return JSON.stringify([option.effects, option.nextStoryId ?? null, [...(option.flags ?? [])].sort()])
}

/**
 * 内容校验器（纯函数）：结构、引用、条件合法性、图可达性与结局可达性。
 * 运行时路径验证（每种身份能否走完一生）见 content.test.ts 与 scripts/validate-content.ts。
 */
export function validateContent(): ContentReport {
  const errors: string[] = []
  const warnings: string[] = []
  const err = (message: string) => errors.push(message)

  const storyIds = new Set(STORY_NODES.map((s) => s.id))
  const eventIds = new Set(LIFE_EVENTS.map((e) => e.id))
  const narrativeIds = new Set(NARRATIVES.map((n) => n.id))
  const identityIds = new Set(ARCHETYPES.map((a) => a.id))
  const producedFlags = new Set(STORY_NODES.flatMap((s) => s.options.flatMap((o) => [...(o.flags ?? [])])))

  // 1. ID 重复
  for (const [label, ids] of [
    ['主线剧情', STORY_NODES.map((s) => s.id)],
    ['事件', LIFE_EVENTS.map((e) => e.id)],
    ['剧情', NARRATIVES.map((n) => n.id)],
    ['结局', ENDINGS.map((e) => e.id)],
    ['成就', ACHIEVEMENTS.map((a) => a.id)],
    ['身份', ARCHETYPES.map((a) => a.id)],
  ] as const) {
    for (const dup of duplicateIds(ids)) err(`${label} ID 重复：${dup}`)
  }

  // 2. 章节覆盖
  if (CHAPTERS.length !== 5) err(`章节数量应为 5，实际 ${CHAPTERS.length}`)
  const sorted = [...CHAPTERS].sort((a, b) => a.minAge - b.minAge)
  let cursor = 0
  for (const chapter of sorted) {
    if (chapter.minAge !== cursor) err(`章节 ${chapter.id} 年龄区间不连续：期望 ${cursor} 起，实际 ${chapter.minAge}`)
    if (chapter.maxAge < chapter.minAge) err(`章节 ${chapter.id} 区间倒置`)
    cursor = chapter.maxAge + 1
  }
  if (cursor !== MAX_AGE + 1) err(`章节未覆盖到 ${MAX_AGE} 岁`)

  // 3. 条件字段合法性
  const checkCondition = (condition: Condition, where: string) => {
    switch (condition.kind) {
      case 'stat':
        if (!STAT_KEYS.includes(condition.stat)) err(`${where}：未知属性 ${condition.stat}`)
        if (!OPS.includes(condition.op)) err(`${where}：非法比较符 ${condition.op}`)
        if (!Number.isFinite(condition.value)) err(`${where}：非法阈值`)
        break
      case 'age':
        if (!OPS.includes(condition.op)) err(`${where}：非法比较符 ${condition.op}`)
        if (!Number.isFinite(condition.value) || condition.value < 0 || condition.value > MAX_AGE) {
          err(`${where}：年龄阈值越界 ${condition.value}`)
        }
        break
      case 'event':
        if (!eventIds.has(condition.eventId)) err(`${where}：引用不存在的事件 ${condition.eventId}`)
        break
      case 'narrative':
        if (!narrativeIds.has(condition.narrativeId)) err(`${where}：引用不存在的剧情 ${condition.narrativeId}`)
        break
      case 'identity':
        if (!identityIds.has(condition.identityId)) err(`${where}：引用不存在的身份 ${condition.identityId}`)
        break
      case 'flag':
        if (!producedFlags.has(condition.flag)) err(`${where}：引用无来源的 flag ${condition.flag}`)
        break
      default:
        err(`${where}：未知条件类型`)
    }
  }
  const checkConditions = (conditions: readonly Condition[] | undefined, where: string) => {
    for (const condition of conditions ?? []) checkCondition(condition, where)
  }

  // 4. 主线节点结构与引用
  const terminals: string[] = []
  const edges = new Map<string, string[]>()
  for (const story of STORY_NODES) {
    const where = `主线 ${story.id}`
    edges.set(story.id, [])
    if (!story.title.trim() || !story.description.trim()) err(`${where}：标题/描述为空`)
    if (story.options.length < 2) err(`${where}：选项少于 2 个`)
    const chapter = CHAPTERS.find((c) => c.id === story.chapter)
    if (!chapter) err(`${where}：未知章节 ${story.chapter}`)
    else if (story.minAge < chapter.minAge || story.minAge > chapter.maxAge) {
      err(`${where}：minAge ${story.minAge} 不在章节 ${story.chapter} 区间内`)
    }
    if (story.minAge > MAX_AGE - 2) err(`${where}：里程碑过晚，无法在终局前结算`)
    checkConditions(story.conditions, where)
    const deltaErr = deltaProblem(story.effects, where)
    if (deltaErr) err(deltaErr)
    for (const eventId of story.eventIds) {
      if (!eventIds.has(eventId)) err(`${where}：引用不存在的事件 ${eventId}`)
    }
    const signatures = new Set<string>()
    for (const option of story.options) {
      const optWhere = `${where}/${option.id}`
      if (!option.label.trim() || !option.description.trim()) err(`${optWhere}：标签/描述为空`)
      const optDeltaErr = deltaProblem(option.effects, optWhere)
      if (optDeltaErr) err(optDeltaErr)
      const signature = optionSignature(option)
      if (signatures.has(signature)) err(`${optWhere}：与其他选项完全同质（换文字不换效果）`)
      signatures.add(signature)
      const next = option.nextStoryId !== undefined ? option.nextStoryId : story.nextStoryId
      if (next !== null) {
        if (!storyIds.has(next)) err(`${optWhere}：nextStoryId 不存在 ${next}`)
        else edges.get(story.id)?.push(next)
        const target = STORY_NODES.find((s) => s.id === next)
        if (target) {
          if (target.minAge <= story.minAge) err(`${optWhere}：后继节点年龄不递增（${story.minAge} → ${target.minAge}）`)
          for (const condition of target.conditions) {
            if (condition.kind === 'flag' && !(option.flags ?? []).includes(condition.flag)) {
              err(`${optWhere}：进入 ${next} 所需 flag ${condition.flag} 未由该选项写入`)
            }
          }
        }
      }
    }
    if (story.nextStoryId !== null && !storyIds.has(story.nextStoryId)) {
      err(`${where}：nextStoryId 不存在 ${story.nextStoryId}`)
    }
    const outgoing = edges.get(story.id) ?? []
    if (story.nextStoryId === null && outgoing.length === 0) terminals.push(story.id)
    if (story.nextStoryId === null && story.chapter !== 5) err(`${where}：非第五章节点却是终点`)
  }
  if (STORY_NODES.length !== TARGET_COUNTS.stories) err(`主线数量应为 ${TARGET_COUNTS.stories}，实际 ${STORY_NODES.length}`)
  if (!storyIds.has(INITIAL_STORY_ID)) err(`入口节点 ${INITIAL_STORY_ID} 不存在`)
  const entry = STORY_NODES.find((s) => s.id === INITIAL_STORY_ID)
  if (entry && entry.minAge !== 0) err(`入口节点 minAge 应为 0`)
  if (terminals.length === 0) err('不存在任何终点节点')

  // 5. 可达性：入口 BFS 覆盖全部节点
  const reachable = new Set<string>()
  const queue = [INITIAL_STORY_ID]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (reachable.has(id)) continue
    reachable.add(id)
    queue.push(...(edges.get(id) ?? []))
  }
  const unreachableStories = STORY_NODES.map((s) => s.id).filter((id) => !reachable.has(id))
  for (const id of unreachableStories) err(`主线 ${id} 从入口不可达`)

  // 6. 结局可达：反向 BFS，所有节点必须能到达某个终点
  const reverse = new Map<string, string[]>()
  for (const [from, tos] of edges) {
    for (const to of tos) {
      reverse.set(to, [...(reverse.get(to) ?? []), from])
    }
  }
  const canEnd = new Set<string>(terminals)
  const endQueue = [...terminals]
  while (endQueue.length > 0) {
    const id = endQueue.shift() as string
    for (const prev of reverse.get(id) ?? []) {
      if (!canEnd.has(prev)) {
        canEnd.add(prev)
        endQueue.push(prev)
      }
    }
  }
  const noEndingStories = STORY_NODES.map((s) => s.id).filter((id) => !canEnd.has(id))
  for (const id of noEndingStories) err(`主线 ${id} 无法到达任何终点（结局路径断裂）`)

  // 7. 环检测（DFS 三色标记，仅检查可达子图）
  const color = new Map<string, number>()
  const hasCycle = (id: string): boolean => {
    color.set(id, 1)
    for (const next of edges.get(id) ?? []) {
      const state = color.get(next) ?? 0
      if (state === 1) return true
      if (state === 0 && hasCycle(next)) return true
    }
    color.set(id, 2)
    return false
  }
  if (hasCycle(INITIAL_STORY_ID)) err('主线图存在环，剧情可能无限循环')

  // 8. 事件库
  const normalEvents = LIFE_EVENTS.filter((e) => e.tier === 'normal')
  const specialEvents = LIFE_EVENTS.filter((e) => e.tier === 'special')
  if (normalEvents.length !== TARGET_COUNTS.normalEvents) err(`普通事件应为 ${TARGET_COUNTS.normalEvents}，实际 ${normalEvents.length}`)
  if (specialEvents.length !== TARGET_COUNTS.specialEvents) err(`特殊事件应为 ${TARGET_COUNTS.specialEvents}，实际 ${specialEvents.length}`)
  for (const event of LIFE_EVENTS) {
    const where = `事件 ${event.id}`
    if (event.minAge > event.maxAge || event.minAge < 0 || event.maxAge > MAX_AGE) err(`${where}：年龄区间非法`)
    if (event.weight <= 0) err(`${where}：权重必须为正`)
    const deltaErr = deltaProblem(event.effects, where)
    if (deltaErr) err(deltaErr)
    checkConditions(event.conditions, where)
  }

  // 9. 其余集合的条件与结构
  for (const narrative of NARRATIVES) checkConditions(narrative.conditions, `剧情 ${narrative.id}`)
  for (const choice of CHOICE_POOL) {
    checkConditions(choice.conditions, `选择池 ${choice.id}`)
    const deltaErr = deltaProblem(choice.effects, `选择池 ${choice.id}`)
    if (deltaErr) err(deltaErr)
  }
  for (const ending of ENDINGS) {
    checkConditions(ending.requirements, `结局 ${ending.id}`)
    for (const bonus of ending.bonuses ?? []) checkConditions(bonus.conditions, `结局 ${ending.id} 加分`)
  }
  if (ENDINGS.length !== TARGET_COUNTS.endings) err(`结局应为 ${TARGET_COUNTS.endings}，实际 ${ENDINGS.length}`)
  if (!ENDINGS.some((e) => !e.requirements || e.requirements.length === 0)) {
    err('缺少无门槛兜底结局，可能存在无法判定结局的人生')
  }
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.conditions.length === 0) err(`成就 ${achievement.id}：隐藏成就必须有解锁条件`)
    checkConditions(achievement.conditions, `成就 ${achievement.id}`)
  }
  if (ACHIEVEMENTS.length !== TARGET_COUNTS.achievements) err(`成就应为 ${TARGET_COUNTS.achievements}，实际 ${ACHIEVEMENTS.length}`)
  if (ARCHETYPES.length !== 4) err(`身份应为 4，实际 ${ARCHETYPES.length}`)
  for (const identity of ARCHETYPES) {
    if (!NARRATIVES.some((n) => n.conditions.some((c) => c.kind === 'identity' && c.identityId === identity.id))) {
      err(`身份 ${identity.id} 缺少初始剧情`)
    }
    const deltaErr = deltaProblem(identity.baseStats, `身份 ${identity.id}`)
    if (deltaErr) err(deltaErr)
  }

  const counts: ContentCounts = {
    chapters: CHAPTERS.length,
    stories: STORY_NODES.length,
    normalEvents: normalEvents.length,
    specialEvents: specialEvents.length,
    endings: ENDINGS.length,
    achievements: ACHIEVEMENTS.length,
    narratives: NARRATIVES.length,
    identities: ARCHETYPES.length,
  }
  return { ok: errors.length === 0, errors, warnings, counts, unreachableStories, noEndingStories }
}