"""TechGear Week 7 backend: registration, login, logout, profile, sessions, roles, orders.
Run:  python3 server/app.py   then open http://127.0.0.1:5000
Optional first admin:  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-pass1' python3 server/app.py
"""
import os, re, time, posixpath, threading, secrets, hashlib, sqlite3, hmac
from functools import wraps
from datetime import datetime, timezone
from flask import Flask, request, jsonify, g, send_from_directory, abort
from werkzeug.security import generate_password_hash, check_password_hash

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB_PATH = os.environ.get("TECHGEAR_DB", os.path.join(ROOT, "database", "techgear.db"))
COOKIE, IDLE, ABSOLUTE, MAX_FAILS, LOCK = "tg_session", 30 * 60, 8 * 3600, 5, 10 * 60
SECURE = os.environ.get("TECHGEAR_HTTPS") == "1"       # set to 1 when served over HTTPS

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
DUMMY_HASH = generate_password_hash("not-a-real-password")  # equalises timing for unknown emails
now = lambda: int(time.time())
tok_hash = lambda t: hashlib.sha256(t.encode()).hexdigest()

# ---------- database ----------
def connect(path=None):
    c = sqlite3.connect(path or DB_PATH, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c

def init_db():
    c = connect()
    cols = [r["name"] for r in c.execute("PRAGMA table_info(customers)")]
    if "password_hash" not in cols:
        c.executescript(open(os.path.join(ROOT, "database", "week7_accounts.sql")).read())
    if "recipient_name" not in [r["name"] for r in c.execute("PRAGMA table_info(orders)")]:
        c.executescript(open(os.path.join(ROOT, "database", "week9_orders.sql")).read())
    email, pw = os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD")
    if email and pw and not c.execute("SELECT 1 FROM customers WHERE role='admin'").fetchone():
        c.execute("INSERT INTO customers (full_name,phone,email,password_hash,role,created_at) VALUES (?,?,?,?, 'admin',?)",
                  ("Shop Admin", "0000000000", email.lower(), generate_password_hash(pw), now()))
    c.close()

def db():
    if "db" not in g: g.db = connect()
    return g.db

@app.teardown_appcontext
def close_db(_):
    d = g.pop("db", None)
    if d: d.close()

# ---------- helpers ----------
def err(msg, status=400, **extra): return jsonify(error=msg, **extra), status
def user_json(r): return {k: r[k] for k in ("customer_id", "full_name", "email", "phone", "address", "role")}
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s.]+(\.[^@\s.]+)+$")
COMMON = {"password", "password1", "12345678", "123456789", "qwerty123", "11111111", "iloveyou", "admin123", "letmein1", "techgear1"}

def clean(d):
    f = {}
    name = " ".join(str(d.get("full_name", "")).split())
    email = str(d.get("email", "")).strip().lower()
    phone = re.sub(r"[ \-()]", "", str(d.get("phone", "")))
    if not 2 <= len(name) <= 80: f["full_name"] = "Enter your full name (2-80 characters)."
    if not EMAIL_RE.match(email) or len(email) > 254: f["email"] = "Enter a valid email address."
    if not re.fullmatch(r"\+?\d{9,15}", phone): f["phone"] = "Enter a valid phone number (9-15 digits)."
    addr = str(d.get("address", "") or "").strip()[:200]
    return {"full_name": name, "email": email, "phone": phone, "address": addr or None}, f

def pw_problem(pw, email="", name=""):
    if not isinstance(pw, str) or len(pw) < 8: return "Password must be at least 8 characters."
    if len(pw) > 128: return "Password is too long (max 128)."
    if not (re.search(r"[A-Za-z]", pw) and re.search(r"\d", pw)): return "Password needs at least one letter and one number."
    if pw.lower() in COMMON: return "That password is too common."
    local = email.split("@")[0]
    if len(local) >= 4 and local in pw.lower(): return "Password must not contain your email name."
    return None

def new_session(cid):
    tok, csrf, t = secrets.token_urlsafe(32), secrets.token_urlsafe(24), now()
    db().execute("INSERT INTO sessions VALUES (?,?,?,?,?,?)", (tok_hash(tok), cid, csrf, t, t, t + ABSOLUTE))
    return tok, csrf

def with_cookie(resp, tok):
    resp.set_cookie(COOKIE, tok, httponly=True, samesite="Lax", secure=SECURE, path="/")
    return resp

