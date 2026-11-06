-- TechGear Computer Accessories Shop: Week 6 database schema (SQLite; standard SQL)
PRAGMA foreign_keys = ON;
DROP VIEW  IF EXISTS v_order_summary;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  product_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  sku         TEXT NOT NULL UNIQUE,            -- same id used by the website, e.g. 'keyboard'
  name        TEXT NOT NULL,
  description TEXT,
  price       INTEGER NOT NULL CHECK (price >= 0),   -- UGX
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image       TEXT,
  category_id INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL UNIQUE,
  email       TEXT,
  address     TEXT
);

CREATE TABLE orders (
  order_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no         TEXT NOT NULL UNIQUE,         -- e.g. TG-100001
  customer_id      INTEGER NOT NULL,
  order_date       TEXT NOT NULL DEFAULT (date('now')),
  delivery_method  TEXT NOT NULL CHECK (delivery_method IN ('collection','delivery')),
  delivery_address TEXT,
  delivery_fee     INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  status           TEXT NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending','Confirmed','Shipped','Completed','Cancelled')),
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE order_items (
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    INTEGER NOT NULL CHECK (unit_price >= 0),   -- price at time of sale
  UNIQUE (order_id, product_id),
  FOREIGN KEY (order_id)   REFERENCES orders(order_id)     ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
);

CREATE TABLE payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  method     TEXT NOT NULL CHECK (method IN ('Mobile money','Cash on delivery','Cash at shop')),
  amount     INTEGER NOT NULL CHECK (amount >= 0),
  status     TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid','Paid','Refunded')),
  paid_at    TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name     ON products(name);
CREATE INDEX idx_orders_customer   ON orders(customer_id);
CREATE INDEX idx_items_order       ON order_items(order_id);

CREATE VIEW v_order_summary AS
SELECT o.order_no, c.full_name, o.order_date, o.delivery_method, o.status,
       SUM(oi.quantity * oi.unit_price) AS items_total,
       o.delivery_fee,
       SUM(oi.quantity * oi.unit_price) + o.delivery_fee AS grand_total
FROM orders o
JOIN customers   c  ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
GROUP BY o.order_id;
