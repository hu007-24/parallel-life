import type { LifeStats } from '@/types'
import { STAT_KEYS, STAT_LABELS } from '@/engine/ple/state-engine'
import { createRng } from '@/engine/ple/random-engine'

export const CARD_W = 1000
export const CARD_H = 1400

const BG = '#17191C'
const INK = '#F5F5F3'
const SILVER = '#BFC3C7'
const MUTED = '#777777'
const HAIR = '#3A3F45'

/** 中文字体栈：覆盖 macOS / Windows / Linux，保证 Canvas 中文正确渲染 */
export const FONT_CJK =
  '"PingFang SC","Microsoft YaHei","Noto Sans SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif'
export const FONT_MONO = '"SF Mono","Cascadia Code","Consolas","Courier New",monospace'

export interface CardData {
  universeId: string
  universeName: string
  endingTitle: string
  endingNumber: number
  summaryText: string
  stats: LifeStats
  createdDate: string
  seed: number
  identityName: string
  age: number
}

export type CardBlock =
  | {
      kind: 'text'
      x: number
      y: number
      w: number
      h: number
      text: string
      size: number
      color: string
      mono?: boolean
      bold?: boolean
      align?: 'left' | 'right'
      spaced?: number
    }
  | { kind: 'bar'; x: number; y: number; w: number; h: number; ratio: number }
  | { kind: 'rule'; x: number; y: number; w: number; h: number }

const isWide = (char: string) =>
  /[⺀-﫿＀-￯]/.test(char)

export function charWidth(char: string, size: number): number {
  return isWide(char) ? size : size * 0.62
}

export function textWidth(text: string, size: number, spaced = 0): number {
  let width = 0
  for (const char of text) width += charWidth(char, size) + spaced
  return Math.max(0, width - spaced)
}

/** 按估算字宽换行（CJK 全角 / 拉丁半角），保证不溢出版心 */
export function wrapText(text: string, maxWidth: number, size: number): string[] {
  const lines: string[] = []
  let line = ''
  let width = 0
  for (const char of text) {
    const w = charWidth(char, size)
    if (width + w > maxWidth && line.length > 0) {
      lines.push(line)
      line = char
      width = w
    } else {
      line += char
      width += w
    }
  }
  if (line.length > 0) lines.push(line)
  return lines
}

/**
 * 纪念卡版式（纯函数）：所有元素坐标固定推导，互不重叠、不出版心。
 * 单测据此验证布局不变量；绘制层只消费这些 block。
 */
export function buildCardLayout(data: CardData): CardBlock[] {
  const blocks: CardBlock[] = []
  const M = 80
  const innerW = CARD_W - M * 2

  blocks.push({
    kind: 'text', x: M, y: 96, w: 420, h: 32,
    text: 'PARALLEL LIFE', size: 26, color: INK, mono: true, bold: true, spaced: 6,
  })
  const endingTag = `ENDING ${String(data.endingNumber).padStart(2, '0')} / 08`
  blocks.push({
    kind: 'text', x: CARD_W - M - 260, y: 100, w: 260, h: 26,
    text: endingTag, size: 16, color: SILVER, mono: true, align: 'right',
  })
  blocks.push({ kind: 'rule', x: M, y: 150, w: innerW, h: 1 })

  blocks.push({
    kind: 'text', x: M, y: 196, w: 300, h: 18,
    text: 'UNIVERSE ID', size: 14, color: MUTED, mono: true, spaced: 3,
  })
  blocks.push({
    kind: 'text', x: M, y: 224, w: innerW, h: 26,
    text: data.universeId, size: 20, color: INK, mono: true,
  })

  blocks.push({
    kind: 'text', x: M, y: 320, w: 620, h: 76,
    text: data.endingTitle, size: 64, color: INK, bold: true,
  })
  blocks.push({
    kind: 'text', x: M, y: 412, w: 620, h: 30,
    text: `${data.identityName} · ${data.age} 岁 · SEED ${data.seed}`, size: 22, color: SILVER,
  })

  const summaryLines = wrapText(data.summaryText, 620, 26).slice(0, 4)
  summaryLines.forEach((line, i) => {
    blocks.push({
      kind: 'text', x: M, y: 470 + i * 40, w: 620, h: 32,
      text: line, size: 26, color: SILVER,
    })
  })

  blocks.push({ kind: 'rule', x: M, y: 660, w: innerW, h: 1 })
  blocks.push({
    kind: 'text', x: M, y: 706, w: 300, h: 18,
    text: 'LIFE STATS', size: 14, color: MUTED, mono: true, spaced: 3,
  })
  STAT_KEYS.forEach((key, i) => {
    const y = 750 + i * 88
    blocks.push({
      kind: 'text', x: M, y, w: 140, h: 30,
      text: STAT_LABELS[key], size: 24, color: SILVER,
    })
    blocks.push({
      kind: 'bar', x: 260, y: y + 12, w: 560, h: 6,
      ratio: Math.max(0, Math.min(1, data.stats[key] / 100)),
    })
    blocks.push({
      kind: 'text', x: 860, y, w: 60, h: 32,
      text: String(data.stats[key]), size: 28, color: INK, mono: true, align: 'right',
    })
  })

  blocks.push({ kind: 'rule', x: M, y: 1180, w: innerW, h: 1 })
  blocks.push({
    kind: 'text', x: M, y: 1226, w: 300, h: 18,
    text: 'CREATED DATE', size: 14, color: MUTED, mono: true, spaced: 3,
  })
  blocks.push({
    kind: 'text', x: M, y: 1254, w: 400, h: 28,
    text: data.createdDate, size: 22, color: INK, mono: true,
  })
  blocks.push({
    kind: 'text', x: 620, y: 1226, w: 300, h: 18,
    text: 'UNIVERSE', size: 14, color: MUTED, mono: true, align: 'right', spaced: 3,
  })
  blocks.push({
    kind: 'text', x: 620, y: 1254, w: 300, h: 28,
    text: data.universeName, size: 22, color: INK, align: 'right',
  })
  blocks.push({
    kind: 'text', x: M, y: 1330, w: innerW, h: 18,
    text: '100% LOCAL ENGINE · NO AI · PARALLEL LIFE LAB', size: 14, color: MUTED, mono: true, spaced: 2,
  })
  return blocks
}

