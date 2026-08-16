const STORE = window.TOKYO_DATA.store;
const DEFAULT_MENU = window.TOKYO_DATA.menu;
const DEFAULT_COMPLEMENTS = window.TOKYO_DATA.complements || [];
const LOCAL_IMAGE_IDS = new Set(DEFAULT_MENU.filter(item => String(item.image || "").startsWith("assets/menu/")).map(item => String(item.id)));
const normalizeMenuImages = products => (Array.isArray(products) ? products : []).map(item => {
  return LOCAL_IMAGE_IDS.has(String(item.id))
    ? { ...item, image: `assets/menu/${item.id}.jpeg` }
    : item;
});
const normalizePublicProduct = item => ({
  ...item,
  activeDays: Array.isArray(item?.activeDays) && item.activeDays.length ? item.activeDays.map(Number) : [0, 1, 2, 3, 4, 5, 6],
  channels: { retirada: true, delivery: false, mesa: false, ...(item?.channels || {}) },
  badges: item?.badges || {},
  archived: item?.archived === true || Boolean(item?.archivedAt),
  stockControlled: item?.stockControlled === true,
  stockQty: item?.stockQty == null || item?.stockQty === "" ? null : Number(item.stockQty)
});
const STORE_STATUS_KEY = "tokyoStoreStatus";
const CUSTOMER_MEMORY_KEY = "tokyoCustomerMemory";
const DEFAULT_STORE_STATUS = { mode: "open", label: "Aberto", manualOverride: false };
function normalizeStoreStatus(value) {
  const source = value || {};
  const manualOverrideDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.manualOverrideDate || ""))
    ? String(source.manualOverrideDate)
    : "";
  if (source.mode === "open") return { ...DEFAULT_STORE_STATUS, manualOverride: source.manualOverride === true, manualOverrideDate };
  return { mode: "closed", label: "Fechado", manualOverride: source.manualOverride !== false, manualOverrideDate };
}
const DEFAULT_STORE_SCHEDULE = window.TokyoSchedule?.normalize
  ? window.TokyoSchedule.normalize({})
  : { enabled: false, weekly: [] };
let MENU = normalizeMenuImages(JSON.parse(localStorage.getItem("tokyoMenu") || "null") || DEFAULT_MENU).map(normalizePublicProduct);
let complementGroups = JSON.parse(localStorage.getItem("tokyoComplements") || "null") || DEFAULT_COMPLEMENTS;
let storeStatus = normalizeStoreStatus(JSON.parse(localStorage.getItem(STORE_STATUS_KEY) || "null") || DEFAULT_STORE_STATUS);
let storeSchedule = window.TokyoSchedule?.normalize
  ? window.TokyoSchedule.normalize(JSON.parse(localStorage.getItem("tokyoStoreSchedule") || "null") || DEFAULT_STORE_SCHEDULE)
  : DEFAULT_STORE_SCHEDULE;
function normalizeBusinessWhatsapp(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55") && [10, 11].includes(digits.length)) digits = `55${digits}`;
  return digits;
}

let businessWhatsapp = normalizeBusinessWhatsapp(STORE.phone);

let searchTerm = "";
let cart = JSON.parse(localStorage.getItem("sushiCart") || "{}");
let deferredPrompt = null;
let pendingProduct = null;
let pendingOptions = {};
let orderSubmitting = false;
let scheduleStatusTimer = null;
let cartTouchStartY = null;

const byId = id => document.getElementById(id);
const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let feedbackTimer = null;
function showFeedback(message, type = "info") {
  const region = byId("feedbackRegion");
  if (!region) return;
  region.innerHTML = `<div class="feedback feedback-${type}" role="status"><span>${escapeHtml(message)}</span><button type="button" aria-label="Fechar mensagem">×</button></div>`;
  region.querySelector("button")?.addEventListener("click", () => { region.innerHTML = ""; });
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => { region.innerHTML = ""; }, 5200);
}
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
const safeImageUrl = value => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

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

function loadCustomerMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOMER_MEMORY_KEY) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function rememberCustomer() {
  const name = byId("customerName")?.value.trim() || "";
  const phone = normalizePhone(byId("customerPhone")?.value || "").slice(0, 11);
  if (!name || phone.length < 10) return;
  localStorage.setItem(CUSTOMER_MEMORY_KEY, JSON.stringify({ name, phone }));
}

