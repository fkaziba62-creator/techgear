// End-to-end cart test: loads the real pages from the running server in jsdom.
// Needs: npm install jsdom.  Run: node tests/e2e_cart.js   (starts its own server on a temporary copy of the database)
const { spawn } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = path.dirname(__dirname), PORT = 5071, BASE = "http://127.0.0.1:" + PORT + "/";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tg-")), dbp = path.join(tmp, "t.db");
fs.copyFileSync(path.join(ROOT, "database", "techgear.db"), dbp);
const out = []; let fails = 0;
const t = (n, c, d = "") => { fails += !c; out.push((c ? "PASS  " : "FAIL  ") + n + (d ? "\n      -> " + d : "")); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms = 5000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (fn()) return true; } catch (e) {} await sleep(40); } return false; };
const open = async (page, cart) => {
  const dom = await JSDOM.fromURL(BASE + page, { runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    beforeParse(w) { w.fetch = (u, o) => fetch(new URL(u, BASE), o); if (cart) w.localStorage.setItem("techgearCart", JSON.stringify(cart)); } });
  await waitFor(() => dom.window.document.querySelector("#cartBox .cart-line, #cartBox .empty-cart, #checkoutSummary li, #checkoutSummary a, .grid .card"));
  return dom;
};
const $ = (d, s) => d.window.document.querySelector(s), $$ = (d, s) => [...d.window.document.querySelectorAll(s)];
const saved = d => JSON.parse(d.window.localStorage.getItem("techgearCart") || "{}");
const text = (d, s) => ($(d, s) || { textContent: "" }).textContent;
const price = (sku) => Number(require("child_process").execSync(`python3 -c "import sqlite3;print(sqlite3.connect('${dbp}').execute(\\"select price from products where sku='${sku}'\\").fetchone()[0])"`));
const stock = (sku) => Number(require("child_process").execSync(`python3 -c "import sqlite3;print(sqlite3.connect('${dbp}').execute(\\"select stock from products where sku='${sku}'\\").fetchone()[0])"`));
const fmt = n => "UGX " + n.toLocaleString("en-US");

