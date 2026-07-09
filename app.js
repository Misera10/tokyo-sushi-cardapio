const STORE = window.TOKYO_DATA.store;
const DEFAULT_MENU = window.TOKYO_DATA.menu;
let MENU = JSON.parse(localStorage.getItem("tokyoMenu") || "null") || DEFAULT_MENU;

let searchTerm = "";
let cart = JSON.parse(localStorage.getItem("sushiCart") || "{}");
let deferredPrompt = null;

const byId = id => document.getElementById(id);
const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cleanText = value => String(value || "")
  .replace(/\s+/g, " ")
  .replace(/\bUnd\b/gi, "un.")
  .replace(/\bChesse\b/gi, "Cheese")
  .replace(/salmão,cream/gi, "Salmão, cream")
  .trim();
const normalizePhone = value => value.replace(/\D/g, "");

function formatPhone(value) {
  const digits = normalizePhone(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function cartLines() {
  if (Array.isArray(cart)) return cart;
  return Object.keys(cart).map(id => ({ id, qty: cart[id], options: [] }));
}

function setCart(lines) {
  cart = lines.filter(line => line.qty > 0);
  saveCart();
}

async function loadMenuFromDb() {
  if (!window.TokyoDb?.enabled) return;
  try {
    MENU = await window.TokyoDb.loadMenu(DEFAULT_MENU);
    localStorage.setItem("tokyoMenu", JSON.stringify(MENU));
  } catch (error) {
    console.warn("Falha ao carregar cardapio online. Usando cache local.", error);
  }
}

async function saveOrder() {
  const lines = cartLines();
  const total = lines.reduce((sum, line) => {
    const item = MENU.find(product => String(product.id) === String(line.id));
    return item ? sum + item.price * line.qty : sum;
  }, 0);
  const order = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    status: "Recebido",
    customerName: byId("customerName").value.trim(),
    customerPhone: normalizePhone(byId("customerPhone").value),
    payment: byId("paymentMethod").value,
    notes: byId("notes").value.trim(),
    total,
    items: lines.map(line => {
      const item = MENU.find(product => String(product.id) === String(line.id));
      return {
        id: line.id,
        name: item ? cleanText(item.name) : "Item removido",
        price: item ? item.price : 0,
        qty: line.qty,
        options: line.options || []
      };
    })
  };
  const orders = JSON.parse(localStorage.getItem("tokyoOrders") || "[]");
  orders.unshift(order);
  localStorage.setItem("tokyoOrders", JSON.stringify(orders));
  if (window.TokyoDb?.enabled) {
    try {
      await window.TokyoDb.createOrder(order);
    } catch (error) {
      console.warn("Pedido salvo localmente, mas falhou no banco online.", error);
    }
  }
}


function saveCart() {
  localStorage.setItem("sushiCart", JSON.stringify(cartLines()));
}

function visibleProducts() {
  const term = searchTerm.toLowerCase();
  return MENU.filter(item => {
    const text = `${item.name} ${item.desc} ${item.cat}`.toLowerCase();
    const active = item.active !== false;
    return active && (searchTerm ? text.includes(term) : true);
  });
}

function categoryId(cat) {
  return `cat-${cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
}

function renderCategories() {
  const cats = [...new Set(MENU.filter(item => item.active !== false).map(item => item.cat))];
  byId("categories").innerHTML = cats.map(cat => {
    const count = MENU.filter(item => item.cat === cat && item.active !== false).length;
    return `
      <button data-cat="${cat}">
        ${cleanText(cat)} <span>${count}</span>
      </button>
    `;
  }).join("");
}

function renderProducts() {
  const wrap = byId("products");
  const template = byId("productTemplate");
  const products = visibleProducts();
  const cats = [...new Set(products.map(item => item.cat))];
  wrap.innerHTML = "";

  if (!products.length) {
    wrap.innerHTML = `
      <div class="empty-products">
        <strong>Nenhum item encontrado</strong>
        <span>Tente outro nome ou escolha uma categoria.</span>
      </div>
    `;
    return;
  }

  cats.forEach(cat => {
    const section = document.createElement("section");
    section.className = "menu-section";
    section.id = categoryId(cat);
    section.innerHTML = `<h2>${cleanText(cat)}</h2>`;

    products.filter(item => item.cat === cat).forEach(item => {
      const node = template.content.cloneNode(true);
      const photo = node.querySelector(".photo");
      if (item.image) {
        photo.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.12)), url("${item.image}")`;
        photo.classList.add("real-photo");
      }
      node.querySelector(".tag").textContent = cleanText(item.cat);
      node.querySelector("h3").textContent = cleanText(item.name);
      node.querySelector(".desc").textContent = cleanText(item.desc);
      node.querySelector(".price").textContent = money(item.price);
      node.querySelector(".add").dataset.id = item.id;
      section.appendChild(node);
    });

    wrap.appendChild(section);
  });
}

function renderMenu() {
  renderCategories();
  renderProducts();
}

