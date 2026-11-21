import type { LifeStats, StatKey, Universe } from '@/engine/ple/types'
import { STAT_KEYS } from '@/engine/ple/state-engine'
import { getRoute, getRoutePath } from '@/engine/ple/timeline-engine'
import { parseStoryChoice } from '@/engine/ple/story-engine'
import { ENDINGS } from '@/data/endings'
import { LIFE_EVENTS } from '@/data/events'
import { getArchetype } from '@/data/archetypes'

export interface KeyChoice {
  age: number
  storyId: string
  label: string
}

export interface RouteEvent {
  id: string
  title: string
  tier: 'normal' | 'special'
  age: number
}

export interface PathEntry {
  nodeId: string
  age: number
  label: string
  eventId: string | null
}

/** 单条路线的对照快照：全部来自既有 Universe / LifeNode 数据，纯函数推导 */
export interface SideReport {
  universeId: string
  universeName: string
  routeId: string
  routeName: string
  status: 'active' | 'ended'
  endingId: string | null
  endingName: string | null
  endingNumber: number | null
  age: number
  seed: number
  identityName: string
  stats: LifeStats
  keyChoices: KeyChoice[]
  events: RouteEvent[]
  achievementIds: string[]
  path: PathEntry[]
}

export interface ComparisonReport {
  left: SideReport
  right: SideReport
  statDelta: Record<StatKey, number>
  sharedEvents: RouteEvent[]
  leftOnlyEvents: RouteEvent[]
  rightOnlyEvents: RouteEvent[]
  /** 两条路径首次出现不同节点的年龄；完全同路径时为 null */
  divergenceAge: number | null
  sameRoute: boolean
}

export function buildSide(universe: Universe, routeId?: string): SideReport {
  const route = getRoute(universe, routeId)
  const path = getRoutePath(universe, route.id)
  const node = path[path.length - 1]
  if (!node) throw new Error('comparison-engine: 路线没有节点')
  const endingIndex = route.endingId ? ENDINGS.findIndex((e) => e.id === route.endingId) : -1
  const ending = endingIndex >= 0 ? ENDINGS[endingIndex] : null

  const keyChoices: KeyChoice[] = []
  const events: RouteEvent[] = []
  for (const entry of path) {
    const parsed = entry.choiceId ? parseStoryChoice(entry.choiceId) : null
    if (parsed && entry.choiceLabel) {
      keyChoices.push({ age: entry.age, storyId: parsed.storyId, label: entry.choiceLabel })
    }
    if (entry.eventId) {
      const def = LIFE_EVENTS.find((e) => e.id === entry.eventId)
      if (def) events.push({ id: def.id, title: def.title, tier: def.tier, age: entry.age })
    }
  }

  return {
    universeId: universe.id,
    universeName: universe.name,
    routeId: route.id,
    routeName: route.name,
    status: route.status,
    endingId: route.endingId,
    endingName: ending?.name ?? null,
    endingNumber: ending ? endingIndex + 1 : null,
    age: node.age,
    seed: universe.seed,
    identityName: getArchetype(universe.archetypeId).name,
    stats: { ...node.stats },
    keyChoices,
    events,
    achievementIds: [...node.seenAchievementIds],
    path: path.map((entry) => ({
      nodeId: entry.id,
      age: entry.age,
      label: entry.choiceLabel ?? '宇宙诞生',
      eventId: entry.eventId,
    })),
  }
}

export function compareSides(left: SideReport, right: SideReport): ComparisonReport {
  const statDelta = Object.fromEntries(
    STAT_KEYS.map((key) => [key, left.stats[key] - right.stats[key]]),
  ) as Record<StatKey, number>

  const rightIds = new Set(right.events.map((e) => e.id))
  const leftIds = new Set(left.events.map((e) => e.id))
  const sharedEvents = left.events.filter((e) => rightIds.has(e.id))
  const leftOnlyEvents = left.events.filter((e) => !rightIds.has(e.id))
  const rightOnlyEvents = right.events.filter((e) => !leftIds.has(e.id))

  let divergenceAge: number | null = null
  const length = Math.min(left.path.length, right.path.length)
  for (let i = 0; i < length; i++) {
    const l = left.path[i]
    const r = right.path[i]
    if (l && r && l.nodeId !== r.nodeId) {
      divergenceAge = l.age
      break
    }
  }
  if (divergenceAge === null && left.path.length !== right.path.length) {
    divergenceAge = length
  }

  return {
    left,
    right,
    statDelta,
    sharedEvents,
    leftOnlyEvents,
    rightOnlyEvents,
    divergenceAge,
    sameRoute: left.universeId === right.universeId && left.routeId === right.routeId,
  }
}