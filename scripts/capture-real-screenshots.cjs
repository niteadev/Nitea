const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const outDir = path.join(__dirname, '..', 'build', 'screenshots')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

// Mock IPC handlers so the app renders smoothly
ipcMain.handle('fetch-locale-strings', async (event, lang) => {
  const langPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'languages', `${lang}.json`)
  if (fs.existsSync(langPath)) {
    return JSON.parse(fs.readFileSync(langPath, 'utf8'))
  }
  const enPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'languages', 'en.json')
  return JSON.parse(fs.readFileSync(enPath, 'utf8'))
})

ipcMain.handle('fetch-app-box', async () => null)
ipcMain.handle('validate-strict-mode-admin', async () => true)
ipcMain.on('check-for-updates', (event) => {
  event.sender.send('update-not-available')
})
ipcMain.on('ping', () => {})
ipcMain.on('window-min', () => {})
ipcMain.on('window-close', () => {})

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'out', 'preload', 'index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  const indexPath = path.join(__dirname, '..', 'out', 'renderer', 'index.html')
  await win.loadFile(indexPath)
  await new Promise((r) => setTimeout(r, 2000))

  // 1. Dark Main View Screenshot
  let img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '01_nitea_main_dark.png'), img.toPNG())
  console.log('Saved: 01_nitea_main_dark.png')

  // 2. Open Settings Modal
  await win.webContents.executeJavaScript(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.querySelector('svg') || b.className.includes('settings'));
    if (settingsBtn) settingsBtn.click();
  `)
  await new Promise((r) => setTimeout(r, 1000))
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '02_nitea_settings_modal.png'), img.toPNG())
  console.log('Saved: 02_nitea_settings_modal.png')

  // 3. Switch to Light Mode and close modal
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    const closeBtn = document.querySelector('button.close, .modal-backdrop, .modal-close');
    if (closeBtn) closeBtn.click();
  `)
  await new Promise((r) => setTimeout(r, 1000))
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '03_nitea_main_light.png'), img.toPNG())
  console.log('Saved: 03_nitea_main_light.png')

  // 4. Fullscreen Mode
  await win.loadURL(`file://${indexPath}?mode=fullscreen`)
  await new Promise((r) => setTimeout(r, 2000))
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '04_nitea_fullscreen_focus.png'), img.toPNG())
  console.log('Saved: 04_nitea_fullscreen_focus.png')

  app.quit()
})
