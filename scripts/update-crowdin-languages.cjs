#!/usr/bin/env node

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
  console.error('Missing CROWDIN_PROJECT_ID or CROWDIN_PERSONAL_TOKEN environment variables.')
  process.exit(1)
}

async function crowdinRequest(endpoint) {
  const response = await fetch(`https://api.crowdin.com/api/v2${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Crowdin API request failed for ${endpoint}: ${response.status} ${text}`)
  }

  return response.json()
}

function normalizeLanguageCode(code) {
  return String(code || '').trim().replace(/_/g, '-').replace(/-\w+$/i, (match) => match.toLowerCase())
}

function countryFromCode(code) {
  const normalized = String(code || '').toUpperCase()
  if (!normalized) return undefined
  const parts = normalized.split('-')
  return parts.length > 1 ? parts[1] : undefined
}

async function main() {
  const progressResponse = await crowdinRequest(`/projects/${projectId}/languages/progress`)
  const progressRecords = Array.isArray(progressResponse?.data) ? progressResponse.data : []

  const normalized = progressRecords.map((entry) => {
    const data = entry?.data ?? entry
    const langObj = data?.language ?? {}
    const rawId = data?.languageId ?? langObj?.id ?? data?.code ?? 'en'
    const code = normalizeLanguageCode(rawId)
    const name = langObj?.name ?? data?.name ?? code
    const completion = Number(
      data?.translationProgress ?? data?.progress ?? data?.completion ?? data?.approvalProgress ?? 0
    )

    return {
      code,
      country: countryFromCode(langObj?.locale || code),
      name,
      completion: Number.isFinite(completion) ? Math.max(0, Math.min(100, completion)) : 0
    }
  })

  const targetDir = path.join(process.cwd(), 'src', 'renderer', 'src', 'languages')
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  const outputPath = path.join(targetDir, 'languages.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${normalized.length} language entries to ${outputPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
