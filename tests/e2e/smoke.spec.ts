import { expect, test, type Page } from '@playwright/test'

async function createUniverse(page: Page, name: string) {
  await page.goto('/create')
  await page.getByLabel('宇宙名称').fill(name)
  await page.getByRole('button', { name: /生成创建确认/ }).click()
  await page.getByRole('button', { name: /确认并启动/ }).click()
  await expect(page).toHaveURL(/\/simulation\//)
}

test('首页渲染品牌标识与开启人生实验入口', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('PARALLEL LIFE').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /每一个选择/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /开启人生实验/ }).first()).toBeVisible()
})

test('创建宇宙 → 确认 → 进入模拟 → 选择并确认推进', async ({ page }) => {
  await page.goto('/create')
  await page.getByLabel('宇宙名称').fill('E2E 测试宇宙')
  await page.getByLabel('命运种子').fill('42')
  await page.getByRole('button', { name: /生成创建确认/ }).click()
  await expect(page.getByRole('dialog', { name: '创建确认' })).toBeVisible()
  await page.getByRole('button', { name: /确认并启动/ }).click()

  await expect(page).toHaveURL(/\/simulation\//)
  await expect(page.getByRole('heading', { name: 'E2E 测试宇宙' })).toBeVisible()

  await page.getByTestId('choice-option').first().click()
  await page.getByTestId('confirm-choice').click()
  await expect(page.getByText('AGE 1').first()).toBeVisible()
})

test('平行宇宙页展示已创建的宇宙并支持收藏', async ({ page }) => {
  await createUniverse(page, '列表验证宇宙')
  await page.goto('/multiverse')
  await expect(page.getByText('列表验证宇宙')).toBeVisible()
  await page.getByRole('button', { name: '收藏 列表验证宇宙' }).click()
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  await expect(page.getByText('列表验证宇宙')).toBeVisible()
})