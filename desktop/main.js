// Electron shell for Vispar. It serves the exported web app (../dist, packaged as resources/web)
// from a private app:// origin, so routes like /movie/12 and absolute asset paths work offline.
const { app, BrowserWindow, Menu, protocol, net, session, shell, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WEB_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://vispar';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

/** Serves files from the web build; unknown paths fall back to index.html (single-page app). */
function registerProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    let file = path.normalize(path.join(WEB_ROOT, rel));
    if (!file.startsWith(WEB_ROOT)) return new Response('Forbidden', { status: 403 });
    if (!rel || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

/** The catalog API sends no CORS headers; allow it for the app's own origin only. */
function allowApiCors() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    if (!details.url.startsWith(ORIGIN) && details.webContents?.getURL().startsWith(ORIGIN)) {
      for (const k of Object.keys(headers)) if (k.toLowerCase().startsWith('access-control-')) delete headers[k];
      headers['Access-Control-Allow-Origin'] = [ORIGIN];
      headers['Access-Control-Allow-Headers'] = ['*'];
      headers['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
    }
    callback({ responseHeaders: headers });
  });
}

function createWindow() {
  nativeTheme.themeSource = 'dark';
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#08080C',
    title: 'ویسپار',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(`${ORIGIN}/`);

  // External links open in the default browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  // F11 toggles full screen, Esc leaves it.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'Escape' && win.isFullScreen() && !input.isAutoRepeat) {
      win.setFullScreen(false);
    }
  });
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerProtocol();
  allowApiCors();
  let win = createWindow();
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
