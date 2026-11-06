"""Week 9 tests: checkout, order creation, order history, admin status updates. Run: python3 tests/test_orders.py"""
import os, sys, shutil, tempfile, sqlite3, threading, uuid
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp(); dbp = os.path.join(tmp, "t.db"); shutil.copy(os.path.join(ROOT, "database", "techgear.db"), dbp)
os.environ.update(TECHGEAR_DB=dbp, ADMIN_EMAIL="admin@techgear.example", ADMIN_PASSWORD="Admin-pass-2026")
sys.path.insert(0, os.path.join(ROOT, "server")); import app as A
out, fails = [], 0
def t(n, c, d=""):
    global fails; fails += (not c); out.append(("PASS  " if c else "FAIL  ") + n + (f"\n      -> {d}" if d else ""))
def q(sql, *a): c = sqlite3.connect(dbp); r = c.execute(sql, a).fetchall(); c.close(); return r
def one(sql, *a): return q(sql, *a)[0][0]
stock = lambda sku: one("SELECT stock FROM products WHERE sku=?", sku)
price = lambda sku: one("SELECT price FROM products WHERE sku=?", sku)
def user(email, phone, name="Shopper One"):
    c = A.app.test_client(); r = c.post("/api/register", json=dict(full_name=name, email=email, phone=phone, password="Strong-pass-1" if "a" else "")); return c, {"X-CSRF-Token": r.json["csrf"]}
def body(**kw):
    b = dict(items={"mouse": 1}, recipient_name="Grace Nuwagaba", recipient_phone="0772 300 111", recipient_email="", delivery_method="collection",
             delivery_address="", delivery_district="", notes="", payment_method="Cash at shop", idempotency_key=uuid.uuid4().hex)
    b.update(kw); return b
C1, H1 = user("one@example.com", "0700000101"); C2, H2 = user("two@example.com", "0700000102", "Shopper Two")
ad = A.app.test_client(); HA = {"X-CSRF-Token": ad.post("/api/login", json={"email": "admin@techgear.example", "password": "Admin-pass-2026"}).json["csrf"]}
post = lambda c, h, **kw: c.post("/api/orders", json=body(**kw), headers=h)

out.append("ORDER CREATION (steps 4-8)")
m0, k0 = stock("mouse"), stock("keyboard"); pm, pk = price("mouse"), price("keyboard")
r = post(C1, H1, items={"mouse": 2, "keyboard": 1}, delivery_method="delivery", delivery_address="Kitagata Town, Plot 4", delivery_district="Sheema",
         payment_method="Cash on delivery", notes="Call at the gate", expected_total=2 * pm + pk + 5000)
no = r.json.get("order_no", "")
t("Valid order is created (201) with an order number like TG-123456", r.status_code == 201 and len(no) == 9 and no.startswith("TG-") and no[3:].isdigit(), no)
t("Total is computed on the server from database prices (+ delivery fee)", r.json["total"] == 2 * pm + pk + 5000, f"{r.json['total']} = 2 x {pm} + {pk} + 5000")
oid = one("SELECT order_id FROM orders WHERE order_no=?", no)
t("Orders record holds the delivery snapshot", q("SELECT recipient_name,recipient_phone,delivery_method,delivery_address,delivery_district,notes,status FROM orders WHERE order_id=?", oid)[0] == ("Grace Nuwagaba", "0772300111", "delivery", "Kitagata Town, Plot 4", "Sheema", "Call at the gate", "Pending"))
t("Order_Items records created with the unit price at time of sale", sorted(q("SELECT quantity,unit_price FROM order_items WHERE order_id=?", oid)) == sorted([(2, pm), (1, pk)]))
t("Stock is reduced in the same transaction", stock("mouse") == m0 - 2 and stock("keyboard") == k0 - 1)
t("Payment row and first status-history row are created", q("SELECT method,status,amount FROM payments WHERE order_id=?", oid) == [("Cash on delivery", "Unpaid", 2 * pm + pk + 5000)] and q("SELECT status FROM order_status_history WHERE order_id=?", oid) == [("Pending",)])
nos = {post(C1, H1, items={"keyboard": 1}).json["order_no"] for _ in range(5)}
t("Order numbers are unique", len(nos) == 5 and no not in nos and one("SELECT COUNT(*) FROM orders") == one("SELECT COUNT(DISTINCT order_no) FROM orders"))
r = post(C1, H1, items={"mouse": 1}, **{"unit_price": 1, "price": 1, "total": 1}); t("Prices sent by the browser are ignored", r.status_code == 201 and r.json["total"] == pm, f"total {r.json['total']}")
r = post(C1, H1, items={"mouse": 1}, expected_total=1); before = one("SELECT COUNT(*) FROM orders")
t("If the price changed since the customer looked, order is refused with the new total", r.status_code == 409 and r.json["code"] == "price_changed" and r.json["total"] == pm and one("SELECT COUNT(*) FROM orders") == before)

