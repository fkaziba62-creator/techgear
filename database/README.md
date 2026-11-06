# Week 6: TechGear Database

Follows Week 5 (product catalogue). The 24 products in `js/products.js` are now stored in a relational database.

## Deliverables
| Deliverable | File |
|---|---|
| ER diagram | `erd.png` / `erd.svg` |
| Schema | `schema.sql` |
| SQL script (data + CRUD) | `seed.sql`, `crud.sql` |
| Database evidence | `evidence.txt` (output of every query), `techgear.db` (the built database) |

## Entities and relationships
| Entity | Primary key | Foreign keys | Purpose |
|---|---|---|---|
| categories | category_id | | Audio, Bags, Input devices, Networking, Power & cables, Storage |
| products | product_id | category_id -> categories | Catalogue items: sku, name, description, price, stock, image |
| customers | customer_id | | Name, phone, email, address from the checkout form |
| orders | order_id | customer_id -> customers | Order number, date, collection/delivery, fee, status |
| order_items | order_item_id | order_id -> orders, product_id -> products | Products in an order, with quantity and price at time of sale |
| payments | payment_id | order_id -> orders | Mobile money / cash on delivery / cash at shop, and paid status |

- One category has many products (1:N).
- One customer places many orders (1:N).
- One order has many payments records (1:N), usually one.
- Orders and products are many-to-many, resolved by `order_items` (UNIQUE on order_id + product_id).

## Integrity rules
- `price >= 0`, `stock >= 0`, `quantity > 0` (CHECK).
- `sku`, `order_no`, customer `phone`, category `name` are UNIQUE.
- Order status and payment method/status are limited to fixed values (CHECK).
- A category with products, or a product that was sold, cannot be deleted (RESTRICT).
- Deleting an order also deletes its items and payments (CASCADE).
- `order_items.unit_price` keeps the price at sale time, so later price changes do not alter old orders.

## How to run
```
python3 run_demo.py        # rebuilds techgear.db and rewrites evidence.txt
sqlite3 techgear.db < schema.sql && sqlite3 techgear.db < seed.sql   # or use the sqlite3 CLI / DB Browser for SQLite
```
`PRAGMA foreign_keys = ON;` must be on in each SQLite session for foreign keys to be enforced.

## CRUD coverage
- Create: C1 product, C2 customer, C3 order with items and stock update.
- Read: R1 listing, R2 search, R3 filter, R4 category stats, R5 order view, R6 order lines, R7 low stock.
- Update: U1 price, U2 restock, U3 order status and payment.
- Delete: D1 order (cascade), D2 product never sold.
- 7 constraint tests, all PASS (see the end of `evidence.txt`).

## Link to the website
The website still reads `js/products.js`. In Week 7 a backend can read the same data from this database; `products.sku` equals the product `id` used by the pages, and `products.image` holds the image file name.