def current():
    tok = request.cookies.get(COOKIE)
    if not tok: return None
    r = db().execute("""SELECT s.token_hash, s.csrf_token, s.last_seen, s.expires_at, c.customer_id, c.full_name, c.email,
                        c.phone, c.address, c.role FROM sessions s JOIN customers c ON c.customer_id = s.customer_id
                        WHERE s.token_hash = ?""", (tok_hash(tok),)).fetchone()
    if not r: return None
    t = now()
    if r["expires_at"] <= t or r["last_seen"] + IDLE <= t:
        db().execute("DELETE FROM sessions WHERE token_hash=?", (r["token_hash"],)); return None
    db().execute("UPDATE sessions SET last_seen=? WHERE token_hash=?", (t, r["token_hash"]))
    return r

def login_required(role=None):
    def deco(fn):
        @wraps(fn)
        def wrap(*a, **k):
            s = current()
            if not s: return err("Please log in.", 401)
            if request.method != "GET" and not hmac.compare_digest(request.headers.get("X-CSRF-Token", ""), s["csrf_token"]):
                return err("Invalid or missing CSRF token.", 403)
            if role and s["role"] != role: return err("You do not have permission.", 403)
            g.s = s; return fn(*a, **k)
        return wrap
    return deco

@app.before_request
def json_only():                      # cross-site forms cannot send JSON, so they cannot hit the API
    if request.path.startswith("/api/") and request.method in ("POST", "PUT", "DELETE") and not request.is_json:
        return err("JSON required.", 415)

