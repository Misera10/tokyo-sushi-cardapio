const STORE = window.TOKYO_DATA.store;
const DEFAULT_MENU = window.TOKYO_DATA.menu;
const DEFAULT_COMPLEMENTS = window.TOKYO_DATA.complements || [];
const STORE_STATUS_KEY = "tokyoStoreStatus";
const DEFAULT_STORE_STATUS = { mode: "open", label: "Aberto para retirada" };
let MENU = JSON.parse(localStorage.getItem("tokyoMenu") || "null") || DEFAULT_MENU;
let complementGroups = JSON.parse(localStorage.getItem("tokyoComplements") || "null") || DEFAULT_COMPLEMENTS;
let storeStatus = JSON.parse(localStorage.getItem(STORE_STATUS_KEY) || "null") || DEFAULT_STORE_STATUS;

let searchTerm = "";
let cart = JSON.parse(localStorage.getItem("sushiCart") || "{}");
let deferredPrompt = null;
let pendingProduct = null;
let pendingOptions = {};

const byId = id => document.getElementById(id);
const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cleanText = value => String(value || "")
  .replace(/\s+/g, " ")
  .replace(/\bUnd\b/gi, "un.")
  .replace(/\bChesse\b/gi, "Cheese")
  .replace(/salmão,cream/gi, "Salmão, cream")
  .trim();
const normalizePhone = value => value.replace(/\D/g, "");
const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function withDefaultComplements(groups = []) {
  const list = Array.isArray(groups) ? [...groups] : [];
  DEFAULT_COMPLEMENTS.forEach(defaultGroup => {
    if (!list.some(group => String(group.id) === String(defaultGroup.id))) {
      list.push(defaultGroup);
    }
  });
  return list;
}

complementGroups = withDefaultComplements(complementGroups);

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

function lineUnitExtra(line) {
  return (line.options || []).reduce((sum, option) => sum + Number(option.price || 0) * Number(option.qty || 0), 0);
}

function lineUnitPrice(line, item) {
  return Number(item?.price || 0) + Number(line.unitExtra ?? lineUnitExtra(line));
}

function optionText(option) {
  if (typeof option === "string") return cleanText(option);
  return `${option.qty || 1}x ${cleanText(option.name)}${option.price ? ` (+${money(Number(option.price) * Number(option.qty || 1))})` : ""}`;
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

async function loadComplementsFromDb() {
  if (!window.TokyoDb?.enabled) return;
  try {
    complementGroups = withDefaultComplements(await window.TokyoDb.loadComplements(DEFAULT_COMPLEMENTS));
    localStorage.setItem("tokyoComplements", JSON.stringify(complementGroups));
  } catch (error) {
    console.warn("Falha ao carregar complementos online. Usando cache local.", error);
    complementGroups = withDefaultComplements(complementGroups);
    localStorage.setItem("tokyoComplements", JSON.stringify(complementGroups));
  }
}

async function loadStoreStatusFromDb() {
  if (!window.TokyoDb?.enabled) return;
  try {
    storeStatus = await window.TokyoDb.loadSetting("store_status", DEFAULT_STORE_STATUS);
    localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
  } catch (error) {
    console.warn("Falha ao carregar status do cardapio. Usando cache local.", error);
  }
}

function isStoreOpen() {
  return (storeStatus?.mode || "open") === "open";
}

async function saveOrder() {
  const lines = cartLines();
  const total = lines.reduce((sum, line) => {
    const item = MENU.find(product => String(product.id) === String(line.id));
    return item ? sum + lineUnitPrice(line, item) * line.qty : sum;
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
        price: item ? lineUnitPrice(line, item) : 0,
        basePrice: item ? item.price : 0,
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

function productComplements(productId) {
  return complementGroups.filter(group =>
    group.active !== false &&
    Array.isArray(group.linkedProductIds) &&
    group.linkedProductIds.map(String).includes(String(productId)) &&
    (group.items || []).some(item => item.active !== false)
  );
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
      const addButton = node.querySelector(".add");
      addButton.dataset.id = item.id;
      addButton.disabled = !isStoreOpen();
      addButton.textContent = isStoreOpen() ? "Adicionar" : "Indisponível";
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
    return item ? sum + lineUnitPrice(line, item) * line.qty : sum;
  }, 0);

  byId("totalValue").textContent = money(total);
  byId("sendOrder").disabled = total <= 0 || !isStoreOpen();
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
    const options = line.options?.length ? `<small>${line.options.map(optionText).join("<br>")}</small>` : "";
    const unit = lineUnitPrice(line, item);
    return `
      <div class="cart-row">
        <div>
          <div class="cart-title">
            <strong>${cleanText(item.name)}</strong>
            <button type="button" class="trash-btn" data-remove-line="${index}" aria-label="Remover item">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 11h4l1-11h2l-1 13H8L7 9Z"/></svg>
            </button>
          </div>
          ${options}
          <div class="qty">
            <button type="button" data-minus="${index}" aria-label="Remover uma unidade">-</button>
            <span>${line.qty}</span>
            <button type="button" data-plus="${index}" aria-label="Adicionar uma unidade">+</button>
          </div>
        </div>
        <strong>${money(unit * line.qty)}</strong>
      </div>
    `;
  }).join("");
}

