"""Week 8: /api/cart/validate reads prices and stock from the database. Run: python3 tests/test_cart_api.py"""
import os, sys, shutil, tempfile, sqlite3
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp(); dbp = os.path.join(tmp, "t.db"); shutil.copy(os.path.join(ROOT, "database", "techgear.db"), dbp)
os.environ["TECHGEAR_DB"] = dbp; sys.path.insert(0, os.path.join(ROOT, "server")); import app as A
cl = A.app.test_client(); out = []; fails = 0
def t(n, c, d=""):
    global fails; fails += (not c); out.append(("PASS  " if c else "FAIL  ") + n + (f"\n      -> {d}" if d else ""))
db = sqlite3.connect(dbp)
r = cl.post("/api/cart/validate", json={"items": {"keyboard": 2, "mouse": 1, "backpack": 1, "ghost": 1}})
L = {l["sku"]: l for l in r.json["lines"]}
t("Works without logging in (guest carts)", r.status_code == 200)
t("Price comes from the database, not from the browser", L["keyboard"]["price"] == db.execute("SELECT price FROM products WHERE sku='keyboard'").fetchone()[0], f"keyboard = {L['keyboard']['price']}")
t("Stock comes from the database", L["mouse"]["stock"] == db.execute("SELECT stock FROM products WHERE sku='mouse'").fetchone()[0])
t("Out-of-stock product is reported with stock 0", L["backpack"]["found"] and L["backpack"]["stock"] == 0)
t("Unknown product is reported as not found", L["ghost"]["found"] is False)
db.execute("UPDATE products SET price=99000, stock=1 WHERE sku='mouse'"); db.commit()
L = {l["sku"]: l for l in cl.post("/api/cart/validate", json={"items": {"mouse": 5}}).json["lines"]}
t("A price/stock change in the database shows up immediately", L["mouse"]["price"] == 99000 and L["mouse"]["stock"] == 1)
t("SQL injection in a product code is harmless", cl.post("/api/cart/validate", json={"items": {"x' OR '1'='1": 1}}).json["lines"][0]["found"] is False)
t("Invalid payload rejected", cl.post("/api/cart/validate", json={"items": [1, 2]}).status_code == 400)
t("Too many items rejected", cl.post("/api/cart/validate", json={"items": {f"p{i}": 1 for i in range(51)}}).status_code == 400)
t("Non-JSON request rejected", cl.post("/api/cart/validate", data="items=1").status_code == 415)
t("Response is not cached", "no-store" in cl.post("/api/cart/validate", json={"items": {"mouse": 1}}).headers["Cache-Control"])
t("New pages are served", all(cl.get(p).status_code == 200 for p in ("/cart.html", "/checkout.html", "/js/cart.js", "/js/checkout.js")))
import re, json, subprocess
prod = json.loads(subprocess.check_output(["node", "-e", "const fs=require('fs');eval(fs.readFileSync(process.argv[1],'utf8')+';console.log(JSON.stringify(PRODUCTS))')", os.path.join(ROOT, "js", "products.js")]))
pristine = sqlite3.connect(os.path.join(ROOT, "database", "techgear.db"))
mism = [(s, p["price"], p["stock"]) for s, pr, st in pristine.execute("SELECT sku,price,stock FROM products") for p in [prod[s]] if (p["price"], p["stock"]) != (pr, st)]
t("Catalogue file (js/products.js) matches the database on price and stock for all products", not mism and len(prod) == pristine.execute("SELECT COUNT(*) FROM products").fetchone()[0], str(mism))
summary = f"\nRESULT: {sum(l.startswith('PASS') for l in out)} passed, {fails} failed"
open(os.path.join(ROOT, "tests", "evidence_week8_api.txt"), "w").write("TECHGEAR WEEK 8 CART API TESTS\n" + "=" * 60 + "\n" + "\n".join(out) + summary + "\n")
print("\n".join(out) + summary); shutil.rmtree(tmp); sys.exit(1 if fails else 0)
