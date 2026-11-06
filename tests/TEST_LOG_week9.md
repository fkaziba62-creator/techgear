# Week 9 test log (Checkout and Orders)

Run on the project as zipped; every suite starts from a temporary copy of `database/techgear.db`, so the real database is not changed.

| Suite | Command | Result |
|---|---|---|
| Checkout and orders API | `python3 tests/test_orders.py` | 80 passed, 0 failed |
| Checkout journey in the real pages | `node tests/e2e_checkout.js` | 29 passed, 0 failed |
| Week 8 cart (still passing) | `node tests/test_cart_logic.js`, `python3 tests/test_cart_api.py`, `node tests/e2e_cart.js` | 33, 13, 32 passed |
| Week 7 accounts (still passing) | `python3 tests/test_accounts.py` | 46 passed |

## Lab step 11 scenarios
| Scenario | Result | Evidence line |
|---|---|---|
| Empty cart | API: 400 `empty_cart`; page: "Your cart is empty" with link to products | `evidence_week9_api.txt`, `evidence_week9_e2e.txt` |
| Invalid delivery details (13 cases: name, phone, email, notes, method, address, district, payment mismatch) | Rejected by the server with a message per field; no order, no stock change | `evidence_week9_api.txt` |
| Insufficient stock (more than available, out of stock, partly available) | 409 with every problem listed; the whole order is rolled back | `evidence_week9_api.txt` |
| Repeated submission (double click, same key twice, 4 simultaneous requests) | Exactly one order and one stock deduction | `evidence_week9_api.txt`, `evidence_week9_e2e.txt` |
| Two customers racing for the last unit | One order succeeds (201), the other gets 409; stock never below 0 | `evidence_week9_api.txt` |
| Price changed after the customer viewed the cart | 409 `price_changed`; new total shown; no order until confirmed | both files |

## Bugs found by these tests and fixed during Week 9
1. The error helper's `code` argument clashed with the `code` field sent to the browser, so every error response was a server error (HTTP 500).
2. On the checkout page, switching from collection to delivery left no payment option selected, so the order was rejected.
3. (Test data) The Week 6 seed customers already use some phone numbers; tests now use unique ones.

## Screenshots
`tests/screenshots/*.png` (12 images) are rendered from the real pages with their JavaScript output (HTML copies are in `tests/screenshots/html/`). They are produced by the test run, not captured from a browser window, so fonts and spacing differ slightly from Chrome or Firefox. For the final submission, add your own browser screenshots of the same screens (list in README_week9.md).