function addItem(id, amount, options = []) {
  const lines = cartLines();
  const optionKey = JSON.stringify(options.map(option => [option.groupId, option.itemId, option.qty]).sort());
  const existing = lines.find(line => String(line.id) === String(id) && (line.optionKey || "[]") === optionKey);
  if (existing) {
    existing.qty = Math.max(0, existing.qty + amount);
  } else if (amount > 0) {
    lines.push({ id, qty: amount, options, unitExtra: options.reduce((sum, option) => sum + Number(option.price || 0) * Number(option.qty || 0), 0), optionKey });
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

function removeCartLine(index) {
  const lines = cartLines();
  lines.splice(index, 1);
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
    const subtotal = lineUnitPrice(line, item) * line.qty;
    total += subtotal;
    lines.push(`${line.qty}x ${cleanText(item.name)} - ${money(subtotal)}`);
    if (line.options?.length) {
      lines.push(`   Complementos: ${line.options.map(option => typeof option === "string" ? cleanText(option) : `${option.qty}x ${cleanText(option.name)}`).join(", ")}`);
    }
  });

  lines.push("", `Total: ${money(total)}`);
  if (notes) lines.push(`Observação: ${notes}`);
  return lines.join("\n");
}

function openComplementModal(productId) {
  const product = MENU.find(item => String(item.id) === String(productId));
  const groups = productComplements(productId);
  if (!product || !groups.length) {
    addItem(productId, 1);
    return;
  }

  pendingProduct = product;
  pendingOptions = {};
  const modal = byId("complementModal");
  byId("modalProductName").textContent = cleanText(product.name);
  byId("modalProductDesc").textContent = cleanText(product.desc);
  byId("modalProductPrice").textContent = money(product.price);
  byId("modalProductImage").style.backgroundImage = product.image ? `url("${product.image}")` : "";
  byId("modalComplements").innerHTML = groups.map(group => {
    const activeItems = (group.items || []).filter(item => item.active !== false);
    return `
      <section class="option-group" data-group-id="${group.id}">
        <h3>${escapeHtml(cleanText(group.name))} <span>${group.minQty ? "obrigatório" : "opcional"} 0/${group.maxQty || 100}</span></h3>
        ${activeItems.map(item => `
          <div class="option-row">
            <div>
              <strong>${escapeHtml(cleanText(item.name))}</strong>
              <span>${money(Number(item.price || 0))}</span>
            </div>
            <div class="qty option-qty">
              <button type="button" data-option-minus="${group.id}:${item.id}">-</button>
              <span data-option-count="${group.id}:${item.id}">0</span>
              <button type="button" data-option-plus="${group.id}:${item.id}">+</button>
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }).join("");
  byId("addWithComplements").disabled = false;
  modal.hidden = false;
}

function closeComplementModal() {
  byId("complementModal").hidden = true;
  pendingProduct = null;
  pendingOptions = {};
}

