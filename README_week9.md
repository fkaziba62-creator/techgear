# Week 9: Checkout and Orders

Builds on Week 8 (cart), Week 7 (accounts) and Week 6 (database). A customer can now go from cart to a recorded, confirmed order; see their order history; and an admin can inspect orders and update their status.

## Run it
```
pip install -r server/requirements.txt
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-strong-pass1' python3 server/app.py     # http://127.0.0.1:5000
```
First start adds the Week 9 columns and `order_status_history` table (`database/week9_orders.sql`). Tests: see `tests/TEST_LOG_week9.md`.

## The journey
`products` -> `cart.html` -> **Proceed to Checkout** -> `checkout.html` -> **Place order** -> `order.html?no=TG-xxxxxx&placed=1` (confirmation) -> `orders.html` (history). Admin: `admin-orders.html`.

## Lab steps and where they are
| Step | Done in |
|---|---|
| 1 Review the Week 8 cart | Cart page unchanged except that Proceed to Checkout now goes to the real checkout |
| 2 Checkout form and delivery fields | `checkout.html`: receiver name, phone, email (optional), collection or delivery, address, town/district, notes, payment method |
| 3 Items, quantities, unit prices, totals | Order summary panel on the checkout page |
| 4 Validate delivery on the server | `delivery_problems()` in `server/app.py`; errors shown beside each field |
| 5 Recheck prices and stock | `POST /api/orders` reads price and stock from the database inside one transaction; browser prices are ignored; a changed price returns `price_changed` |
| 6 Create Orders and Order_Items | Same transaction also creates the payment row and first status-history row and reduces stock |
| 7 Unique order number | `TG-` + 6 random digits, checked against existing orders (and UNIQUE in the database) |
| 8 Confirmation page | `order.html`: thank-you, order number, items, delivery details, payment, totals, status history |
| 9 Order history for the correct customer | `orders.html`; the API only returns the logged-in customer's orders, and another customer's order number gives 404 |
| 10 Admin list and status update | `admin-orders.html`: search, status filter, update with allowed next statuses only |
| 11 Test empty cart, invalid details, stock, repeated submission | `tests/test_orders.py` (80), `tests/e2e_checkout.js` (29) |
| 12 Screenshots, source, test log | `tests/screenshots/`, this project, `tests/TEST_LOG_week9.md` |

## Design decisions
- **Login required to order.** Orders belong to a customer so that history and privacy work. Guests keep their cart and are sent to log in.
- **Inventory is reserved when the order is placed** (stock is reduced at once) and **returned if the order is cancelled**, by the customer (while Pending) or by an admin.
- **Status flow:** Pending -> Confirmed -> Shipped -> Completed, with Cancelled possible from Pending or Confirmed. Steps cannot be skipped, Completed and Cancelled are final, and collection orders skip Shipped. Completing an order marks its payment Paid. Every change is stored in `order_status_history` with who and when.
- **Repeated submission:** each checkout attempt carries a one-time key; the server has a unique index on (customer, key), so double clicks, retries and simultaneous requests return the first order instead of creating another.
- **Payment:** cash at the shop, cash on delivery, or "Mobile money" recorded as Unpaid. No real payment gateway or card data is involved.
- **Delivery fee:** flat UGX 5,000 for delivery, free for collection (constant in `server/app.py` and `js/checkout.js`).

## Reflection: can a customer complete the journey from cart to confirmed order?
Yes. A logged-in customer can turn a validated cart into an order whose price, stock and delivery details are all checked on the server, receive an order number and confirmation, and later find the order in their own history. An admin can move it through its statuses. Remaining limits: no real payment or email/SMS notifications, a flat delivery fee, no order editing after placement, and the Flask development server should be replaced by a production server over HTTPS before real use.

## Screenshots to add for submission (take them in your browser)
Cart; checkout form; validation errors; insufficient-stock message; confirmation page; order history; admin order list before and after a status change; order status history.