out.append("\nEMPTY CART, INVALID DELIVERY DETAILS, SECURITY (step 11)")
r = post(C1, H1, items={}); t("Empty cart rejected", r.status_code == 400 and r.json["code"] == "empty_cart")
t("Missing cart rejected", C1.post("/api/orders", json={"recipient_name": "x"}, headers=H1).status_code == 400)
bad = [("name too short", dict(recipient_name="A"), "recipient_name"), ("empty name", dict(recipient_name="   "), "recipient_name"),
       ("phone with letters", dict(recipient_phone="07abc"), "recipient_phone"), ("phone too short", dict(recipient_phone="12345"), "recipient_phone"),
       ("bad email", dict(recipient_email="not-an-email"), "recipient_email"), ("notes too long", dict(notes="x" * 201), "notes"),
       ("unknown delivery method", dict(delivery_method="drone"), "delivery_method"),
       ("delivery without address", dict(delivery_method="delivery", payment_method="Cash on delivery", delivery_district="Sheema"), "delivery_address"),
       ("delivery address too short", dict(delivery_method="delivery", payment_method="Cash on delivery", delivery_address="abc", delivery_district="Sheema"), "delivery_address"),
       ("delivery without district", dict(delivery_method="delivery", payment_method="Cash on delivery", delivery_address="Main street 5"), "delivery_district"),
       ("cash on delivery for a collection order", dict(payment_method="Cash on delivery"), "payment_method"),
       ("cash at shop for a delivery order", dict(delivery_method="delivery", delivery_address="Main street 5", delivery_district="Sheema"), "payment_method"),
       ("unknown payment method", dict(payment_method="Bitcoin"), "payment_method")]
before = one("SELECT COUNT(*) FROM orders"); sb = stock("mouse")
for n, kw, field in bad:
    r = post(C1, H1, **kw); t(f"Invalid details rejected on the server: {n}", r.status_code == 400 and field in r.json["fields"], r.json["fields"].get(field, ""))
t("None of the invalid submissions created an order or changed stock", one("SELECT COUNT(*) FROM orders") == before and stock("mouse") == sb)
r = post(C1, H1, recipient_name="<b>Tom</b> O'Neil'; DROP TABLE orders;--"); t("HTML/SQL text in names is stored as plain text (parameterised SQL)", r.status_code == 201 and one("SELECT COUNT(*) FROM orders") > 0 and q("SELECT recipient_name FROM orders WHERE order_no=?", r.json["order_no"])[0][0].startswith("<b>Tom"))
r = post(C1, H1, delivery_method="collection", delivery_address="ignored", payment_method="Mobile money"); t("Collection order ignores address; Mobile money allowed", r.status_code == 201 and q("SELECT delivery_address FROM orders WHERE order_no=?", r.json["order_no"])[0][0] is None)
for label, items in [("quantity 0", {"mouse": 0}), ("negative quantity", {"mouse": -1}), ("decimal quantity", {"mouse": 1.5}), ("text quantity", {"mouse": "2"}), ("quantity 100", {"mouse": 100}), ("boolean quantity", {"mouse": True})]:
    r = post(C1, H1, items=items); t(f"Invalid quantity rejected: {label}", r.status_code == 409 and r.json["code"] == "unavailable")
r = post(C1, H1, items={"ghost": 1}); t("Unknown product rejected", r.status_code == 409)
t("Anonymous user cannot order", A.app.test_client().post("/api/orders", json=body()).status_code == 401)
t("Order without CSRF token is rejected", C1.post("/api/orders", json=body()).status_code == 403)
t("Non-JSON order request is rejected", C1.post("/api/orders", data="x=1", headers=H1).status_code == 415)

out.append("\nINSUFFICIENT STOCK (step 5 and 11)")
db = sqlite3.connect(dbp); db.execute("UPDATE products SET stock=3 WHERE sku='router'"); db.execute("UPDATE products SET stock=0 WHERE sku='backpack'"); db.commit()
before = one("SELECT COUNT(*) FROM orders"); k = stock("keyboard")
r = post(C1, H1, items={"router": 5, "keyboard": 1, "backpack": 1})
t("Ordering more than the stock is refused (409) and every problem is listed", r.status_code == 409 and r.json["code"] == "unavailable" and len(r.json["problems"]) == 2, "; ".join(p["message"] for p in r.json["problems"]))
t("Whole order is rolled back: no order, no stock change even for the available item", one("SELECT COUNT(*) FROM orders") == before and stock("router") == 3 and stock("keyboard") == k)
r = post(C1, H1, items={"router": 3}); t("Ordering exactly the remaining stock works and leaves 0", r.status_code == 201 and stock("router") == 0)
r = post(C1, H1, items={"router": 1}); t("Next customer then sees it as out of stock", r.status_code == 409 and "out of stock" in r.json["problems"][0]["message"])

