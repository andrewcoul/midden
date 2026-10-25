-- One tree of folders and files. The row with id 'root' is "My Drive".
CREATE TABLE nodes (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
  size         INTEGER NOT NULL DEFAULT 0,
  mime         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  -- Set on every node of a trashed subtree. trash_root marks the node the user trashed.
  trashed_at   INTEGER,
  trash_root   INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX nodes_parent_name ON nodes(parent_id, name) WHERE trashed_at IS NULL;
CREATE INDEX nodes_parent ON nodes(parent_id);
CREATE INDEX nodes_trash ON nodes(trash_root) WHERE trash_root = 1;

INSERT INTO nodes (id, parent_id, name, kind, created_at, updated_at)
VALUES ('root', NULL, 'My Drive', 'folder', 0, 0);

CREATE TABLE shares (
  id             TEXT PRIMARY KEY,
  node_id        TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  password_hash  TEXT,
  expires_at     INTEGER,
  created_at     INTEGER NOT NULL,
  downloads      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX shares_node ON shares(node_id);

-- Chunked uploads that are in progress.
CREATE TABLE uploads (
  id          TEXT PRIMARY KEY,
  blob_key    TEXT NOT NULL,
  store_id    TEXT NOT NULL,
  parent_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  mime        TEXT,
  created_at  INTEGER NOT NULL
);
