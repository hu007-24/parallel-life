import type { NarrativeDef } from '@/engine/ple/types'

/** 条件剧情：满足条件且沿路径未触发过时自动发生，每年至多推进一次状态 */
export const NARRATIVES: NarrativeDef[] = [
  {
    id: 'n-deep-study',
    title: '进入心流领域',
    text: '你发现自己可以连续数小时沉浸在一件事里，忘记时间。',
    conditions: [
      { kind: 'stat', stat: 'creativity', op: '>=', value: 60 },
      { kind: 'stat', stat: 'exploration', op: '>=', value: 50 },
    ],
    effects: { creativity: 3 },
  },
  {
    id: 'n-belonging',
    title: '找到归属',
    text: '有一群人，不需要解释就能理解你。',
    conditions: [{ kind: 'stat', stat: 'social', op: '>=', value: 65 }],
    effects: { happiness: 4 },
  },
  {
    id: 'n-recognition',
    title: '被领域看见',
    text: '你的名字开始出现在别人的参考文献里。',
    conditions: [{ kind: 'stat', stat: 'influence', op: '>=', value: 60 }],
    effects: { influence: 3, happiness: 2 },
  },
  {
    id: 'n-wanderlust',
    title: '远方在召唤',
    text: '地图上没去过的地方，变得越来越刺眼。',
    conditions: [{ kind: 'stat', stat: 'exploration', op: '>=', value: 65 }],
    effects: { exploration: 3, happiness: 2 },
  },
  {
    id: 'n-joy',
    title: '简单的快乐',
    text: '一顿饭、一次散步、一场好觉。幸福变得具体。',
    conditions: [{ kind: 'stat', stat: 'happiness', op: '>=', value: 75 }],
    effects: { happiness: 3 },
  },
  {
    id: 'n-balance',
    title: '五维均衡',
    text: '事业、关系、身体与好奇心，罕见地同时在线。',
    conditions: [
      { kind: 'stat', stat: 'creativity', op: '>=', value: 50 },
      { kind: 'stat', stat: 'exploration', op: '>=', value: 50 },
      { kind: 'stat', stat: 'social', op: '>=', value: 50 },
      { kind: 'stat', stat: 'influence', op: '>=', value: 50 },
      { kind: 'stat', stat: 'happiness', op: '>=', value: 50 },
    ],
    effects: { happiness: 3, creativity: 1 },
  },
  {
    id: 'n-low-spirits',
    title: '低谷期',
    text: '一切都很慢、很灰。但低谷也在重塑你的判断力。',
    conditions: [{ kind: 'stat', stat: 'happiness', op: '<=', value: 25 }],
    effects: { creativity: 2, exploration: 1 },
  },
  {
    id: 'n-hidden-craft',
    title: '无人知晓的打磨',
    text: '没有观众的日子里，你把作品磨到了另一个层级。',
    conditions: [
      { kind: 'stat', stat: 'creativity', op: '>=', value: 70 },
      { kind: 'stat', stat: 'influence', op: '<=', value: 40 },
    ],
    effects: { creativity: 4 },
  },
  {
    id: 'n-network',
    title: '节点人物',
    text: '人们通过你认识彼此。你成了网络里的那个节点。',
    conditions: [
      { kind: 'stat', stat: 'social', op: '>=', value: 60 },
      { kind: 'stat', stat: 'influence', op: '>=', value: 50 },
    ],
    effects: { social: 2, influence: 2 },
  },
  {
    id: 'n-cross-pollination',
    title: '跨界迁移',
    text: '一个领域的方法，在另一个领域突然奏效。',
    conditions: [
      { kind: 'stat', stat: 'creativity', op: '>=', value: 50 },
      { kind: 'stat', stat: 'exploration', op: '>=', value: 50 },
    ],
    effects: { creativity: 2, exploration: 2 },
  },
  // 四种身份的初始剧情：出生第一年自动触发，各自强化身份底色
  {
    id: 'n-open-campus',
    title: '校园地图',
    text: '你把校园画成了一张地图：实验室、社团招新处、图书馆的靠窗座位，都被标上了星号。',
    conditions: [
      { kind: 'identity', identityId: 'campus' },
      { kind: 'age', op: '<=', value: 1 },
    ],
    effects: { exploration: 2, creativity: 1 },
  },
  {
    id: 'n-open-founder',
    title: '第一次路演',
    text: '你用零花钱做了第一个小项目，在市集上摆了一天摊。卖出不多，但你记住了「成交」的感觉。',
    conditions: [
      { kind: 'identity', identityId: 'founder' },
      { kind: 'age', op: '<=', value: 1 },
    ],
    effects: { influence: 2, social: 1 },
  },
  {
    id: 'n-open-creator',
    title: '第一件作品',
    text: '没人要求你做，但你还是做完了第一件小作品，并把它摆在了窗台上。',
    conditions: [
      { kind: 'identity', identityId: 'creator' },
      { kind: 'age', op: '<=', value: 1 },
    ],
    effects: { creativity: 2, happiness: 1 },
  },
  {
    id: 'n-open-traveler',
    title: '第一次出发',
    text: '第一次独自坐上跨城的慢车，窗外的风景成了你最早的笔记本。',
    conditions: [
      { kind: 'identity', identityId: 'traveler' },
      { kind: 'age', op: '<=', value: 1 },
    ],
    effects: { exploration: 2, happiness: 1 },
  },
]