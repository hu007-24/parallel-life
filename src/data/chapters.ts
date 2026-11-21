import type { ChapterDef } from '@/engine/ple/types'

/** 五个人生阶段：年龄区间互不重叠，覆盖 0–80 岁 */
export const CHAPTERS: ChapterDef[] = [
  { id: 1, title: '人生起点', minAge: 0, maxAge: 17 },
  { id: 2, title: '探索与选择', minAge: 18, maxAge: 29 },
  { id: 3, title: '机遇与挑战', minAge: 30, maxAge: 44 },
  { id: 4, title: '转折与成长', minAge: 45, maxAge: 59 },
  { id: 5, title: '人生归属', minAge: 60, maxAge: 80 },
]