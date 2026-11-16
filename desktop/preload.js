// 목회 비서 데스크톱: 사이트 화면에 ‘이 컴퓨터에 로그인 정보 저장’ 기능 하나만 열어 준다.
// 파일·시스템 접근은 열지 않는다. 저장은 메인 프로세스가 Windows 사용자 계정 암호화(safeStorage = DPAPI)로 한다.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mbDesktop', {
  cred: {
    available: () => ipcRenderer.invoke('cred:available'),
    get: () => ipcRenderer.invoke('cred:get'),
    save: (email, password) => ipcRenderer.invoke('cred:save', String(email || ''), String(password || '')),
    clear: () => ipcRenderer.invoke('cred:clear'),
  },
});