function hydrateCustomerMemory() {
  const saved = loadCustomerMemory();
  const nameField = byId("customerName");
  const phoneField = byId("customerPhone");
  if (nameField && !nameField.value && saved.name) nameField.value = String(saved.name);
  if (phoneField && !phoneField.value && saved.phone) phoneField.value = formatPhone(saved.phone);
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

function cartTotal() {
  return cartLines().reduce((sum, line) => {
    const item = MENU.find(product => String(product.id) === String(line.id));
    return item ? sum + lineUnitPrice(line, item) * line.qty : sum;
  }, 0);
}

function getCashPayment(total = cartTotal()) {
  const isCash = byId("paymentMethod")?.value === "Dinheiro";
  if (!isCash) return { isCash: false, amountReceived: null, change: 0, missing: 0 };
  const raw = String(byId("amountReceived")?.value || "").replace(",", ".");
  const parsed = raw === "" ? null : Number(raw);
  const amountReceived = parsed == null || !Number.isFinite(parsed) ? null : Math.max(0, parsed);
  const change = amountReceived != null && amountReceived >= total
    ? Math.round((amountReceived - total) * 100) / 100
    : 0;
  const missing = amountReceived == null
    ? total
    : Math.max(0, Math.round((total - amountReceived) * 100) / 100);
  return { isCash: true, amountReceived, change, missing };
}

function renderCashPayment(total = cartTotal()) {
  const fields = byId("cashPaymentFields");
  const hint = byId("cashChangeHint");
  const cash = getCashPayment(total);
  if (fields) fields.hidden = !cash.isCash;
  if (!hint || !cash.isCash) return;
  if (cash.amountReceived == null) {
    hint.textContent = "Informe o valor recebido para calcular o troco.";
    hint.className = "cash-change";
  } else if (cash.missing > 0) {
    hint.textContent = `Falta pagar ${money(cash.missing)}.`;
    hint.className = "cash-change is-invalid";
  } else {
    hint.textContent = `Troco: ${money(cash.change)}`;
    hint.className = "cash-change is-valid";
  }
}

function optionText(option) {
  if (typeof option === "string") return escapeHtml(cleanText(option));
  return `${option.qty || 1}x ${escapeHtml(cleanText(option.name))}${option.price ? ` (+${money(Number(option.price) * Number(option.qty || 1))})` : ""}`;
}

function setCart(lines) {
  cart = lines.filter(line => line.qty > 0);
  saveCart();
}

async function loadMenuFromDb() {
  if (!window.TokyoDb?.enabled) return;
  try {
    MENU = normalizeMenuImages(await window.TokyoDb.loadMenu(DEFAULT_MENU)).map(normalizePublicProduct);
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
    storeStatus = normalizeStoreStatus(await window.TokyoDb.loadSetting("store_status", DEFAULT_STORE_STATUS));
    localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
  } catch (error) {
    console.warn("Falha ao carregar status do cardapio. Usando cache local.", error);
  }
}

async function loadStoreScheduleFromDb() {
  if (!window.TokyoSchedule?.normalize) return;
  try {
    const saved = window.TokyoDb?.enabled ? await window.TokyoDb.loadSetting("store_schedule", storeSchedule) : storeSchedule;
    storeSchedule = window.TokyoSchedule.normalize(saved || storeSchedule);
    localStorage.setItem("tokyoStoreSchedule", JSON.stringify(storeSchedule));
  } catch (error) {
    console.warn("Falha ao carregar horários do cardápio. Usando cache local.", error);
  }
}

function effectiveStoreStatus() {
  return window.TokyoSchedule?.resolveStatus
    ? window.TokyoSchedule.resolveStatus(storeSchedule, storeStatus)
    : storeStatus;
}

function isStoreOpen() {
  return effectiveStoreStatus().mode === "open";
}

function renderStoreStatus() {
  const status = effectiveStoreStatus();
  const statusIsOpen = status.mode === "open";
  const statusLabel = statusIsOpen ? "Aberto" : "Fechado";
  byId("storeStatus").textContent = statusLabel;
  byId("storeStatusBadge").dataset.mode = statusIsOpen ? "open" : "closed";
  byId("storeStatusBadge").setAttribute("aria-label", `Status da loja: ${statusLabel}`);
}

async function saveOrder() {
  const lines = cartLines();
  const total = cartTotal();
  const payment = byId("paymentMethod").value;
  const cash = getCashPayment(total);
  const clientRequestId = sessionStorage.getItem("tokyoOrderRequestId") || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  sessionStorage.setItem("tokyoOrderRequestId", clientRequestId);
  const order = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    status: "Recebido",
    customerName: byId("customerName").value.trim(),
    customerPhone: normalizePhone(byId("customerPhone").value),
    payment,
    paymentStatus: "pending",
    amountReceived: cash.amountReceived,
    changeAmount: cash.change,
    pricing: { amountReceived: cash.amountReceived },
    notes: byId("notes").value.trim(),
    clientRequestId,
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
  let onlineSaved = !window.TokyoDb?.enabled;
  if (window.TokyoDb?.enabled) {
    try {
      const saved = await window.TokyoDb.createOrder(order);
      const persisted = Array.isArray(saved) ? saved[0] : saved;
      if (persisted?.id) order.id = persisted.id;
      if (persisted?.total !== undefined) order.total = Number(persisted.total);
      onlineSaved = true;
    } catch (error) {
      localStorage.setItem("tokyoPendingOrder", JSON.stringify(order));
      console.warn("Pedido pendente: falhou no banco online.", error);
    }
  }
  if (onlineSaved && !window.TokyoDb?.enabled) {
    const orders = JSON.parse(localStorage.getItem("tokyoOrders") || "[]");
    orders.unshift(order);
    localStorage.setItem("tokyoOrders", JSON.stringify(orders));
  }
  return onlineSaved ? order : false;
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
    const availableToday = (item.activeDays || [0, 1, 2, 3, 4, 5, 6]).includes(new Date().getDay());
    const availableForPickup = item.channels?.retirada !== false;
    const inStock = !item.stockControlled || Number(item.stockQty || 0) > 0;
    return active && !item.archived && availableToday && availableForPickup && inStock && (searchTerm ? text.includes(term) : true);
  });
}

