import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const server = await createServer({ server: { host: '127.0.0.1', port: 4174, strictPort: true } })
let exitCode = 1
try {
  await server.listen()
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
} finally {
  await server.close()
}
process.exitCode = exitCode
