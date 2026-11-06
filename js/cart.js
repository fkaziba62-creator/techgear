// TechGear Week 8: shopping cart.
// Approach: the cart is kept in localStorage as {sku: quantity}, so it survives page changes and refreshes.
// Prices and stock are re-checked against the database via /api/cart/validate (falls back to js/products.js offline).
const TGCart = (() => {
  const KEY = "techgearCart", MAX = 99;
  const money = n => "UGX " + Number(n).toLocaleString("en-US");
  const store = () => { try { return localStorage; } catch (e) { return null; } };
  const clean = o => {                       // keep only valid {sku: whole number 1..99}
    const out = {};
    if (o && typeof o === "object" && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) {
      const q = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;   // numbers or digit strings only
      if (/^[a-z0-9]{1,40}$/i.test(k) && Number.isInteger(q) && q > 0) out[k] = Math.min(q, MAX);
    }
    return out;
  };
  const load = () => { try { return clean(JSON.parse(store().getItem(KEY))); } catch (e) { return {}; } };
  const count = () => Object.values(load()).reduce((a, b) => a + b, 0);
  const updateCount = () => {
    if (typeof document === "undefined") return;
    const b = document.getElementById("cartCount"); if (b) b.textContent = count();
  };
  const save = c => { try { store().setItem(KEY, JSON.stringify(clean(c))); } catch (e) {} updateCount(); };

  // ----- cart actions -----
  const add = (id, qty = 1) => {
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: "invalid" };
    const p = typeof PRODUCTS !== "undefined" ? PRODUCTS[id] : null;
    if (!p) return { ok: false, reason: "unknown" };
    if (p.stock <= 0) return { ok: false, reason: "out" };
    const cart = load(), have = cart[id] || 0, limit = Math.min(p.stock, MAX);
    if (have >= limit) return { ok: false, reason: "max", qty: have, limit };
    const q = Math.min(limit, have + qty);
    cart[id] = q; save(cart);
    return { ok: true, qty: q, limit, capped: have + qty > limit };
  };
  const setQty = (id, raw, max = MAX) => {
    const s = String(raw).trim();
    if (!/^\d+$/.test(s) || Number(s) < 1) return { ok: false, reason: "invalid" };
    const cart = load(); if (!(id in cart)) return { ok: false, reason: "missing" };
    const limit = Math.min(max, MAX), q = Math.min(Number(s), limit);
    cart[id] = q; save(cart);
    return { ok: true, qty: q, limit, capped: Number(s) > limit };
  };
  const remove = id => { const c = load(); delete c[id]; save(c); };
  const clear = () => save({});

  // ----- checking the cart against the catalogue -----
  const finish = l => { l.available = l.found && l.stock > 0; l.reason = !l.found ? "No longer sold" : l.stock <= 0 ? "Out of stock" : ""; return l; };
  const local = (id, qty) => {
    const p = typeof PRODUCTS !== "undefined" ? PRODUCTS[id] : null;
    return p ? { id, name: p.name, price: p.price, stock: p.stock, image: decodeURIComponent(p.image), cat: p.cat, qty, found: true }
             : { id, name: id, qty, found: false };
  };
  async function validate() {
    const cart = load(), ids = Object.keys(cart);
    if (!ids.length) return { lines: [], source: "none" };
    try {
      const r = await fetch("/api/cart/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart }) });
      if (!r.ok) throw new Error("bad response");
      const { lines } = await r.json();
      return { source: "database", lines: lines.map(s => finish(s.found
        ? { id: s.sku, name: s.name, price: s.price, stock: s.stock, image: s.image, cat: s.category, qty: cart[s.sku], found: true }
        : { id: s.sku, name: s.sku, qty: cart[s.sku], found: false })) };
    } catch (e) { return { source: "local", lines: ids.map(id => finish(local(id, cart[id]))) }; }
  }
  const qtyOf = l => (l.available ? Math.min(l.qty, l.stock) : 0);
  const totals = lines => lines.reduce((t, l) => { const q = qtyOf(l); t.items += q; t.subtotal += q * (l.price || 0); return t; }, { items: 0, subtotal: 0 });

  // ----- cart page -----
  function initPage() {
    const box = document.getElementById("cartBox"); if (!box) return;
    const note = document.getElementById("cartNotice");
    let state = { lines: [], source: "none" }, confirmClear = false, timer = null;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const say = msgs => { note.textContent = ""; msgs.forEach(m => note.appendChild(el("p", "", m))); };
    const stockText = l => !l.found ? "No longer sold" : l.stock <= 0 ? "Out of stock" : l.stock <= 5 ? "Only " + l.stock + " left" : "In stock";

    function render() {
      box.textContent = "";
      const lines = state.lines;
      if (!lines.length) {
        const d = el("div", "empty-cart");
        d.appendChild(el("h2", "", "Your cart is empty"));
        d.appendChild(el("p", "", "Products you add will appear here with their prices and quantities."));
        const a = el("a", "btn", "Browse products"); a.href = "products.html"; d.appendChild(a);
        box.appendChild(d); return;
      }
      const bad = lines.filter(l => !l.available);
      lines.forEach(l => {
        const row = el("div", "cart-line" + (l.available ? "" : " unavailable")); row.dataset.id = l.id;
        const img = el("img"); img.alt = ""; img.src = l.found ? "images/" + encodeURIComponent(l.image) : "images/placeholder.svg"; row.appendChild(img);
        const info = el("div", "cart-info"), strong = el("strong");
        if (l.found) { const a = el("a", "", l.name); a.href = "product.html?id=" + encodeURIComponent(l.id); strong.appendChild(a); } else strong.textContent = l.name;
        info.appendChild(strong);
        if (l.found) info.appendChild(el("div", "", money(l.price) + " each"));
        info.appendChild(el("div", "stock " + (!l.available ? "out" : l.stock <= 5 ? "low" : ""), stockText(l)));
        row.appendChild(info);
        const q = el("div", "qty");
        if (l.available) {
          const q1 = Math.min(l.qty, l.stock), top = Math.min(l.stock, MAX);
          const dec = el("button", "qbtn", "\u2212"); dec.type = "button"; dec.dataset.act = "dec"; dec.disabled = q1 <= 1; dec.setAttribute("aria-label", "Decrease quantity of " + l.name);
          const inp = el("input"); inp.type = "number"; inp.min = 1; inp.max = top; inp.value = q1; inp.dataset.act = "set"; inp.setAttribute("aria-label", "Quantity of " + l.name);
          const inc = el("button", "qbtn", "+"); inc.type = "button"; inc.dataset.act = "inc"; inc.disabled = q1 >= top; inc.setAttribute("aria-label", "Increase quantity of " + l.name);
          q.append(dec, inp, inc);
        } else q.appendChild(el("span", "", "Qty " + l.qty));
        row.appendChild(q);
        row.appendChild(el("strong", "line-total", l.available ? money(l.price * Math.min(l.qty, l.stock)) : "\u2014"));
        const rm = el("button", "linkbtn", "Remove"); rm.type = "button"; rm.dataset.act = "remove"; rm.setAttribute("aria-label", "Remove " + l.name + " from cart");
        row.appendChild(rm); box.appendChild(row);
      });
      const t = totals(lines), sum = el("div", "cart-summary");
      sum.appendChild(el("p", "", "Items: " + t.items));
      const st = el("p", "total", "Subtotal: "), sv = el("strong", "", money(t.subtotal)); sv.id = "cartSubtotal"; st.appendChild(sv); sum.appendChild(st);
      sum.appendChild(el("p", "hint", "Delivery fees are added at checkout."));
      if (bad.length) {
        const b = el("button", "btn ghost-dark", "Remove unavailable items"); b.type = "button"; b.dataset.act = "removebad"; sum.appendChild(b);
        sum.appendChild(el("p", "form-error", "Remove unavailable items to continue to checkout."));
      }
      const go = bad.length ? el("button", "btn", "Proceed to Checkout") : el("a", "btn", "Proceed to Checkout");
      go.id = "proceedBtn"; if (bad.length) go.disabled = true; else go.href = "checkout.html";
      sum.appendChild(go);
      const clr = el("button", "btn ghost-dark", confirmClear ? "Click again to clear the cart" : "Clear cart"); clr.type = "button"; clr.dataset.act = "clear"; clr.id = "clearBtn";
      sum.appendChild(clr);
      const more = el("a", "", "Continue shopping"); more.href = "products.html"; sum.appendChild(more);
      box.appendChild(sum);
    }
    function change(l, raw) {
      const r = setQty(l.id, raw, l.stock);
      if (!r.ok) say(["Enter a whole number of 1 or more for " + l.name + ". Use Remove to delete it."]);
      else { l.qty = r.qty; say(r.capped ? ["Only " + r.limit + " of " + l.name + " available, so the quantity was set to " + r.qty + "."] : []); }
    }
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b || b.tagName === "INPUT") return;
      const act = b.dataset.act, row = b.closest(".cart-line"), id = row && row.dataset.id, l = id && state.lines.find(x => x.id === id);
      if (act !== "clear") confirmClear = false;
      if (act === "remove") { remove(id); state.lines = state.lines.filter(x => x.id !== id); say([l.name + " removed from your cart."]); }
      else if (act === "inc" || act === "dec") change(l, Math.min(l.qty, l.stock) + (act === "inc" ? 1 : -1));
      else if (act === "removebad") { state.lines.filter(x => !x.available).forEach(x => remove(x.id)); state.lines = state.lines.filter(x => x.available); say(["Unavailable items removed."]); }
      else if (act === "clear") {
        if (!confirmClear) { confirmClear = true; clearTimeout(timer); timer = setTimeout(() => { confirmClear = false; render(); }, 4000); }
        else { clear(); state.lines = []; confirmClear = false; say(["Your cart was cleared."]); }
      }
      render();
    });
    box.addEventListener("change", e => {
      if (e.target.dataset.act !== "set") return;
      const l = state.lines.find(x => x.id === e.target.closest(".cart-line").dataset.id);
      change(l, e.target.value); render();
    });
    async function refresh() {
      const r = await validate(); state = r;
      const msgs = [], cart = load(); let changed = false;
      state.lines.forEach(l => {
        if (!l.available) msgs.push(l.name + " is unavailable (" + l.reason.toLowerCase() + ") and is not included in the total.");
        else if (l.qty > l.stock) { msgs.push(l.name + ": quantity reduced to " + l.stock + " because only " + l.stock + " are in stock."); cart[l.id] = l.stock; l.qty = l.stock; changed = true; }
      });
      if (changed) save(cart);
      if (r.source === "local") msgs.push("Could not reach the shop server, so saved prices are shown. They are checked again at checkout.");
      say(msgs); render();
    }
    window.addEventListener("storage", e => { if (e.key === KEY) { updateCount(); refresh(); } });   // another tab changed the cart
    refresh();
  }
  return { KEY, MAX, money, clean, load, save, count, updateCount, add, setQty, remove, clear, validate, totals, initPage };
})();
if (typeof module !== "undefined") module.exports = TGCart;
if (typeof document !== "undefined") { TGCart.updateCount(); TGCart.initPage(); }
