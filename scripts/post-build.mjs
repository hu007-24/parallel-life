import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// SPA 回退：静态宿主（含 Qoder Sites / GitHub Pages 风格）对未知路径返回 404.html 时，
// 返回应用外壳即可由前端路由接管深链。
const dist = resolve(process.cwd(), 'dist')
const index = resolve(dist, 'index.html')
const fallback = resolve(dist, '404.html')
if (!existsSync(index)) {
  console.error('[post-build] dist/index.html 不存在，先运行 vite build')
  process.exit(1)
}
copyFileSync(index, fallback)
console.log('[post-build] SPA fallback: dist/404.html 已生成')