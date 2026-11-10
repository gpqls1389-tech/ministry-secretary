-- 목회 비서 로그인·사용자별 저장용 D1(SQLite) 스키마
-- Cloudflare 대시보드 → Storage & databases → D1 → 해당 데이터베이스 → Console 에 전체를 붙여넣고 실행하세요.
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,      -- 소문자로 저장
  name       TEXT NOT NULL DEFAULT '',
  pw_hash    TEXT NOT NULL,             -- pbkdf2-sha256$반복횟수$salt$hash (base64)
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,          -- 세션 토큰의 SHA-256 (토큰 원문은 저장하지 않음)
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
-- 사용자 한 명당 한 줄: 그 사람의 앱 데이터(JSON) 전체. 다른 사람의 줄은 조회할 수 없습니다.
CREATE TABLE IF NOT EXISTS user_state (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  state      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- 로그인·가입 시도 횟수 제한
CREATE TABLE IF NOT EXISTS rate (
  key      TEXT PRIMARY KEY,
  n        INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
