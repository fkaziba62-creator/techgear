// TechGear Week 9: checkout. The server re-validates everything; this page only collects and displays.
(async () => {
  const $ = id => document.getElementById(id);
  if (!$("checkoutForm")) return;
  const money = TGCart.money, FEE = 5000;
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const gate = $("checkoutGate"), form = $("checkoutForm");
  const stop = (msg, linkText, href) => { gate.textContent = ""; const p = el("p", msg + " "); const a = el("a", linkText); a.href = href; p.appendChild(a); gate.appendChild(p); };
  await TGAuth.ready;
  if (!TGAuth.user) {                       // order history must belong to a customer, so ordering needs an account
    gate.textContent = "";
    const p = el("p", "Please log in or create an account to place an order. Your cart will be kept. ");
    const l = el("a", "Log in"); l.href = "login.html?next=checkout.html"; const r = el("a", "Create an account"); r.href = "register.html";
    p.append(l, document.createTextNode(" or "), r); gate.appendChild(p); return;
  }
  let lines = (await TGCart.validate()).lines;
  if (!lines.length) return stop("Your cart is empty.", "Browse products", "products.html");
  if (lines.some(l => !l.available || l.qty > l.stock)) return stop("Some items are unavailable or their stock changed.", "Review your cart", "cart.html");
  gate.hidden = true; $("checkoutBody").hidden = false;

  const method = () => form.querySelector("input[name=delivery_method]:checked").value;
  const sub = () => TGCart.totals(lines).subtotal, fee = () => (method() === "delivery" ? FEE : 0);
  function renderSummary() {
    const box = $("summaryLines"); box.textContent = "";
    lines.forEach(l => { const r = el("div", undefined, "sum-line"); r.append(el("span", l.name + " x " + l.qty + " @ " + money(l.price)), el("strong", money(l.price * l.qty))); box.appendChild(r); });
    $("sumSub").textContent = money(sub()); $("sumFee").textContent = fee() ? money(fee()) : "Free (collection)"; $("sumTotal").textContent = money(sub() + fee());
  }
  function renderMethod() {
    $("deliveryFields").hidden = method() !== "delivery";
    const opts = method() === "delivery" ? ["Cash on delivery", "Mobile money"] : ["Cash at shop", "Mobile money"];
    const keep = (form.querySelector("input[name=payment_method]:checked") || {}).value, box = $("payOptions"); box.textContent = "";
    opts.forEach(o => { const lab = el("label", undefined, "radio"), r = document.createElement("input"); r.type = "radio"; r.name = "payment_method"; r.value = o; r.checked = o === (opts.includes(keep) ? keep : opts[0]); lab.append(r, document.createTextNode(" " + o)); box.appendChild(lab); });
    renderSummary();
  }
  form.querySelectorAll("input[name=delivery_method]").forEach(r => r.addEventListener("change", renderMethod));
  renderMethod();
  $("coName").value = TGAuth.user.full_name; $("coPhone").value = TGAuth.user.phone; $("coEmail").value = TGAuth.user.email || ""; $("coAddress").value = TGAuth.user.address || "";

  const key = () => { let k = sessionStorage.getItem("tgCheckoutKey"); if (!k) { k = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^A-Za-z0-9_-]/g, "") + "0000000000"; sessionStorage.setItem("tgCheckoutKey", k); } return k; };
  const showErrors = f => { form.querySelectorAll("[data-err]").forEach(s => { s.textContent = f[s.dataset.err] || ""; }); };
  let busy = false;
  form.addEventListener("submit", async e => {
    e.preventDefault(); if (busy) return;                      // ignore repeated clicks while a request is running
    busy = true; $("placeOrder").disabled = true; $("placeOrder").textContent = "Placing order..."; $("checkoutError").textContent = ""; showErrors({});
    const v = n => (form.elements[n] ? form.elements[n].value : "");
    const payload = { items: TGCart.load(), recipient_name: v("recipient_name"), recipient_phone: v("recipient_phone"), recipient_email: v("recipient_email"),
      delivery_method: method(), delivery_address: v("delivery_address"), delivery_district: v("delivery_district"), notes: v("notes"),
      payment_method: (form.querySelector("input[name=payment_method]:checked") || {}).value, expected_total: sub() + fee(), idempotency_key: key() };
    try {
      const r = await TGAuth.api("POST", "/api/orders", payload);
      TGCart.clear(); sessionStorage.removeItem("tgCheckoutKey");
      const url = "order.html?no=" + encodeURIComponent(r.order_no) + "&placed=1";
      $("checkoutBody").hidden = true; $("orderMsg").textContent = "Order " + r.order_no + " placed. ";
      const a = el("a", "View your confirmation"); a.href = url; $("orderMsg").appendChild(a); location.href = url; return;
    } catch (x) {
      const d = x.data || {}, out = $("checkoutError"); out.textContent = "";
      if (x.status === 400 && d.fields) { showErrors(d.fields); out.textContent = "Please correct the highlighted fields."; }
      else if (d.code === "unavailable") {
        out.appendChild(el("p", x.message)); const ul = el("ul"); (d.problems || []).forEach(p => ul.appendChild(el("li", p.message))); out.appendChild(ul);
        const a = el("a", "Go back to your cart"); a.href = "cart.html"; out.appendChild(a);
      } else if (d.code === "price_changed") {
        out.textContent = x.message; lines = (await TGCart.validate()).lines; renderSummary();
      } else if (x.status === 401) out.textContent = "Your session expired. Please log in again.";
      else out.textContent = x.message;
    }
    busy = false; $("placeOrder").disabled = false; $("placeOrder").textContent = "Place order";
  });
})();
