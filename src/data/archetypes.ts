import type { Archetype } from '@/engine/ple/types'

/** 四种初始身份：不同初始属性 + 各自初始剧情（见 narratives.ts 的 n-open-*） */
export const ARCHETYPES: Archetype[] = [
  {
    id: 'campus',
    name: '校园探索者',
    tagline: '以好奇为罗盘',
    description: '从校园与课堂出发，在实验室、社团和图书馆里尝试每一种可能。',
    baseStats: { creativity: 55, exploration: 60, social: 50, influence: 35, happiness: 55 },
  },
  {
    id: 'founder',
    name: '创业探索者',
    tagline: '以行动为杠杆',
    description: '对机会敏感，习惯把想法变成小项目与小团队，在实践里学习。',
    baseStats: { creativity: 50, exploration: 50, social: 55, influence: 60, happiness: 50 },
  },
  {
    id: 'creator',
    name: '自由创造者',
    tagline: '以作品为答案',
    description: '习惯用作品表达自己，在喧嚣之外保留自己的节奏与标准。',
    baseStats: { creativity: 70, exploration: 45, social: 40, influence: 30, happiness: 60 },
  },
  {
    id: 'traveler',
    name: '世界旅行者',
    tagline: '以地图为笔记',
    description: '收集城市与风景，相信经历本身就是一种知识。',
    baseStats: { creativity: 45, exploration: 70, social: 50, influence: 35, happiness: 60 },
  },
]

export function getArchetype(id: string): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? (ARCHETYPES[0] as Archetype)
}