/* eslint-disable prettier/prettier */
import { app, shell, BrowserWindow, ipcMain, globalShortcut, dialog, nativeImage, NativeImage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto'
import { exec, execSync, spawn, ChildProcess } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

autoUpdater.autoDownload = false

function loadEnvFile(fileName: string): void {
  const candidates = [
    join(app.getPath('userData'), fileName),
    join(process.resourcesPath, fileName),
    join(app.getAppPath(), fileName),
    join(process.cwd(), fileName)
  ]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
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
      return
    } catch (e) {
      // Ignore env load error
    }
  }
}

function saveLocaleFileToLanguages(fileName: string, data: object): void {
  try {
    const userLanguagesDir = join(app.getPath('userData'), 'languages')
    if (!existsSync(userLanguagesDir)) {
      mkdirSync(userLanguagesDir, { recursive: true })
    }
    const targetPath = join(userLanguagesDir, fileName)
    writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8')
  } catch (e) {
    // Ignore save error
  }
}

function getAppIcon(): NativeImage | string {
  const candidatePaths = [
    join(process.cwd(), 'src', 'renderer', 'src', 'assets', 'icn_light.png'),
    join(process.cwd(), 'build', 'icon.png'),
    join(process.cwd(), 'resources', 'icon.png'),
    join(app.getAppPath(), 'src', 'renderer', 'src', 'assets', 'icn_light.png'),
    join(app.getAppPath(), 'build', 'icon.png'),
    join(app.getAppPath(), 'resources', 'icon.png'),
    join(process.resourcesPath, 'icon.png')
  ]

  for (const iconPath of candidatePaths) {
    if (existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) {
        return img
      }
    }
  }

  return icon
}

function resolveLocaleFilePath(fileName: string): string {
  const candidates = [
    join(app.getPath('userData'), 'languages', fileName),
    join(app.getPath('userData'), fileName),
    join(process.resourcesPath, 'languages', fileName),
    join(process.resourcesPath, fileName),
    join(app.getAppPath(), 'src', 'renderer', 'src', 'languages', fileName),
    join(process.cwd(), 'src', 'renderer', 'src', 'languages', fileName)
  ]

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      return filePath
    }
  }

  return candidates[candidates.length - 1]
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

let currentAppLanguage = 'en'
let strictModeHookProcess: ChildProcess | null = null

