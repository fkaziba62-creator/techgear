"""Week 7 security tests. Run: python3 tests/test_accounts.py  (uses a temporary copy of the database)"""
import os, sys, shutil, tempfile, sqlite3, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp(); dbp = os.path.join(tmp, "t.db"); shutil.copy(os.path.join(ROOT, "database", "techgear.db"), dbp)
os.environ.update(TECHGEAR_DB=dbp, ADMIN_EMAIL="admin@techgear.example", ADMIN_PASSWORD="Admin-pass-2026")
sys.path.insert(0, os.path.join(ROOT, "server")); import app as A
out, fails = [], 0
def check(name, cond, detail=""):
    global fails; fails += (not cond); out.append(("PASS  " if cond else "FAIL  ") + name + (f"\n      -> {detail}" if detail else ""))
def raw(): c = sqlite3.connect(dbp); c.row_factory = sqlite3.Row; return c
good = dict(full_name="Test Customer", email="Test.User@Example.com", phone="0755 123 456", password="Strong-pass-1")
cl = A.app.test_client()

out.append("REGISTRATION")
r = cl.post("/api/register", json=good); csrf = r.json["csrf"]
check("Register with valid details creates account and logs in", r.status_code == 201 and r.json["user"]["email"] == "test.user@example.com", f"{r.status_code}, email stored lower-case")
sc = r.headers.get("Set-Cookie", "")
check("Session cookie is HttpOnly and SameSite=Lax", "HttpOnly" in sc and "SameSite=Lax" in sc, sc.split(";")[0][:20] + "... " + "; ".join(sc.split("; ")[1:]))
h = raw().execute("SELECT password_hash FROM customers WHERE email='test.user@example.com'").fetchone()[0]
check("Password is stored as a salted scrypt hash, not plain text", h.startswith("scrypt:") and "Strong-pass-1" not in h, h[:40] + "...")
tokrows = raw().execute("SELECT token_hash FROM sessions").fetchall()
check("Only a SHA-256 hash of the session token is stored", all(len(t[0]) == 64 for t in tokrows))
for n, (label, pw) in enumerate([("too short", "ab1"), ("no number", "onlyletters"), ("common password", "password1"), ("contains email name", "hello-user3-pass")]):
    d = dict(good, email="user%d@example.com" % n, phone="07000%05d" % n, password=pw)
    r = A.app.test_client().post("/api/register", json=d); check(f"Weak password rejected ({label})", r.status_code == 400 and "password" in r.json["fields"], r.json["fields"].get("password", ""))
r = A.app.test_client().post("/api/register", json=dict(good, email="bad", phone="12", full_name="")); check("Invalid email/phone/name rejected", r.status_code == 400 and len(r.json["fields"]) == 3, str(sorted(r.json["fields"])))
r = A.app.test_client().post("/api/register", json=dict(good, phone="0700000001")); check("Duplicate email rejected", r.status_code == 409, r.json["error"])
r = A.app.test_client().post("/api/register", json=dict(good, email="other@example.com")); check("Duplicate phone rejected", r.status_code == 409)
r = A.app.test_client().post("/api/register", json=dict(good, full_name="<script>alert(1)</script> O'Neil", email="xss@example.com", phone="0700111222"))
check("Quotes/HTML in names stored as plain data (SQL-injection safe; page uses textContent)", r.status_code == 201 and "<script>" in r.json["user"]["full_name"])

