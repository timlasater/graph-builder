import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { chromium } from '@playwright/test'

const dist = new URL('../dist/', import.meta.url)
const mime = { '.css': 'text/css', '.html': 'text/html', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.svg': 'image/svg+xml' }
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
  await page.getByRole('heading', { name: /Turn your data into/ }).waitFor()
  const hero = page.locator('.hero')
  assert.equal(await hero.evaluate((element) => getComputedStyle(element).backgroundAttachment), 'fixed')
  assert.equal(await hero.evaluate((element) => getComputedStyle(element).backgroundImage.includes('linear-gradient')), false)
  assert.ok(await hero.evaluate((element) => element.getBoundingClientRect().height) > await page.evaluate(() => innerHeight))
  assert.equal(await page.getByRole('link', { name: 'Read the user guide' }).getAttribute('href'), 'https://github.com/timlasater/graph-builder/blob/main/docs/user-guide.md')
  assert.equal(await page.getByRole('link', { name: 'GitHub repository' }).getAttribute('href'), 'https://github.com/timlasater/graph-builder')
  if (process.env.GB_CAPTURE_PAGES === '1') {
    await mkdir('test-results/pages', { recursive: true })
    await page.screenshot({ path: 'test-results/pages/landing-desktop.png', fullPage: true })
    await page.evaluate(() => scrollTo(0, 460))
    await page.screenshot({ path: 'test-results/pages/landing-scrolled.png' })
    await page.evaluate(() => scrollTo(0, 0))
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(`${origin}/graph-builder/`)
  await mobile.getByRole('link', { name: 'Launch Graph Builder' }).waitFor()
  assert.equal(await mobile.locator('.hero').evaluate((element) => getComputedStyle(element).backgroundAttachment), 'scroll')
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  if (process.env.GB_CAPTURE_PAGES === '1') await mobile.screenshot({ path: 'test-results/pages/landing-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Launch Graph Builder' }).click()
  assert.equal(new URL(page.url()).pathname, '/graph-builder/app/')
  await page.getByRole('region', { name: 'Graph preview' }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Graph Builder page' }).getAttribute('href'), 'https://timothylasater.com/graph-builder/')
  assert.equal(await page.getByRole('link', { name: 'Website home' }).getAttribute('href'), 'https://timothylasater.com/')
  if (process.env.GB_CAPTURE_PAGES === '1') await page.screenshot({ path: 'test-results/pages/app.png', fullPage: false })
  await page.reload()
  await page.getByRole('region', { name: 'Graph preview' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Pages landing, app, assets, and direct refresh passed.')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