@app.after_request
def headers(r):
    r.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["X-Frame-Options"] = "DENY"
    r.headers["Referrer-Policy"] = "same-origin"
    if request.path.startswith("/api/"): r.headers["Cache-Control"] = "no-store"
    o = request.headers.get("Origin", "")
    if request.path.startswith("/api/") and re.fullmatch(r"http://(127\.0\.0\.1|localhost)(:\d+)?", o):   # local dev: pages opened from Live Server etc.
        r.headers.update({"Access-Control-Allow-Origin": o, "Access-Control-Allow-Credentials": "true", "Vary": "Origin",
                          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"})
    return r

# ---------- account routes ----------
@app.get("/api/session")
def session_info():
    s = current()
    return jsonify(authenticated=bool(s), user=user_json(s) if s else None, csrf=s["csrf_token"] if s else None)

@app.post("/api/register")
def register():
    d = request.get_json(silent=True) or {}
    c, f = clean(d)
    p = pw_problem(d.get("password"), c["email"], c["full_name"])
    if p: f["password"] = p
    if f: return err("Please correct the highlighted fields.", 400, fields=f)
    if db().execute("SELECT 1 FROM customers WHERE lower(email)=? OR phone=?", (c["email"], c["phone"])).fetchone():
        return err("An account with those details already exists. Try logging in.", 409)
    cur = db().execute("INSERT INTO customers (full_name,phone,email,address,password_hash,created_at) VALUES (?,?,?,?,?,?)",
                       (c["full_name"], c["phone"], c["email"], c["address"], generate_password_hash(d["password"]), now()))
    tok, csrf = new_session(cur.lastrowid)
    row = db().execute("SELECT * FROM customers WHERE customer_id=?", (cur.lastrowid,)).fetchone()
    resp = jsonify(user=user_json(row), csrf=csrf); resp.status_code = 201
    return with_cookie(resp, tok)

@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    email, pw = str(d.get("email", "")).strip().lower(), d.get("password")
    if not isinstance(pw, str) or len(pw) > 128: return err("Incorrect email or password.", 401)
    r = db().execute("SELECT * FROM customers WHERE lower(email)=?", (email,)).fetchone()
    if r and r["locked_until"] > now():
        return err("Too many failed attempts. Try again in a few minutes.", 429)
    ok = check_password_hash((r["password_hash"] if r and r["password_hash"] else DUMMY_HASH), pw) and bool(r and r["password_hash"])
    if not ok:
        if r:
            fails = r["failed_logins"] + 1
            db().execute("UPDATE customers SET failed_logins=?, locked_until=? WHERE customer_id=?",
                         (0 if fails >= MAX_FAILS else fails, now() + LOCK if fails >= MAX_FAILS else 0, r["customer_id"]))
        return err("Incorrect email or password.", 401)      # same message for unknown email and wrong password
    db().execute("UPDATE customers SET failed_logins=0, locked_until=0 WHERE customer_id=?", (r["customer_id"],))
    tok, csrf = new_session(r["customer_id"])                # new token on every login (no session fixation)
    return with_cookie(jsonify(user=user_json(r), csrf=csrf), tok)

@app.post("/api/logout")
@login_required()
def logout():
    db().execute("DELETE FROM sessions WHERE token_hash=?", (g.s["token_hash"],))
    resp = jsonify(ok=True); resp.delete_cookie(COOKIE, path="/"); return resp

@app.route("/api/profile", methods=["GET", "PUT"])
@login_required()
def profile():
    if request.method == "PUT":
        c, f = clean(request.get_json(silent=True) or {})
        if f: return err("Please correct the highlighted fields.", 400, fields=f)
        if db().execute("SELECT 1 FROM customers WHERE (lower(email)=? OR phone=?) AND customer_id<>?",
                        (c["email"], c["phone"], g.s["customer_id"])).fetchone():
            return err("That email or phone is already used by another account.", 409)
        db().execute("UPDATE customers SET full_name=?, email=?, phone=?, address=? WHERE customer_id=?",
                     (c["full_name"], c["email"], c["phone"], c["address"], g.s["customer_id"]))
    r = db().execute("SELECT * FROM customers WHERE customer_id=?", (g.s["customer_id"],)).fetchone()
    return jsonify(user=user_json(r))

@app.post("/api/change-password")
@login_required()
def change_password():
    d = request.get_json(silent=True) or {}
    r = db().execute("SELECT * FROM customers WHERE customer_id=?", (g.s["customer_id"],)).fetchone()
    if not isinstance(d.get("current"), str) or not check_password_hash(r["password_hash"], d["current"]):
        return err("Current password is incorrect.", 400, fields={"current": "Current password is incorrect."})
    p = pw_problem(d.get("new"), r["email"] or "", r["full_name"])
    if p: return err(p, 400, fields={"new": p})
    db().execute("UPDATE customers SET password_hash=? WHERE customer_id=?", (generate_password_hash(d["new"]), r["customer_id"]))
    db().execute("DELETE FROM sessions WHERE customer_id=? AND token_hash<>?", (r["customer_id"], g.s["token_hash"]))  # log out other devices
    return jsonify(ok=True)

# ---------- checkout and orders (Week 9) ----------
STATUSES = ("Pending", "Confirmed", "Shipped", "Completed", "Cancelled")
FLOW = {"Pending": ("Confirmed", "Cancelled"), "Confirmed": ("Shipped", "Completed", "Cancelled"),
        "Shipped": ("Completed",), "Completed": (), "Cancelled": ()}
PAY = {"collection": ("Cash at shop", "Mobile money"), "delivery": ("Cash on delivery", "Mobile money")}
DELIVERY_FEE = 5000
ORDER_NO_RE, KEY_RE = re.compile(r"^TG-\d{6}$"), re.compile(r"^[A-Za-z0-9_-]{16,64}$")

class Reject(Exception):
    def __init__(self, resp): self.resp = resp

def allowed_next(status, method):    # collection orders are never "Shipped"
    return [x for x in FLOW[status] if not (x == "Shipped" and method != "delivery")]

def stamp(t): return datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

def delivery_problems(d):
    f, one = {}, lambda k, n=None: " ".join(str(d.get(k) or "").split())[:n]
    name, addr, district = one("recipient_name"), one("delivery_address"), one("delivery_district")
    phone = re.sub(r"[ \-()]", "", str(d.get("recipient_phone") or ""))
    email, notes = str(d.get("recipient_email") or "").strip().lower(), str(d.get("notes") or "").strip()
    method, pay = d.get("delivery_method"), d.get("payment_method")
    if not 2 <= len(name) <= 80: f["recipient_name"] = "Enter the receiver's full name (2-80 characters)."
    if not re.fullmatch(r"\+?\d{9,15}", phone): f["recipient_phone"] = "Enter a valid phone number (9-15 digits)."
    if email and (len(email) > 254 or not EMAIL_RE.match(email)): f["recipient_email"] = "Enter a valid email address or leave it empty."
    if len(notes) > 200: f["notes"] = "Notes can be at most 200 characters."
    if method not in PAY: f["delivery_method"] = "Choose collection or delivery."
    else:
        if method == "delivery":
            if not 5 <= len(addr) <= 200: f["delivery_address"] = "Enter the delivery address (5-200 characters)."
            if not 2 <= len(district) <= 60: f["delivery_district"] = "Enter the town or district (2-60 characters)."
        else: addr = district = ""
        if pay not in PAY[method]: f["payment_method"] = "Choose a payment method: " + " or ".join(PAY[method]) + "."
    return dict(name=name, phone=phone, email=email or None, address=addr or None, district=district or None,
                notes=notes or None, method=method, pay=pay), f

def order_total(c, order_id):
    return c.execute("SELECT COALESCE(SUM(oi.quantity*oi.unit_price),0)+o.delivery_fee FROM orders o LEFT JOIN order_items oi "
                     "ON oi.order_id=o.order_id WHERE o.order_id=?", (order_id,)).fetchone()[0]

def order_full(c, o, admin=False):
    items = [dict(i) for i in c.execute("SELECT p.sku,p.name,oi.quantity,oi.unit_price,oi.quantity*oi.unit_price AS line_total FROM order_items oi "
                                         "JOIN products p ON p.product_id=oi.product_id WHERE oi.order_id=? ORDER BY oi.order_item_id", (o["order_id"],))]
    cust = c.execute("SELECT full_name,email,phone FROM customers WHERE customer_id=?", (o["customer_id"],)).fetchone()
    pay = c.execute("SELECT method,status,paid_at,amount FROM payments WHERE order_id=? ORDER BY payment_id LIMIT 1", (o["order_id"],)).fetchone()
    hist = [{"status": h["status"], "at": stamp(h["changed_at"]), "note": h["note"]} for h in
            c.execute("SELECT status,changed_at,note FROM order_status_history WHERE order_id=? ORDER BY history_id", (o["order_id"],))]
    sub = sum(i["line_total"] for i in items)
    d = {"order_no": o["order_no"], "date": o["order_date"], "status": o["status"], "items": items, "subtotal": sub,
         "delivery_fee": o["delivery_fee"], "total": sub + o["delivery_fee"], "payment": dict(pay) if pay else None,
         "history": hist or [{"status": o["status"], "at": o["order_date"], "note": None}],
         "delivery": {"method": o["delivery_method"], "name": o["recipient_name"] or cust["full_name"], "phone": o["recipient_phone"] or cust["phone"],
                      "email": o["recipient_email"] or cust["email"], "address": o["delivery_address"], "district": o["delivery_district"]},
         "notes": o["notes"], "next": allowed_next(o["status"], o["delivery_method"]) if admin else []}
    if admin: d["customer"] = dict(cust)
    return d

def set_status(c, o, new, by, note=None):      # call inside a transaction
    if new == "Cancelled":                      # put the stock back
        for i in c.execute("SELECT product_id,quantity FROM order_items WHERE order_id=?", (o["order_id"],)).fetchall():
            c.execute("UPDATE products SET stock = stock + ? WHERE product_id=?", (i["quantity"], i["product_id"]))
        c.execute("UPDATE payments SET status='Refunded' WHERE order_id=? AND status='Paid'", (o["order_id"],))
    if new == "Completed":
        c.execute("UPDATE payments SET status='Paid', paid_at=date('now') WHERE order_id=? AND status='Unpaid'", (o["order_id"],))
    c.execute("UPDATE orders SET status=?, updated_at=? WHERE order_id=?", (new, now(), o["order_id"]))
    c.execute("INSERT INTO order_status_history (order_id,status,changed_by,changed_at,note) VALUES (?,?,?,?,?)", (o["order_id"], new, by, now(), note))

@app.route("/api/orders", methods=["GET", "POST"])
@login_required()
def orders():
    cid, c = g.s["customer_id"], db()
    if request.method == "GET":                 # order history: only this customer's orders
        out = []
        for o in c.execute("SELECT * FROM orders WHERE customer_id=? ORDER BY order_id DESC", (cid,)).fetchall():
            full = order_full(c, o)
            out.append(dict(order_no=o["order_no"], date=o["order_date"], status=o["status"], method=o["delivery_method"], total=full["total"], items=full["items"]))
        return jsonify(orders=out)
    d = request.get_json(silent=True) or {}
    key, items = d.get("idempotency_key"), d.get("items")
    if key is not None and not (isinstance(key, str) and KEY_RE.match(key)): return err("Invalid checkout key.")
    if not isinstance(items, dict) or not items: return err("Your cart is empty.", 400, code="empty_cart")
    if len(items) > 30: return err("Too many different items in one order.")
    dl, f = delivery_problems(d)
    if f: return err("Please correct the highlighted fields.", 400, fields=f, code="invalid_details")
    c.execute("BEGIN IMMEDIATE")
    try:
        if key:                                  # same checkout submitted twice -> return the first order
            ex = c.execute("SELECT order_id,order_no FROM orders WHERE customer_id=? AND idempotency_key=?", (cid, key)).fetchone()
            if ex: raise Reject((jsonify(order_no=ex["order_no"], total=order_total(c, ex["order_id"]), duplicate=True), 200))
        lines, problems = [], []
        for sku, qty in items.items():           # prices and stock are re-read from the database
            if not isinstance(qty, int) or isinstance(qty, bool) or not 1 <= qty <= 99:
                problems.append({"sku": str(sku)[:40], "message": "Invalid quantity."}); continue
            p = c.execute("SELECT product_id,name,price,stock FROM products WHERE sku=?", (str(sku)[:40],)).fetchone()
            if not p: problems.append({"sku": str(sku)[:40], "message": "This product is no longer sold."})
            elif p["stock"] <= 0: problems.append({"sku": sku, "message": p["name"] + " is out of stock."})
            elif p["stock"] < qty: problems.append({"sku": sku, "message": f"{p['name']}: only {p['stock']} left (you asked for {qty})."})
            else: lines.append((p, qty))
        if problems: raise Reject(err("Some items cannot be ordered. Please review your cart.", 409, code="unavailable", problems=problems))
        fee = DELIVERY_FEE if dl["method"] == "delivery" else 0
        total = sum(p["price"] * q for p, q in lines) + fee
        if d.get("expected_total") is not None and d.get("expected_total") != total:
            raise Reject(err("Prices changed since you last looked. Please check the new total.", 409, code="price_changed", total=total))
        while True:
            no = "TG-" + str(secrets.randbelow(900000) + 100000)
            if not c.execute("SELECT 1 FROM orders WHERE order_no=?", (no,)).fetchone(): break
        t = now()
        oid = c.execute("""INSERT INTO orders (order_no,customer_id,order_date,delivery_method,delivery_address,delivery_fee,recipient_name,recipient_phone,
                           recipient_email,delivery_district,notes,idempotency_key,created_at,updated_at) VALUES (?,?,date('now'),?,?,?,?,?,?,?,?,?,?,?)""",
                        (no, cid, dl["method"], dl["address"], fee, dl["name"], dl["phone"], dl["email"], dl["district"], dl["notes"], key, t, t)).lastrowid
        for p, q in lines:
            if c.execute("UPDATE products SET stock = stock - ? WHERE product_id=? AND stock >= ?", (q, p["product_id"], q)).rowcount != 1:
                raise Reject(err("Stock changed while ordering. Please try again.", 409, code="unavailable", problems=[]))
            c.execute("INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)", (oid, p["product_id"], q, p["price"]))
        c.execute("INSERT INTO payments (order_id,method,amount) VALUES (?,?,?)", (oid, dl["pay"], total))
        c.execute("INSERT INTO order_status_history (order_id,status,changed_by,changed_at,note) VALUES (?,?,?,?,?)", (oid, "Pending", cid, t, "Order placed"))
        c.execute("COMMIT")
    except Reject as r:
        c.execute("ROLLBACK"); return r.resp
    except Exception:
        c.execute("ROLLBACK"); raise
    return jsonify(order_no=no, total=total, subtotal=total - fee, delivery_fee=fee, duplicate=False), 201

def find_order(order_no, owner_only=False):
    if not ORDER_NO_RE.match(order_no): return None
    o = db().execute("SELECT * FROM orders WHERE order_no=?", (order_no,)).fetchone()
    if not o or (o["customer_id"] != g.s["customer_id"] and (owner_only or g.s["role"] != "admin")): return None   # 404, not 403: do not reveal other orders
    return o

@app.get("/api/orders/<order_no>")
@login_required()
def order_detail(order_no):
    o = find_order(order_no)
    if not o: return err("Order not found.", 404)
    return jsonify(order=order_full(db(), o, admin=g.s["role"] == "admin"))

@app.post("/api/orders/<order_no>/cancel")
@login_required()
def cancel_order(order_no):
    c = db(); c.execute("BEGIN IMMEDIATE")
    try:
        o = find_order(order_no, owner_only=True)
        if not o: raise Reject(err("Order not found.", 404))
        if o["status"] != "Pending": raise Reject(err("Only orders that are still Pending can be cancelled. Please contact the shop.", 409))
        set_status(c, o, "Cancelled", g.s["customer_id"], "Cancelled by customer"); c.execute("COMMIT")
    except Reject as r:
        c.execute("ROLLBACK"); return r.resp
    except Exception:
        c.execute("ROLLBACK"); raise
    return jsonify(ok=True)

# ---------- cart (Week 8): prices and stock always come from the database ----------
@app.post("/api/cart/validate")
def cart_validate():
    items = (request.get_json(silent=True) or {}).get("items")
    if not isinstance(items, dict) or len(items) > 50: return err("Invalid cart.")
    lines = []
    for sku in items:
        p = db().execute("SELECT p.sku,p.name,p.price,p.stock,p.image,c.name AS category FROM products p "
                         "JOIN categories c ON c.category_id=p.category_id WHERE p.sku=?", (str(sku)[:40],)).fetchone()
        lines.append({**dict(p), "found": True} if p else {"sku": str(sku)[:40], "found": False})
    return jsonify(lines=lines)

# ---------- admin ----------
@app.get("/api/admin/customers")
@login_required("admin")
def admin_customers():
    rows = db().execute("""SELECT c.customer_id, c.full_name, c.email, c.phone, c.role, c.password_hash IS NOT NULL AS has_account,
                           c.created_at, (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.customer_id) AS orders
                           FROM customers c ORDER BY c.customer_id""").fetchall()
    return jsonify(customers=[dict(r) for r in rows])

@app.get("/api/admin/orders")
@login_required("admin")
def admin_orders():
    status, q = request.args.get("status", ""), request.args.get("q", "").strip()[:40]
    if status and status not in STATUSES: return err("Unknown status.")
    where, args = [], []
    if status: where.append("o.status=?"); args.append(status)
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append("(o.order_no LIKE ? ESCAPE '\\' OR c.full_name LIKE ? ESCAPE '\\')"); args += [like, like]
    rows = db().execute("SELECT o.order_no,o.order_date,o.status,o.delivery_method,c.full_name,c.phone,"
                        "COALESCE(SUM(oi.quantity*oi.unit_price),0)+o.delivery_fee AS total FROM orders o JOIN customers c ON c.customer_id=o.customer_id "
                        "LEFT JOIN order_items oi ON oi.order_id=o.order_id" + (" WHERE " + " AND ".join(where) if where else "") +
                        " GROUP BY o.order_id ORDER BY o.order_id DESC LIMIT 200", args).fetchall()
    return jsonify(orders=[{**dict(r), "next": allowed_next(r["status"], r["delivery_method"])} for r in rows])

@app.put("/api/admin/orders/<order_no>/status")
@login_required("admin")
def admin_set_status(order_no):
    d = request.get_json(silent=True) or {}
    new, note = d.get("status"), str(d.get("note") or "").strip()[:200] or None
    if new not in STATUSES: return err("Unknown status.")
    c = db(); c.execute("BEGIN IMMEDIATE")
    try:
        o = find_order(order_no)
        if not o: raise Reject(err("Order not found.", 404))
        if new not in allowed_next(o["status"], o["delivery_method"]):
            raise Reject(err(f"An order that is {o['status']} cannot be changed to {new}.", 409, allowed=allowed_next(o["status"], o["delivery_method"])))
        set_status(c, o, new, g.s["customer_id"], note); c.execute("COMMIT")
    except Reject as r:
        c.execute("ROLLBACK"); return r.resp
    except Exception:
        c.execute("ROLLBACK"); raise
    return jsonify(ok=True, status=new)

# ---------- static site (only html, css, js, images are public) ----------
@app.route("/", defaults={"p": "index.html"})
@app.route("/<path:p>")
def site(p):
    if posixpath.normpath(p) != p or "\\" in p or "\x00" in p: abort(404)   # no "..", ".", "//" or backslashes
    parts = p.split("/")
    if (len(parts) == 1 and p.endswith(".html")) or (parts[0] in ("css", "js", "images") and len(parts) > 1):
        return send_from_directory(ROOT, p)
    abort(404)

init_db()
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)))
