/* eslint-disable prettier/prettier */
import { app, shell, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

autoUpdater.autoDownload = false

function loadEnvFile(fileName: string): void {
  const filePath = join(process.cwd(), fileName)
  if (!existsSync(filePath)) return

  try {
    const content = readFileSync(filePath, 'utf8')
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
  } catch (e) {
    console.error(`Failed to load env file ${fileName}:`, e)
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const forceStandardMode = process.argv.includes('--mode=standard')
const isDevMode = is.dev && !forceStandardMode

const devUrlArg = process.argv.find((a) => a.startsWith('--dev-url='))
const passedDevUrl = devUrlArg ? decodeURIComponent(devUrlArg.split('=')[1]) : ''
const devUrl = process.env['ELECTRON_RENDERER_URL'] || passedDevUrl || 'http://localhost:5173'

// Encrypted Local Focus Session Logger in AppData
interface FocusSessionLog {
  id: string
  startTime: string
  durationSeconds: number
  completed: boolean
}

const ENCRYPTION_KEY = scryptSync('nitea-focus-session-secret-key-2026', 'nitea-salt-secure', 32)
const ALGORITHM = 'aes-256-cbc'

function getFocusSessionsFilePath(): string {
  return join(app.getPath('userData'), 'focus_sessions.enc')
}

function readEncryptedSessions(): FocusSessionLog[] {
  const filePath = getFocusSessionsFilePath()
  if (!existsSync(filePath)) return []

  try {
    const fileBuffer = readFileSync(filePath)
    if (fileBuffer.length < 16) return []

    const iv = fileBuffer.subarray(0, 16)
    const encryptedData = fileBuffer.subarray(16)

    const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  } catch (e) {
    console.error('Failed to decrypt local focus sessions log:', e)
    return []
  }
}

function writeEncryptedSessions(sessions: FocusSessionLog[]): void {
  const filePath = getFocusSessionsFilePath()
  try {
    const iv = randomBytes(16)
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    const dataText = JSON.stringify(sessions)
    const encryptedData = Buffer.concat([cipher.update(Buffer.from(dataText, 'utf8')), cipher.final()])

    const combinedBuffer = Buffer.concat([iv, encryptedData])
    writeFileSync(filePath, combinedBuffer)
  } catch (e) {
    console.error('Failed to encrypt local focus sessions log:', e)
  }
}

function saveFocusSession(log: FocusSessionLog): void {
  const currentLogs = readEncryptedSessions()
  currentLogs.push(log)
  writeEncryptedSessions(currentLogs)
}

function relaunchAsAdmin(): void {
  if (process.platform !== 'win32') return
  const execPath = process.execPath
  const args = process.argv.slice(1).map((a) => `"${a}"`).join(' ')
  const cmd = `powershell -Command "Start-Process '${execPath}' -ArgumentList '${args}' -Verb RunAs"`
  exec(cmd, () => {
    app.quit()
  })
}

function setSystemPoliciesDisabled(disabled: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(true)
    const val = disabled ? 1 : 0
    const cmds = [
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /t REG_DWORD /d ${val} /f`,
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableLockWorkstation /t REG_DWORD /d ${val} /f`,
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableChangePassword /t REG_DWORD /d ${val} /f`
    ]
    const fullCmd = cmds.join(' & ')
    exec(fullCmd, (err) => {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1270,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' || process.platform === 'win32' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    if (isDevMode) {
      mainWindow.loadURL(devUrl)
    } else {
      mainWindow.loadURL(`${devUrl}?mode=standard`)
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  initAutoUpdater(mainWindow)
}

function createDevControlWindow(): void {
  const devWindow = new BrowserWindow({
    width: 360,
    height: 360,
    title: 'Dev Control Panel',
    frame: true, // Pure WinForm style window with native titlebar
    resizable: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' || process.platform === 'win32' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev) {
    devWindow.loadURL(`${devUrl}?mode=dev-panel`)
  } else {
    devWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { mode: 'dev-panel' } })
  }
}

function initAutoUpdater(targetWindow: BrowserWindow): void {
  autoUpdater.on('checking-for-update', () => {
    targetWindow.webContents.send('update-checking')
  })

  autoUpdater.on('update-available', (info) => {
    targetWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes || 'New updates and stability improvements.'
    })
  })

  autoUpdater.on('update-not-available', () => {
    targetWindow.webContents.send('update-not-available')
  })

  autoUpdater.on('download-progress', (progressObj) => {
    targetWindow.webContents.send('update-download-progress', {
      percent: progressObj.percent
    })
  })

  autoUpdater.on('update-downloaded', () => {
    targetWindow.webContents.send('update-downloaded')
    autoUpdater.quitAndInstall()
  })
}

function createFullscreenWindow(durationSeconds?: number): void {
  const fsWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' || process.platform === 'win32' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  fsWindow.setAlwaysOnTop(true, 'screen-saver')
  fsWindow.setMenu(null)

  // Disable System Policies (Task Manager, Lock, Change Password) in Registry
  setSystemPoliciesDisabled(true).then((success) => {
    // Only prompt for Admin restart in Production/Build mode (do NOT show in Dev mode)
    if (!success && !isDevMode) {
      const choice = dialog.showMessageBoxSync(fsWindow, {
        type: 'warning',
        title: 'Administrator Rights Required',
        message: 'Administrator rights are required to restrict system policies (Disable Task Manager).',
        detail: 'No registry keys could be updated. Would you like to restart the application as Administrator?',
        buttons: ['OK', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      })

      if (choice === 0) {
        relaunchAsAdmin()
      }
    }
  })

  // Intercept and block Alt+Tab, Alt+F4, Task Manager & Win key shortcuts
  const shortcutsToBlock = [
    'Alt+Tab',
    'Alt+F4',
    'Control+Shift+Escape',
    'CommandOrControl+Alt+Delete',
    'Meta+Tab',
    'Meta+D',
    'Super'
  ]

  shortcutsToBlock.forEach((sc) => {
    try {
      globalShortcut.register(sc, () => {
        // Block shortcut action
      })
    } catch (e) {
      // Ignore unregisterable OS shortcuts
    }
  })

  // Auto-close fullscreen window after durationSeconds
  let autoCloseTimer: ReturnType<typeof setTimeout> | null = null
  const dur = durationSeconds || 10
  const sessionStartTime = new Date().toISOString()

  // Save session start to encrypted local AppData file
  saveFocusSession({
    id: `session-${Date.now()}`,
    startTime: sessionStartTime,
    durationSeconds: dur,
    completed: true
  })

  if (durationSeconds && durationSeconds > 0) {
    autoCloseTimer = setTimeout(() => {
      if (!fsWindow.isDestroyed()) {
        fsWindow.close()
      }
    }, durationSeconds * 1000)
  }

  fsWindow.on('closed', () => {
    if (autoCloseTimer) clearTimeout(autoCloseTimer)
    setSystemPoliciesDisabled(false)
    shortcutsToBlock.forEach((sc) => {
      try {
        globalShortcut.unregister(sc)
      } catch (e) {
        // ignore error
      }
    })
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('reset-start-button')
      }
    })
  })

  if (is.dev) {
    fsWindow.loadURL(`${devUrl}?mode=fullscreen&duration=${dur}`)
  } else {
    fsWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { mode: 'fullscreen', duration: String(dur) } })
  }
}

// IPC Handlers for Local Encrypted Focus Sessions Log
try {
  ipcMain.removeHandler('get-focus-sessions')
  ipcMain.removeHandler('save-focus-session')
} catch (e) {
  // ignore
}

ipcMain.handle('get-focus-sessions', () => {
  return readEncryptedSessions()
})

ipcMain.handle('save-focus-session', (_, session: FocusSessionLog) => {
  saveFocusSession(session)
  return true
})

// IPC Handlers for Internationalization (i18n) Translations from Crowdin or repo fallback
try {
  ipcMain.removeHandler('fetch-languages')
  ipcMain.removeHandler('fetch-locale-strings')
} catch (e) {
  // ignore
}

function readLocalJsonFile(filePath: string): unknown | null {
  try {
    if (!existsSync(filePath)) return null
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`Failed to read local JSON file: ${filePath}`, e)
    return null
  }
}

function normalizeCrowdinLanguageCode(code?: string): string {
  const raw = String(code || '').trim()
  if (!raw) return 'en'
  return raw.replace(/_/g, '-').replace(/-\w+$/i, (match) => match.toLowerCase())
}

async function fetchCrowdinLanguages(): Promise<Array<{ code: string; country?: string; name: string; completion: number }> | null> {
  const projectId = process.env['CROWDIN_PROJECT_ID']
  const token = process.env['CROWDIN_PERSONAL_TOKEN']
  const baseUrl = (process.env['CROWDIN_BASE_URL'] || 'https://api.crowdin.com').replace(/\/+$/, '')

  console.log('[Crowdin] Credentials check:', {
    projectId: projectId || 'MISSING',
    tokenPresent: Boolean(token),
    baseUrl,
    tokenPrefix: token ? `${token.substring(0, 4)}...` : 'NONE'
  })

  if (!projectId || !token) {
    console.warn('[Crowdin] Missing CROWDIN_PROJECT_ID or CROWDIN_PERSONAL_TOKEN environment variables.')
    return null
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    console.log(`[Crowdin] Fetching language progress for project ${projectId} from ${baseUrl}...`)

    const progressRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/languages/progress`, { headers })

    if (progressRes.ok) {
      const progressJson = await progressRes.json()
      const progressData = Array.isArray(progressJson?.data) ? progressJson.data : []

      if (progressData.length > 0) {
        const languages = progressData.map((entry: any) => {
          const data = entry?.data ?? entry
          const langObj = data?.language ?? {}
          const rawId = data?.languageId ?? langObj?.id ?? data?.code ?? 'en'
          const code = normalizeCrowdinLanguageCode(rawId)
          const name = langObj?.name ?? data?.name ?? code
          const completion = Number(
            data?.translationProgress ?? data?.progress ?? data?.completion ?? data?.approvalProgress ?? 0
          )
          const locale = String(langObj?.locale || langObj?.countryCode || code.split('-')[1] || '').toUpperCase()
          const countryCode = locale.includes('-') ? locale.split('-')[1] : locale

          return {
            code,
            country: countryCode || undefined,
            name,
            completion: Number.isFinite(completion) ? Math.max(0, Math.min(100, completion)) : 0
          }
        })

        console.log(`[Crowdin] Successfully fetched ${languages.length} languages from progress API.`)
        return languages
      }
    } else {
      console.error('[Crowdin] Progress API error:', {
        status: progressRes.status,
        statusText: progressRes.statusText,
        body: await progressRes.text().catch(() => '')
      })
    }

    return null
  } catch (e) {
    console.error('[Crowdin] Exception caught during fetch:', e)
    return null
  }
}

ipcMain.handle('fetch-languages', async () => {
  const crowdinLanguages = await fetchCrowdinLanguages()
  if (Array.isArray(crowdinLanguages) && crowdinLanguages.length > 0) {
    console.log(`[Crowdin] Returning ${crowdinLanguages.length} dynamic Crowdin languages.`)
    return crowdinLanguages
  }

  console.warn('[Crowdin] Falling back to local hardcoded languages file (languages.json).')
  const localFile = join(process.cwd(), 'src', 'renderer', 'src', 'locales', 'languages.json')
  const localLanguages = readLocalJsonFile(localFile)
  return Array.isArray(localLanguages) ? localLanguages : []
})

async function fetchCrowdinLocaleStrings(langCode: string): Promise<Record<string, unknown> | null> {
  const projectId = process.env['CROWDIN_PROJECT_ID']
  const token = process.env['CROWDIN_PERSONAL_TOKEN']
  const baseUrl = (process.env['CROWDIN_BASE_URL'] || 'https://api.crowdin.com').replace(/\/+$/, '')
  if (!projectId || !token || !langCode) return null

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    console.log(`[Crowdin] Fetching translation strings for '${langCode}' (project ${projectId})...`)

    // 1. Get project files list
    const filesRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/files`, { headers }).catch(() => null)
    if (filesRes && filesRes.ok) {
      const filesData = (await filesRes.json())?.data ?? []
      console.log(`[Crowdin] Found ${filesData.length} project files.`)

      for (const item of filesData) {
        const fileObj = item?.data ?? item
        const fileId = fileObj?.id
        if (fileId) {
          console.log(`[Crowdin] Building file translation for file ${fileId} (${fileObj?.name || 'unknown'}), language: ${langCode}...`)
          const buildRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/translations/builds/files/${fileId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ targetLanguageId: langCode, exportApprovedOnly: false })
          })

          if (buildRes.ok) {
            const buildData = await buildRes.json()
            const downloadUrl = buildData?.data?.url
            if (downloadUrl) {
              const fileRes = await fetch(downloadUrl)
              if (fileRes.ok) {
                const json = await fileRes.json()
                if (json && typeof json === 'object') {
                  console.log(`[Crowdin] Successfully loaded translated JSON for '${langCode}' (file ${fileId}).`)
                  return json
                }
              }
            }
          } else {
            console.warn('[Crowdin] Single file build status:', buildRes.status, await buildRes.text().catch(() => ''))
          }
        }
      }
    } else if (filesRes) {
      console.warn('[Crowdin] Project files listing status:', filesRes.status, await filesRes.text().catch(() => ''))
    }

    // 2. Fallback: Project-level build creation
    const projectBuildRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/translations/builds`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetLanguageId: langCode })
    })

    if (projectBuildRes.ok) {
      const buildJson = await projectBuildRes.json()
      const buildId = buildJson?.data?.id
      if (buildId) {
        const downloadRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/translations/builds/${buildId}/download`, { headers })
        if (downloadRes.ok) {
          const downloadData = await downloadRes.json()
          console.log(`[Crowdin] Project build ${buildId} completed. Download URL:`, downloadData?.data?.url ? 'FOUND' : 'NOT FOUND')
        }
      }
    } else {
      console.warn('[Crowdin] Project build API status:', projectBuildRes.status, await projectBuildRes.text().catch(() => ''))
    }
  } catch (e) {
    console.warn(`[Crowdin] Could not fetch dynamic strings for '${langCode}':`, e)
  }

  return null
}

function logLocaleComparison(langCode: string, enKeys: string[], targetStrings: Record<string, string>): void {
  const targetKeys = Object.keys(targetStrings || {})
  const missingKeys = enKeys.filter((k) => !targetKeys.includes(k) || !targetStrings[k])
  const presentKeys = enKeys.filter((k) => targetKeys.includes(k) && Boolean(targetStrings[k]))

  console.log(`[i18n] === Locale Strings Report for '${langCode}' ===`)
  console.log(`[i18n] Total Base (en.json) Keys: ${enKeys.length}`)
  console.log(`[i18n] Present & Translated Keys (${presentKeys.length}):`, targetStrings)
  if (missingKeys.length > 0) {
    console.warn(`[i18n] Missing / Un-translated Keys (${missingKeys.length}):`, missingKeys)
  } else {
    console.log(`[i18n] All base keys are translated for '${langCode}'!`)
  }
  console.log(`[i18n] ==============================================`)
}

ipcMain.handle('fetch-locale-strings', async (_, langCode: string) => {
  const normalizedCode = String(langCode || 'en').trim() || 'en'
  const enLocalFile = join(process.cwd(), 'src', 'renderer', 'src', 'locales', 'en.json')
  const enParsed = (readLocalJsonFile(enLocalFile) as Record<string, string>) || {}
  const enKeys = Object.keys(enParsed)

  if (normalizedCode === 'en') {
    logLocaleComparison('en', enKeys, enParsed)
    return enParsed
  }

  let rawTargetStrings: Record<string, string> | null = null

  const specificLocalFile = join(process.cwd(), 'src', 'renderer', 'src', 'locales', `${normalizedCode}.json`)
  const localParsed = readLocalJsonFile(specificLocalFile) as Record<string, string> | null
  if (localParsed && typeof localParsed === 'object') {
    rawTargetStrings = localParsed
    console.log(`[i18n] Loaded '${normalizedCode}' from local file: ${specificLocalFile}`)
  }

  if (!rawTargetStrings) {
    const crowdinStrings = (await fetchCrowdinLocaleStrings(normalizedCode)) as Record<string, string> | null
    if (crowdinStrings && typeof crowdinStrings === 'object') {
      rawTargetStrings = crowdinStrings
      console.log(`[i18n] Loaded '${normalizedCode}' from Crowdin API.`)
    }
  }

  if (!rawTargetStrings) {
    try {
      const cacheBust = `?_t=${Date.now()}`
      const targetUrl = `https://raw.githubusercontent.com/niteadev/niteaassets/main/i18n/${normalizedCode}.json${cacheBust}`
      const res = await fetch(targetUrl, { cache: 'no-store' })
      if (res.ok) {
        const remoteJson = await res.json()
        if (remoteJson && typeof remoteJson === 'object') {
          rawTargetStrings = remoteJson
          console.log(`[i18n] Loaded '${normalizedCode}' from remote niteaassets repository.`)
        }
      }
    } catch (e) {
      console.error(`Failed to fetch locale strings for ${normalizedCode}:`, e)
    }
  }

  if (rawTargetStrings) {
    logLocaleComparison(normalizedCode, enKeys, rawTargetStrings)
    return { ...enParsed, ...rawTargetStrings }
  }

  console.warn(`[i18n] No strings found for '${normalizedCode}'. Using en.json fallbacks entirely.`)
  logLocaleComparison(normalizedCode, enKeys, {})
  return enParsed
})

