// Week 9 end-to-end journey: cart -> checkout -> confirmation -> history -> admin status update, using the real pages in jsdom.
// Needs: npm install jsdom.  Run: node tests/e2e_checkout.js   (own server + temporary database copy; saves page snapshots, then PNG screenshots)
const { spawn, execFileSync } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = path.dirname(__dirname), PORT = 5072, BASE = "http://127.0.0.1:" + PORT + "/";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tg9-")), dbp = path.join(tmp, "t.db"); fs.copyFileSync(path.join(ROOT, "database", "techgear.db"), dbp);
const SHOTS = path.join(__dirname, "screenshots", "html"); fs.mkdirSync(SHOTS, { recursive: true }); for (const f of fs.readdirSync(SHOTS)) fs.unlinkSync(path.join(SHOTS, f));
const CSS = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
const out = []; let fails = 0;
const t = (n, c, d = "") => { fails += !c; out.push((c ? "PASS  " : "FAIL  ") + n + (d ? "\n      -> " + d : "")); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms = 6000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (fn()) return true; } catch (e) {} await sleep(40); } return false; };
const py = (code, ...args) => execFileSync("python3", ["-c", code, dbp, ...args]).toString().trim();
const sqlOne = (q) => py("import sqlite3,sys;r=sqlite3.connect(sys.argv[1]).execute(sys.argv[2]).fetchone();print(r[0] if r else '')", q);
const sqlRun = (q) => py("import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute(sys.argv[2]);c.commit()", q);
const fmt = n => "UGX " + Number(n).toLocaleString("en-US");
const newJar = () => new Map();
const mkFetch = jar => async (u, o = {}) => {
  const headers = new Headers(o.headers || {}); if (jar.size) headers.set("Cookie", [...jar].map(([k, v]) => k + "=" + v).join("; "));
  const res = await fetch(new URL(u, BASE), { ...o, headers, redirect: "manual" });
  for (const c of res.headers.getSetCookie()) { const kv = c.split(";")[0], i = kv.indexOf("="), k = kv.slice(0, i), v = kv.slice(i + 1); if (!v || /Max-Age=0/i.test(c)) jar.delete(k); else jar.set(k, v); }
  return res;
};
const api = async (jar, method, p, body, csrf) => { const r = await mkFetch(jar)(p, { method, headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const open = async (jar, page, cart, ready) => {
  const dom = await JSDOM.fromURL(BASE + page, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    beforeParse(w) { w.fetch = mkFetch(jar); if (cart) w.localStorage.setItem("techgearCart", JSON.stringify(cart)); } });
  await waitFor(() => dom.window.TGAuth && dom.window.TGAuth.ready); await dom.window.eval("TGAuth.ready");
  if (ready) await waitFor(() => ready(dom)); return dom;
};
const $ = (d, s) => d.window.document.querySelector(s), $$ = (d, s) => [...d.window.document.querySelectorAll(s)];
const text = (d, s) => ($(d, s) || { textContent: "" }).textContent.replace(/\s+/g, " ").trim();
const cartOf = d => JSON.parse(d.window.localStorage.getItem("techgearCart") || "{}");
const SNAP_CSS = ".brand img{width:36px!important;height:36px!important}input[type=radio]{display:inline-block;width:13px!important;height:13px!important;border-radius:50%;padding:0;margin-right:6px;vertical-align:middle}input[type=radio][checked]{background:#0f5c5c;border-color:#0f5c5c}.radio{display:block}";
const shot = (d, name) => {            // save the rendered page (with typed values) as a self-contained HTML snapshot
  d.window.document.querySelectorAll("input, textarea").forEach(e => { if (e.type === "radio" || e.type === "checkbox") e.toggleAttribute("checked", e.checked); else if (e.tagName === "TEXTAREA") e.textContent = e.value; else e.setAttribute("value", e.value); });
  let h = d.serialize().replace(/<script[\s\S]*?<\/script>/g, "").replace(/<link rel="stylesheet"[^>]*>/, "<style>" + CSS + SNAP_CSS + "</style>").replace("<head>", '<head><base href="../../../">');
  fs.writeFileSync(path.join(SHOTS, name + ".html"), h);
};
const fill = (d, id, v) => { $(d, "#" + id).value = v; };

(async () => {
  const srv = spawn("python3", [path.join(ROOT, "server", "app.py")], { env: { ...process.env, TECHGEAR_DB: dbp, PORT: String(PORT), ADMIN_EMAIL: "admin@techgear.example", ADMIN_PASSWORD: "Admin-pass-2026" }, stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(BASE + "api/session"); break; } catch (e) { await sleep(100); } }
    const kb = Number(sqlOne("select price from products where sku='keyboard'")), ms = Number(sqlOne("select price from products where sku='mouse'"));
    const jarA = newJar(), jarB = newJar(), jarAdmin = newJar(), jarGuest = newJar();
    await api(jarA, "POST", "/api/register", { full_name: "Grace Nuwagaba", email: "grace@example.com", phone: "0772300999", password: "Strong-pass-1" });
    await api(jarB, "POST", "/api/register", { full_name: "Peter Tumusiime", email: "peter2@example.com", phone: "0701555999", password: "Strong-pass-2" });
    await api(jarAdmin, "POST", "/api/login", { email: "admin@techgear.example", password: "Admin-pass-2026" });
    const cart = { keyboard: 1, mouse: 2 };

    out.push("CHECKOUT PAGE");
    let d = await open(jarGuest, "checkout.html", cart, x => $(x, "#checkoutGate a"));
    t("Guest is asked to log in or register; cart is kept", /log in or create an account/i.test(text(d, "#checkoutGate")) && !!$(d, "#checkoutGate a[href^='login.html']") && cartOf(d).mouse === 2); shot(d, "02_checkout_login_required"); d.window.close();
    d = await open(jarA, "cart.html", cart, x => $(x, ".cart-line")); shot(d, "01_cart"); d.window.close();
    d = await open(jarA, "checkout.html", cart, x => !$(x, "#checkoutBody").hidden);
    t("Logged-in customer sees the checkout form, prefilled with account details", $(d, "#coName").value === "Grace Nuwagaba" && $(d, "#coPhone").value === "0772300999");
    t("Order summary lists items, quantities, unit prices and line totals", $$(d, ".sum-line").length === 2 && text(d, "#summaryLines").includes("Wireless Mouse x 2 @ " + fmt(ms)) && text(d, "#summaryLines").includes(fmt(2 * ms)));
    t("Collection: delivery fee is free and total = subtotal", text(d, "#sumFee").startsWith("Free") && text(d, "#sumTotal") === fmt(kb + 2 * ms) && $(d, "#deliveryFields").hidden);
    $(d, "input[value=delivery]").click();
    t("Choosing delivery shows address fields, adds the fee and changes payment options", !$(d, "#deliveryFields").hidden && text(d, "#sumTotal") === fmt(kb + 2 * ms + 5000) && /Cash on delivery/.test(text(d, "#payOptions")) && !/Cash at shop/.test(text(d, "#payOptions")));
    shot(d, "03_checkout_form");
    fill(d, "coPhone", "abc"); $(d, "#placeOrder").click(); await waitFor(() => /highlighted/.test(text(d, "#checkoutError")));
    const fe = n => text(d, `[data-err=${n}]`);
    t("Server validation errors appear next to the fields (phone, address, district)", fe("recipient_phone") !== "" && fe("delivery_address") !== "" && fe("delivery_district") !== "", `${fe("recipient_phone")} | ${fe("delivery_address")}`);
    t("Nothing was ordered and the cart is untouched", sqlOne("select count(*) from orders where recipient_name is not null") === "0" && cartOf(d).mouse === 2); shot(d, "04_checkout_validation_errors");
    fill(d, "coPhone", "0772 300 999"); fill(d, "coAddress", "Bushenyi University, Hall 3"); fill(d, "coDistrict", "Bushenyi"); fill(d, "coNotes", "Call on arrival");
    sqlRun("update products set stock=1 where sku='mouse'");
    $(d, "#placeOrder").click(); await waitFor(() => /only 1 left/.test(text(d, "#checkoutError")));
    t("Insufficient stock: order refused, problem item named, link back to cart", /Wireless Mouse: only 1 left/.test(text(d, "#checkoutError")) && !!$(d, "#checkoutError a[href='cart.html']") && cartOf(d).mouse === 2 && !$(d, "#placeOrder").disabled, text(d, "#checkoutError") + " | " + $$(d, "[data-err]").map(e => e.dataset.err + "=" + e.textContent).filter(x => !x.endsWith("=")).join("; ")); shot(d, "05_checkout_insufficient_stock");
    sqlRun("update products set stock=40 where sku='mouse'"); sqlRun("update products set price=price+1000 where sku='keyboard'");
    $(d, "#placeOrder").click(); await waitFor(() => /Prices changed/.test(text(d, "#checkoutError")));
    t("Price changed in the database: customer is told and the summary shows the new total", /Prices changed/.test(text(d, "#checkoutError")) && text(d, "#sumTotal") === fmt(kb + 1000 + 2 * ms + 5000), text(d, "#sumTotal"));
    t("Still no order created", sqlOne("select count(*) from orders where recipient_name is not null") === "0");
    $(d, "#placeOrder").click(); $(d, "#placeOrder").click();      // double click
    await waitFor(() => /placed/.test(text(d, "#orderMsg")));
    const link = $(d, "#orderMsg a").getAttribute("href"), no = new URLSearchParams(link.split("?")[1]).get("no");
    t("Order is placed and a confirmation link with the order number is shown", /^TG-\d{6}$/.test(no), no);
    t("Double click created exactly one order", sqlOne("select count(*) from orders where recipient_name is not null") === "1");
    t("Cart is emptied after the order", JSON.stringify(cartOf(d)) === "{}");
    const total = kb + 1000 + 2 * ms + 5000;
    t("Database: order, items, payment and history rows exist; stock reduced once", sqlOne(`select count(*) from order_items where order_id=(select order_id from orders where order_no='${no}')`) === "2" && sqlOne(`select amount from payments where order_id=(select order_id from orders where order_no='${no}')`) === String(total) && sqlOne("select stock from products where sku='mouse'") === "38");
    d.window.close();

    out.push("\nCONFIRMATION, HISTORY, PRIVACY");
    d = await open(jarA, "order.html?no=" + no + "&placed=1", null, x => $(x, "#orderTotal"));
    t("Confirmation page thanks the customer and shows the order number", /Thank you/.test(text(d, ".confirm-banner h1")) && text(d, ".order-no") === no);
    t("Confirmation shows accurate items, delivery details and total", $$(d, "#orderBox tbody tr").length === 2 && text(d, "#orderBox").includes("Bushenyi University, Hall 3, Bushenyi") && text(d, "#orderBox").includes("Call on arrival") && text(d, "#orderTotal") === fmt(total) && /Pending/.test(text(d, ".badge")));
    t("Cancel button is offered while the order is Pending", !!$(d, "#cancelOrder")); shot(d, "06_confirmation"); d.window.close();
    d = await open(jarA, "orders.html", null, x => $(x, "#historyBox table"));
    t("Order history lists the order with status and total", text(d, "#historyBox tbody").includes(no) && text(d, "#historyBox tbody").includes(fmt(total)) && $$(d, "#historyBox tbody tr").length === 1); shot(d, "07_order_history"); d.window.close();
    d = await open(jarB, "order.html?no=" + no, null, x => text(x, "#orderBox") !== "Loading your order...");
    t("Another customer cannot open this order", /Order not found/.test(text(d, "#orderBox")) && !/Bushenyi/.test(d.serialize())); shot(d, "12_other_customer_cannot_see_order"); d.window.close();
    d = await open(jarB, "orders.html", null, x => $(x, "#historyBox .empty-cart, #historyBox table"));
    t("Other customer's history is empty (shows only their own orders)", /no orders yet/.test(text(d, "#historyBox"))); d.window.close();
    d = await open(jarGuest, "orders.html"); await sleep(300); t("Guest is not shown any orders", !$(d, "#historyBox table")); d.window.close();
    d = await open(jarA, "checkout.html", {}, x => /empty/.test(text(x, "#checkoutGate")));
    t("Checkout with an empty cart explains and links to products", /cart is empty/i.test(text(d, "#checkoutGate")) && !!$(d, "#checkoutGate a[href='products.html']")); shot(d, "11_checkout_empty_cart"); d.window.close();

    out.push("\nADMIN ORDER LIST AND STATUS UPDATE");
    d = await open(jarB, "admin-orders.html"); await sleep(500); t("Customer cannot use the admin order page", /Admins only/.test(text(d, "#adminMsg")) && $$(d, "#orderTable tbody tr").length === 0); d.window.close();
    d = await open(jarAdmin, "admin-orders.html", null, x => $$(x, "#orderTable tbody tr").length > 0);
    t("Admin sees the orders including the new one", $$(d, "#orderTable tbody tr").length >= 5 && text(d, "#orderTable tbody").includes(no));
    $(d, "#adminQ").value = no; $(d, "#adminSearch").click(); await waitFor(() => $$(d, "#orderTable tbody tr").length === 1);
    t("Admin can search by order number", $$(d, "#orderTable tbody tr").length === 1 && /Grace Nuwagaba/.test(text(d, "#orderTable tbody"))); shot(d, "08_admin_orders");
    const row = $(d, "#orderTable tbody tr"), sel = row.querySelector("select");
    t("Only valid next statuses are offered (Confirmed, Cancelled)", [...sel.options].map(o => o.text).join() === "Confirmed,Cancelled");
    sel.value = "Confirmed"; row.querySelector("button").click(); await waitFor(() => /is now Confirmed/.test(text(d, "#adminMsg")) && /Confirmed/.test(text(d, "#orderTable tbody .badge")));
    t("Admin updates the status; the list refreshes", /Confirmed/.test(text(d, "#orderTable tbody .badge")) && sqlOne(`select status from orders where order_no='${no}'`) === "Confirmed" && [...$(d, "#orderTable tbody select").options].map(o => o.text).join() === "Shipped,Completed,Cancelled"); shot(d, "09_admin_status_updated"); d.window.close();
    d = await open(jarA, "order.html?no=" + no, null, x => $(x, "#orderTotal"));
    t("Customer sees the new status and the status history", /Confirmed/.test(text(d, ".badge")) && $$(d, ".timeline li").length === 2 && !$(d, "#cancelOrder"), text(d, ".timeline")); shot(d, "10_order_status_history"); d.window.close();

    out.push("\nCUSTOMER CANCELS A PENDING ORDER");
    const o2 = await api(jarA, "POST", "/api/orders", { items: { keyboard: 2 }, recipient_name: "Grace", recipient_phone: "0772300999", delivery_method: "collection", payment_method: "Cash at shop" }, (await api(jarA, "GET", "/api/session")).data.csrf);
    const kbStock = Number(sqlOne("select stock from products where sku='keyboard'"));
    d = await open(jarA, "order.html?no=" + o2.data.order_no, null, x => $(x, "#cancelOrder")); $(d, "#cancelOrder").click(); await sleep(600);
    t("Cancelling puts the stock back and marks the order Cancelled", sqlOne(`select status from orders where order_no='${o2.data.order_no}'`) === "Cancelled" && Number(sqlOne("select stock from products where sku='keyboard'")) === kbStock + 2); d.window.close();
  } catch (e) { t("Test run completed without errors", false, e.stack); }
  srv.kill();
  const summary = "\nRESULT: " + out.filter(l => l.startsWith("PASS")).length + " passed, " + fails + " failed";
  fs.writeFileSync(path.join(__dirname, "evidence_week9_e2e.txt"), "TECHGEAR WEEK 9 END-TO-END JOURNEY (real pages in jsdom against the running server)\n" + "=".repeat(60) + "\n" + out.join("\n") + summary + "\n");
  console.log(out.join("\n") + summary);
  try { console.log(execFileSync("python3", [path.join(__dirname, "render_screenshots.py")]).toString()); } catch (e) { console.log("Screenshot rendering skipped:", String(e.message).slice(0, 200)); }
  process.exit(fails ? 1 : 0);
})();