function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => {
    const item = MENU.find(product => String(product.id) === String(line.id));
    return item ? sum + item.price * line.qty : sum;
  }, 0);

  byId("totalValue").textContent = money(total);
  byId("sendOrder").disabled = total <= 0;
  byId("mobileCartBar").hidden = total <= 0;
  byId("mobileCartCount").textContent = `Ver pedido • ${count} ${count === 1 ? "item" : "itens"}`;
  byId("mobileCartTotal").textContent = money(total);

  if (!lines.length) {
    byId("cartItems").innerHTML = `<p class="empty">Seu pedido ainda está vazio.</p>`;
    return;
  }

  byId("cartItems").innerHTML = lines.map((line, index) => {
    const item = MENU.find(product => String(product.id) === String(line.id));
    if (!item) return "";
    const options = line.options?.length ? `<small>${line.options.map(cleanText).join(", ")}</small>` : "";
    return `
      <div class="cart-row">
        <div>
          <strong>${cleanText(item.name)}</strong>
          ${options}
          <div class="qty">
            <button type="button" data-minus="${index}" aria-label="Remover uma unidade">-</button>
            <span>${line.qty}</span>
            <button type="button" data-plus="${index}" aria-label="Adicionar uma unidade">+</button>
          </div>
        </div>
        <strong>${money(item.price * line.qty)}</strong>
      </div>
    `;
  }).join("");
}

function addItem(id, amount) {
  const lines = cartLines();
  const existing = lines.find(line => String(line.id) === String(id));
  if (existing) {
    existing.qty = Math.max(0, existing.qty + amount);
  } else if (amount > 0) {
    lines.push({ id, qty: amount, options: [] });
  }
  setCart(lines);
  renderCart();
}

function updateCartLine(index, amount) {
  const lines = cartLines();
  if (!lines[index]) return;
  lines[index].qty = Math.max(0, lines[index].qty + amount);
  setCart(lines);
  renderCart();
}

function buildMessage() {
  const name = byId("customerName").value.trim();
  const phone = normalizePhone(byId("customerPhone").value);
  const payment = byId("paymentMethod").value;
  const notes = byId("notes").value.trim();
  const lines = [
    `Novo pedido - ${STORE.name}`,
    "",
    `Cliente: ${name}`,
    `Celular: ${phone}`,
    "Retirada: no balcão",
    `Pagamento: ${payment}`,
    "",
    "Itens:"
  ];
  let total = 0;

  cartLines().forEach(line => {
    const item = MENU.find(product => String(product.id) === String(line.id));
    if (!item) return;
    const subtotal = item.price * line.qty;
    total += subtotal;
    lines.push(`${line.qty}x ${cleanText(item.name)} - ${money(subtotal)}`);
    if (line.options?.length) lines.push(`   Complementos: ${line.options.map(cleanText).join(", ")}`);
  });

  lines.push("", `Total: ${money(total)}`);
  if (notes) lines.push(`Observação: ${notes}`);
  return lines.join("\n");
}

async function sendOrder() {
  if (!cartLines().length) return;
  if (!byId("customerName").value.trim()) {
    document.querySelector(".cart").scrollIntoView({ behavior: "smooth", block: "start" });
    byId("customerName").focus();
    alert("Informe o nome para retirada antes de enviar o pedido.");
    return;
  }
  if (normalizePhone(byId("customerPhone").value).length < 10) {
    document.querySelector(".cart").scrollIntoView({ behavior: "smooth", block: "start" });
    byId("customerPhone").focus();
    alert("Informe o celular/WhatsApp para acompanhamento do pedido.");
    return;
  }
  await saveOrder();
  window.open(`https://wa.me/${STORE.phone}?text=${encodeURIComponent(buildMessage())}`, "_blank", "noopener");
}

async function init() {
  byId("storeStatus").textContent = "Retirada no balcão";
  byId("storeHours").textContent = STORE.hours;
  byId("storeAddress").textContent = cleanText(STORE.address);
  byId("instagramTop").href = STORE.instagram;
  byId("whatsTop").href = `https://wa.me/${STORE.phone}`;
  byId("mapsTop").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE.address + " Tokyo Sushi Tuntum")}`;

  await loadMenuFromDb();
  renderMenu();
  renderCart();

  byId("menuSearch").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    renderMenu();
  });
  byId("customerPhone").addEventListener("input", event => {
    event.target.value = formatPhone(event.target.value);
  });

  byId("categories").addEventListener("click", event => {
    const button = event.target.closest("button[data-cat]");
    if (!button) return;
    searchTerm = "";
    byId("menuSearch").value = "";
    renderMenu();
    document.getElementById(categoryId(button.dataset.cat))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.body.addEventListener("click", event => {
    if (event.target.dataset.id) {
      addItem(event.target.dataset.id, 1);
      event.target.textContent = "Adicionado";
      setTimeout(() => { event.target.textContent = "Adicionar"; }, 750);
    }
    if (event.target.dataset.plus) updateCartLine(Number(event.target.dataset.plus), 1);
    if (event.target.dataset.minus) updateCartLine(Number(event.target.dataset.minus), -1);
  });

  byId("clearCart").addEventListener("click", () => {
    cart = {};
    saveCart();
    renderCart();
  });
  byId("sendOrder").addEventListener("click", sendOrder);
  byId("mobileCartBar").addEventListener("click", () => {
    document.querySelector(".cart").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    byId("installBtn").hidden = false;
  });
  byId("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt = null;
    byId("installBtn").hidden = true;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