// Fetch App Box JSON in main process safely
try {
  ipcMain.removeHandler('fetch-app-box')
} catch (e) {
  // ignore
}

ipcMain.handle('fetch-app-box', async () => {
  try {
    const cacheBust = `?_t=${Date.now()}_${Math.floor(Math.random() * 100000)}`
    const targetUrl = `https://raw.githubusercontent.com/niteadev/niteaassets/refs/heads/main/upds/appbox.json${cacheBust}`
    const res = await fetch(targetUrl, { cache: 'no-store' })
    if (res.ok) {
      return await res.json()
    }
  } catch (e) {
    console.error('Failed to fetch appbox JSON:', e)
  }
  return null
})

// Toast notification IPC handler
ipcMain.on(
  'trigger-toast',
  (
    _,
    toast: {
      type: 'error' | 'warning' | 'info' | 'success'
      title: string
      message?: string | null
      effect?: 'confetti' | null
    }
  ) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('show-toast', toast)
      }
    })
  }
)

// Window control IPC handlers
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.on('open-fullscreen-screen', (_, data?: { durationSeconds?: number }) => {
  createFullscreenWindow(data?.durationSeconds)
})

// Mode Switch Handler (Reboot app into standard mode)
ipcMain.on('switch-to-standard-mode', () => {
  const currentDevUrl = process.env['ELECTRON_RENDERER_URL'] || passedDevUrl || 'http://localhost:5173'
  const cleanArgs = process.argv.slice(1).filter((a) => a !== '--mode=standard' && !a.startsWith('--dev-url='))
  const newArgs = cleanArgs.concat(['--mode=standard', `--dev-url=${encodeURIComponent(currentDevUrl)}`])
  app.relaunch({ args: newArgs })
  app.exit(0)
})

// Auto Updater IPC handlers
ipcMain.on('check-for-updates', () => {
  if (!isDevMode) {
    autoUpdater.checkForUpdates().catch(() => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('update-not-available')
        }
      })
    })
  } else {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('update-not-available')
      }
    })
  }
})

ipcMain.on('trigger-dummy-update', () => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('update-available', {
        version: '2.0.0-dev',
        releaseNotes: 'Dev Preview Dummy Update - Test auto-update flow.'
      })
    }
  })
})

ipcMain.on('start-download-update', () => {
  if (isDevMode) {
    let percent = 0
    const interval = setInterval(() => {
      percent += 20
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('update-download-progress', { percent })
        }
      })
      if (percent >= 100) {
        clearInterval(interval)
        setTimeout(() => {
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('update-downloaded')
            }
          })
        }, 500)
      }
    }, 500)
  } else {
    autoUpdater.downloadUpdate().catch(() => {})
  }
})

// App lifecycle
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  // Open Dev Control Panel in Dev Mode
  if (isDevMode) {
    createDevControlWindow()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  setSystemPoliciesDisabled(false)
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
