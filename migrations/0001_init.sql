-- Link Stash — initial schema.
-- Two tables only (links, cron_runs). Anything else is out of scope.

CREATE TABLE links (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  title       TEXT,
  summary     TEXT,            -- null until generated; null is not an error
  status      TEXT NOT NULL,   -- 'unread' | 'read'
  source      TEXT,            -- 'share' | 'manual'
  created_at  INTEGER NOT NULL,
  read_at     INTEGER
);

-- url is deliberately NOT unique. Re-saving a link is allowed; the UI surfaces
-- the duplicate rather than the API rejecting it.
CREATE INDEX idx_links_created_at ON links (created_at);
CREATE INDEX idx_links_status ON links (status);

-- ADR-006 mitigation: Cron Triggers do not retry and do not alert. This table
-- is the only way a silent failure becomes visible.
CREATE TABLE cron_runs (
  id          TEXT PRIMARY KEY,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  count       INTEGER NOT NULL DEFAULT 0,
  error       TEXT
);

CREATE INDEX idx_cron_runs_started_at ON cron_runs (started_at);
