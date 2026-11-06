# Week 8: Shopping Cart

Builds on Week 5 (catalogue), Week 6 (database) and Week 7 (accounts). A cart is **not** an order: it only holds the customer's selected items and the amount payable. Delivery details and confirmation belong to checkout (Week 9).

## Chosen approach
The cart is stored in the browser (`localStorage`, key `techgearCart`, shape `{sku: quantity}`), so it survives page changes, refreshes and works for guests as well as logged-in customers. Prices and stock are **not** trusted from the browser: the cart page and checkout ask `POST /api/cart/validate`, which reads the current price and stock from the Week 6 database. If the server is not reachable the page falls back to `js/products.js` and tells the customer.

## Run it
```
pip install -r server/requirements.txt
python3 server/app.py                      # http://127.0.0.1:5000/products.html
node tests/test_cart_logic.js              # 33 unit tests
python3 tests/test_cart_api.py             # 13 API tests
npm install jsdom && node tests/e2e_cart.js   # 36 end-to-end tests on the real pages
python3 tests/test_accounts.py             # Week 7 tests still pass (46)
```

## Lab requirements checklist
| # | Requirement | Where / how |
|---|---|---|
| 1 | Add from listing or details page | `products.html`, `product.html` buttons call `TGCart.add`; details page lets you choose a quantity; button shows "Added", "All N in cart" or "Unavailable" |
| 2 | Show products, unit prices, quantities, line subtotals | `cart.html`: image, name (link to details), price each, stock status, quantity, line total |
| 3 | Update quantity | `-` / `+` buttons or typing a number |
| 4 | Remove one item | Remove button on each line |
| 5 | Clear all items | Clear cart button (needs a second click to confirm) |
| 6 | Accurate subtotal | `TGCart.totals`: unit price x quantity of available items only; delivery fee is shown at checkout |
| 7 | State kept across pages / refresh | localStorage; header badge on every page; updates in other tabs via the `storage` event |
| 8 | Empty-cart message | "Your cart is empty" with a Browse products button |
| 9 | Validate quantities, handle unavailable products | Whole numbers 1-99 only; capped at stock with an explanation; out-of-stock and discontinued items are flagged, left out of the total, and block checkout until removed ("Remove unavailable items" button); corrupted storage is cleaned |
| 10 | Proceed to Checkout | Button goes to `checkout.html`, clearly labelled as the Week 9 placeholder (cart summary, delivery option, basic order step) |

## Files
- `js/cart.js` (new): cart logic and cart page. `js/checkout.js` (new): checkout placeholder.
- `cart.html` (rewritten, checkout form moved out), `checkout.html` (new).
- `js/script.js`: now uses `TGCart`; the old cart code was removed.
- `server/app.py`: new `/api/cart/validate` endpoint.
- `js/products.js`: keyboard price and gaming-mouse stock aligned with the database (the Week 6 CRUD demo had changed them), and a test now checks all 24 products match.

## Limits to mention in the report
- Cart contents are per browser; they are not yet saved in the database or merged across devices after login (a possible extension: a `carts` table).
- The product listing still shows prices from `products.js`; the cart shows database prices. They match today (tested), but a future step is to load the catalogue from the database too.
