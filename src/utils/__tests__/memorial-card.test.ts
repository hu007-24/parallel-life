import { describe, expect, it } from 'vitest'
import {
  CARD_H,
  CARD_W,
  buildCardLayout,
  charWidth,
  textWidth,
  wrapText,
  type CardBlock,
  type CardData,
} from '@/utils/memorial-card'

const DATA: CardData = {
  universeId: '8e46fce1-efb3-4d1f-ba84-ca6f77a14af3',
  universeName: '联调宇宙',
  endingTitle: '独立创造者',
  endingNumber: 3,
  summaryText:
    '自由创造者的平行人生：80 岁抵达「独立创造者」。23 次主线抉择、4 次特殊事件、6 项隐藏成就。不依附体系，用持续的作品定义了属于自己的表达。',
  stats: { creativity: 92, exploration: 61, social: 48, influence: 30, happiness: 85 },
  createdDate: '2026/11/17',
  seed: 2026,
  identityName: '自由创造者',
  age: 80,
}

function overlaps(a: CardBlock, b: CardBlock): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

describe('memorial-card：版式不变量', () => {
  it('所有元素位于画布内', () => {
    for (const block of buildCardLayout(DATA)) {
      expect(block.x).toBeGreaterThanOrEqual(0)
      expect(block.y).toBeGreaterThanOrEqual(0)
      expect(block.x + block.w).toBeLessThanOrEqual(CARD_W)
      expect(block.y + block.h).toBeLessThanOrEqual(CARD_H)
    }
  })

  it('任意两个元素互不重叠（导出不错位的核心保证）', () => {
    const blocks = buildCardLayout(DATA)
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i]
        const b = blocks[j]
        if (a && b) expect(overlaps(a, b)).toBe(false)
      }
    }
  })

  it('必备内容齐全：品牌 / 编号 / 结局 / 摘要 / 五维 / 日期', () => {
    const texts = buildCardLayout(DATA)
      .filter((b): b is Extract<CardBlock, { kind: 'text' }> => b.kind === 'text')
      .map((b) => b.text)
    expect(texts).toContain('PARALLEL LIFE')
    expect(texts).toContain(DATA.universeId)
    expect(texts).toContain(DATA.endingTitle)
    expect(texts).toContain('ENDING 03 / 08')
    expect(texts).toContain(DATA.createdDate)
    expect(texts.filter((t) => ['创造', '探索', '联结', '影响', '幸福'].includes(t))).toHaveLength(5)
    const bars = buildCardLayout(DATA).filter((b) => b.kind === 'bar')
    expect(bars).toHaveLength(5)
    expect(bars.map((b) => (b.kind === 'bar' ? b.ratio : 0))).toEqual([0.92, 0.61, 0.48, 0.3, 0.85])
  })

  it('长摘要换行后仍不超版心且行数受控', () => {
    const long = '平行人生'.repeat(60)
    const lines = wrapText(long, 620, 26)
    for (const line of lines) {
      expect(textWidth(line, 26)).toBeLessThanOrEqual(620)
    }
    expect(lines.join('')).toBe(long)
    expect(wrapText(DATA.summaryText, 620, 26).length).toBeLessThanOrEqual(4)
  })

  it('字宽估算：CJK 全角、拉丁半角', () => {
    expect(charWidth('创', 26)).toBe(26)
    expect(charWidth('A', 26)).toBeCloseTo(16.12)
    expect(textWidth('创造', 26)).toBe(52)
  })

  it('极端数据（超长名称/满属性/零属性）仍满足布局不变量', () => {
    const extreme: CardData = {
      ...DATA,
      universeName: '一二三四五六七八九十一二',
      endingTitle: '多元跨界者',
      stats: { creativity: 100, exploration: 0, social: 100, influence: 0, happiness: 100 },
      summaryText: '短摘要。',
    }
    const blocks = buildCardLayout(extreme)
    for (const block of blocks) {
      expect(block.x + block.w).toBeLessThanOrEqual(CARD_W)
      expect(block.y + block.h).toBeLessThanOrEqual(CARD_H)
    }
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i]
        const b = blocks[j]
        if (a && b) expect(overlaps(a, b)).toBe(false)
      }
    }
  })
})