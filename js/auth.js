// TechGear Week 7: talks to the backend for login, registration, profile, orders and the admin list
(function () {
  const $ = id => document.getElementById(id);
  const A = (window.TGAuth = { user: null, csrf: null });
  const money = n => "UGX " + Number(n).toLocaleString("en-US");

  // If the page is not served by the Flask app (file://, Live Server, another port) fall back to the Flask server on port 5000.
  const host = ["localhost", "127.0.0.1"].includes(location.hostname) ? location.hostname : "127.0.0.1";
  const LOCAL = "http://" + host + ":5000";
  let base = location.protocol === "file:" ? LOCAL : "";
  const DOWN = "Cannot reach the TechGear server. Start it with \"python server/app.py\" and open http://127.0.0.1:5000 in your browser.";
  A.api = async (method, path, body) => {
    const opt = { method, headers: {}, credentials: "include" };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    if (method !== "GET" && A.csrf) opt.headers["X-CSRF-Token"] = A.csrf;
    const isApi = r => (r.headers.get("content-type") || "").includes("json");
    let r;
    try { r = await fetch(base + path, opt); } catch (e) { r = null; }
    if ((!r || (!isApi(r) && [404, 405, 501].includes(r.status))) && base === "") {   // wrong server: try the Flask one
      try { const r2 = await fetch(LOCAL + path, opt); if (isApi(r2)) { r = r2; base = LOCAL; } } catch (e) {}
    }
    if (!r) { const e = new Error(DOWN); e.status = 0; e.fields = {}; throw e; }
    let data = {}; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error(data.error || "Request failed"); e.status = r.status; e.fields = data.fields || {}; e.data = data; throw e; }
    return data;
  };
  const setAuth = d => { A.user = d.user || null; A.csrf = d.csrf || null; };
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const showErr = (id, e) => { const f = Object.values(e.fields || {}); $(id).textContent = f.length ? f.join(" ") : e.message; };
  const safeNext = () => { const n = new URLSearchParams(location.search).get("next"); return /^[a-z-]+\.html$/.test(n || "") ? n : "account.html"; };

  A.ready = A.api("GET", "/api/session").then(setAuth).catch(() => {}).then(() => {
    const ul = document.querySelector("#mainNav ul"); if (!ul) return;
    const add = (text, href, id) => { const li = el("li"), a = el("a", text); a.href = href; if (id) a.id = id; li.appendChild(a); ul.appendChild(li); return a; };
    if (A.user) {
      add("Hi, " + A.user.full_name.split(" ")[0], "account.html");
      if (A.user.role === "admin") add("Admin", "admin.html");
      add("My orders", "orders.html");
      add("Log out", "#", "navLogout").addEventListener("click", async e => { e.preventDefault(); try { await A.api("POST", "/api/logout", {}); } catch (x) {} location.href = "index.html"; });
    } else { add("Log in", "login.html"); add("Register", "register.html"); }
  });

  // Register
  if ($("registerForm")) $("registerForm").addEventListener("submit", async e => {
    e.preventDefault(); $("formError").textContent = "";
    const pw = $("regPassword").value;
    if (pw !== $("regConfirm").value) { $("formError").textContent = "Passwords do not match."; return; }
    try {
      setAuth(await A.api("POST", "/api/register", { full_name: $("regName").value, email: $("regEmail").value, phone: $("regPhone").value, password: pw }));
      location.href = "account.html";
    } catch (x) { showErr("formError", x); }
  });

  // Login
  if ($("loginForm")) $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); $("formError").textContent = "";
    try { setAuth(await A.api("POST", "/api/login", { email: $("loginEmail").value, password: $("loginPassword").value })); location.href = safeNext(); }
    catch (x) { showErr("formError", x); }
  });

  // Account page
  if ($("profileForm")) A.ready.then(async () => {
    if (!A.user) { location.href = "login.html?next=account.html"; return; }
    const fill = u => { $("profName").value = u.full_name; $("profEmail").value = u.email || ""; $("profPhone").value = u.phone; $("profAddress").value = u.address || ""; };
    fill(A.user);
    $("profileForm").addEventListener("submit", async e => {
      e.preventDefault(); $("profError").textContent = ""; $("accountMsg").textContent = "";
      try { const d = await A.api("PUT", "/api/profile", { full_name: $("profName").value, email: $("profEmail").value, phone: $("profPhone").value, address: $("profAddress").value });
            A.user = d.user; fill(d.user); $("accountMsg").textContent = "Profile saved."; } catch (x) { showErr("profError", x); }
    });
    $("passwordForm").addEventListener("submit", async e => {
      e.preventDefault(); $("passError").textContent = ""; $("accountMsg").textContent = "";
      if ($("newPass").value !== $("newConfirm").value) { $("passError").textContent = "New passwords do not match."; return; }
      try { await A.api("POST", "/api/change-password", { current: $("curPass").value, new: $("newPass").value });
            $("passwordForm").reset(); $("accountMsg").textContent = "Password changed. Other devices were logged out."; } catch (x) { showErr("passError", x); }
    });
    $("logoutBtn").addEventListener("click", async () => { try { await A.api("POST", "/api/logout", {}); } catch (x) {} location.href = "index.html"; });
    try {
      const box = $("ordersBox"); box.textContent = "";
      const { orders } = await A.api("GET", "/api/orders");
      if (!orders.length) box.appendChild(el("p", "You have no orders yet."));
      orders.forEach(o => {
        const d = el("div", undefined, "cart-row order-row");
        const ol = el("a", o.order_no + " (" + o.date + ")"); ol.href = "order.html?no=" + encodeURIComponent(o.order_no); const os = el("strong"); os.appendChild(ol); d.appendChild(os);
        d.appendChild(el("span", o.items.map(i => i.name + " x " + i.quantity).join(", ")));
        d.appendChild(el("span", o.status)); d.appendChild(el("strong", money(o.total)));
        box.appendChild(d);
      });
    } catch (x) { $("ordersBox").textContent = x.message; }
  });

  // Admin page
  if ($("customerTable")) A.ready.then(async () => {
    if (!A.user) { location.href = "login.html?next=admin.html"; return; }
    try {
      const { customers } = await A.api("GET", "/api/admin/customers"); const tb = $("customerTable").tBodies[0];
      customers.forEach(c => { const tr = el("tr"); [c.customer_id, c.full_name, c.email || "", c.phone, c.role, c.has_account ? "Yes" : "Guest", c.orders].forEach(v => tr.appendChild(el("td", String(v)))); tb.appendChild(tr); });
    } catch (x) { $("adminMsg").textContent = x.status === 403 ? "Admins only." : x.message; }
  });

  // Cart page: prefill details for logged-in customers
  if ($("custName")) A.ready.then(() => {
    if (!A.user) return;
    $("custName").value = A.user.full_name; $("custPhone").value = A.user.phone; $("custEmail").value = A.user.email || "";
    if ($("custAddress") && A.user.address) $("custAddress").value = A.user.address;
  });
})();