function isUserAdmin(): boolean {
  if (process.platform !== 'win32') return true
  try {
    execSync('net session', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function relaunchAsAdmin(): void {
  if (process.platform !== 'win32') return
  const execPath = process.execPath
  const rawArgs = process.argv.slice(1).filter((a) => a !== '--uac-attempted')
  rawArgs.push('--uac-attempted')
  const argsList = rawArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(',')
  const psCmd = argsList
    ? `Start-Process -FilePath '${execPath.replace(/'/g, "''")}' -ArgumentList ${argsList} -Verb RunAs`
    : `Start-Process -FilePath '${execPath.replace(/'/g, "''")}' -Verb RunAs`

  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`
  exec(cmd, () => {
    app.exit(0)
  })
}

function setSystemPoliciesDisabled(disabled: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(true)
    const val = disabled ? 1 : 0
    const sysPath = `"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System"`
    const expPath = `"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer"`

    const cmds = [
      `reg add ${sysPath} /v DisableTaskMgr /t REG_DWORD /d ${val} /f`,
      `reg add ${sysPath} /v DisableLockWorkstation /t REG_DWORD /d ${val} /f`,
      `reg add ${sysPath} /v DisableChangePassword /t REG_DWORD /d ${val} /f`,
      `reg add ${expPath} /v NoWinKeys /t REG_DWORD /d ${val} /f`,
      `reg add ${expPath} /v DisableTaskSwitching /t REG_DWORD /d ${val} /f`
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

function startStrictModeKeyboardHook(): void {
  if (process.platform !== 'win32') return
  stopStrictModeKeyboardHook()

  const psScript = `
$code = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class KeyBlocker {
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0200;

    private static HookProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;

    public static void Main() {
        _hookID = SetHook(_proc);
        Application.Run();
        UnhookWindowsHookEx(_hookID);
    }

    private static IntPtr SetHook(HookProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN)) {
            int vkCode = Marshal.ReadInt32(lParam);
            bool isWin = (vkCode == 0x5B || vkCode == 0x5C);
            bool isTab = (vkCode == 0x09);
            bool isEsc = (vkCode == 0x1B);
            bool isF4 = (vkCode == 0x73);

            if (isWin || isTab || (isEsc && Control.ModifierKeys.HasFlag(Keys.Control)) || (isF4 && Control.ModifierKeys.HasFlag(Keys.Alt))) {
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);
}
"@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms
[KeyBlocker]::Main()
`

  try {
    strictModeHookProcess = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
      windowsHide: true
    })
  } catch (e) {
    // Ignore hook spawn errors
  }
}

function stopStrictModeKeyboardHook(): void {
  if (strictModeHookProcess) {
    try {
      strictModeHookProcess.kill()
    } catch (e) {
      // Ignore kill error
    }
    strictModeHookProcess = null
  }
}

function isStrictModeEnabled(): boolean {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    if (existsSync(settingsPath)) {
      const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
      if (typeof parsed?.strictMode === 'boolean') {
        return parsed.strictMode
      }
    }
  } catch (e) {
    // ignore
  }
  return true
}

function saveStrictModeSetting(enabled: boolean): void {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    let parsed: Record<string, unknown> = {}
    if (existsSync(settingsPath)) {
      try {
        parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
      } catch {
        parsed = {}
      }
    }
    parsed.strictMode = enabled
    writeFileSync(settingsPath, JSON.stringify(parsed, null, 2), 'utf8')

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('strict-mode-updated', enabled)
      }
    })
  } catch (e) {
    // ignore
  }
}

function getLocalizedDialogStrings(langCode?: string) {
  const normalizedCode = String(langCode || currentAppLanguage || 'en').trim() || 'en'
  const specificFile = resolveLocaleFilePath(`${normalizedCode}.json`)
  const enFile = resolveLocaleFilePath('en.json')

  const localParsed = (readLocalJsonFile(specificFile) as Record<string, string>) || {}
  const enParsed = (readLocalJsonFile(enFile) as Record<string, string>) || {}

  return {
    title: localParsed.registry_update_title || enParsed.registry_update_title || 'Administrator Rights Required',
    message: localParsed.registry_update_message || enParsed.registry_update_message || 'Administrator rights are required to restrict system policies (Disable Task Manager, Win key, Alt+Tab).',
    detail: localParsed.registry_update_detail || enParsed.registry_update_detail || 'No registry keys could be updated. The application will restart as Administrator.',
    restartAsAdmin: localParsed.restart_as_admin || enParsed.restart_as_admin || 'Restart as Administrator',
    disableStrictMode: localParsed.disable_strict_mode_btn || enParsed.disable_strict_mode_btn || 'Disable Strict Mode',
    ok: localParsed.ok || enParsed.ok || 'OK'
  }
}

function isAdminNoticeShown(): boolean {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    if (existsSync(settingsPath)) {
      const parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
      if (typeof parsed?.hasShownAdminNotice === 'boolean') {
        return parsed.hasShownAdminNotice
      }
    }
  } catch (e) {
    // ignore
  }
  return false
}

function setAdminNoticeShown(shown: boolean): void {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    let parsed: Record<string, unknown> = {}
    if (existsSync(settingsPath)) {
      try {
        parsed = JSON.parse(readFileSync(settingsPath, 'utf8'))
      } catch {
        parsed = {}
      }
    }
    parsed.hasShownAdminNotice = shown
    writeFileSync(settingsPath, JSON.stringify(parsed, null, 2), 'utf8')
  } catch (e) {
    // ignore
  }
}

function checkAdminAndRegistryWithPrompt(parentWin: BrowserWindow | null): boolean {
  if (process.platform !== 'win32') return true
  const isAdmin = isUserAdmin()
  if (isAdmin) {
    return true
  }

  // Check if UAC was attempted on current launch (user clicked No on UAC prompt)
  const wasUacAttempted = process.argv.includes('--uac-attempted')
  const noticeAlreadyShown = isAdminNoticeShown()

  // If notice was already shown AND user did not just reject UAC -> auto restart as admin directly without modal!
  if (noticeAlreadyShown && !wasUacAttempted) {
    relaunchAsAdmin()
    return false
  }

  // Otherwise (first time OR UAC was denied by user): show info modal (exact unedited text & buttons)
  const dialogStrings = getLocalizedDialogStrings()
  const buttons = [
    dialogStrings.restartAsAdmin,
    dialogStrings.disableStrictMode
  ]

  let choice = 0
  if (parentWin && !parentWin.isDestroyed()) {
    choice = dialog.showMessageBoxSync(parentWin, {
      type: 'info', // INFO MSGBOX (LOCALIZED)
      title: dialogStrings.title,
      message: dialogStrings.message,
      detail: dialogStrings.detail,
      buttons,
      defaultId: 0,
      cancelId: 1
    })
  } else {
    choice = dialog.showMessageBoxSync({
      type: 'info',
      title: dialogStrings.title,
      message: dialogStrings.message,
      detail: dialogStrings.detail,
      buttons,
      defaultId: 0,
      cancelId: 1
    })
  }

  if (choice === 0) {
    // Restart as Administrator
    setAdminNoticeShown(true)
    relaunchAsAdmin()
    return false
  } else {
    // Disable Strict Mode and continue boot without rebooting
    saveStrictModeSetting(false)
    setAdminNoticeShown(false)
    return true
  }
}

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 370,
    show: false,
    frame: false, // Borderless, no titlebar - THE SPLASH
    resizable: false,
    center: true,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  splashWindow.on('ready-to-show', () => {
    splashWindow?.show()
  })

  if (is.dev) {
    splashWindow.loadURL(`${devUrl}?mode=splash`)
  } else {
    splashWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { mode: 'splash' } })
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1270,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Hidden initially; shown after splash countdown finishes
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
    icon: getAppIcon(),
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
  const isStrict = isStrictModeEnabled()

  const fsWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: isStrict,
    alwaysOnTop: isStrict,
    skipTaskbar: isStrict,
    frame: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (isStrict) {
    fsWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  fsWindow.setMenu(null)

  let isSessionCompleted = false

  // Lock window focus & prevent losing focus only if strict mode is enabled
  if (isStrict) {
    fsWindow.on('blur', () => {
      if (!fsWindow.isDestroyed() && !isSessionCompleted) {
        fsWindow.focus()
        fsWindow.setAlwaysOnTop(true, 'screen-saver')
      }
    })

    // Prevent closing window before focus duration finishes
    fsWindow.on('close', (e) => {
      if (!isSessionCompleted) {
        e.preventDefault()
      }
    })

    // Apply registry restrictions & start low-level keyboard hook silently (NO info box in fullscreen)
    setSystemPoliciesDisabled(true).catch(() => {})
    startStrictModeKeyboardHook()
  }

  // Intercept and block Alt+Tab, Alt+F4, Task Manager & Win key shortcuts only if strict mode is enabled
  const shortcutsToBlock = [
    'Alt+Tab',
    'Alt+F4',
    'Control+Shift+Escape',
    'CommandOrControl+Alt+Delete',
    'Meta+Tab',
    'Meta+D',
    'Meta+X',
    'Meta+R',
    'Meta+L',
    'Super'
  ]

  if (isStrict) {
    shortcutsToBlock.forEach((sc) => {
      try {
        globalShortcut.register(sc, () => {
          // Block shortcut action
        })
      } catch (e) {
        // Ignore unregisterable OS shortcuts
      }
    })
  }

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
      isSessionCompleted = true
      if (!fsWindow.isDestroyed()) {
        fsWindow.close()
      }
    }, durationSeconds * 1000)
  }

  fsWindow.on('closed', () => {
    isSessionCompleted = true
    if (autoCloseTimer) clearTimeout(autoCloseTimer)
    if (isStrict) {
      stopStrictModeKeyboardHook()
      setSystemPoliciesDisabled(false)
      shortcutsToBlock.forEach((sc) => {
        try {
          globalShortcut.unregister(sc)
        } catch (e) {
          // ignore error
        }
      })
    }
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

// IPC Handler for Dev Mode F key toggle windowed mode
ipcMain.on('toggle-fullscreen-windowed', (event) => {
  if (!isDevMode && !is.dev) return
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    const isFull = win.isFullScreen() || win.isKiosk()
    if (isFull) {
      win.setKiosk(false)
      win.setFullScreen(false)
      win.setResizable(true)
      win.setSize(1270, 800)
      win.center()
    } else {
      win.setFullScreen(true)
      win.setKiosk(true)
    }
  }
})

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

  if (!projectId || !token) {
    return null
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    const progressRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/languages/progress`, { headers })

    if (progressRes.ok) {
      const progressJson = await progressRes.json()
      const progressData = Array.isArray(progressJson?.data) ? progressJson.data : []

      if (progressData.length > 0) {
        return progressData.map((entry: any) => {
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
      }
    }

    return null
  } catch (e) {
    return null
  }
}

ipcMain.handle('fetch-languages', async () => {
  const crowdinLanguages = await fetchCrowdinLanguages()
  if (Array.isArray(crowdinLanguages) && crowdinLanguages.length > 0) {
    return crowdinLanguages
  }

  const localFile = resolveLocaleFilePath('languages.json')
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

    // 1. Get project files list
    const filesRes = await fetch(`${baseUrl}/api/v2/projects/${projectId}/files`, { headers }).catch(() => null)
    if (filesRes && filesRes.ok) {
      const filesData = (await filesRes.json())?.data ?? []

      for (const item of filesData) {
        const fileObj = item?.data ?? item
        const fileId = fileObj?.id
        if (fileId) {
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
                  return json
                }
              }
            }
          }
        }
      }
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
        await fetch(`${baseUrl}/api/v2/projects/${projectId}/translations/builds/${buildId}/download`, { headers }).catch(() => null)
      }
    }
  } catch (e) {
    // Silent catch
  }

  return null
}

