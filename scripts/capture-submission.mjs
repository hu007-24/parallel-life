import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CAPTURE_BASE_URL ?? 'http://localhost:4173'
const out = 'submission/screenshots'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const shot = (name, fullPage = false) => page.screenshot({ path: `${out}/${name}.png`, fullPage })
const sleep = (ms) => page.waitForTimeout(ms)

async function createUniverse(name, seed, chapterLabel, auto) {
  await page.goto(`${base}/create`)
  await page.getByLabel('宇宙名称').fill(name)
  await page.getByLabel('命运种子').fill(String(seed))
  if (chapterLabel) await page.getByRole('button', { name: new RegExp(chapterLabel) }).click()
  if (auto) await page.getByRole('button', { name: /自动推演/ }).click()
  await page.getByRole('button', { name: /生成创建确认/ }).click()
  await sleep(300)
  await page.getByRole('button', { name: /确认并启动/ }).click()
  await page.waitForURL(/\/simulation\//, { timeout: 15_000 })
  await sleep(900)
  return page.url()
}

// 01 首页
await page.goto(base)
await sleep(1500)
await shot('01-home', true)

// 02 创建确认弹窗
await page.goto(`${base}/create`)
await page.getByLabel('宇宙名称').fill('平行人生演示')
await page.getByLabel('命运种子').fill('2026')
await page.getByRole('button', { name: /CHAPTER 02/ }).click()
await page.getByRole('button', { name: /生成创建确认/ }).click()
await sleep(400)
await shot('02-create-confirm')
await page.getByRole('button', { name: /确认并启动/ }).click()
await page.waitForURL(/\/simulation\//, { timeout: 15_000 })
await sleep(900)
const demoUrl = page.url()

// 03 模拟三栏（推进三次选择）
for (let i = 0; i < 3; i++) {
  await page.getByTestId('choice-option').first().click()
  await page.getByTestId('confirm-choice').click()
  await sleep(700)
}
await shot('03-simulation')

// 04 时间线分支
await page.goto(demoUrl.replace('/simulation/', '/timeline/'))
await page.locator('.react-flow__node').first().waitFor()
await sleep(600)
await page.locator('.react-flow__node', { hasText: 'AGE 20' }).first().click()
await page.getByRole('button', { name: /在此年创建分支路线/ }).click()
await sleep(800)
await shot('04-timeline-branch')

// 05 对照实验
await page.goto(`${base}/comparison`)
await sleep(1200)
await shot('05-comparison', true)

// 06 结局 + 纪念卡（自动推演完成一生）
const endedUrl = await createUniverse('终局演示', 7, 'CHAPTER 05', true)
await page.getByRole('button', { name: /开始推演/ }).click()
for (let i = 0; i < 40; i++) {
  if ((await page.getByText('FINAL').count()) > 0) break
  if ((await page.getByText('主线剧情年：请亲自抉择').count()) > 0) {
    await page.getByTestId('choice-option').first().click()
    await page.getByTestId('confirm-choice').click()
    await page.getByRole('button', { name: /开始推演/ }).click()
  }
  await sleep(950)
}
await page.getByRole('link', { name: /查看完整结局/ }).click()
await sleep(1500)
await shot('06-ending-card', true)

// 07 图鉴 / 08 设置
await page.goto(`${base}/collection`)
await sleep(900)
await shot('07-collection', true)
await page.goto(`${base}/settings`)
await sleep(600)
await shot('08-settings')

// 移动端三张
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mpage = await mobile.newPage()
await mpage.goto(base)
await mpage.waitForTimeout(1200)
await mpage.screenshot({ path: `${out}/09-mobile-home.png` })
await mpage.goto(demoUrl)
await mpage.waitForTimeout(900)
await mpage.screenshot({ path: `${out}/10-mobile-simulation.png` })
await mpage.goto(demoUrl.replace('/simulation/', '/timeline/'))
await mpage.waitForTimeout(1200)
await mpage.screenshot({ path: `${out}/11-mobile-timeline.png` })

await browser.close()
console.log('screenshots saved to', out)