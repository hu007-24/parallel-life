import type { AchievementDef } from '@/engine/ple/types'

/**
 * 12 个隐藏成就：全部默认隐藏，条件满足且未解锁时触发（once 语义）。
 * 条件组合剧情 flags、特殊事件与属性阈值，鼓励多周目探索不同路径。
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'a-first-project',
    title: '第一个完整作品',
    description: '无论组队还是独立，你交出了第一个从头到尾的作品。',
    conditions: [{ kind: 'flag', flag: 'first-project' }],
  },
  {
    id: 'a-team-lead',
    title: '带队伍的人',
    description: '选择带领团队，并真的把新人培养了出来。',
    conditions: [
      { kind: 'flag', flag: 'lead-path' },
      { kind: 'flag', flag: 'mentor' },
    ],
  },
  {
    id: 'a-solo-builder',
    title: '独立建造者',
    description: '从第一个独立作品到署名发布，一个人走完了一条完整的路。',
    conditions: [
      { kind: 'flag', flag: 'solo-builder' },
      { kind: 'flag', flag: 'indie-release' },
    ],
  },
  {
    id: 'a-city-hopper',
    title: '城市跳跃者',
    description: '换过城市闯荡，也在多年后重访旧地，地图连成了线。',
    conditions: [
      { kind: 'flag', flag: 'city-hop' },
      { kind: 'flag', flag: 'revisit' },
    ],
  },
  {
    id: 'a-cross-pollinator',
    title: '跨界迁移者',
    description: '年轻时跨界自学，年长后仍敢进入全新领域。',
    conditions: [
      { kind: 'flag', flag: 'cross-study' },
      { kind: 'flag', flag: 'new-field' },
    ],
  },
  {
    id: 'a-balanced-life',
    title: '五维在线',
    description: '事业、关系、身体与好奇心同时在线，且幸福不低。',
    conditions: [
      { kind: 'narrative', narrativeId: 'n-balance' },
      { kind: 'stat', stat: 'happiness', op: '>=', value: 60 },
    ],
  },
  {
    id: 'a-hidden-master',
    title: '无名高手',
    description: '作品流传于世，名字无人知晓。',
    conditions: [{ kind: 'event', eventId: 'e-anonymous-master' }],
  },
  {
    id: 'a-launcher',
    title: '第一次启动',
    description: '完整做过项目，并拿到过第一笔真金白银的支持。',
    conditions: [
      { kind: 'event', eventId: 'e-startup-launch' },
      { kind: 'flag', flag: 'first-project' },
    ],
  },
  {
    id: 'a-expedition',
    title: '地图边缘',
    description: '去过没有信号的地方，且探索之心仍在高位。',
    conditions: [
      { kind: 'event', eventId: 'e-expedition' },
      { kind: 'stat', stat: 'exploration', op: '>=', value: 70 },
    ],
  },
  {
    id: 'a-mentor',
    title: '传承者',
    description: '培养过新人，也开过课，经验有了两代以上的读者。',
    conditions: [
      { kind: 'flag', flag: 'teach' },
      { kind: 'flag', flag: 'mentor' },
    ],
  },
  {
    id: 'a-archivist',
    title: '人生归档',
    description: '整理过作品与经验，并把它们写成了可以留下的文字。',
    conditions: [
      { kind: 'flag', flag: 'legacy-work' },
      { kind: 'flag', flag: 'write' },
    ],
  },
  {
    id: 'a-quiet-joy',
    title: '安静的丰盛',
    description: '选择安静创作，且幸福处于高位——不响，但满。',
    conditions: [
      { kind: 'flag', flag: 'quiet-create' },
      { kind: 'stat', stat: 'happiness', op: '>=', value: 75 },
    ],
  },
]