ipcMain.handle('fetch-locale-strings', async (_, langCode: string) => {
  const normalizedCode = String(langCode || 'en').trim() || 'en'
  currentAppLanguage = normalizedCode
  const enLocalFile = resolveLocaleFilePath('en.json')
  const enParsed = (readLocalJsonFile(enLocalFile) as Record<string, string>) || {}

  if (normalizedCode === 'en') {
    return enParsed
  }

  let rawTargetStrings: Record<string, string> | null = null

  const specificLocalFile = resolveLocaleFilePath(`${normalizedCode}.json`)
  const localParsed = readLocalJsonFile(specificLocalFile) as Record<string, string> | null
  if (localParsed && typeof localParsed === 'object') {
    rawTargetStrings = localParsed
  }

  if (!rawTargetStrings) {
    const crowdinStrings = (await fetchCrowdinLocaleStrings(normalizedCode)) as Record<string, string> | null
    if (crowdinStrings && typeof crowdinStrings === 'object') {
      rawTargetStrings = crowdinStrings
      saveLocaleFileToLanguages(`${normalizedCode}.json`, crowdinStrings)
    }
  }

  if (!rawTargetStrings) {
    try {
      const cacheBust = `?_t=${Date.now()}`
      const targetUrl = `https://raw.githubusercontent.com/niteadev/niteaassets/main/i18n/${normalizedCode}.json${cacheBust}`
      const res = await fetch(targetUrl, { cache: 'no-store' })
      if (res.ok) {
        const remoteJson = (await res.json()) as Record<string, string>
        if (remoteJson && typeof remoteJson === 'object') {
          rawTargetStrings = remoteJson
          saveLocaleFileToLanguages(`${normalizedCode}.json`, remoteJson)
        }
      }
    } catch (e) {
      // Silent catch
    }
  }

  if (rawTargetStrings) {
    return { ...enParsed, ...rawTargetStrings }
  }

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

async function downloadLanguageUpdatesOnSplash(): Promise<void> {
  try {
    // 1. Refresh dynamic languages catalog
    const crowdinLangs = await fetchCrowdinLanguages()
    if (Array.isArray(crowdinLangs) && crowdinLangs.length > 0) {
      saveLocaleFileToLanguages('languages.json', crowdinLangs)
    }

    // 2. Refresh active language and supported languages from Crowdin
    const targetLangs = ['it', 'de', 'es', 'pt', 'ru', 'ar', 'en']
    for (const lang of targetLangs) {
      const strings = await fetchCrowdinLocaleStrings(lang)
      if (strings && typeof strings === 'object' && Object.keys(strings).length > 0) {
        saveLocaleFileToLanguages(`${lang}.json`, strings)
      }
    }
  } catch (e) {
    // Silent catch
  }
}

// App lifecycle
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 1. Create small borderless native Splash Window first
  createSplashWindow()

  // 2. Download language updates on every splashscreen launch
  const languageDownloadPromise = downloadLanguageUpdatesOnSplash()

  // 3. Create Main Window in background (hidden)
  createWindow()

  // 4. Splash Screen minimum 5s timer & loading phase
  const splashStartTime = Date.now()
  const MIN_SPLASH_DURATION = 5000

  setTimeout(async () => {
    // Wait for language download or 4.5s max timeout to prevent blocking splash UI
    await Promise.race([
      languageDownloadPromise,
      new Promise((res) => setTimeout(res, 4500))
    ]).catch(() => {})

    const elapsed = Date.now() - splashStartTime
    const remaining = Math.max(0, MIN_SPLASH_DURATION - elapsed)

    setTimeout(() => {
      // Check Registry & Admin status AFTER the 5s splash timer finishes ONLY IF strict mode is enabled
      const strictEnabled = isStrictModeEnabled()
      if (strictEnabled && process.platform === 'win32') {
        const canProceed = checkAdminAndRegistryWithPrompt(splashWindow)
        if (!canProceed) {
          return
        }
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
      }
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
        splashWindow = null
      }
    }, remaining)
  }, 0)

  // Open Dev Control Panel in Dev Mode
  if (isDevMode) {
    createDevControlWindow()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

ipcMain.handle('validate-strict-mode-admin', (_, enabled: boolean) => {
  saveStrictModeSetting(enabled)
  if (!enabled) {
    return true
  }
  return checkAdminAndRegistryWithPrompt(mainWindow)
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
