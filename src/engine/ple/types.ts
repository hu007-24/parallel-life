/** PLE 核心领域类型。所有引擎函数围绕这些不可变结构运作。 */

export type StatKey = 'creativity' | 'exploration' | 'social' | 'influence' | 'happiness'

export interface LifeStats {
  creativity: number
  exploration: number
  social: number
  influence: number
  happiness: number
}

export type StatDelta = Partial<LifeStats>

export type CompareOp = '>=' | '<=' | '>' | '<'

export type Condition =
  | { kind: 'stat'; stat: StatKey; op: CompareOp; value: number }
  | { kind: 'age'; op: CompareOp; value: number }
  | { kind: 'event'; eventId: string }
  | { kind: 'narrative'; narrativeId: string }
  | { kind: 'identity'; identityId: string }
  | { kind: 'flag'; flag: string }

export interface ConditionContext {
  stats: LifeStats
  age: number
  seenEventIds: readonly string[]
  seenNarrativeIds: readonly string[]
  identityId: string
  flags: readonly string[]
}

/** 节点上呈现给用户的可选行动 */
export interface Choice {
  id: string
  label: string
  description: string
  effects: StatDelta
  tags: readonly string[]
}

export interface ChoiceDef extends Choice {
  minAge: number
  maxAge: number
  weight: number
  conditions?: readonly Condition[]
}

export interface EventDef {
  id: string
  title: string
  description: string
  minAge: number
  maxAge: number
  weight: number
  effects: StatDelta
  conditions?: readonly Condition[]
  tags: readonly string[]
  tier: 'normal' | 'special'
}

export interface NarrativeDef {
  id: string
  title: string
  text: string
  conditions: readonly Condition[]
  effects?: StatDelta
}

export type ChapterId = 1 | 2 | 3 | 4 | 5

export interface ChapterDef {
  id: ChapterId
  title: string
  minAge: number
  maxAge: number
}

/** 主线剧情选项：effects 立即生效；nextStoryId 覆盖节点默认走向；flags 写入路线快照 */
export interface StoryOption {
  id: string
  label: string
  description: string
  effects: StatDelta
  nextStoryId?: string | null
  flags?: readonly string[]
}

/**
 * 主线剧情节点。minAge 年份该节点成为当年唯一选择来源（里程碑），
 * effects 为经历该节点的基线增量，eventIds 限定当年的随机事件候选池。
 */
export interface StoryDef {
  id: string
  chapter: ChapterId
  title: string
  description: string
  minAge: number
  conditions: readonly Condition[]
  options: readonly StoryOption[]
  effects: StatDelta
  nextStoryId: string | null
  eventIds: readonly string[]
}

/** 路线级剧情进度快照，随节点携带，分支继承原点时刻的状态 */
export interface StoryProgress {
  currentStoryId: string | null
  flags: readonly string[]
  resolvedStoryIds: readonly string[]
}

export interface AchievementDef {
  id: string
  title: string
  description: string
  conditions: readonly Condition[]
}

/**
 * 不可变人生节点。stats 为完整快照（不共享引用），
 * seen* 集合记录沿路径已触发内容，保证事件/剧情/成就不重复执行。
 */
export interface LifeNode {
  id: string
  parentId: string | null
  age: number
  stats: LifeStats
  pathKey: string
  identityId: string
  choiceId: string | null
  choiceLabel: string | null
  eventId: string | null
  narrativeIds: readonly string[]
  achievementIds: readonly string[]
  seenEventIds: readonly string[]
  seenNarrativeIds: readonly string[]
  seenAchievementIds: readonly string[]
  story: StoryProgress
  options: readonly Choice[]
}

export type RouteStatus = 'active' | 'ended'

/** 模拟模式：manual 逐步选择；auto 自动推进（里程碑剧情年暂停交由用户选择） */
export type SimulationMode = 'manual' | 'auto'

/** 一条路线 = 从根到当前节点的不可变节点路径 + 独立状态指针 */
export interface Route {
  id: string
  name: string
  nodeIds: readonly string[]
  currentNodeId: string
  originNodeId: string | null
  status: RouteStatus
  endingId: string | null
  createdAt: number
}

export interface Universe {
  id: string
  name: string
  seed: number
  archetypeId: string
  createdAt: number
  nodes: Readonly<Record<string, LifeNode>>
  routes: Readonly<Record<string, Route>>
  currentRouteId: string
  /** 应用层元数据：不参与模拟计算 */
  favorite?: boolean
  mode?: SimulationMode
}

export interface EndingDef {
  id: string
  name: string
  description: string
  conditionText: string
  weights: Partial<Record<StatKey, number>>
  requirements?: readonly Condition[]
  bonuses?: readonly { conditions: readonly Condition[]; points: number }[]
  /** balanced：均值 + 最低维度加成，用于奖励均衡发展的跨界人生 */
  scoring?: 'weighted' | 'balanced'
  priority?: number
}

export interface Archetype {
  id: string
  name: string
  tagline: string
  description: string
  baseStats: LifeStats
}

export type EngineErrorCode =
  | 'INVALID_CHOICE'
  | 'ROUTE_NOT_FOUND'
  | 'ROUTE_ENDED'
  | 'NODE_NOT_FOUND'
  | 'INVALID_STATS'
  | 'INVALID_DELTA'

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'EngineError'
  }
}