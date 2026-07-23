-- お問い合わせ・採用エントリーの保存テーブル (Cloudflare D1)
CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type   TEXT NOT NULL,          -- 'contact' | 'recruit'
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  tel         TEXT,
  company     TEXT,
  category    TEXT,                   -- お問い合わせ種別
  position    TEXT,                   -- 希望職種
  message     TEXT,
  resume_name TEXT,                   -- 添付ファイル名
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_type    ON submissions(form_type);
