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
  const [languagesResponse, progressResponse] = await Promise.all([
    crowdinRequest(`/projects/${projectId}/languages`),
    crowdinRequest(`/projects/${projectId}/languages/progress`)
  ])

  const languageRecords = Array.isArray(languagesResponse?.data) ? languagesResponse.data : []
  const progressRecords = Array.isArray(progressResponse?.data) ? progressResponse.data : []

  const progressMap = new Map()
  for (const entry of progressRecords) {
    const data = entry?.data ?? entry
    const rawCode = data?.languageId ?? data?.language?.id ?? data?.code ?? data?.id
    const progress = Number(
      data?.translationProgress ?? data?.progress ?? data?.completion ?? data?.approvalProgress ?? 0
    )
    if (rawCode) {
      progressMap.set(String(rawCode), Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0)
    }
  }

  const normalized = languageRecords.map((entry) => {
    const data = entry?.data ?? entry
    const code = normalizeLanguageCode(data?.languageId ?? data?.code ?? data?.locale ?? 'en')
    const name = data?.name ?? data?.fullName ?? code
    const completion =
      progressMap.get(code) ??
      progressMap.get(String(data?.languageId ?? data?.code ?? '')) ??
      0

    return {
      code,
      country: countryFromCode(code),
      name,
      completion
    }
  })

  const outputPath = path.join(process.cwd(), 'src', 'renderer', 'src', 'locales', 'languages.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${normalized.length} language entries to ${outputPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