async function loadWhatsappContactFromDb() {
  if (!window.TokyoDb?.enabled) return;
  try {
    const value = await window.TokyoDb.loadSetting("whatsapp_contact", STORE.phone);
    const normalized = normalizeBusinessWhatsapp(value);
    if (normalized) businessWhatsapp = normalized;
  } catch (error) {
    console.warn("Falha ao carregar WhatsApp de atendimento. Usando o padrão local.", error);
  }
}

function whatsappLinks(message) {
  const phone = normalizeBusinessWhatsapp(businessWhatsapp);
  const text = encodeURIComponent(message);
  return {
    app: `whatsapp://send?phone=${phone}&text=${text}`,
    web: `https://api.whatsapp.com/send?phone=${phone}&text=${text}`
  };
}

function setupWhatsappContact() {
  const link = byId("whatsappContact");
  if (!link) return;
  const message = "Olá! Tenho uma dúvida sobre o cardápio da Tokyo Sushi.";
  const links = whatsappLinks(message);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  link.href = isMobile ? links.app : links.web;
  if (link.dataset.whatsappBound) return;
  link.dataset.whatsappBound = "true";
  link.addEventListener("click", event => {
    if (!isMobile) return;
    event.preventDefault();
    openWhatsapp(message);
  }, { once: true });
}