out.append("\nLOGIN, LOGOUT AND SESSIONS")
c2 = A.app.test_client()
r = c2.post("/api/login", json={"email": "test.user@example.com", "password": "wrong-pass-9"}); m1 = r.json["error"]
r2 = c2.post("/api/login", json={"email": "nobody@example.com", "password": "wrong-pass-9"})
check("Wrong password and unknown email give the same 401 message", r.status_code == 401 and r2.status_code == 401 and m1 == r2.json["error"], m1)
r = c2.post("/api/login", json={"email": "' OR '1'='1", "password": "x' OR '1'='1"}); check("SQL injection in login fails", r.status_code == 401)
check("Seeded guest customer (no password) cannot log in", c2.post("/api/login", json={"email": "brian@example.com", "password": "anything123"}).status_code == 401)
check("Protected route without session returns 401", c2.get("/api/profile").status_code == 401)
r = c2.post("/api/login", json={"email": "TEST.user@example.com", "password": "Strong-pass-1"}); csrf2 = r.json["csrf"]
check("Correct login works (email is case-insensitive)", r.status_code == 200 and c2.get("/api/profile").status_code == 200)
check("Each login issues a new session token (no fixation)", raw().execute("SELECT COUNT(DISTINCT token_hash) FROM sessions WHERE customer_id=(SELECT customer_id FROM customers WHERE email='test.user@example.com')").fetchone()[0] == 2)
for i in range(5): lk = A.app.test_client().post("/api/login", json={"email": "xss@example.com", "password": "bad-guess-%d" % i})
check("Account locks after 5 failed attempts", A.app.test_client().post("/api/login", json={"email": "xss@example.com", "password": "Strong-pass-1"}).status_code == 429, "429 even with a correct password while locked")
r = c2.post("/api/logout", json={}); check("Logout without CSRF token is rejected", r.status_code == 403)
r = c2.post("/api/logout", json={}, headers={"X-CSRF-Token": csrf2}); check("Logout with CSRF token succeeds", r.status_code == 200)
check("Session is invalid after logout", c2.get("/api/profile").status_code == 401)
c3 = A.app.test_client(); c3.post("/api/login", json={"email": "test.user@example.com", "password": "Strong-pass-1"})
raw_c = raw(); raw_c.execute("UPDATE sessions SET last_seen=last_seen-?", (31 * 60,)); raw_c.commit()
check("Session expires after 30 minutes idle", c3.get("/api/profile").status_code == 401)
c4 = A.app.test_client(); csrf4 = c4.post("/api/login", json={"email": "test.user@example.com", "password": "Strong-pass-1"}).json["csrf"]
raw_c.execute("UPDATE sessions SET expires_at=?", (int(time.time()) - 1,)); raw_c.commit()
check("Session expires after absolute lifetime (8 hours)", c4.get("/api/profile").status_code == 401)
r = A.app.test_client().post("/api/login", data="email=a&password=b"); check("Non-JSON (cross-site form style) POST is rejected", r.status_code == 415)

out.append("\nPROFILE AND PASSWORD")
c = A.app.test_client(); csrf = c.post("/api/login", json={"email": "test.user@example.com", "password": "Strong-pass-1"}).json["csrf"]; H = {"X-CSRF-Token": csrf}
r = c.put("/api/profile", json={"full_name": "Test Updated", "email": "test.user@example.com", "phone": "0755123456", "address": "Kitagata"}, headers=H)
check("Profile update with CSRF token works", r.status_code == 200 and r.json["user"]["full_name"] == "Test Updated")
check("Profile update without CSRF token is rejected", c.put("/api/profile", json=good).status_code == 403)
r = c.put("/api/profile", json={"full_name": "T", "email": "brian@example.com", "phone": "0755123456"}, headers=H); check("Cannot take another customer's email", r.status_code in (400, 409))
other = A.app.test_client(); other.post("/api/login", json={"email": "test.user@example.com", "password": "Strong-pass-1"})
r = c.post("/api/change-password", json={"current": "wrong", "new": "New-pass-22"}, headers=H); check("Change password needs the correct current password", r.status_code == 400)
r = c.post("/api/change-password", json={"current": "Strong-pass-1", "new": "weak"}, headers=H); check("New password must meet the rules", r.status_code == 400)
r = c.post("/api/change-password", json={"current": "Strong-pass-1", "new": "New-pass-22"}, headers=H); check("Password change succeeds", r.status_code == 200)
check("Other devices are logged out after password change", other.get("/api/profile").status_code == 401 and c.get("/api/profile").status_code == 200)
check("Old password no longer works, new one does", A.app.test_client().post("/api/login", json={"email": "test.user@example.com", "password": "Strong-pass-1"}).status_code == 401 and A.app.test_client().post("/api/login", json={"email": "test.user@example.com", "password": "New-pass-22"}).status_code == 200)

