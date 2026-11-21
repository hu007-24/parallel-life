import type {
  Choice,
  ConditionContext,
  StoryDef,
  StoryOption,
  StoryProgress,
} from '@/engine/ple/types'
import { evaluateConditions } from '@/engine/ple/narrative-engine'
import { STORY_NODES } from '@/data/stories'
import { CHAPTERS } from '@/data/chapters'

export const STORY_CHOICE_PREFIX = 'st:'
export const INITIAL_STORY_ID = 's01'

export function storyChoiceId(storyId: string, optionId: string): string {
  return `${STORY_CHOICE_PREFIX}${storyId}:${optionId}`
}

export function parseStoryChoice(choiceId: string): { storyId: string; optionId: string } | null {
  if (!choiceId.startsWith(STORY_CHOICE_PREFIX)) return null
  const [storyId, optionId] = choiceId.slice(STORY_CHOICE_PREFIX.length).split(':')
  if (!storyId || !optionId) return null
  return { storyId, optionId }
}

export function getStoryDef(id: string): StoryDef | null {
  return STORY_NODES.find((def) => def.id === id) ?? null
}

export function initialStoryProgress(): StoryProgress {
  return { currentStoryId: INITIAL_STORY_ID, flags: [], resolvedStoryIds: [] }
}

/**
 * 取当前应激活的主线节点：条件不满足时沿 nextStoryId 跳过（保证无死锁），
 * visited 防御环形引用（内容校验器已保证图无环）。
 */
export function activeStory(progress: StoryProgress, ctx: ConditionContext): StoryDef | null {
  const visited = new Set<string>()
  let cursor = progress.currentStoryId
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor)
    const def = getStoryDef(cursor)
    if (!def) return null
    if (evaluateConditions(def.conditions, ctx)) return def
    cursor = def.nextStoryId
  }
  return null
}

/** 里程碑年份的选项 = 剧情节点选项（确定性，不经过随机采样） */
export function storyOptions(def: StoryDef): Choice[] {
  return def.options.map((option) => ({
    id: storyChoiceId(def.id, option.id),
    label: option.label,
    description: option.description,
    effects: { ...option.effects },
    tags: ['story'],
  }))
}

export function findStoryOption(def: StoryDef, optionId: string): StoryOption | null {
  return def.options.find((option) => option.id === optionId) ?? null
}

/** 结算剧情节点：写入 flags、记录已解决、指针走向 option 覆盖或节点默认 next */
export function resolveStory(
  progress: StoryProgress,
  def: StoryDef,
  option: StoryOption,
): StoryProgress {
  const nextId = option.nextStoryId !== undefined ? option.nextStoryId : def.nextStoryId
  return {
    currentStoryId: nextId,
    flags: [...progress.flags, ...(option.flags ?? [])],
    resolvedStoryIds: [...progress.resolvedStoryIds, def.id],
  }
}

export function chapterForAge(age: number) {
  return CHAPTERS.find((chapter) => age >= chapter.minAge && age <= chapter.maxAge) ?? null
}