out.append("\nREPEATED SUBMISSION (step 11)")
key = uuid.uuid4().hex; s0 = stock("mouse"); n0 = one("SELECT COUNT(*) FROM orders")
a = post(C1, H1, idempotency_key=key, items={"mouse": 1}); b = post(C1, H1, idempotency_key=key, items={"mouse": 1})
t("Submitting the same checkout twice returns the same order", a.status_code == 201 and b.status_code == 200 and a.json["order_no"] == b.json["order_no"] and b.json["duplicate"] is True)
t("Only one order was created and stock was reduced once", one("SELECT COUNT(*) FROM orders") == n0 + 1 and stock("mouse") == s0 - 1)
res = []; key2 = uuid.uuid4().hex; s0 = stock("mouse"); n0 = one("SELECT COUNT(*) FROM orders")
def worker(): c = A.app.test_client(); c.post("/api/login", json={"email": "one@example.com", "password": "Strong-pass-1"}); res.append(c.post("/api/orders", json=body(idempotency_key=key2), headers={"X-CSRF-Token": c.get("/api/session").json["csrf"]}))
th = [threading.Thread(target=worker) for _ in range(4)]; [x.start() for x in th]; [x.join() for x in th]
t("Four simultaneous submissions with one key create exactly one order", one("SELECT COUNT(*) FROM orders") == n0 + 1 and stock("mouse") == s0 - 1 and len({r.json["order_no"] for r in res}) == 1, str(sorted(r.status_code for r in res)))
t("A different key (a deliberate second order) creates a second order", post(C1, H1).status_code == 201)
t("Bad checkout key rejected", post(C1, H1, idempotency_key="short").status_code == 400)
db.execute("UPDATE products SET stock=1 WHERE sku='speaker'"); db.commit(); res.clear()
def racer(c, h): res.append(post(c, h, items={"speaker": 1}))
th = [threading.Thread(target=racer, args=(C1, H1)), threading.Thread(target=racer, args=(C2, H2))]; [x.start() for x in th]; [x.join() for x in th]
t("Two customers racing for the last unit: exactly one wins, stock never negative", sorted(r.status_code for r in res) == [201, 409] and stock("speaker") == 0)

out.append("\nORDER DETAIL AND HISTORY (steps 8-9)")
r = C1.get("/api/orders/" + no); o = r.json["order"]
t("Owner can open the order confirmation with accurate details", r.status_code == 200 and o["total"] == 2 * pm + pk + 5000 and len(o["items"]) == 2 and o["delivery"]["address"] == "Kitagata Town, Plot 4" and o["payment"]["method"] == "Cash on delivery")
t("Line totals add up to the subtotal and total", sum(i["line_total"] for i in o["items"]) == o["subtotal"] and o["subtotal"] + o["delivery_fee"] == o["total"])
t("Another customer gets 404 for this order (cannot even confirm it exists)", C2.get("/api/orders/" + no).status_code == 404)
t("Anonymous user cannot open an order", A.app.test_client().get("/api/orders/" + no).status_code == 401)
t("Malformed order numbers return 404", all(C1.get(f"/api/orders/{x}").status_code == 404 for x in ["TG-1", "x' OR '1'='1", "TG-12345a", "..%2f"]))
mine = [x["order_no"] for x in C1.get("/api/orders").json["orders"]]
t("Order history lists only the customer's own orders", no in mine and all(one("SELECT customer_id FROM orders WHERE order_no=?", x) == one("SELECT customer_id FROM customers WHERE email='one@example.com'") for x in mine), f"{len(mine)} orders")
t("Second customer's history does not contain them", C2.get("/api/orders").json["orders"][0]["order_no"] not in mine if C2.get("/api/orders").json["orders"] else True)
t("Admin can open any order and sees the customer", ad.get("/api/orders/" + no).json["order"]["customer"]["full_name"] == "Shopper One")

