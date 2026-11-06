-- Week 9 migration: checkout details, safe re-submission and order status history (applied once by server/app.py)
ALTER TABLE orders ADD COLUMN recipient_name     TEXT;     -- who receives the order (snapshot at checkout)
ALTER TABLE orders ADD COLUMN recipient_phone    TEXT;
ALTER TABLE orders ADD COLUMN recipient_email    TEXT;
ALTER TABLE orders ADD COLUMN delivery_district  TEXT;
ALTER TABLE orders ADD COLUMN notes              TEXT;
ALTER TABLE orders ADD COLUMN idempotency_key    TEXT;     -- one key per checkout attempt: stops double orders
ALTER TABLE orders ADD COLUMN created_at         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN updated_at         INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX uq_orders_idem ON orders(customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_status_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('Pending','Confirmed','Shipped','Completed','Cancelled')),
  changed_by INTEGER,                 -- customer_id of the customer or admin who made the change
  changed_at INTEGER NOT NULL,
  note       TEXT,
  FOREIGN KEY (order_id)   REFERENCES orders(order_id)       ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES customers(customer_id) ON DELETE SET NULL
);
CREATE INDEX idx_history_order ON order_status_history(order_id);
