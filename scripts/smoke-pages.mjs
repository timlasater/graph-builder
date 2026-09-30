import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { chromium } from '@playwright/test'

const dist = new URL('../dist/', import.meta.url)
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' }
const server = createServer(async (request, response) => {
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
  const file = new URL(fileName, dist)
  try {
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': mime[extname(file.pathname)] ?? 'application/octet-stream' }).end(body)
  } catch {
    response.writeHead(404).end()
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--no-sandbox'] })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  const origin = `http://127.0.0.1:${server.address().port}`
  await page.goto(`${origin}/graph-builder/`)
  await page.getByRole('heading', { name: 'Make scientific graphs from your own data.' }).waitFor()
  await page.getByRole('link', { name: 'Launch Graph Builder' }).click()
  assert.equal(new URL(page.url()).pathname, '/graph-builder/app/')
  await page.getByRole('region', { name: 'Graph preview' }).waitFor()
  await page.reload()
  await page.getByRole('region', { name: 'Graph preview' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Pages landing, app, assets, and direct refresh passed.')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
