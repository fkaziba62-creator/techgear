// TechGear Week 5: catalogue (listing, details, search, filter, sort), cart, checkout
const money = n => "UGX " + n.toLocaleString("en-US");
const $ = id => document.getElementById(id);
const stockText = p => p.stock === 0 ? "Out of stock" : p.stock <= 5 ? "Only " + p.stock + " left" : "In stock";
const stockClass = p => p.stock === 0 ? "out" : p.stock <= 5 ? "low" : "";
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const { load: loadCart, save: saveCart, updateCount, add: addToCart } = TGCart;   // cart logic lives in js/cart.js (Week 8)

const card = p => `<article class="card">
  <a href="product.html?id=${p.id}"><img src="images/${p.image}" alt="${esc(p.name)}"></a>
  <h3><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
  <p class="cat-tag">${esc(p.cat)}</p><p class="price">${money(p.price)}</p>
  <p class="stock ${stockClass(p)}">${stockText(p)}</p>
  <button class="btn small add" data-id="${p.id}" ${p.stock === 0 ? "disabled" : ""}>${p.stock === 0 ? "Unavailable" : "Add to cart"}</button></article>`;

function bindAdd(root) {
  root.querySelectorAll(".add").forEach(btn => btn.addEventListener("click", () => {
    const r = addToCart(btn.dataset.id);
    btn.textContent = r.ok ? "Added \u2713" : r.reason === "max" ? "All " + r.limit + " in cart" : "Unavailable";
    setTimeout(() => (btn.textContent = "Add to cart"), 1400);
  }));
}

// Mobile menu
const menuBtn = $("menuBtn"), mainNav = $("mainNav");
menuBtn.addEventListener("click", () => {
  menuBtn.setAttribute("aria-expanded", mainNav.classList.toggle("open"));
});
updateCount(loadCart());

// Home: featured products and category links
const featured = $("featuredGrid");
if (featured) {
  featured.innerHTML = ["keyboard","mouse","flashdisk","headphones"].map(id => card(PRODUCTS[id])).join("");
  bindAdd(featured);
}
const catList = $("catList");
if (catList) catList.innerHTML = CATEGORIES.map(c => `<li><a href="products.html?cat=${encodeURIComponent(c)}">${esc(c)}</a></li>`).join("");

// Products page: listing + search + filters + sort
const grid = $("productGrid");
if (grid) {
  const search = $("search"), select = $("catSelect"), sort = $("sort"), maxPrice = $("maxPrice"), inStock = $("inStock");
  select.innerHTML = "<option>All</option>" + CATEGORIES.map(c => `<option>${esc(c)}</option>`).join("");
  const params = new URLSearchParams(location.search);
  if (params.get("cat")) select.value = params.get("cat");
  if (params.get("q")) search.value = params.get("q");
  const apply = () => {
    const q = search.value.trim().toLowerCase(), max = Number(maxPrice.value) || Infinity;
    let list = Object.values(PRODUCTS).filter(p =>
      (p.name + " " + p.desc + " " + p.cat).toLowerCase().includes(q) &&
      (select.value === "All" || p.cat === select.value) && p.price <= max && (!inStock.checked || p.stock > 0));
    const s = sort.value;
    if (s === "low") list.sort((a, b) => a.price - b.price);
    else if (s === "high") list.sort((a, b) => b.price - a.price);
    else if (s === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    grid.innerHTML = list.map(card).join("");
    bindAdd(grid);
    $("resultCount").textContent = list.length + " of " + Object.keys(PRODUCTS).length + " products";
    $("noResults").hidden = list.length > 0;
  };
  [search, maxPrice].forEach(e => e.addEventListener("input", apply));
  [select, sort, inStock].forEach(e => e.addEventListener("change", apply));
  $("resetFilters").addEventListener("click", () => {
    search.value = ""; select.value = "All"; sort.value = "default"; maxPrice.value = ""; inStock.checked = false; apply();
  });
  apply();
}

// Product details page
const detail = $("productDetail");
if (detail) {
  const p = PRODUCTS[new URLSearchParams(location.search).get("id")];
  if (!p) detail.innerHTML = '<p>Product not found. <a href="products.html">Back to products</a></p>';
  else {
    document.title = p.name + " | TechGear";
    detail.innerHTML = `<p><a href="products.html?cat=${encodeURIComponent(p.cat)}">&larr; ${esc(p.cat)}</a></p>
    <div class="detail-grid"><img src="images/${p.image}" alt="${esc(p.name)}">
    <div><h1>${esc(p.name)}</h1><p class="price big">${money(p.price)}</p>
    <p class="stock ${stockClass(p)}">${stockText(p)}</p><p>${esc(p.desc)}</p>
    <ul class="meta"><li>Category: ${esc(p.cat)}</li><li>Product code: TG-${p.id.toUpperCase()}</li><li>Pickup free at Kitagata shop</li></ul>
    <label>Quantity <input type="number" id="qty" min="1" max="${p.stock}" value="1" ${p.stock === 0 ? "disabled" : ""}></label>
    <button class="btn" id="addDetail" ${p.stock === 0 ? "disabled" : ""}>${p.stock === 0 ? "Out of stock" : "Add to cart"}</button>
    <p id="addMsg" role="status"></p></div></div>
    <h2>Related products</h2><div class="grid">${Object.values(PRODUCTS).filter(r => r.cat === p.cat && r.id !== p.id).slice(0, 4).map(card).join("")}</div>`;
    bindAdd(detail);
    const b = $("addDetail");
    if (p.stock > 0) b.addEventListener("click", () => {
      const q = Number($("qty").value);
      if (!Number.isInteger(q) || q < 1) { $("addMsg").textContent = "Enter a whole number of 1 or more."; return; }
      const r = addToCart(p.id, q);
      $("addMsg").innerHTML = r.ok
        ? "Added to cart" + (r.capped ? " (limited to the " + r.limit + " in stock)" : "") + '. <a href="cart.html">View cart</a>'
        : "You already have all " + r.limit + ' in your cart. <a href="cart.html">View cart</a>';
    });
  }
}

// Contact form
const form = $("contactForm");
if (form) form.addEventListener("submit", e => {
  e.preventDefault(); $("formMsg").textContent = "Thank you. We will reply soon."; form.reset();
});