(async () => {
  const srv = spawn("python3", [path.join(ROOT, "server", "app.py")], { env: { ...process.env, TECHGEAR_DB: dbp, PORT: String(PORT) }, stdio: "ignore" });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(BASE + "api/session"); break; } catch (e) { await sleep(100); } }
    const kb = price("keyboard"), ms = price("mouse"), mouseStock = stock("mouse");

    out.push("ADD FROM LISTING AND DETAILS PAGES");
    let d = await open("products.html");
    const addBtn = $$(d, ".add").find(b => b.dataset.id === "mouse"); addBtn.click();
    t("Add to cart from the product listing", saved(d).mouse === 1 && text(d, "#cartCount") === "1", JSON.stringify(saved(d)));
    addBtn.click(); t("Adding again increases quantity; header badge updates", saved(d).mouse === 2 && text(d, "#cartCount") === "2");
    const oos = $$(d, ".add").find(b => b.dataset.id === "backpack"); t("Out-of-stock product has a disabled button on the listing", oos.disabled);
    d.window.close();
    d = await open("product.html?id=router"); $(d, "#qty").value = "3"; $(d, "#addDetail").click();
    t("Add with a chosen quantity from the details page", saved(d).router === 3, text(d, "#addMsg"));
    $(d, "#qty").value = "abc"; $(d, "#addDetail").click(); t("Invalid quantity on details page is rejected with a message", saved(d).router === 3 && /whole number/.test(text(d, "#addMsg")));
    d.window.close();

    out.push("\nCART PAGE: DISPLAY, TOTALS, UPDATE");
    d = await open("cart.html", { keyboard: 2, mouse: 1 });
    t("Shows every selected product", $$(d, ".cart-line").length === 2);
    t("Shows unit price and line subtotal (database prices)", text(d, ".cart-line").includes(fmt(kb) + " each") && text(d, ".cart-line .line-total") === fmt(2 * kb), `keyboard ${fmt(kb)} x 2`);
    t("Cart subtotal is correct", text(d, "#cartSubtotal") === fmt(2 * kb + ms), text(d, "#cartSubtotal"));
    $$(d, ".cart-line")[1].querySelector("[data-act=inc]").click();
    t("+ button updates quantity, line total, subtotal and storage", saved(d).mouse === 2 && text(d, "#cartSubtotal") === fmt(2 * kb + 2 * ms) && text(d, "#cartCount") === "4");
    $$(d, ".cart-line")[1].querySelector("[data-act=dec]").click(); t("- button decreases quantity", saved(d).mouse === 1);
    t("- button is disabled at quantity 1", $$(d, ".cart-line")[1].querySelector("[data-act=dec]").disabled);
    let inp = () => $$(d, ".cart-line")[1].querySelector("input");
    for (const bad of ["0", "-3", "abc", "2.5", ""]) { inp().value = bad; inp().dispatchEvent(new d.window.Event("change", { bubbles: true })); t(`Typed quantity ${JSON.stringify(bad)} is rejected, old quantity kept`, saved(d).mouse === 1 && inp().value === "1" && /whole number/.test(text(d, "#cartNotice"))); }
    inp().value = "500"; inp().dispatchEvent(new d.window.Event("change", { bubbles: true }));
    t("Typing more than the stock limits quantity to stock and explains why", saved(d).mouse === Math.min(99, mouseStock) && /available/.test(text(d, "#cartNotice")), text(d, "#cartNotice"));
    t("Proceed to Checkout leads to the checkout page", $(d, "#proceedBtn").getAttribute("href") === "checkout.html");
    const keep = saved(d); d.window.close();

    out.push("\nSTATE SURVIVES REFRESH / NAVIGATION");
    d = await open("cart.html", keep); t("Reloading the cart page shows the same items and subtotal", $$(d, ".cart-line").length === 2 && text(d, "#cartSubtotal") === fmt(2 * kb + keep.mouse * ms));
    d.window.close(); d = await open("index.html", keep); t("Header badge on another page shows the cart count", text(d, "#cartCount") === String(2 + keep.mouse)); d.window.close();

    out.push("\nREMOVE AND CLEAR");
    d = await open("cart.html", { keyboard: 2, mouse: 1 });
    $$(d, ".cart-line")[0].querySelector("[data-act=remove]").click();
    t("Remove deletes one item only", $$(d, ".cart-line").length === 1 && !("keyboard" in saved(d)) && saved(d).mouse === 1 && /removed/.test(text(d, "#cartNotice")));
    $(d, "#clearBtn").click(); t("Clear needs a second click (no accidental clearing)", saved(d).mouse === 1 && /Click again/.test(text(d, "#clearBtn")));
    $(d, "#clearBtn").click();
    t("Second click clears the whole cart", JSON.stringify(saved(d)) === "{}" && text(d, "#cartCount") === "0");
    t("Helpful empty-cart message with a link to browse products", /Your cart is empty/.test(text(d, ".empty-cart")) && $(d, ".empty-cart a").getAttribute("href") === "products.html");
    d.window.close();
    d = await open("cart.html"); t("Empty cart on first visit shows the same message", !!$(d, ".empty-cart")); d.window.close();

    out.push("\nUNAVAILABLE PRODUCTS AND CHANGED STOCK");
    d = await open("cart.html", { mouse: 1, backpack: 2, ghost: 1 });
    t("Out-of-stock and unknown items are flagged", $$(d, ".cart-line.unavailable").length === 2 && /Out of stock/.test(text(d, ".cart-line.unavailable")) && /No longer sold/.test(text(d, "#cartBox")));
    t("Unavailable items are excluded from the subtotal", text(d, "#cartSubtotal") === fmt(ms));
    t("Proceed to Checkout is disabled until they are removed", $(d, "#proceedBtn").disabled && /Remove unavailable/.test(text(d, ".form-error")));
    $(d, "[data-act=removebad]").click(); t("'Remove unavailable items' fixes the cart", $$(d, ".cart-line").length === 1 && !$(d, "#proceedBtn").disabled && JSON.stringify(saved(d)) === JSON.stringify({ mouse: 1 }));
    d.window.close();
    d = await open("cart.html", { adapter: 50 }); const as = stock("wifiadapter");
    d.window.close(); d = await open("cart.html", { wifiadapter: 50 });
    t("Quantity above current stock is reduced automatically with a notice", saved(d).wifiadapter === as && /reduced to/.test(text(d, "#cartNotice")), text(d, "#cartNotice")); d.window.close();
    d = await open("cart.html", { "bad key!": 3, mouse: "x" }); t("Garbage in storage does not break the page", !!$(d, ".empty-cart")); d.window.close();

    out.push("\nPROCEED TO CHECKOUT (the checkout itself is tested in e2e_checkout.js)");
    d = await open("cart.html", { keyboard: 1 }); t("Cart links to checkout.html", $(d, "#proceedBtn").getAttribute("href") === "checkout.html"); d.window.close();
  } catch (e) { t("Test run completed without errors", false, e.stack); }
  srv.kill();
  const summary = "\nRESULT: " + out.filter(l => l.startsWith("PASS")).length + " passed, " + fails + " failed";
  fs.writeFileSync(path.join(__dirname, "evidence_week8_e2e.txt"), "TECHGEAR WEEK 8 CART END-TO-END TESTS (real pages in jsdom against the running server)\n" + "=".repeat(60) + "\n" + out.join("\n") + summary + "\n");
  console.log(out.join("\n") + summary); process.exit(fails ? 1 : 0);
})();
