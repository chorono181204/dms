import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Custom splash logic
let splash: BrowserWindow | null

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1366,
    height: 768, // Reasonable default size
    show: false, // Don't show until ready
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    autoHideMenuBar: true,
  })

  // Create Splash Window
  splash = new BrowserWindow({
    width: 500,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load splash screen
  if (VITE_DEV_SERVER_URL) {
    splash.loadURL(`${VITE_DEV_SERVER_URL}/loading.html`);
  } else {
    splash.loadFile(path.join(RENDERER_DIST, 'loading.html'));
  }

  // Handle main window ready
  win.once('ready-to-show', () => {
    setTimeout(() => { // Keep splash for at least a bit to look nice
      splash?.destroy();
      win?.show();
      win?.focus(); // Ensure focus
    }, 1500);
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
