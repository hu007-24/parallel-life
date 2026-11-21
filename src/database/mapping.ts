import type { AppSettings, LifeNode, Universe } from '@/types'
import { LIFE_EVENTS } from '@/data/events'

/** 宇宙元数据行：routes 随聚合根保存，nodes 规范化到独立表 */
export interface UniverseMeta {
  id: string
  name: string
  seed: number
  archetypeId: string
  createdAt: number
  currentRouteId: string
  routes: Universe['routes']
  favorite?: boolean
  mode?: Universe['mode']
}

export interface NodeRow {
  key: string
  universeId: string
  nodeId: string
  parentId: string | null
  age: number
  data: LifeNode
}

export type CollectionKind = 'ending' | 'achievement' | 'specialEvent' | 'favorite'

export interface CollectionRecord {
  id: string
  kind: CollectionKind
  refId: string
  universeId: string
  unlockedAt: number
}

export const DEFAULT_SETTINGS: AppSettings = { reduceMotion: false, sound: true }

const SPECIAL_EVENT_IDS = new Set(
  LIFE_EVENTS.filter((e) => e.tier === 'special').map((e) => e.id),
)

/** 节点行主键含 universeId：同种子派生宇宙共享 node.id 也不会在表中冲突 */
export function nodeRowKey(universeId: string, nodeId: string): string {
  return `${universeId}|${nodeId}`
}

export function collectionKey(kind: CollectionKind, refId: string, universeId: string): string {
  return `${kind}:${refId}:${universeId}`
}

export function splitUniverse(universe: Universe): { meta: UniverseMeta; rows: NodeRow[] } {
  const { nodes, ...meta } = universe
  const rows = Object.values(nodes).map((node) => ({
    key: nodeRowKey(universe.id, node.id),
    universeId: universe.id,
    nodeId: node.id,
    parentId: node.parentId,
    age: node.age,
    data: node,
  }))
  return { meta: meta as UniverseMeta, rows }
}

/** 组装时深拷贝节点数据：任何两个 Universe 实例都不共享可变状态对象 */
export function assembleUniverse(meta: UniverseMeta, rows: NodeRow[]): Universe {
  const nodes: Record<string, LifeNode> = {}
  for (const row of rows) {
    nodes[row.nodeId] = JSON.parse(JSON.stringify(row.data)) as LifeNode
  }
  return {
    id: meta.id,
    name: meta.name,
    seed: meta.seed,
    archetypeId: meta.archetypeId,
    createdAt: meta.createdAt,
    currentRouteId: meta.currentRouteId,
    routes: JSON.parse(JSON.stringify(meta.routes)) as Universe['routes'],
    nodes,
    favorite: meta.favorite,
    mode: meta.mode,
  }
}

/** 从宇宙数据推导图鉴记录：结局 / 成就 / 特殊事件 / 收藏（沿全部节点并集，含分支发现） */
export function collectionsFromUniverse(
  universe: Universe,
  unlockedAt: number,
): CollectionRecord[] {
  const records: CollectionRecord[] = []
  const push = (kind: CollectionKind, refId: string) => {
    records.push({
      id: collectionKey(kind, refId, universe.id),
      kind,
      refId,
      universeId: universe.id,
      unlockedAt,
    })
  }
  for (const route of Object.values(universe.routes)) {
    if (route.endingId) push('ending', route.endingId)
  }
  const achievements = new Set<string>()
  const specials = new Set<string>()
  for (const node of Object.values(universe.nodes)) {
    for (const id of node.seenAchievementIds) achievements.add(id)
    for (const id of node.seenEventIds) {
      if (SPECIAL_EVENT_IDS.has(id)) specials.add(id)
    }
  }
  for (const id of achievements) push('achievement', id)
  for (const id of specials) push('specialEvent', id)
  if (universe.favorite) push('favorite', universe.id)
  return records
}