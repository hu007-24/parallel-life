import type { Choice, Universe } from '@/engine/ple/types'
import { EngineError } from '@/engine/ple/types'
import { applyDelta, createStats, mergeDeltas } from '@/engine/ple/state-engine'
import { rngFor } from '@/engine/ple/random-engine'
import { rollEvent } from '@/engine/ple/event-engine'
import { narrativeDelta, triggerNarratives } from '@/engine/ple/narrative-engine'
import { triggerAchievements } from '@/engine/ple/achievement-engine'
import {
  activeStory,
  findStoryOption,
  initialStoryProgress,
  parseStoryChoice,
  resolveStory,
} from '@/engine/ple/story-engine'
import {
  MAX_AGE,
  branchFromNode,
  createLifeNode,
  getCurrentNode,
  getRoute,
  nodeContext,
  pathToNode,
  switchRoute,
} from '@/engine/ple/timeline-engine'
import { computeEnding } from '@/engine/ple/ending-engine'
import { CHOICE_POOL } from '@/data/choices'
import { LIFE_EVENTS } from '@/data/events'
import { NARRATIVES } from '@/data/narratives'
import { ACHIEVEMENTS } from '@/data/achievements'
import { ENDINGS } from '@/data/endings'
import { getArchetype } from '@/data/archetypes'

export interface CreateUniverseInput {
  id?: string
  name: string
  seed: number
  archetypeId: string
  createdAt?: number
}

/**
 * 年度自然衰减：不被选择的维度缓慢回落。
 * 没有它，80 年的正向增量会让五维全部饱和到 100，结局判定退化为加分项比较；
 * 衰减使「持续投入的维度」与「放下的维度」分化，选择才真正决定结局。
 */
const ANNUAL_DECAY = {
  creativity: -1,
  exploration: -1,
  social: -1,
  influence: -1,
  happiness: -1,
} as const

export function createUniverse(input: CreateUniverseInput): Universe {
  const archetype = getArchetype(input.archetypeId)
  const root = createLifeNode({
    seed: input.seed,
    parent: null,
    stats: createStats(archetype.baseStats),
    choice: null,
    eventId: null,
    narrativeIds: [],
    achievementIds: [],
    identityId: archetype.id,
    story: initialStoryProgress(),
    pool: CHOICE_POOL,
  })
  const createdAt = input.createdAt ?? 0
  return {
    id: input.id ?? `u_${input.seed.toString(36)}`,
    name: input.name,
    seed: input.seed,
    archetypeId: archetype.id,
    createdAt,
    nodes: { [root.id]: root },
    routes: {
      r_root: {
        id: 'r_root',
        name: '主路线',
        nodeIds: [root.id],
        currentNodeId: root.id,
        originNodeId: null,
        status: 'active',
        endingId: null,
        createdAt,
      },
    },
    currentRouteId: 'r_root',
  }
}

/**
 * 选择处理主流程（纯函数，返回新 Universe）：
 * 1 验证选项（普通池选项或里程碑剧情选项）→ 2 取当前节点
 * → 3 计算属性变化（选择+剧情基线+条件剧情+随机事件）→ 4 触发检查（剧情/成就）
 * → 5 创建不可变新节点（携带剧情进度快照）→ 6 保存父子关系 → 7 更新路线指针。
 * 里程碑年份的随机事件候选池限定为剧情节点的 eventIds，使事件与前后剧情关联。
 */
