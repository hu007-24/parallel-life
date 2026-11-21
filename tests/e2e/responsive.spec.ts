import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${label} 横向溢出 ${overflow}px`).toBeLessThanOrEqual(1)
}

for (const vp of VIEWPORTS) {
  test(`${vp.name} ${vp.width}×${vp.height}：全页面可达、无横向溢出、核心交互可用`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })

    // 创建宇宙（移动端同样完整可完成）
    await page.goto('/create')
    await assertNoHorizontalOverflow(page, 'create')
    await page.getByLabel('宇宙名称').fill(`响应式-${vp.name}`)
    await page.getByLabel('命运种子').fill('2026')
    await page.getByRole('button', { name: /生成创建确认/ }).click()
    await page.getByRole('button', { name: /确认并启动/ }).click()
    await expect(page).toHaveURL(/\/simulation\//, { timeout: 10_000 })
    const simulationUrl = page.url()
    const universePath = new URL(simulationUrl).pathname
    const timelinePath = universePath.replace('/simulation/', '/timeline/')

    // 模拟页：三栏/堆叠布局下选择与确认可用
    await assertNoHorizontalOverflow(page, 'simulation')
    await expect(page.getByTestId('confirm-choice')).toBeVisible()
    await page.getByTestId('choice-option').first().click()
    await page.getByTestId('confirm-choice').click()
    await expect(page.getByText('AGE 1').first()).toBeVisible()

    // 时间线：窄屏画布 + 节点点击 + 分支创建
    await page.goto(timelinePath)
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    await assertNoHorizontalOverflow(page, 'timeline')
    await page.locator('.react-flow__node', { hasText: 'AGE 1' }).first().click()
    await page.getByRole('button', { name: /在此年创建分支路线/ }).click()
    await expect(page.getByRole('button', { name: /分支 1/ })).toBeVisible()

    // 对照实验：窄屏表格容器内滚动而非页面溢出
    await page.goto('/comparison')
    await expect(page.getByText('Attribute Radar')).toBeVisible()
    await assertNoHorizontalOverflow(page, 'comparison')
    await expect(page.locator('canvas').first()).toBeVisible()

    // 其余页面
    for (const path of ['/', '/multiverse', '/collection', '/settings', universePath.replace('/simulation/', '/ending/')]) {
      await page.goto(path)
      await page.waitForTimeout(400)
      await assertNoHorizontalOverflow(page, path)
    }

    // 移动端导航六项全部可达
    if (vp.name === 'mobile') {
      const nav = page.locator('header nav')
      await expect(nav.getByRole('link')).toHaveCount(6)
      await nav.getByRole('link', { name: '系统设置' }).scrollIntoViewIfNeeded()
      await nav.getByRole('link', { name: '系统设置' }).click()
      await expect(page).toHaveURL(/\/settings/)
      await expect(page.getByRole('switch', { name: '音效' })).toBeVisible()
    }

    expect(errors).toEqual([])
  })
}