function selectedGroupTotal(groupId) {
  return Object.entries(pendingOptions)
    .filter(([key]) => key.startsWith(`${groupId}:`))
    .reduce((sum, [, qty]) => sum + qty, 0);
}

function updateOption(key, amount) {
  const [groupId] = key.split(":");
  const group = complementGroups.find(item => String(item.id) === String(groupId));
  const max = Number(group?.maxQty || 100);
  const currentGroupTotal = selectedGroupTotal(groupId);
  const current = pendingOptions[key] || 0;
  if (amount > 0 && currentGroupTotal >= max) return;
  pendingOptions[key] = Math.max(0, current + amount);
  if (!pendingOptions[key]) delete pendingOptions[key];
  const counter = [...document.querySelectorAll("[data-option-count]")].find(item => item.dataset.optionCount === key);
  if (counter) counter.textContent = pendingOptions[key] || 0;
  const heading = [...document.querySelectorAll("[data-group-id]")].find(item => String(item.dataset.groupId) === String(groupId))?.querySelector("h3 span");
  if (heading && group) heading.textContent = `${group.minQty ? "obrigatório" : "opcional"} ${selectedGroupTotal(groupId)}/${group.maxQty || 100}`;
}

function confirmComplements() {
  if (!pendingProduct) return;
  const groups = productComplements(pendingProduct.id);
  const invalid = groups.find(group => selectedGroupTotal(group.id) < Number(group.minQty || 0));
  if (invalid) {
    alert(`Escolha pelo menos ${invalid.minQty} item(ns) em ${cleanText(invalid.name)}.`);
    return;
  }
  const options = Object.entries(pendingOptions).flatMap(([key, qty]) => {
    const [groupId, itemId] = key.split(":");
    const group = complementGroups.find(item => String(item.id) === String(groupId));
    const option = group?.items?.find(item => String(item.id) === String(itemId));
    return option && qty > 0 ? [{
      groupId: Number(groupId),
      groupName: group.name,
      itemId: Number(itemId),
      name: option.name,
      price: Number(option.price || 0),
      qty
    }] : [];
  });
  addItem(pendingProduct.id, 1, options);
  closeComplementModal();
}

async function sendOrder() {
  if (!cartLines().length) return;
  if (!isStoreOpen()) {
    alert("O cardápio está pausado ou fechado no momento.");
    return;
  }
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
  await loadStoreStatusFromDb();
  byId("storeStatus").textContent = storeStatus.label || "Retirada no balcão";
  byId("storeHours").textContent = STORE.hours;
  byId("storeAddress").textContent = cleanText(STORE.address);
  byId("instagramTop").href = STORE.instagram;
  byId("whatsTop").href = `https://wa.me/${STORE.phone}`;
  byId("mapsTop").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE.address + " Tokyo Sushi Tuntum")}`;

  await loadMenuFromDb();
  await loadComplementsFromDb();
  byId("storeStatus").textContent = storeStatus.label || "Retirada no balcão";
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
      if (!isStoreOpen()) {
        alert("O cardápio está pausado ou fechado no momento.");
        return;
      }
      const id = event.target.dataset.id;
      const hasComplements = productComplements(id).length > 0;
      openComplementModal(id);
      if (!hasComplements) {
        event.target.textContent = "Adicionado";
        setTimeout(() => { event.target.textContent = "Adicionar"; }, 750);
      }
    }
    if (event.target.dataset.plus) updateCartLine(Number(event.target.dataset.plus), 1);
    if (event.target.dataset.minus) updateCartLine(Number(event.target.dataset.minus), -1);
    if (event.target.closest("[data-remove-line]")) removeCartLine(Number(event.target.closest("[data-remove-line]").dataset.removeLine));
    if (event.target.dataset.optionPlus) updateOption(event.target.dataset.optionPlus, 1);
    if (event.target.dataset.optionMinus) updateOption(event.target.dataset.optionMinus, -1);
    if (event.target.id === "closeComplementModal") closeComplementModal();
    if (event.target.id === "addWithComplements") confirmComplements();
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
