import type { Choice, LifeNode, LifeStats, Route, StoryProgress, Universe } from '@/engine/ple/types'
import { EngineError } from '@/engine/ple/types'
import { hashString, rngFor, sampleWeighted } from '@/engine/ple/random-engine'
import type { ChoiceDef, ConditionContext } from '@/engine/ple/types'
import { evaluateConditions } from '@/engine/ple/narrative-engine'
import { activeStory, storyOptions } from '@/engine/ple/story-engine'

export const MAX_AGE = 80
export const OPTIONS_PER_NODE = 3

export function nodeContext(node: LifeNode): ConditionContext {
  return {
    stats: node.stats,
    age: node.age,
    seenEventIds: node.seenEventIds,
    seenNarrativeIds: node.seenNarrativeIds,
    identityId: node.identityId,
    flags: node.story.flags,
  }
}

/** 节点 id 由 (seed, pathKey) 决定：同路径必同 id，支撑复现与去重 */
export function nodeIdFor(seed: number, pathKey: string): string {
  return `n_${hashString(`${seed}:${pathKey}`).toString(36)}`
}

export function generateOptions(
  pool: readonly ChoiceDef[],
  seed: number,
  pathKey: string,
  ctx: ConditionContext,
): Choice[] {
  const eligible = pool.filter(
    (def) =>
      ctx.age >= def.minAge &&
      ctx.age <= def.maxAge &&
      evaluateConditions(def.conditions ?? [], ctx),
  )
  const rng = rngFor(seed, 'options', pathKey)
  return sampleWeighted(eligible, OPTIONS_PER_NODE, (def) => def.weight, rng).map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    effects: { ...def.effects },
    tags: [...def.tags],
  }))
}

export interface CreateNodeInput {
  seed: number
  parent: LifeNode | null
  stats: LifeStats
  choice: Choice | null
  eventId: string | null
  narrativeIds: readonly string[]
  achievementIds: readonly string[]
  identityId: string
  story: StoryProgress
  pool: readonly ChoiceDef[]
}

/**
 * 不可变节点工厂：stats 传入时已是新快照；seen 集合在父路径基础上追加，
 * 父节点对象永远不被修改（分支共享祖先节点因此是安全的）。
 * 里程碑年份（activeStory.minAge === age）选项来自主线剧情，其余年份来自选择池采样。
 */
export function createLifeNode(input: CreateNodeInput): LifeNode {
  const pathKey = input.parent ? `${input.parent.pathKey}>${input.choice?.id ?? 'root'}` : 'root'
  const age = input.parent ? input.parent.age + 1 : 0
  const seenEventIds = input.parent
    ? [...input.parent.seenEventIds, ...(input.eventId ? [input.eventId] : [])]
    : input.eventId
      ? [input.eventId]
      : []
  const seenNarrativeIds = input.parent
    ? [...input.parent.seenNarrativeIds, ...input.narrativeIds]
    : [...input.narrativeIds]
  const seenAchievementIds = input.parent
    ? [...input.parent.seenAchievementIds, ...input.achievementIds]
    : [...input.achievementIds]
  const stats = { ...input.stats }
  const story: StoryProgress = {
    currentStoryId: input.story.currentStoryId,
    flags: [...input.story.flags],
    resolvedStoryIds: [...input.story.resolvedStoryIds],
  }
  const ctx: ConditionContext = {
    stats,
    age,
    seenEventIds,
    seenNarrativeIds,
    identityId: input.identityId,
    flags: story.flags,
  }
  const active = activeStory(story, ctx)
  const options =
    active && active.minAge === age
      ? storyOptions(active)
      : generateOptions(input.pool, input.seed, pathKey, ctx)

  return {
    id: nodeIdFor(input.seed, pathKey),
    parentId: input.parent?.id ?? null,
    age,
    stats,
    pathKey,
    identityId: input.identityId,
    choiceId: input.choice?.id ?? null,
    choiceLabel: input.choice?.label ?? null,
    eventId: input.eventId,
    narrativeIds: [...input.narrativeIds],
    achievementIds: [...input.achievementIds],
    seenEventIds,
    seenNarrativeIds,
    seenAchievementIds,
    story,
    options,
  }
}

export function getRoute(universe: Universe, routeId?: string): Route {
  const id = routeId ?? universe.currentRouteId
  const route = universe.routes[id]
  if (!route) throw new EngineError('ROUTE_NOT_FOUND', `路线不存在：${id}`)
  return route
}

export function getCurrentNode(universe: Universe, routeId?: string): LifeNode {
  const route = getRoute(universe, routeId)
  const node = universe.nodes[route.currentNodeId]
  if (!node) throw new EngineError('NODE_NOT_FOUND', `节点不存在：${route.currentNodeId}`)
  return node
}

/** 从根到指定节点的路径（沿 parentId 回溯），用于时间线渲染与分支 */
export function pathToNode(universe: Universe, nodeId: string): LifeNode[] {
  const path: LifeNode[] = []
  let cursor: string | null = nodeId
  while (cursor) {
    const node: LifeNode | undefined = universe.nodes[cursor]
    if (!node) throw new EngineError('NODE_NOT_FOUND', `节点不存在：${cursor}`)
    path.push(node)
    cursor = node.parentId
  }
  return path.reverse()
}

export function getRoutePath(universe: Universe, routeId?: string): LifeNode[] {
  return pathToNode(universe, getRoute(universe, routeId).currentNodeId)
}

/**
 * 回溯分支：以 nodeId 为原点创建独立新路线。
 * - 历史节点不可变，祖先路径按引用共享（git 式），任何后续推进只产生新节点；
 * - 原路线对象与指针完全保留；
 * - 新路线持有自己的 nodeIds 快照数组与 currentNodeId 指针。
 */
export function branchFromNode(universe: Universe, nodeId: string, name: string): Universe {
  if (!universe.nodes[nodeId]) {
    throw new EngineError('NODE_NOT_FOUND', `分支原点不存在：${nodeId}`)
  }
  const path = pathToNode(universe, nodeId)
  const routeId = `r_${hashString(`${universe.seed}:route:${nodeId}:${Object.keys(universe.routes).length}`).toString(36)}`
  const route: Route = {
    id: routeId,
    name,
    nodeIds: path.map((n) => n.id),
    currentNodeId: nodeId,
    originNodeId: nodeId,
    status: 'active',
    endingId: null,
    createdAt: 0,
  }
  return {
    ...universe,
    routes: { ...universe.routes, [routeId]: route },
    currentRouteId: routeId,
  }
}

export function switchRoute(universe: Universe, routeId: string): Universe {
  getRoute(universe, routeId)
  return { ...universe, currentRouteId: routeId }
}