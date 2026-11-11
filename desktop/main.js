// 목회 비서 데스크톱 프로그램: 사이트(https://ministry-secretary.pages.dev)를 앱 창으로 여는 얇은 껍데기입니다.
// 화면과 기능은 사이트가 그대로 제공하므로, 사이트 버전(MB11.x)이 올라가면 이 프로그램도 열 때마다 자동으로 새 버전이 됩니다.
// 데이터는 로그인 계정의 서버 저장소에 있어 그대로 이어집니다. 이 프로그램은 파일·시스템에 접근하는 기능을 노출하지 않습니다.
'use strict';
const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const SITE = 'https://ministry-secretary.pages.dev/';
const ORIGIN = new URL(SITE).origin;
const SMOKE = !app.isPackaged && process.env.MB_SMOKE; // 개발 중 시험용(설치본에서는 동작하지 않음)

app.setAppUserModelId('app.ministry-secretary.desktop');
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;

// 사이트 밖 주소는 이 창에서 열지 않고, http(s)만 기본 브라우저로 넘긴다.
function openExternal(url) { try { const u = new URL(url); if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString()); } catch (e) { /* 잘못된 주소는 무시 */ } }

function buildMenu() {
  const about = () => dialog.showMessageBox(win, { type: 'info', title: '목회 비서', message: '목회 비서 데스크톱', detail: `프로그램 ${app.getVersion()}\n화면과 기능은 사이트(${SITE})를 불러오며, 사이트 버전은 설정 화면에서 볼 수 있어요.\n데이터는 로그인한 계정의 서버에 저장돼요.` });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '파일', submenu: [{ label: '새로 고침', accelerator: 'CmdOrCtrl+R', click: () => win && win.webContents.reload() }, { type: 'separator' }, { label: '종료', role: 'quit' }] },
    { label: '편집', submenu: [{ role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' }, { type: 'separator' }, { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' }, { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '모두 선택' }] },
    { label: '보기', submenu: [{ role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { role: 'resetZoom', label: '원래 크기' }, { type: 'separator' }, { role: 'togglefullscreen', label: '전체 화면' }] },
    { label: '도움말', submenu: [{ label: '프로그램 정보', click: about }] },
  ]));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 600, title: '목회 비서', backgroundColor: '#ffffff', autoHideMenuBar: true, show: !SMOKE,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, devTools: !app.isPackaged },
  });
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} MokhoeBiseoDesktop/${app.getVersion()}`);
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { let ok = false; try { const u = new URL(url); ok = u.origin === ORIGIN || (u.protocol === 'file:' && u.pathname.endsWith('/offline.html')); } catch (err) { ok = false; } if (!ok) { e.preventDefault(); openExternal(url); } });
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { to: SITE } }); }); // -3 = 사용자가 취소
  win.on('closed', () => { win = null; });
  win.loadURL(SITE);
  if (SMOKE) {
    win.webContents.on('did-finish-load', async () => {
      try { const r = await win.webContents.executeJavaScript('JSON.stringify({title: document.title, desktopUA: navigator.userAgent.includes("MokhoeBiseoDesktop/"), url: location.href, hasApp: !!document.getElementById("main")})'); fs.writeFileSync(SMOKE, r); } catch (err) { fs.writeFileSync(SMOKE, 'ERR ' + err.message); }
      app.quit();
    });
  }
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('web-contents-created', (e, contents) => { contents.on('will-attach-webview', ev => ev.preventDefault()); });
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(false)); // 카메라·위치 등은 모두 거부(영수증 사진은 파일 선택으로 올림)
  session.defaultSession.setPermissionCheckHandler(() => false);
  buildMenu(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
