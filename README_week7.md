# Week 7: Customer Accounts

Builds on Week 6 (database). Registration, login, logout, profile, sessions, roles and password security, connected to the Week 6 `customers` table and the Week 4 pages.

## Run it
```
pip install -r server/requirements.txt
python3 server/app.py                 # open http://127.0.0.1:5000
# optional first admin account (the password is never stored in the code):
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-strong-pass1' python3 server/app.py
python3 tests/test_accounts.py        # 46 security tests -> tests/evidence_week7.txt
```
The first start adds the Week 7 columns and the `sessions` table to `database/techgear.db` (see `database/week7_accounts.sql`). Open the pages through the server, not by double-clicking the files, because the pages call `/api/...`.

## What was added
| Part | Files |
|---|---|
| Backend (Flask + SQLite) | `server/app.py` |
| Database changes | `database/week7_accounts.sql`: customers + password_hash, role, failed_logins, locked_until, created_at; new `sessions` table |
| Pages | `register.html`, `login.html`, `account.html`, `admin.html` (same header, footer and styles as Weeks 4-5) |
| Browser code | `js/auth.js`; the menu shows Log in / Register, or the customer's name / Log out |
| Cart | Logged-in customers save real orders to the database (My account lists them); guests still get the simulated order |
| Evidence | `tests/test_accounts.py`, `tests/evidence_week7.txt` |

## Security design
| Topic | What is done |
|---|---|
| Password storage | Salted scrypt hash (Werkzeug); plain passwords are never stored |
| Password rules | 8-128 characters, a letter and a number, not a common password, must not contain the email name |
| Login errors | Same message for unknown email and wrong password; a dummy hash is checked so timing does not reveal accounts |
| Brute force | Account locked for 10 minutes after 5 failed logins |
| Sessions | Random token in an HttpOnly, SameSite=Lax cookie (Secure when `TECHGEAR_HTTPS=1`); only its SHA-256 is stored; new token on every login; 30 min idle and 8 h absolute expiry; logout deletes the session; changing the password logs out other devices |
| CSRF | State-changing calls need JSON (cross-site forms cannot send it) and a per-session `X-CSRF-Token` header |
| Authorization | Roles `customer` and `admin`; `/api/admin/*` is admin-only; customers only see their own orders; a role cannot be chosen at registration |
| Injection / XSS | Parameterised SQL everywhere; pages write user data with `textContent`; strict Content-Security-Policy |
| Orders | Prices and stock come from the database inside one transaction, never from the browser |
| Exposure | Only `*.html`, `css/`, `js/`, `images/` are public; the database and server code cannot be downloaded; `..` paths are rejected |

## Reflection: can customers securely create accounts and log in?
Yes, within limits. Passwords are hashed, sessions are server-controlled and expire, input is validated on the server, and the 46 tests show the main attacks (weak passwords, SQL injection, brute force, CSRF, session reuse after logout, role escalation, file exposure) are blocked. Before real use, add HTTPS (and set `TECHGEAR_HTTPS=1`), email verification and password reset, per-IP rate limiting, and run behind a production server such as gunicorn instead of Flask's development server.