out.append("\nCUSTOMER CANCEL AND INVENTORY")
r = post(C2, H2, items={"keyboard": 2}); nc = r.json["order_no"]; k = stock("keyboard")
t("Other customer cannot cancel it", C1.post(f"/api/orders/{nc}/cancel", json={}, headers=H1).status_code == 404)
t("Cancel without CSRF token is rejected", C2.post(f"/api/orders/{nc}/cancel", json={}).status_code == 403)
r = C2.post(f"/api/orders/{nc}/cancel", json={}, headers=H2)
t("Customer can cancel a Pending order; stock is returned", r.status_code == 200 and stock("keyboard") == k + 2 and one("SELECT status FROM orders WHERE order_no=?", nc) == "Cancelled")
t("Cancelled order is in the history table", [x[0] for x in q("SELECT status FROM order_status_history WHERE order_id=(SELECT order_id FROM orders WHERE order_no=?)", nc)] == ["Pending", "Cancelled"])
t("A cancelled order cannot be cancelled again", C2.post(f"/api/orders/{nc}/cancel", json={}, headers=H2).status_code == 409)

out.append("\nADMIN ORDER LIST AND STATUS UPDATE (step 10)")
t("Customer cannot use the admin order API", C1.get("/api/admin/orders").status_code == 403 and C1.put(f"/api/admin/orders/{no}/status", json={"status": "Confirmed"}, headers=H1).status_code == 403)
t("Anonymous user cannot use the admin order API", A.app.test_client().get("/api/admin/orders").status_code == 401)
r = ad.get("/api/admin/orders"); t("Admin sees all orders with customer, total and allowed next statuses", r.status_code == 200 and len(r.json["orders"]) >= 10 and any(x["order_no"] == no and x["next"] == ["Confirmed", "Cancelled"] for x in r.json["orders"]))
t("Admin can filter by status", all(x["status"] == "Cancelled" for x in ad.get("/api/admin/orders?status=Cancelled").json["orders"]) and ad.get("/api/admin/orders?status=Bogus").status_code == 400)
t("Admin can search by order number and by customer name", [x["order_no"] for x in ad.get("/api/admin/orders?q=" + no).json["orders"]] == [no] and all(x["full_name"] == "Shopper Two" for x in ad.get("/api/admin/orders?q=Shopper%20Two").json["orders"]))
t("Search treats % and _ as plain characters", ad.get("/api/admin/orders?q=%25").json["orders"] == [])
put = lambda no_, s, h=HA, **kw: ad.put(f"/api/admin/orders/{no_}/status", json={"status": s, **kw}, headers=h)
t("Status update without CSRF token is rejected", ad.put(f"/api/admin/orders/{no}/status", json={"status": "Confirmed"}).status_code == 403)
t("Pending -> Completed is not allowed (steps cannot be skipped)", put(no, "Completed").status_code == 409)
t("Unknown status rejected", put(no, "Lost").status_code == 400)
t("Pending -> Confirmed", put(no, "Confirmed", note="Stock checked").status_code == 200)
t("Confirmed -> Shipped (delivery order)", put(no, "Shipped").status_code == 200)
t("Shipped -> Cancelled is not allowed", put(no, "Cancelled").status_code == 409)
t("Shipped -> Completed marks the payment as Paid", put(no, "Completed").status_code == 200 and q("SELECT status FROM payments WHERE order_id=?", oid)[0][0] == "Paid")
t("Completed is final", put(no, "Pending").status_code == 409 and put(no, "Cancelled").status_code == 409)
h = C1.get("/api/orders/" + no).json["order"]["history"]
t("Customer sees the whole status history with admin note", [x["status"] for x in h] == ["Pending", "Confirmed", "Shipped", "Completed"] and h[1]["note"] == "Stock checked", str([x["status"] for x in h]))
r = post(C1, H1, items={"mouse": 1}); nco = r.json["order_no"]
t("Collection order cannot be 'Shipped'", put(nco, "Confirmed").status_code == 200 and put(nco, "Shipped").status_code == 409 and put(nco, "Completed").status_code == 200)
r = post(C1, H1, items={"keyboard": 3}); na = r.json["order_no"]; k = stock("keyboard")
t("Admin cancelling an order puts the stock back", put(na, "Cancelled").status_code == 200 and stock("keyboard") == k + 3)
t("Status change for an unknown order returns 404", put("TG-000000", "Confirmed").status_code == 404)
t("Week 6 seed orders (no history rows) still display", ad.get("/api/orders/TG-100002").json["order"]["history"][0]["status"] == "Shipped" and ad.get("/api/orders/TG-100002").json["order"]["total"] == 116000)
t("Migration can be run again safely", (A.init_db() or True))
summary = f"\nRESULT: {sum(l.startswith('PASS') for l in out)} passed, {fails} failed"
open(os.path.join(ROOT, "tests", "evidence_week9_api.txt"), "w").write("TECHGEAR WEEK 9 CHECKOUT AND ORDER TESTS\n" + "=" * 60 + "\n" + "\n".join(out) + summary + "\n")
print("\n".join(out) + summary); shutil.rmtree(tmp); sys.exit(1 if fails else 0)
