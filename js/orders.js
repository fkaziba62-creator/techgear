// TechGear Week 9: order confirmation/detail, order history and the admin order list.
(function () {
  const $ = id => document.getElementById(id), money = n => "UGX " + Number(n).toLocaleString("en-US");
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const badge = s => el("span", s, "badge badge-" + s.toLowerCase());
  const link = (text, href) => { const a = el("a", text); a.href = href; return a; };
  const need = async (next, role) => {
    await TGAuth.ready;
    if (!TGAuth.user) { location.href = "login.html?next=" + next; return false; }
    if (role && TGAuth.user.role !== role) return "denied";
    return true;
  };
  const row = (label, value) => { const p = el("p"); p.append(el("strong", label + ": "), document.createTextNode(value)); return p; };

  // ----- Order confirmation / detail -----
  if ($("orderBox")) (async () => {
    if ((await need("orders.html")) !== true) return;
    const box = $("orderBox"), q = new URLSearchParams(location.search), no = q.get("no") || "";
    try {
      const { order: o } = await TGAuth.api("GET", "/api/orders/" + encodeURIComponent(no));
      document.title = "Order " + o.order_no + " | TechGear"; box.textContent = "";
      const admin = TGAuth.user.role === "admin";
      if (q.get("placed") === "1" && !admin) {
        const ok = el("div", undefined, "confirm-banner"); ok.append(el("h1", "Thank you! Your order has been placed."), el("p", "Your order number is"), el("p", o.order_no, "order-no"),
          el("p", "Keep this number. We will confirm your order and the status will appear in your order history.")); box.appendChild(ok);
      } else { box.appendChild(el("h1", "Order " + o.order_no)); }
      const st = el("p"); st.append(el("strong", "Status: "), badge(o.status)); box.appendChild(st);
      box.appendChild(row("Order date", o.date));
      if (admin && o.customer) box.appendChild(row("Customer", o.customer.full_name + " (" + o.customer.phone + (o.customer.email ? ", " + o.customer.email : "") + ")"));
      const d = o.delivery;
      box.appendChild(el("h2", "Delivery"));
      box.appendChild(row("Method", d.method === "delivery" ? "Delivery" : "Collect from the shop"));
      box.appendChild(row("Receiver", d.name + ", " + d.phone + (d.email ? ", " + d.email : "")));
      if (d.method === "delivery") box.appendChild(row("Address", d.address + ", " + d.district));
      if (o.notes) box.appendChild(row("Notes", o.notes));
      if (o.payment) box.appendChild(row("Payment", o.payment.method + " (" + o.payment.status + ")"));
      box.appendChild(el("h2", "Items"));
      const wrap = el("div", undefined, "table-wrap"), t = el("table", undefined, "tbl"), head = el("tr");
      ["Product", "Qty", "Unit price", "Line total"].forEach(h => head.appendChild(el("th", h))); t.appendChild(el("thead")).appendChild(head);
      const tb = el("tbody"); o.items.forEach(i => { const r = el("tr"); [i.name, String(i.quantity), money(i.unit_price), money(i.line_total)].forEach(v => r.appendChild(el("td", v))); tb.appendChild(r); }); t.appendChild(tb);
      wrap.appendChild(t); box.appendChild(wrap);
      box.appendChild(row("Subtotal", money(o.subtotal))); box.appendChild(row("Delivery fee", o.delivery_fee ? money(o.delivery_fee) : "Free"));
      const tot = el("p", undefined, "total"); tot.append(el("strong", "Total: "), el("strong", money(o.total))); tot.lastChild.id = "orderTotal"; box.appendChild(tot);
      box.appendChild(el("h2", "Status history"));
      const ol = el("ol", undefined, "timeline"); o.history.forEach(h => ol.appendChild(el("li", h.status + " - " + h.at + (h.note ? " (" + h.note + ")" : "")))); box.appendChild(ol);
      const msg = el("p"); msg.id = "orderActionMsg"; msg.setAttribute("role", "status");
      if (!admin && o.status === "Pending") {
        const b = el("button", "Cancel this order", "btn ghost-dark"); b.type = "button"; b.id = "cancelOrder";
        b.addEventListener("click", async () => { try { await TGAuth.api("POST", "/api/orders/" + encodeURIComponent(o.order_no) + "/cancel", {}); location.href = "order.html?no=" + encodeURIComponent(o.order_no); } catch (x) { msg.textContent = x.message; } });
        box.appendChild(b);
      }
      box.appendChild(msg);
      const nav = el("p"); nav.append(admin ? link("Back to admin orders", "admin-orders.html") : link("Order history", "orders.html"), document.createTextNode(" | "), link("Continue shopping", "products.html")); box.appendChild(nav);
    } catch (x) { box.textContent = ""; const p = el("p", x.status === 404 ? "Order not found." : x.message); box.appendChild(p); box.appendChild(link("Go to order history", "orders.html")); }
  })();

  // ----- Customer order history -----
  if ($("historyBox")) (async () => {
    if ((await need("orders.html")) !== true) return;
    const box = $("historyBox");
    try {
      const { orders } = await TGAuth.api("GET", "/api/orders"); box.textContent = "";
      if (!orders.length) { const d = el("div", undefined, "empty-cart"); d.append(el("h2", "You have no orders yet"), link("Browse products", "products.html")); box.appendChild(d); return; }
      const wrap = el("div", undefined, "table-wrap"), t = el("table", undefined, "tbl"), head = el("tr");
      ["Order", "Date", "Items", "Total", "Status"].forEach(h => head.appendChild(el("th", h))); t.appendChild(el("thead")).appendChild(head);
      const tb = el("tbody");
      orders.forEach(o => { const r = el("tr"), c1 = el("td"); c1.appendChild(link(o.order_no, "order.html?no=" + encodeURIComponent(o.order_no)));
        const c5 = el("td"); c5.appendChild(badge(o.status)); r.append(c1, el("td", o.date), el("td", o.items.map(i => i.name + " x " + i.quantity).join(", ")), el("td", money(o.total)), c5); tb.appendChild(r); });
      t.appendChild(tb); wrap.appendChild(t); box.appendChild(wrap);
    } catch (x) { box.textContent = x.message; }
  })();

  // ----- Admin order list and status update -----
  if ($("orderTable")) (async () => {
    const ok = await need("admin-orders.html", "admin");
    if (ok === "denied") { $("adminMsg").textContent = "Admins only."; return; } if (ok !== true) return;
    const tb = $("orderTable").tBodies[0];
    async function load() {
      const p = new URLSearchParams(); if ($("adminStatus").value) p.set("status", $("adminStatus").value); if ($("adminQ").value.trim()) p.set("q", $("adminQ").value.trim());
      try {
        const { orders } = await TGAuth.api("GET", "/api/admin/orders?" + p); tb.textContent = ""; $("adminMsg").textContent = orders.length + " order(s)";
        orders.forEach(o => {
          const r = el("tr"), c1 = el("td"), c6 = el("td"), c7 = el("td");
          c1.appendChild(link(o.order_no, "order.html?no=" + encodeURIComponent(o.order_no))); c6.appendChild(badge(o.status));
          if (o.next.length) {
            const sel = el("select"); sel.setAttribute("aria-label", "New status for " + o.order_no); o.next.forEach(n => sel.appendChild(el("option", n)));
            const b = el("button", "Update", "btn small"); b.type = "button";
            b.addEventListener("click", async () => { try { await TGAuth.api("PUT", "/api/admin/orders/" + encodeURIComponent(o.order_no) + "/status", { status: sel.value }); $("adminMsg").textContent = o.order_no + " is now " + sel.value + "."; load(); }
              catch (x) { $("adminMsg").textContent = x.message; } });
            c7.append(sel, b);
          } else c7.textContent = "Final";
          r.append(c1, el("td", o.order_date), el("td", o.full_name), el("td", o.delivery_method), el("td", money(o.total)), c6, c7); tb.appendChild(r);
        });
      } catch (x) { $("adminMsg").textContent = x.message; }
    }
    $("adminSearch").addEventListener("click", load); $("adminStatus").addEventListener("change", load); $("adminQ").addEventListener("keydown", e => { if (e.key === "Enter") load(); });
    load();
  })();
})();