export function choose(universe: Universe, choiceId: string, routeId?: string): Universe {
  const route = getRoute(universe, routeId)
  if (route.status === 'ended') {
    throw new EngineError('ROUTE_ENDED', `路线 ${route.id} 已结束，无法继续选择`)
  }
  const node = getCurrentNode(universe, route.id)
  const choice: Choice | undefined = node.options.find((option) => option.id === choiceId)
  if (!choice) {
    throw new EngineError('INVALID_CHOICE', `选项 ${choiceId} 不在当前节点的合法选项中`)
  }

  const parsed = parseStoryChoice(choice.id)
  const storyDef = parsed ? activeStory(node.story, nodeContext(node)) : null
  const storyOption = parsed && storyDef ? findStoryOption(storyDef, parsed.optionId) : null
  if (parsed && (!storyDef || storyDef.id !== parsed.storyId || !storyOption)) {
    throw new EngineError('INVALID_CHOICE', `剧情选项 ${choiceId} 与当前剧情进度不匹配`)
  }

  const nextPathKey = `${node.pathKey}>${choice.id}`
  const nextAge = node.age + 1
  const baseDelta = mergeDeltas(choice.effects, storyDef?.effects ?? {})
  const statsAfterChoice = applyDelta(node.stats, baseDelta)
  const nextFlags = storyOption
    ? [...node.story.flags, ...(storyOption.flags ?? [])]
    : node.story.flags
  const ctx = {
    stats: statsAfterChoice,
    age: nextAge,
    seenEventIds: node.seenEventIds,
    seenNarrativeIds: node.seenNarrativeIds,
    identityId: universe.archetypeId,
    flags: nextFlags,
  }

  const narratives = triggerNarratives(NARRATIVES, ctx)
  const eventPool = storyDef
    ? LIFE_EVENTS.filter((eventDef) => storyDef.eventIds.includes(eventDef.id))
    : LIFE_EVENTS
  const event = rollEvent(eventPool, ctx, rngFor(universe.seed, 'event', nextPathKey))
  const delta = mergeDeltas(baseDelta, narrativeDelta(narratives), event?.effects ?? {}, ANNUAL_DECAY)
  const stats = applyDelta(node.stats, delta)
  const achievements = triggerAchievements(ACHIEVEMENTS, {
    ...ctx,
    stats,
    seenAchievementIds: node.seenAchievementIds,
  })
  const childStory =
    storyDef && storyOption ? resolveStory(node.story, storyDef, storyOption) : node.story

  const child = createLifeNode({
    seed: universe.seed,
    parent: node,
    stats,
    choice,
    eventId: event?.id ?? null,
    narrativeIds: narratives.map((n) => n.id),
    achievementIds: achievements.map((a) => a.id),
    identityId: universe.archetypeId,
    story: childStory,
    pool: CHOICE_POOL,
  })

  const ended = child.age >= MAX_AGE
  const nextRoute = {
    ...route,
    nodeIds: [...route.nodeIds, child.id],
    currentNodeId: child.id,
    status: ended ? ('ended' as const) : ('active' as const),
    endingId: ended ? computeEnding(ENDINGS, child) : null,
  }

  return {
    ...universe,
    nodes: { ...universe.nodes, [child.id]: child },
    routes: { ...universe.routes, [route.id]: nextRoute },
  }
}

export function branch(universe: Universe, nodeId: string, name: string): Universe {
  return branchFromNode(universe, nodeId, name)
}

export function selectRoute(universe: Universe, routeId: string): Universe {
  return switchRoute(universe, routeId)
}

/** 复现：相同 seed + 相同决策序列必然重建出结构一致的宇宙 */
export function replay(
  input: CreateUniverseInput,
  choiceIds: readonly string[],
): Universe {
  let universe = createUniverse(input)
  for (const choiceId of choiceIds) {
    universe = choose(universe, choiceId)
  }
  return universe
}

/** 自动推进的确定性选项：由 (seed, 'auto', pathKey) 派生，同路径必同选择 */
export function autoChoiceId(universe: Universe, routeId?: string): string {
  const node = getCurrentNode(universe, routeId)
  const option = node.options[Math.floor(rngFor(universe.seed, 'auto', node.pathKey)() * node.options.length)]
  if (!option) throw new EngineError('INVALID_CHOICE', '当前节点没有可用选项')
  return option.id
}

/** 快进到目标年龄（起始阶段选择）：之前年份由引擎按种子自动模拟，全部为真实节点 */
export function autoAdvance(universe: Universe, targetAge: number): Universe {
  let current = universe
  while (getCurrentNode(current).age < targetAge && getRoute(current).status === 'active') {
    current = choose(current, autoChoiceId(current))
  }
  return current
}

/**
 * 回溯派生新宇宙：以 nodeId 的历史决策序列 replay 出一个独立宇宙。
 * 同 seed 同前缀 ⇒ 历史节点完全一致；此后两条人生各自独立推进。
 */
export function deriveUniverse(
  universe: Universe,
  nodeId: string,
  input: { id: string; name: string; createdAt?: number },
): Universe {
  const path = pathToNode(universe, nodeId)
  const choiceIds = path
    .slice(1)
    .map((node) => node.choiceId)
    .filter((id): id is string => id !== null)
  return replay(
    {
      id: input.id,
      name: input.name,
      seed: universe.seed,
      archetypeId: universe.archetypeId,
      createdAt: input.createdAt,
    },
    choiceIds,
  )
}

export { MAX_AGE, getCurrentNode, getRoute, getRoutePath, pathToNode } from '@/engine/ple/timeline-engine'