// 서버 저장 간격(MB12.23): 고칠 때마다 전체 데이터를 올리면 서버 요청이 너무 많아서, 입력이 잠시 멈추면(SAVE_DELAY) 한 번만 올린다.
// 계속 고치는 중이어도 처음 고친 뒤 SAVE_MAX_WAIT 안에는 반드시 올린다. 그 사이의 변경은 이 기기에 임시 보관되어 있어서(auth.js pendingWrite) 창을 닫아도 다시 열면 되살아난다.
export const SAVE_DELAY = 5000;
export const SAVE_MAX_WAIT = 30000;
// 다음 저장까지 기다릴 시간(ms): 마지막 입력 후 delay, 단 첫 변경 후 maxWait를 넘지 않게
export const nextDelay = (now, firstDirtyAt, delay = SAVE_DELAY, maxWait = SAVE_MAX_WAIT) => Math.max(0, Math.min(delay, firstDirtyAt + maxWait - now));