out.append("\nAUTHORIZATION (ROLES)")
check("Customer cannot open admin API", c.get("/api/admin/customers").status_code == 403)
check("Anonymous user cannot open admin API", A.app.test_client().get("/api/admin/customers").status_code == 401)
ad = A.app.test_client(); ad.post("/api/login", json={"email": "admin@techgear.example", "password": "Admin-pass-2026"})
r = ad.get("/api/admin/customers"); check("Admin can list customers", r.status_code == 200 and len(r.json["customers"]) >= 5)
check("Admin list never exposes password hashes", "password" not in str(r.json) and "scrypt" not in str(r.json))
check("Public registration cannot create an admin", c.get("/api/profile").json["user"]["role"] == "customer" and A.app.test_client().post("/api/register", json=dict(good, email="evil@example.com", phone="0700999888", role="admin")).json["user"]["role"] == "customer")

out.append("\nORDERS LINKED TO ACCOUNT")
price = lambda sku: raw().execute("SELECT price FROM products WHERE sku=?", (sku,)).fetchone()[0]
before = raw().execute("SELECT stock FROM products WHERE sku='mouse'").fetchone()[0]
r = c.post("/api/orders", json={"items": {"mouse": 2, "keyboard": 1}, "delivery_method": "delivery", "delivery_address": "Kitagata Town", "delivery_district": "Sheema", "recipient_name": "Test Updated", "recipient_phone": "0755123456", "payment_method": "Cash on delivery"}, headers=H)
check("Logged-in customer can place an order (prices taken from the database)", r.status_code == 201 and r.json["total"] == 2 * price("mouse") + price("keyboard") + 5000, f"{r.json}")
check("Stock is reduced by the order", raw().execute("SELECT stock FROM products WHERE sku='mouse'").fetchone()[0] == before - 2)
check("Order over available stock is rejected and changes nothing", c.post("/api/orders", json={"items": {"backpack": 1}, "delivery_method": "collection", "recipient_name": "Test Updated", "recipient_phone": "0755123456", "payment_method": "Cash at shop"}, headers=H).status_code == 409)
check("Customer sees only their own orders", [o["order_no"] for o in c.get("/api/orders").json["orders"]] == [r.json["order_no"]])
check("Anonymous user cannot place an order", A.app.test_client().post("/api/orders", json={"items": {"mouse": 1}, "delivery_method": "collection"}).status_code == 401)

out.append("\nSITE EXPOSURE AND HEADERS")
s = A.app.test_client()
check("Database file is not downloadable", s.get("/database/techgear.db").status_code == 404 and s.get("/server/app.py").status_code == 404)
check("Path traversal is blocked", all(s.get(u).status_code == 404 for u in ["/css/../server/app.py", "/js/../database/techgear.db", "/css/%2e%2e/server/app.py", "/images/..%2fserver/app.py"]))
r = s.get("/login.html"); check("Pages are served with security headers", r.status_code == 200 and "Content-Security-Policy" in r.headers and r.headers["X-Frame-Options"] == "DENY")
summary = f"\nRESULT: {sum(l.startswith('PASS') for l in out)} passed, {fails} failed"
open(os.path.join(ROOT, "tests", "evidence_week7.txt"), "w").write("TECHGEAR WEEK 7 TEST EVIDENCE\n" + "=" * 60 + "\n" + "\n".join(out) + summary + "\n")
print("\n".join(out) + summary); shutil.rmtree(tmp)
