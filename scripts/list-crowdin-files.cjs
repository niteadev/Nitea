const fs = require('fs')
const path = require('path')

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) return

    const key = trimmed.slice(0, equalIndex).trim()
    if (!key || process.env[key]) return

    let value = trimmed.slice(equalIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  })
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const projectId = process.env.CROWDIN_PROJECT_ID
const token = process.env.CROWDIN_PERSONAL_TOKEN

if (!projectId || !token) {
  console.error('Missing credentials')
  process.exit(1)
}

async function main() {
  const res = await fetch(`https://api.crowdin.com/api/v2/projects/${projectId}/files?limit=500`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const json = await res.json()
  console.log('Crowdin Files:', JSON.stringify(json.data, null, 2))
}

main().catch(console.error)
