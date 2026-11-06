-- Week 7 migration: customer accounts, roles and sessions (applied once by server/app.py)
-- Extends the Week 6 customers table; existing guest customers keep password_hash = NULL (no login).
ALTER TABLE customers ADD COLUMN password_hash  TEXT;                       -- scrypt hash, never the password
ALTER TABLE customers ADD COLUMN role           TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin'));
ALTER TABLE customers ADD COLUMN failed_logins  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN locked_until   INTEGER NOT NULL DEFAULT 0; -- unix time; 0 = not locked
ALTER TABLE customers ADD COLUMN created_at     INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX uq_customers_email ON customers(lower(email)) WHERE email IS NOT NULL;

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,               -- SHA-256 of the cookie token (a DB leak cannot be replayed)
  customer_id INTEGER NOT NULL,
  csrf_token  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,               -- absolute lifetime
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_customer ON sessions(customer_id);
