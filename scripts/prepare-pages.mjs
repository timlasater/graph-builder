import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const app = new URL('../dist/app/', import.meta.url)
const landing = new URL('../site/index.html', import.meta.url)

const appHtml = await readFile(new URL('index.html', dist), 'utf8')
if (!appHtml.includes('/graph-builder/assets/')) {
  throw new Error('The browser app was not built for /graph-builder/.')
}

await mkdir(app, { recursive: true })
await writeFile(new URL('index.html', app), appHtml)
await copyFile(landing, new URL('index.html', dist))
await copyFile(new URL('../site/sinus-setup.jpg', import.meta.url), new URL('sinus-setup.jpg', dist))
await writeFile(new URL('.nojekyll', dist), '')
