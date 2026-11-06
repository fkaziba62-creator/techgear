"""Builds techgear.db from the SQL scripts and writes evidence.txt (run: python3 run_demo.py)."""
import sqlite3, os, re
here = os.path.dirname(os.path.abspath(__file__))
db = os.path.join(here, "techgear.db")
if os.path.exists(db): os.remove(db)
con = sqlite3.connect(db); con.isolation_level = None
con.execute("PRAGMA foreign_keys = ON")
out = []
def table(cur):
    if cur.description is None: return f"OK ({cur.rowcount} row(s) affected)" if cur.rowcount >= 0 else "OK"
    cols = [d[0] for d in cur.description]; rows = [["NULL" if v is None else str(v) for v in r] for r in cur.fetchall()]
    w = [max(len(c), *(len(r[i]) for r in rows)) if rows else len(c) for i, c in enumerate(cols)]
    line = lambda r: " | ".join(x.ljust(w[i]) for i, x in enumerate(r))
    return "\n".join([line(cols), "-+-".join("-" * x for x in w)] + [line(r) for r in rows] + [f"({len(rows)} row(s))"])
def run(script):
    for stmt in re.findall(r"[^;]+;", script, flags=re.S):
        if stmt.strip(): con.execute(stmt)
con.executescript(open(os.path.join(here, "schema.sql")).read())
con.executescript(open(os.path.join(here, "seed.sql")).read())
out.append("TECHGEAR DATABASE EVIDENCE\n" + "=" * 60)
out.append("\n[Setup] Row counts after schema.sql + seed.sql")
for t in ["categories", "products", "customers", "orders", "order_items", "payments"]:
    out.append(f"  {t:<12}{con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]}")
out.append("\n[Setup] Tables: " + ", ".join(r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")))
out.append("[Setup] Foreign keys on orders: " + str([(r[2], r[3], r[4]) for r in con.execute("PRAGMA foreign_key_list(orders)")]))
for block in re.split(r"^--@ ", open(os.path.join(here, "crud.sql")).read(), flags=re.M)[1:]:
    title, _, sql = block.partition("\n")
    sql = "\n".join(l for l in sql.split("\n") if not l.startswith("-- ====="))
    out.append(f"\n[{title}]\n{sql.strip()}\n>>> RESULT")
    for stmt in re.findall(r"[^;]+;", sql, flags=re.S):
        if stmt.strip(): out.append(table(con.execute(stmt)))
out.append("\n" + "=" * 60 + "\nCONSTRAINT TESTS (each statement must be rejected)")
tests = [("Negative stock", "UPDATE products SET stock=-1 WHERE sku='mouse'"),
 ("Duplicate SKU", "INSERT INTO products (sku,name,price,stock,category_id) VALUES ('mouse','Dup',1,1,1)"),
 ("Product with missing category (FK)", "INSERT INTO products (sku,name,price,stock,category_id) VALUES ('x','X',1,1,999)"),
 ("Order for missing customer (FK)", "INSERT INTO orders (order_no,customer_id,delivery_method) VALUES ('TG-9',999,'collection')"),
 ("Invalid order status (CHECK)", "UPDATE orders SET status='Lost' WHERE order_no='TG-100001'"),
 ("Delete category that still has products (RESTRICT)", "DELETE FROM categories WHERE name='Audio'"),
 ("Delete a product that was sold (RESTRICT)", "DELETE FROM products WHERE sku='keyboard'")]
for name, sql in tests:
    try: con.execute(sql); out.append(f"FAIL  {name}: was accepted!")
    except sqlite3.Error as e: out.append(f"PASS  {name}\n      -> {e}")
open(os.path.join(here, "evidence.txt"), "w").write("\n".join(out) + "\n")
con.close(); print("\n".join(out))
