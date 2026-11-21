import type { EndingDef } from '@/engine/ple/types'

/**
 * 八种基础结局。判定 = 多维加权分 + 经历条件（requirements/bonuses）+ 特殊事件组合。
 * 多元跨界者无硬性门槛，保证任何人生都有归宿；隐藏传奇以 priority 置顶。
 */
export const ENDINGS: EndingDef[] = [
  {
    id: 'research',
    name: '科研探索者',
    description: '把一生押注在未被解答的问题上，拓展了人类认知的边界。',
    conditionText: '探索 ≥ 60 且年龄 ≥ 40；意外发现与心流经历加分',
    weights: { exploration: 0.45, creativity: 0.35, influence: 0.1, happiness: 0.1 },
    requirements: [
      { kind: 'stat', stat: 'exploration', op: '>=', value: 60 },
      { kind: 'age', op: '>=', value: 40 },
    ],
    bonuses: [
      { conditions: [{ kind: 'event', eventId: 'e-lab-discovery' }], points: 5 },
      { conditions: [{ kind: 'narrative', narrativeId: 'n-deep-study' }], points: 3 },
    ],
  },
  {
    id: 'founder',
    name: '创业实践者',
    description: '把想法变成组织与产品，在不确定中建立了现实的事业。',
    conditionText: '经历过项目启动事件；影响力与失败教训加分',
    weights: { influence: 0.4, creativity: 0.25, social: 0.2, exploration: 0.15 },
    requirements: [{ kind: 'event', eventId: 'e-startup-launch' }],
    bonuses: [
      { conditions: [{ kind: 'event', eventId: 'e-loss' }], points: 4 },
      { conditions: [{ kind: 'stat', stat: 'influence', op: '>=', value: 70 }], points: 4 },
    ],
  },
  {
    id: 'creator',
    name: '独立创造者',
    description: '不依附体系，用持续的作品定义了属于自己的表达。',
    conditionText: '创造 ≥ 65；无人知晓的打磨与低曝光加分',
    weights: { creativity: 0.55, happiness: 0.25, exploration: 0.1, influence: 0.1 },
    requirements: [{ kind: 'stat', stat: 'creativity', op: '>=', value: 65 }],
    bonuses: [
      { conditions: [{ kind: 'narrative', narrativeId: 'n-hidden-craft' }], points: 6 },
      { conditions: [{ kind: 'stat', stat: 'influence', op: '<=', value: 40 }], points: 4 },
    ],
  },
  {
    id: 'explorer',
    name: '世界探索者',
    description: '用脚步丈量地图的边缘，经历本身成为一生的作品。',
    conditionText: '探索 ≥ 65 且经历过无人区远征',
    weights: { exploration: 0.6, happiness: 0.2, creativity: 0.1, social: 0.1 },
    requirements: [
      { kind: 'stat', stat: 'exploration', op: '>=', value: 65 },
      { kind: 'event', eventId: 'e-expedition' },
    ],
    bonuses: [{ conditions: [{ kind: 'narrative', narrativeId: 'n-wanderlust' }], points: 5 }],
  },
  {
    id: 'connector',
    name: '社群连接者',
    description: '把陌生人织成网络，让很多人因为彼此而过得更好。',
    conditionText: '联结 ≥ 65；社群节日与归属经历加分',
    weights: { social: 0.6, happiness: 0.25, influence: 0.15 },
    requirements: [{ kind: 'stat', stat: 'social', op: '>=', value: 65 }],
    bonuses: [
      { conditions: [{ kind: 'event', eventId: 'e-community-fest' }], points: 6 },
      { conditions: [{ kind: 'narrative', narrativeId: 'n-belonging' }], points: 4 },
    ],
  },
  {
    id: 'leader',
    name: '领域引领者',
    description: '站在领域的前排，定义了别人跟随的方向。',
    conditionText: '影响 ≥ 70；被领域看见与作品走红加分',
    weights: { influence: 0.55, social: 0.2, creativity: 0.15, exploration: 0.1 },
    requirements: [{ kind: 'stat', stat: 'influence', op: '>=', value: 70 }],
    bonuses: [
      { conditions: [{ kind: 'narrative', narrativeId: 'n-recognition' }], points: 5 },
      { conditions: [{ kind: 'event', eventId: 'e-viral-work' }], points: 4 },
    ],
  },
  {
    id: 'polymath',
    name: '多元跨界者',
    description: '没有单一标签，均衡而宽阔的人生本身就是一种成就。',
    conditionText: '无硬性门槛；五维均衡与跨界迁移加分',
    weights: { creativity: 0.2, exploration: 0.2, social: 0.2, influence: 0.2, happiness: 0.2 },
    scoring: 'balanced',
    bonuses: [
      { conditions: [{ kind: 'narrative', narrativeId: 'n-balance' }], points: 6 },
      { conditions: [{ kind: 'narrative', narrativeId: 'n-cross-pollination' }], points: 4 },
    ],
  },
  {
    id: 'hidden',
    name: '隐藏传奇',
    description: '作品流传于世，名字却无人知晓。真正的传奇不需要署名。',
    conditionText: '独立创造路线的匿名杰作事件 + 创造 ≥ 75 + 影响 ≤ 50 + 幸福 ≥ 60',
    weights: { creativity: 0.5, happiness: 0.3, exploration: 0.2 },
    requirements: [
      { kind: 'event', eventId: 'e-anonymous-master' },
      { kind: 'stat', stat: 'creativity', op: '>=', value: 75 },
      { kind: 'stat', stat: 'influence', op: '<=', value: 50 },
      { kind: 'stat', stat: 'happiness', op: '>=', value: 60 },
    ],
    bonuses: [{ conditions: [{ kind: 'narrative', narrativeId: 'n-hidden-craft' }], points: 5 }],
    priority: 100,
  },
]