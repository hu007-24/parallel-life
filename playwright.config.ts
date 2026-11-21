import { defineConfig, devices } from '@playwright/test'

// E2E_BASE_URL 可指向生产预览（npm run preview），验证产物与 SPA 回退
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // 本机 chromium CDN 下载不可用；使用已安装的 Edge（Chromium 内核）官方 channel
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})