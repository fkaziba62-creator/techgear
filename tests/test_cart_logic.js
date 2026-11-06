// Unit tests for js/cart.js (no browser needed). Run: node tests/test_cart_logic.js
const fs = require("fs"), path = require("path");
const mem = {}; global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
global.PRODUCTS = { mouse: { name: "Wireless Mouse", price: 25000, stock: 40, image: "mouse.jpg", cat: "Input devices" },
  router: { name: "Wi-Fi Router", price: 120000, stock: 10, image: "router.jpg", cat: "Networking" },
  adapter: { name: "USB Wi-Fi Adapter", price: 30000, stock: 3, image: "a.jpg", cat: "Networking" },
  backpack: { name: "Laptop Backpack", price: 85000, stock: 0, image: "b.jpg", cat: "Bags" } };
const C = require("../js/cart.js"); const out = []; let fails = 0;
const t = (name, cond, d = "") => { fails += !cond; out.push((cond ? "PASS  " : "FAIL  ") + name + (d ? "\n      -> " + d : "")); };
const reset = () => { for (const k in mem) delete mem[k]; };
const J = o => JSON.stringify(o);

out.push("ADD, UPDATE, REMOVE, CLEAR");
let r = C.add("mouse"); t("Add a product", r.ok && C.load().mouse === 1, J(C.load()));
C.add("mouse", 2); t("Adding again increases the quantity", C.load().mouse === 3);
t("Cart item count is the sum of quantities", C.count() === 3);
r = C.add("backpack"); t("Out-of-stock product cannot be added", !r.ok && r.reason === "out" && !("backpack" in C.load()));
r = C.add("ghost"); t("Unknown product cannot be added", !r.ok && r.reason === "unknown");
r = C.add("mouse", 0); t("Quantity 0 is invalid", !r.ok && r.reason === "invalid");
r = C.add("mouse", -2); t("Negative quantity is invalid", !r.ok);
r = C.add("mouse", 1.5); t("Decimal quantity is invalid", !r.ok);
r = C.add("adapter", 10); t("Adding more than stock is limited to stock", r.ok && r.capped && C.load().adapter === 3, "limit " + r.limit);
r = C.add("adapter"); t("Adding when all stock is already in the cart is refused", !r.ok && r.reason === "max");
r = C.setQty("mouse", "7", 40); t("Update quantity", r.ok && C.load().mouse === 7);
for (const bad of ["0", "-1", "abc", "", "2.5", "1e2", " "]) t("Invalid quantity input rejected: " + J(bad), !C.setQty("mouse", bad, 40).ok && C.load().mouse === 7);
r = C.setQty("mouse", "500", 40); t("Quantity above stock is capped to stock", r.ok && r.capped && C.load().mouse === 40);
r = C.setQty("mouse", "250", 1000); t("Quantity is never above 99", C.load().mouse === 99);
r = C.setQty("router", "2", 10); t("Cannot set quantity for an item not in the cart", !r.ok && r.reason === "missing");
C.remove("mouse"); t("Remove one item leaves the others", !("mouse" in C.load()) && "adapter" in C.load());
C.clear(); t("Clear empties the cart", C.count() === 0 && J(C.load()) === "{}");

out.push("\nSTATE AND CORRUPTED DATA");
reset(); C.add("router", 2); t("State is stored in localStorage (survives refresh and page changes)", J(JSON.parse(mem[C.KEY])) === J({ router: 2 }), mem[C.KEY]);
mem[C.KEY] = "not json{"; t("Corrupted storage gives an empty cart instead of an error", J(C.load()) === "{}");
mem[C.KEY] = J({ router: "3", mouse: -4, bad: 1.5, "a b": 2, x: 9999, ok: [1] }); t("Invalid saved entries are dropped, big quantities capped", J(C.load()) === J({ router: 3, x: 99 }), J(C.load()));
mem[C.KEY] = J([1, 2, 3]); t("Array instead of object is ignored", J(C.load()) === "{}");

out.push("\nTOTALS");
const L = (qty, price, stock, found = true) => ({ qty, price, stock, found, available: found && stock > 0 });
let tt = C.totals([L(2, 25000, 40), L(1, 120000, 10)]); t("Subtotal = sum of unit price x quantity", tt.subtotal === 170000 && tt.items === 3, J(tt));
tt = C.totals([L(2, 25000, 40), L(1, 85000, 0)]); t("Unavailable items are not counted", tt.subtotal === 50000 && tt.items === 2);
tt = C.totals([L(5, 30000, 3)]); t("Quantity above stock is counted only up to stock", tt.subtotal === 90000 && tt.items === 3);
tt = C.totals([{ qty: 1, found: false, available: false }]); t("Unknown product gives 0, not NaN", tt.subtotal === 0 && !Number.isNaN(tt.subtotal));
t("Empty cart totals 0", C.totals([]).subtotal === 0);
t("Money format", C.money(1234567) === "UGX 1,234,567");
const summary = "\nRESULT: " + out.filter(l => l.startsWith("PASS")).length + " passed, " + fails + " failed";
fs.writeFileSync(path.join(__dirname, "evidence_week8_logic.txt"), "TECHGEAR WEEK 8 CART LOGIC TESTS\n" + "=".repeat(60) + "\n" + out.join("\n") + summary + "\n");
console.log(out.join("\n") + summary); process.exit(fails ? 1 : 0);
