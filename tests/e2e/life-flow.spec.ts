import { expect, test } from '@playwright/test'
import fs from 'node:fs'

/**
 * 主流程 14 步：首页 → 创建 → 身份 → 模拟 → 两次选择 → 属性变化 → 时间线 →
 * 历史节点分支 → 双宇宙切换 → 对照实验 → 完成人生 → 导出结局卡 → 刷新 → 数据保留。
 */
test('14 步主流程与刷新后数据恢复', async ({ page }) => {
  test.setTimeout(180_000)
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
  })

  // 1 打开首页
  await page.goto('/')
  await expect(page.getByText('PARALLEL LIFE').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /每一个选择/ })).toBeVisible()

  // 2–4 创建宇宙 A：选择初始身份（创业探索者）并启动模拟
  await page.goto('/create')
  await page.getByLabel('宇宙名称').fill('流程甲')
  await page.getByLabel('命运种子').fill('2026')
  await page.getByRole('button', { name: /创业探索者/ }).click()
  await page.getByRole('button', { name: /生成创建确认/ }).click()
  await expect(page.getByRole('dialog', { name: '创建确认' })).toBeVisible()
  await page.getByRole('button', { name: /确认并启动/ }).click()
  await expect(page).toHaveURL(/\/simulation\//)
  const urlA = page.url()
  await expect(page.getByText('创业探索者').first()).toBeVisible()

  // 5 完成两次选择
  const statBefore = await page
    .locator('[role=progressbar]')
    .first()
    .getAttribute('aria-valuenow')
  for (let i = 1; i <= 2; i++) {
    await page.getByTestId('choice-option').first().click()
    await page.getByTestId('confirm-choice').click()
    await expect(page.getByText(`AGE ${i}`).first()).toBeVisible()
  }

  // 6 查看人生属性变化
  const statAfter = await page
    .locator('[role=progressbar]')
    .first()
    .getAttribute('aria-valuenow')
  expect(statAfter).not.toBe(statBefore)

  // 7 打开时间线
  await page.getByRole('link', { name: /时间线/ }).click()
  await expect(page).toHaveURL(/\/timeline\//)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  expect(await page.locator('.react-flow__node').count()).toBeGreaterThanOrEqual(3)

  // 8 从历史节点（AGE 1）创建分支
  await page.locator('.react-flow__node', { hasText: 'AGE 1' }).first().click()
  await page.getByRole('button', { name: /在此年创建分支路线/ }).click()
  await expect(page.getByRole('button', { name: /分支 1/ })).toBeVisible()

  // 9 创建宇宙 B（第五章起 + 自动推演），并在两个宇宙间切换
  await page.goto('/create')
  await page.getByLabel('宇宙名称').fill('流程乙')
  await page.getByLabel('命运种子').fill('7')
  await page.getByRole('button', { name: /世界旅行者/ }).click()
  await page.getByRole('button', { name: /CHAPTER 05/ }).click()
  await page.getByRole('button', { name: /自动推演/ }).click()
  await page.getByRole('button', { name: /生成创建确认/ }).click()
  await page.getByRole('button', { name: /确认并启动/ }).click()
  await expect(page).toHaveURL(/\/simulation\//)
  const urlB = page.url()
  expect(urlB).not.toBe(urlA)

  await page.goto('/multiverse')
  await expect(page.getByText('流程甲')).toBeVisible()
  await expect(page.getByText('流程乙')).toBeVisible()
  await page.getByRole('button', { name: '收藏 流程甲' }).click()
  await expect(page.getByRole('button', { name: '取消收藏 流程甲' })).toBeVisible()
  // 按 href 精确进入目标宇宙，不依赖列表排序
  const enterUniverse = async (url: string) => {
    await page.locator(`a[href="${new URL(url).pathname}"]`).first().click()
    await expect(page).toHaveURL(url)
  }
  await enterUniverse(urlA)
  await page.goto('/multiverse')
  await enterUniverse(urlB)

  // 10 进入人生对照实验并交换左右
  await page.goto('/comparison')
  await expect(page.getByText('Attribute Radar')).toBeVisible()
  await expect(page.getByText('Key Choices')).toBeVisible()
  await expect(page.getByText('Timeline Compare')).toBeVisible()
  const firstSelect = page.locator('select').nth(0)
  const leftBefore = await firstSelect.inputValue()
  await page.getByRole('button', { name: '交换左右路线' }).click()
  await expect(firstSelect).not.toHaveValue(leftBefore)

  // 11 完成人生模拟（自动推演 + 主线剧情年手动抉择）
  await page.goto(urlB)
  await page.getByRole('button', { name: /开始推演/ }).click()
  for (let i = 0; i < 40; i++) {
    if ((await page.getByText('FINAL').count()) > 0) break
    if ((await page.getByText('主线剧情年：请亲自抉择').count()) > 0) {
      await page.getByTestId('choice-option').first().click()
      await page.getByTestId('confirm-choice').click()
      await page.getByRole('button', { name: /开始推演/ }).click()
    }
    await page.waitForTimeout(950)
  }
  await expect(page.getByText('FINAL')).toBeVisible({ timeout: 30_000 })

  // 12 导出结局卡：校验下载文件为 3000×4200 PNG
  await page.getByRole('link', { name: /查看完整结局/ }).click()
  await expect(page).toHaveURL(/\/ending\//)
  await expect(page.getByText(/Ending \d+ \/ 08/i)).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /导出高清 PNG/ }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/parallel-life-.*\.png/)
  const downloadPath = await download.path()
  const png = fs.readFileSync(downloadPath)
  expect(png.length).toBeGreaterThan(10_000)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(3000)
  expect(png.readUInt32BE(20)).toBe(4200)

  // 13 刷新页面（先关闭音效以验证设置持久化）
  await page.goto('/settings')
  await page.getByRole('button', { name: '关闭音效' }).click()
  await page.reload()

  // 14 检查数据是否保留：设置 / 收藏 / 双宇宙 / 结局图鉴 / 分支与年龄
  await expect(page.getByRole('button', { name: '开启音效' })).toBeVisible()
  await page.goto('/multiverse')
  await expect(page.getByText('流程甲')).toBeVisible()
  await expect(page.getByText('流程乙')).toBeVisible()
  await expect(page.getByRole('button', { name: '取消收藏 流程甲' })).toBeVisible()
  await expect(page.getByText('80 岁').first()).toBeVisible()
  await page.goto('/collection')
  await expect(page.getByText(/解锁 1\/8 结局/)).toBeVisible()
  await page.goto('/multiverse')
  // 乙已终局（链接为「查看人生」），按 href 精确进入甲
  await page.locator(`a[href="${new URL(urlA).pathname}"]`).first().click()
  await expect(page).toHaveURL(urlA)
  await expect(page.getByText('AGE 1').first()).toBeVisible()
  await page.getByRole('link', { name: /时间线/ }).click()
  await expect(page.getByRole('button', { name: /分支 1/ })).toBeVisible()
  expect(await page.locator('.react-flow__node').count()).toBeGreaterThanOrEqual(3)

  expect(runtimeErrors).toEqual([])
})