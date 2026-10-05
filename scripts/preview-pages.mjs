import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const dist = new URL('../dist/', import.meta.url)
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' }
const port = Number(process.env.PORT || 4174)

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (!pathname.startsWith('/graph-builder/')) {
    response.writeHead(404).end()
    return
  }
  const relative = pathname.slice('/graph-builder/'.length)
  const segments = relative.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '..')) {
    response.writeHead(400).end()
    return
  }
  const fileName = segments.length === 0 ? 'index.html' : `${segments.join('/')}${pathname.endsWith('/') ? '/index.html' : ''}`
  try {
    const body = await readFile(new URL(fileName, dist))
    response.writeHead(200, { 'Content-Type': mime[extname(fileName)] ?? 'application/octet-stream' }).end(body)
  } catch {
    response.writeHead(404).end()
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Preview landing page: http://127.0.0.1:${port}/graph-builder/`)
  console.log(`Preview browser app: http://127.0.0.1:${port}/graph-builder/app/`)
})