function openWhatsapp(message) {
  const links = whatsappLinks(message);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

  if (!isMobile) {
    window.location.assign(links.web);
    return;
  }

  const onVisibilityChange = () => {
    if (document.hidden) clearFallback();
  };
  let fallbackTimer = window.setTimeout(() => {
    clearFallback();
    if (!document.hidden) window.location.assign(links.web);
  }, 1400);

  const clearFallback = () => {
    window.clearTimeout(fallbackTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };

  document.addEventListener("visibilitychange", onVisibilityChange, { once: true });
  window.location.assign(links.app);
}

function categoryId(cat) {
  return `cat-${cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
}

function renderCategories() {
  const cats = [...new Set(MENU.filter(item => item.active !== false).map(item => item.cat))];
  byId("categories").innerHTML = cats.map(cat => {
    const count = MENU.filter(item => item.cat === cat && item.active !== false).length;
    return `
      <button data-cat="${escapeHtml(cat)}">
        ${escapeHtml(cleanText(cat))} <span>${count}</span>
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
    section.innerHTML = `<h2>${escapeHtml(cleanText(cat))}</h2>`;

    products.filter(item => item.cat === cat).forEach((item, itemIndex) => {
      const node = template.content.cloneNode(true);
      const productNode = node.querySelector(".product");
      productNode.style.setProperty("--item-index", itemIndex);
      const photo = node.querySelector(".photo");
      const imageUrl = safeImageUrl(item.image);
      if (imageUrl) {
        photo.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(cleanText(item.name))}" loading="lazy" decoding="async">`;
        photo.classList.add("real-photo");
        const image = photo.querySelector("img");
        const applyImageFallback = () => {
          if (!image?.isConnected) return;
          image.remove();
          photo.classList.remove("real-photo");
          photo.classList.add("image-fallback");
        };
        image?.addEventListener("error", applyImageFallback, { once: true });
        window.setTimeout(() => {
          if (image?.isConnected && image.complete && !image.naturalWidth) applyImageFallback();
        }, 2500);
      }
      const labels = [cleanText(item.cat)];
      if (item.badges?.promotion) labels.push("Promoção");
      if (item.badges?.bestSeller) labels.push("Mais vendido");
      if (item.badges?.new) labels.push("Novidade");
      node.querySelector(".tag").textContent = labels.join(" · ");
      if (item.highlight) productNode.classList.add("is-highlighted");
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

function setCartOpen(open) {
  const drawer = byId("cartDrawer");
  const scrim = byId("cartScrim");
  const toggle = byId("mobileCartBar");
  const shouldOpen = Boolean(open);

  drawer.classList.toggle("is-open", shouldOpen);
  drawer.setAttribute("aria-hidden", String(!shouldOpen));
  scrim.hidden = !shouldOpen;
  toggle.setAttribute("aria-expanded", String(shouldOpen));
  toggle.setAttribute("aria-label", shouldOpen ? "Fechar pedido" : "Abrir seu pedido");
  document.body.classList.toggle("cart-open", shouldOpen);

  if (shouldOpen) {
    drawer.focus({ preventScroll: true });
  } else if (document.activeElement === drawer || document.activeElement.closest?.("#cartDrawer")) {
    const focusTarget = toggle.hidden ? null : toggle;
    focusTarget?.focus({ preventScroll: true });
  }
}

function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = cartTotal();

  byId("totalValue").textContent = money(total);
  renderCashPayment(total);
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
    const options = line.options?.length ? `
      <div class="cart-options">
        <span class="cart-options-label">Adicionais</span>
        <small>${line.options.map(optionText).join("<br>")}</small>
      </div>
    ` : "";
    const unit = lineUnitPrice(line, item);
    return `
      <div class="cart-row">
        <div>
          <div class="cart-title">
            <strong>${escapeHtml(cleanText(item.name))}</strong>
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
  const cash = getCashPayment();
  const notes = byId("notes").value.trim();
  const lines = [
    `Olá, ${STORE.name}! Gostaria de fazer este pedido:`,
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
  if (cash.isCash) {
    lines.push(`Valor recebido: ${money(cash.amountReceived)}`, `Troco: ${money(cash.change)}`);
  }
  if (notes) lines.push(`Observação: ${notes}`);
  lines.push("", "Por favor, confirme o recebimento e me avise quando estiver pronto.");
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
  const imageUrl = safeImageUrl(product.image);
  byId("modalProductImage").style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
  byId("modalComplements").innerHTML = groups.map(group => {
    const activeItems = (group.items || []).filter(item => item.active !== false);
    return `
      <section class="option-group" data-group-id="${escapeHtml(group.id)}">
        <h3>${escapeHtml(cleanText(group.name))} <span>${group.minQty ? "obrigatório" : "opcional"} 0/${group.maxQty || 100}</span></h3>
        ${activeItems.map(item => `
          <div class="option-row">
            <div>
              <strong>${escapeHtml(cleanText(item.name))}</strong>
              <span>${money(Number(item.price || 0))}</span>
            </div>
            <div class="qty option-qty">
              <button type="button" data-option-minus="${escapeHtml(group.id)}:${escapeHtml(item.id)}">-</button>
              <span data-option-count="${escapeHtml(group.id)}:${escapeHtml(item.id)}">0</span>
              <button type="button" data-option-plus="${escapeHtml(group.id)}:${escapeHtml(item.id)}">+</button>
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
    showFeedback(`Escolha pelo menos ${invalid.minQty} item(ns) em ${cleanText(invalid.name)}.`, "error");
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
  if (orderSubmitting) return;
  if (!cartLines().length) return;
  if (!isStoreOpen()) {
    showFeedback("O cardápio está fechado no momento.", "error");
    return;
  }
  if (!byId("customerName").value.trim()) {
    document.querySelector(".cart").scrollIntoView({ behavior: "smooth", block: "start" });
    byId("customerName").focus();
    showFeedback("Informe o nome para retirada antes de enviar o pedido.", "error");
    return;
  }
  if (normalizePhone(byId("customerPhone").value).length < 10) {
    document.querySelector(".cart").scrollIntoView({ behavior: "smooth", block: "start" });
    byId("customerPhone").focus();
    showFeedback("Informe o celular/WhatsApp para acompanhamento do pedido.", "error");
    return;
  }
  const cash = getCashPayment();
  if (cash.isCash && cash.amountReceived == null) {
    byId("amountReceived")?.focus();
    showFeedback("Informe quanto o cliente vai pagar em dinheiro.", "error");
    return;
  }
  if (cash.isCash && cash.missing > 0) {
    byId("amountReceived")?.focus();
    showFeedback(`O valor recebido precisa ser pelo menos ${money(cartTotal())}.`, "error");
    return;
  }
  rememberCustomer();
  orderSubmitting = true;
  const button = byId("sendOrder");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Registrando pedido...";
  try {
    const savedOrder = await saveOrder();
    if (!savedOrder) {
      showFeedback("Não foi possível registrar o pedido agora. Tente novamente em instantes.", "error");
      return;
    }
    sessionStorage.removeItem("tokyoOrderRequestId");
    localStorage.removeItem("tokyoPendingOrder");
    const whatsappMessage = buildMessage();
    cart = {};
    saveCart();
    renderCart();
    setCartOpen(false);
    openWhatsapp(whatsappMessage);
  } finally {
    orderSubmitting = false;
    button.disabled = !isStoreOpen();
    button.textContent = originalLabel;
  }
}

async function init() {
  // Desenha o estado local primeiro para evitar uma tela vazia enquanto o online responde.
  renderStoreStatus();
  renderMenu();
  renderCart();
  hydrateCustomerMemory();
  setupWhatsappContact();

  await Promise.all([
    loadStoreStatusFromDb(),
    loadStoreScheduleFromDb(),
    loadWhatsappContactFromDb()
  ]);
  setupWhatsappContact();
  renderStoreStatus();

  await Promise.all([
    loadMenuFromDb(),
    loadComplementsFromDb()
  ]);
  renderMenu();
  renderCart();
  if (scheduleStatusTimer) window.clearInterval(scheduleStatusTimer);
  scheduleStatusTimer = window.setInterval(() => {
    const previousMode = effectiveStoreStatus().mode;
    renderStoreStatus();
    if (previousMode !== effectiveStoreStatus().mode) {
      renderMenu();
      renderCart();
    }
  }, 30000);

  byId("menuSearch").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    renderMenu();
  });
  byId("customerPhone").addEventListener("input", event => {
    event.target.value = formatPhone(event.target.value);
  });
  byId("customerName").addEventListener("blur", rememberCustomer);
  byId("customerPhone").addEventListener("blur", rememberCustomer);
  byId("paymentMethod").addEventListener("change", () => {
    renderCart();
    if (byId("paymentMethod").value === "Dinheiro") byId("amountReceived")?.focus();
  });
  byId("amountReceived")?.addEventListener("input", () => renderCart());

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
        showFeedback("O cardápio está fechado no momento.", "error");
        return;
      }
      const id = event.target.dataset.id;
      const hasComplements = productComplements(id).length > 0;
      openComplementModal(id);
      if (!hasComplements) {
        event.target.textContent = "Adicionado";
        event.target.classList.add("added");
        setTimeout(() => {
          event.target.textContent = "Adicionar";
          event.target.classList.remove("added");
        }, 750);
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
    sessionStorage.removeItem("tokyoOrderRequestId");
    localStorage.removeItem("tokyoPendingOrder");
    saveCart();
    renderCart();
  });
  byId("sendOrder").addEventListener("click", sendOrder);
  byId("cartScrim").addEventListener("click", () => setCartOpen(false));
  byId("cartDrawer").addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    cartTouchStartY = event.touches[0].clientY;
  }, { passive: true });
  byId("cartDrawer").addEventListener("touchend", event => {
    if (cartTouchStartY == null || event.changedTouches.length !== 1) return;
    const distance = event.changedTouches[0].clientY - cartTouchStartY;
    const drawerAtTop = byId("cartDrawer").scrollTop <= 4;
    cartTouchStartY = null;
    if (distance > 72 && drawerAtTop) setCartOpen(false);
  }, { passive: true });
  byId("mobileCartBar").addEventListener("click", () => {
    setCartOpen(!byId("cartDrawer").classList.contains("is-open"));
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && byId("cartDrawer").classList.contains("is-open")) {
      setCartOpen(false);
    }
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
    navigator.serviceWorker.register("sw.js?v=20260811-push-2").catch(() => {});
  }
}

init();
