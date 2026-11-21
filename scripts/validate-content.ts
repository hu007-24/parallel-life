import { validateContent } from '@/engine/ple/content-validator'
import { MAX_AGE, choose, createUniverse, getCurrentNode, getRoute } from '@/engine/ple/simulation-engine'
import { createRng } from '@/engine/ple/random-engine'
import { STORY_NODES } from '@/data/stories'
import { CHAPTERS } from '@/data/chapters'
import { LIFE_EVENTS } from '@/data/events'
import { ACHIEVEMENTS } from '@/data/achievements'
import { ENDINGS } from '@/data/endings'
import { ARCHETYPES } from '@/data/archetypes'
import { NARRATIVES } from '@/data/narratives'
import type { Choice } from '@/engine/ple/types'

const report = validateContent()

console.log('════════ 完整剧情目录 ════════')
for (const chapter of CHAPTERS) {
  console.log(`\nCHAPTER 0${chapter.id} · ${chapter.title}（${chapter.minAge}–${chapter.maxAge} 岁）`)
  for (const story of STORY_NODES.filter((s) => s.chapter === chapter.id)) {
    const options = story.options.map((o) => o.label).join(' / ')
    const next = story.nextStoryId ?? '终点'
    console.log(`  ${story.id} [${story.minAge}岁] ${story.title} → ${next}`)
    console.log(`      选项：${options}`)
  }
}
console.log('\n──── 普通事件（15）────')
for (const event of LIFE_EVENTS.filter((e) => e.tier === 'normal')) console.log(`  ${event.id} · ${event.title}`)
console.log('\n──── 特殊事件（10）────')
for (const event of LIFE_EVENTS.filter((e) => e.tier === 'special')) console.log(`  ${event.id} · ${event.title}`)
console.log('\n──── 隐藏成就（12）────')
for (const achievement of ACHIEVEMENTS) console.log(`  ${achievement.id} · ${achievement.title}`)
console.log('\n──── 最终结局（8）────')
for (const ending of ENDINGS) console.log(`  ${ending.id} · ${ending.name}`)
console.log('\n──── 初始身份（4）────')
for (const identity of ARCHETYPES) {
  const opening = NARRATIVES.find((n) =>
    n.conditions.some((c) => c.kind === 'identity' && c.identityId === identity.id),
  )
  console.log(`  ${identity.id} · ${identity.name} · 初始剧情：${opening?.title ?? '缺失'}`)
}

console.log('\n════════ 校验报告 ════════')
console.log('数量：', JSON.stringify(report.counts))
console.log('不可达节点：', report.unreachableStories.length === 0 ? '无' : report.unreachableStories.join(', '))
console.log('无结局路径节点：', report.noEndingStories.length === 0 ? '无' : report.noEndingStories.join(', '))

console.log('\n──── 运行时路径验证（4 身份 × 5 策略）────')
let runtimeOk = true
const prefer = (pattern: RegExp) => (options: readonly Choice[]) =>
  options.find((o) => pattern.test(o.label)) ?? (options[0] as Choice)
for (const identity of ARCHETYPES) {
  for (const [label, pick] of [
    ['首选', (options: readonly Choice[]) => options[0] as Choice],
    ['末选', (options: readonly Choice[]) => options[options.length - 1] as Choice],
    ['随机', (() => {
      const rng = createRng(7)
      return (options: readonly Choice[]) => options[Math.floor(rng() * options.length)] as Choice
    })()],
    ['社群向', prefer(/伙伴|团队|社群|沟通|让给|培养|扎根|分享|社团/)],
    ['影响向', prefer(/带领|展示|冲刺|扩大|组长|竞赛|路演|发表/)],
  ] as const) {
    let universe = createUniverse({ id: 'u-validate', name: '校验', seed: 2026, archetypeId: identity.id })
    while (getRoute(universe).status === 'active') {
      universe = choose(universe, pick(getCurrentNode(universe).options).id)
    }
    const route = getRoute(universe)
    const node = getCurrentNode(universe)
    const ok = route.status === 'ended' && node.age === MAX_AGE && route.endingId !== null
    runtimeOk &&= ok
    console.log(
      `  ${identity.name} · ${label} → ${ok ? 'OK' : 'FAIL'} · 结局 ${route.endingId} · 成就 ${node.seenAchievementIds.length} 个 · 剧情 ${node.story.resolvedStoryIds.length}/23`,
    )
  }
}

if (report.errors.length > 0) {
  console.log('\n──── 错误 ────')
  for (const error of report.errors) console.log('  ✗', error)
}
for (const warning of report.warnings) console.log('  ⚠', warning)
console.log(`\n结构校验：${report.ok ? 'PASS' : 'FAIL'} · 运行时验证：${runtimeOk ? 'PASS' : 'FAIL'}`)
process.exit(report.ok && runtimeOk ? 0 : 1)