function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spaced: number,
) {
  let cursor = x
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += charWidth(char, Number(ctx.font.match(/(\d+)px/)?.[1] ?? 16)) + spaced
  }
}

/** 装饰分支线：由 seed 确定性生成，限定在右侧空白区，不与文字版心重叠 */
function drawMotif(ctx: CanvasRenderingContext2D, seed: number) {
  const rng = createRng(seed ^ 0x5eed)
  ctx.save()
  ctx.strokeStyle = HAIR
  ctx.lineWidth = 1
  for (let branch = 0; branch < 3; branch++) {
    let x = 730 + branch * 30
    let y = 320
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let step = 0; step < 7; step++) {
      x += 4 + rng() * 12
      y += 34 + rng() * 12
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.fillStyle = SILVER
    ctx.beginPath()
    ctx.arc(x, y, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawCard(canvas: HTMLCanvasElement, data: CardData, scale = 2): void {
  canvas.width = CARD_W * scale
  canvas.height = CARD_H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  ctx.strokeStyle = HAIR
  ctx.lineWidth = 1
  ctx.strokeRect(40.5, 40.5, CARD_W - 81, CARD_H - 81)

  // 注册角标：精密仪器式四角定位标记
  ctx.strokeStyle = 'rgba(191, 195, 199, 0.6)'
  const mark = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath()
    ctx.moveTo(x + dx * 14, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * 14)
    ctx.stroke()
  }
  mark(24, 24, 1, 1)
  mark(CARD_W - 24, 24, -1, 1)
  mark(24, CARD_H - 24, 1, -1)
  mark(CARD_W - 24, CARD_H - 24, -1, -1)

  // 幽灵结局编号：右侧留白区的低对比装饰层
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = HAIR
  ctx.font = `600 120px ${FONT_MONO}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(String(data.endingNumber).padStart(2, '0'), 920, 460)
  ctx.restore()

  drawMotif(ctx, data.seed)

  for (const block of buildCardLayout(data)) {
    if (block.kind === 'rule') {
      ctx.fillStyle = HAIR
      ctx.fillRect(block.x, block.y, block.w, block.h)
      continue
    }
    if (block.kind === 'bar') {
      ctx.fillStyle = HAIR
      ctx.fillRect(block.x, block.y, block.w, block.h)
      const gradient = ctx.createLinearGradient(block.x, 0, block.x + block.w, 0)
      gradient.addColorStop(0, '#777777')
      gradient.addColorStop(1, '#F5F5F3')
      ctx.fillStyle = gradient
      ctx.fillRect(block.x, block.y, block.w * block.ratio, block.h)
      continue
    }
    ctx.font = `${block.bold ? '600 ' : ''}${block.size}px ${block.mono ? FONT_MONO : FONT_CJK}`
    ctx.fillStyle = block.color
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    if (block.spaced) {
      drawSpaced(ctx, block.text, block.x, block.y, block.spaced)
    } else if (block.align === 'right') {
      ctx.textAlign = 'right'
      ctx.fillText(block.text, block.x + block.w, block.y)
    } else {
      ctx.fillText(block.text, block.x, block.y)
    }
  }

  // 标题下金属发丝线 + 右下序列号
  const underline = ctx.createLinearGradient(80, 0, 320, 0)
  underline.addColorStop(0, '#BFC3C7')
  underline.addColorStop(1, 'rgba(191, 195, 199, 0)')
  ctx.fillStyle = underline
  ctx.fillRect(80, 402, 240, 1)
  ctx.font = `12px ${FONT_MONO}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'right'
  ctx.fillText(
    `PL-${(data.seed >>> 0).toString(36).toUpperCase().padStart(6, '0')}`,
    920,
    1330,
  )
}

/** 高清 PNG 导出（默认 3x = 3000×4200） */
export function exportCardPng(data: CardData, scale = 3): Promise<Blob> {
  const canvas = document.createElement('canvas')
  drawCard(canvas, data, scale)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('纪念卡导出失败：canvas.toBlob 返回空'))
    }, 'image/png')
  })
}