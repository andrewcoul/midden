-- Values that midden makes for itself, such as the key that signs cookies.
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Failed password sign-ins for each client address. The login rate limit reads this.
CREATE TABLE login_failures (
  ip     TEXT PRIMARY KEY,
  count  INTEGER NOT NULL,
  until  INTEGER NOT NULL
);
