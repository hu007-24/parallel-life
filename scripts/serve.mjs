import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const dist = join(root, 'dist')
const PORT = Number(process.env.PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

async function sendFile(res, path) {
  const body = await readFile(path)
  res.writeHead(200, {
    'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=3600',
  })
  res.end(body)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    const pathname = decodeURIComponent(url.pathname)
    const target = normalize(join(dist, pathname))
    if (!target.startsWith(dist)) {
      res.writeHead(403).end('forbidden')
      return
    }
    let file = target
    try {
      const info = await stat(file)
      if (info.isDirectory()) file = join(file, 'index.html')
    } catch {
      // SPA 回退：未知路径交给前端路由
      file = join(dist, 'index.html')
    }
    await sendFile(res, file)
  } catch {
    res.writeHead(500).end('server error')
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`端口 ${PORT} 已有实例在运行，直接打开 http://localhost:${PORT} 即可游玩。`)
    process.exit(0)
  }
  console.error(error)
  process.exit(1)
})

server.listen(PORT, () => {
  console.log(`Parallel Life 已启动：http://localhost:${PORT}`)
  console.log('关闭本窗口即停止服务。')
})