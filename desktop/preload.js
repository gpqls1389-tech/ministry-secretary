// 목회 비서 데스크톱: 사이트 화면에 두 가지만 열어 준다.
// ① ‘이 컴퓨터에 로그인 정보 저장’(메인 프로세스가 Windows 사용자 계정 암호화 safeStorage = DPAPI로 저장)
// ② ‘내 컴퓨터에만 저장’: 정해진 폴더(내 문서\목회비서)의 데이터 파일 읽기·쓰기·백업. 경로를 넘길 수 없고, 그 밖의 파일·시스템 접근은 열지 않는다.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mbDesktop', {
  cred: {
    available: () => ipcRenderer.invoke('cred:available'),
    get: () => ipcRenderer.invoke('cred:get'),
    save: (email, password) => ipcRenderer.invoke('cred:save', String(email || ''), String(password || '')),
    clear: () => ipcRenderer.invoke('cred:clear'),
  },
  localdata: {
    available: true,
    info: () => ipcRenderer.invoke('ld:info'),
    read: () => ipcRenderer.invoke('ld:read'),
    write: state => ipcRenderer.invoke('ld:write', String(state)),
    writeSync: state => ipcRenderer.sendSync('ld:writeSync', String(state)),
    backup: () => ipcRenderer.invoke('ld:backup'),
    list: () => ipcRenderer.invoke('ld:list'),
    readBackup: name => ipcRenderer.invoke('ld:readBackup', String(name || '')),
    open: () => ipcRenderer.invoke('ld:open'),
  },
});
