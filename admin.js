const DEFAULT_MENU = window.TOKYO_DATA.menu;
const DEFAULT_COMPLEMENTS = window.TOKYO_DATA.complements || [];
const STORE = window.TOKYO_DATA.store;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);
const ADMIN_SESSION_KEY = "tokyoAdminUnlocked";
const STORE_STATUS_KEY = "tokyoStoreStatus";
const STORE_STATUS = {
  open: { mode: "open", label: "Aberto para retirada" },
  paused: { mode: "paused", label: "Pausado temporariamente" },
  closed: { mode: "closed", label: "Cardápio fechado" }
};

let menu = JSON.parse(localStorage.getItem("tokyoMenu") || "null") || DEFAULT_MENU.map(item => ({ ...item, active: item.active !== false }));
let orders = JSON.parse(localStorage.getItem("tokyoOrders") || "[]");
let promos = JSON.parse(localStorage.getItem("tokyoPromos") || "[]");
let complementGroups = JSON.parse(localStorage.getItem("tokyoComplements") || "null") || DEFAULT_COMPLEMENTS;
let storeStatus = JSON.parse(localStorage.getItem(STORE_STATUS_KEY) || "null") || STORE_STATUS.open;
const productTimers = {};
const complementTimers = {};

async function loadOnlineData() {
  if (!window.TokyoDb?.enabled) return;
  try {
    menu = await window.TokyoDb.loadMenu(DEFAULT_MENU);
    orders = await window.TokyoDb.loadOrders();
    promos = await window.TokyoDb.loadPromos();
    complementGroups = await window.TokyoDb.loadComplements(DEFAULT_COMPLEMENTS).catch(() => complementGroups);
    storeStatus = await window.TokyoDb.loadSetting("store_status", STORE_STATUS.open).catch(() => storeStatus);
    localStorage.setItem("tokyoMenu", JSON.stringify(menu));
    localStorage.setItem("tokyoOrders", JSON.stringify(orders));
    localStorage.setItem("tokyoPromos", JSON.stringify(promos));
    localStorage.setItem("tokyoComplements", JSON.stringify(complementGroups));
    localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
  } catch (error) {
    console.warn("Falha ao carregar dados online. Usando cache local.", error);
  }
}

function saveMenu() {
  localStorage.setItem("tokyoMenu", JSON.stringify(menu));
}

function saveOrders() {
  localStorage.setItem("tokyoOrders", JSON.stringify(orders));
}

function savePromos() {
  localStorage.setItem("tokyoPromos", JSON.stringify(promos));
}

function saveComplements() {
  localStorage.setItem("tokyoComplements", JSON.stringify(complementGroups));
}

function saveStoreStatus() {
  localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
  runOnline(() => window.TokyoDb.saveSetting("store_status", storeStatus), "Falha ao salvar status do cardápio online.");
}

function scheduleProductSave(index) {
  clearTimeout(productTimers[index]);
  productTimers[index] = setTimeout(() => {
    if (!window.TokyoDb?.enabled) return;
    window.TokyoDb.saveProduct(menu[index], index).catch(error => console.warn("Falha ao salvar produto online.", error));
  }, 500);
}

function scheduleComplementSave(index) {
  clearTimeout(complementTimers[index]);
  complementTimers[index] = setTimeout(() => {
    const group = complementGroups[index];
    if (!group) return;
    runOnline(() => window.TokyoDb.saveComplement(group), "Falha ao salvar complemento online.");
  }, 500);
}

function runOnline(action, message) {
  if (!window.TokyoDb?.enabled) return;
  action().catch(error => console.warn(message, error));
}

function formatDate(value) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function orderSummary(order) {
  return [
    `Pedido #${order.id}`,
    `Cliente: ${order.customerName}`,
    `Pagamento: ${order.payment || "-"}`,
    `Total: ${money(order.total)}`,
    "",
    ...order.items.flatMap(item => [
      `${item.qty}x ${item.name} - ${money(item.price * item.qty)}`,
      ...(item.options || []).map(option => `  + ${option.qty}x ${option.name}`)
    ])
  ].join("\n");
}

function orderWhatsappMessage(order) {
  return encodeURIComponent([
    `Olá, ${order.customerName || "cliente"}! Aqui é do ${STORE.name}.`,
    "",
    "Resumo do seu pedido:",
    orderSummary(order),
    "",
    "Se precisar ajustar alguma coisa, pode responder por aqui."
  ].join("\n"));
}

function readyMessage(order) {
  return encodeURIComponent(`Olá, ${order.customerName}! Seu pedido do ${STORE.name} está pronto para retirada.`);
}

function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function renderMetrics() {
  const today = todayKey();
  const todayOrders = orders.filter(order => order.createdAt?.slice(0, 10) === today);
  const revenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pending = orders.filter(order => !["Finalizado", "Cancelado"].includes(order.status)).length;
  const avg = todayOrders.length ? revenue / todayOrders.length : 0;

  byId("metrics").innerHTML = [
    ["Vendas hoje", money(revenue)],
    ["Pedidos hoje", todayOrders.length],
    ["Em aberto", pending],
    ["Ticket médio", money(avg)]
  ].map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderStoreControls() {
  byId("storeStatusAdmin").textContent = storeStatus.label || STORE_STATUS.open.label;
  document.querySelectorAll("[data-store-mode]").forEach(button => {
    button.classList.toggle("active-mode", button.dataset.storeMode === storeStatus.mode);
  });
}

function nextStatuses(status) {
  if (status === "Recebido") return ["Preparando", "Cancelado"];
  if (status === "Preparando") return ["Pronto", "Cancelado"];
  if (status === "Pronto") return ["Finalizado"];
  return [];
}

function orderCard(order) {
  const actions = nextStatuses(order.status);
  return `
    <article class="order-card compact">
      <div>
        <div class="order-title">
          <strong>#${order.id} - ${order.customerName || "Cliente"}</strong>
          <span>${formatDate(order.createdAt)}</span>
        </div>
        <p>WhatsApp: ${order.customerPhone || "-"} | ${order.payment || "-"} | <strong>${money(order.total)}</strong></p>
        <ul class="order-items">
          ${order.items.map(item => `
            <li>
              ${item.qty}x ${item.name}
              ${(item.options || []).length ? `<small>${item.options.map(option => `+ ${option.qty}x ${option.name}`).join("<br>")}</small>` : ""}
            </li>
          `).join("")}
        </ul>
        ${order.notes ? `<p><strong>Obs.:</strong> ${order.notes}</p>` : ""}
      </div>
      <div class="order-actions">
        ${actions.map(status => `<button class="${status === "Cancelado" ? "danger" : "primary"}" data-quick-status="${order.id}:${status}">${status}</button>`).join("")}
        <a class="whatsapp-action" href="https://wa.me/${whatsappNumber(order.customerPhone)}?text=${orderWhatsappMessage(order)}" target="_blank" rel="noopener" title="Abrir WhatsApp do cliente">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.45 15.09L2.4 21.6l4.62-1.16A9.95 9.95 0 1 0 12.04 2Zm0 2a7.95 7.95 0 0 1 6.72 12.2 7.93 7.93 0 0 1-10.93 2.32l-.38-.23-2.24.56.58-2.17-.25-.4A7.95 7.95 0 0 1 12.04 4Zm-3.05 3.7c-.18 0-.46.06-.7.33-.24.26-.92.9-.92 2.2s.94 2.55 1.07 2.73c.13.18 1.82 2.91 4.51 3.96 2.23.88 2.68.7 3.16.66.49-.05 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.06-.11-.24-.18-.51-.31-.27-.13-1.57-.78-1.82-.87-.24-.09-.42-.13-.6.13-.18.27-.69.87-.85 1.04-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.8-.71-1.34-1.59-1.49-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.44.09-.18.05-.33-.02-.47-.07-.13-.6-1.45-.82-1.99-.22-.52-.44-.45-.6-.46h-.44Z"/></svg>
          WhatsApp
        </a>
        <button class="ghost" data-copy-order="${order.id}">Copiar</button>
        <a class="ghost" href="https://wa.me/${whatsappNumber(order.customerPhone)}?text=${readyMessage(order)}" target="_blank" rel="noopener">Pronto</a>
      </div>
    </article>
  `;
}

function renderOrders() {
  if (!orders.length) {
    byId("ordersList").innerHTML = `<div class="order-card"><p>Nenhum pedido salvo ainda.</p></div>`;
    return;
  }

  const columns = [
    ["Recebidos", orders.filter(order => order.status === "Recebido")],
    ["Preparando", orders.filter(order => order.status === "Preparando")],
    ["Prontos", orders.filter(order => order.status === "Pronto")],
    ["Fechados", orders.filter(order => ["Finalizado", "Cancelado"].includes(order.status)).slice(0, 12)]
  ];

  byId("ordersList").innerHTML = `
    <div class="kanban">
      ${columns.map(([title, items]) => `
        <section class="order-column">
          <h2>${title} <span>${items.length}</span></h2>
          ${items.map(orderCard).join("") || `<p class="empty-column">Nenhum pedido.</p>`}
        </section>
      `).join("")}
    </div>
  `;
}

function renderComplements() {
  const term = (byId("complementSearch")?.value || "").toLowerCase().trim();
  const groups = complementGroups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => !term || `${group.name} ${(group.items || []).map(item => item.name).join(" ")}`.toLowerCase().includes(term));

  byId("complementEditor").innerHTML = groups.map(({ group, index }) => `
    <article class="complement-card">
      <div class="complement-head">
        <label>Nome da lista<input data-complement-field="name" data-cindex="${index}" value="${group.name || ""}"></label>
        <label>Mínimo<input type="number" min="0" data-complement-field="minQty" data-cindex="${index}" value="${group.minQty || 0}"></label>
        <label>Máximo<input type="number" min="1" data-complement-field="maxQty" data-cindex="${index}" value="${group.maxQty || 100}"></label>
        <label class="check-line"><input type="checkbox" data-complement-field="active" data-cindex="${index}" ${group.active !== false ? "checked" : ""}> Ativo</label>
        <button class="danger" data-remove-complement="${index}">Excluir lista</button>
      </div>

      <details open>
        <summary>Produtos vinculados (${(group.linkedProductIds || []).length})</summary>
        <div class="linked-products">
          ${menu.map(product => `
            <label>
              <input type="checkbox" data-link-product="${index}:${product.id}" ${(group.linkedProductIds || []).map(String).includes(String(product.id)) ? "checked" : ""}>
              ${product.name}
            </label>
          `).join("")}
        </div>
      </details>

      <div class="complement-items">
        <div class="complement-items-head">
          <strong>Itens da lista</strong>
          <button class="ghost" data-add-complement-item="${index}">Adicionar item</button>
        </div>
        ${(group.items || []).map((item, itemIndex) => `
          <div class="complement-item">
            <input data-complement-item-field="name" data-cindex="${index}" data-iindex="${itemIndex}" value="${item.name || ""}" placeholder="Nome">
            <input type="number" step="0.01" data-complement-item-field="price" data-cindex="${index}" data-iindex="${itemIndex}" value="${item.price || 0}" placeholder="Preço">
            <label class="check-line"><input type="checkbox" data-complement-item-field="active" data-cindex="${index}" data-iindex="${itemIndex}" ${item.active !== false ? "checked" : ""}> Ativo</label>
            <button class="danger" data-remove-complement-item="${index}:${itemIndex}">Excluir</button>
          </div>
        `).join("") || `<p>Nenhum item cadastrado nesta lista.</p>`}
      </div>
    </article>
  `).join("") || `<div class="order-card"><p>Nenhuma lista de complemento cadastrada.</p></div>`;
}

function renderMenuEditor() {
  byId("menuEditor").innerHTML = menu.map((item, index) => `
    <article class="product-edit">
      <img src="${item.image || ""}" alt="">
      <label>Nome<input data-menu-field="name" data-index="${index}" value="${item.name || ""}"></label>
      <label>Categoria<input data-menu-field="cat" data-index="${index}" value="${item.cat || ""}"></label>
      <label>Preço<input data-menu-field="price" data-index="${index}" type="number" step="0.01" value="${item.price || 0}"></label>
      <label>Descrição<textarea data-menu-field="desc" data-index="${index}">${item.desc || ""}</textarea></label>
      <label>Imagem<input data-menu-field="image" data-index="${index}" value="${item.image || ""}"></label>
      <div class="checks"><input data-menu-field="active" data-index="${index}" type="checkbox" ${item.active !== false ? "checked" : ""}> Ativo</div>
      <div class="row-actions">
        <button class="danger" data-remove-product="${index}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function renderReports() {
  const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const byPayment = {};
  const byProduct = {};

  orders.forEach(order => {
    byPayment[order.payment || "Sem pagamento"] = (byPayment[order.payment || "Sem pagamento"] || 0) + Number(order.total || 0);
    order.items.forEach(item => {
      byProduct[item.name] = (byProduct[item.name] || 0) + item.qty;
    });
  });

  const paymentRows = Object.entries(byPayment).map(([name, value]) => `
    <p>${name}: <strong>${money(value)}</strong></p>
    <div class="bar"><span style="width:${total ? Math.round((value / total) * 100) : 0}%"></span></div>
  `).join("") || "<p>Sem vendas ainda.</p>";

  const productRows = Object.entries(byProduct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, qty]) => `<p>${name}: <strong>${qty}</strong></p>`)
    .join("") || "<p>Sem produtos vendidos ainda.</p>";

  byId("reports").innerHTML = `
    <article class="report-box"><h2>Faturamento total</h2><strong>${money(total)}</strong></article>
    <article class="report-box"><h2>Total de pedidos</h2><strong>${orders.length}</strong></article>
    <article class="report-box"><h2>Pagamentos</h2>${paymentRows}</article>
    <article class="report-box"><h2>Mais vendidos</h2>${productRows}</article>
  `;
}

function renderPromos() {
  byId("promoList").innerHTML = promos.map((promo, index) => `
    <article class="promo-card">
      <strong>${promo.title}</strong>
      <p>${promo.text}</p>
      <button class="ghost" data-copy-promo="${index}">Copiar mensagem</button>
      <button class="danger" data-remove-promo="${index}">Excluir</button>
    </article>
  `).join("") || `<p>Nenhuma promoção cadastrada.</p>`;
}

function renderAll() {
  renderStoreControls();
  renderMetrics();
  renderOrders();
  renderMenuEditor();
  renderComplements();
  renderReports();
  renderPromos();
}

document.querySelector(".tabs").addEventListener("click", event => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  document.querySelectorAll(".tabs button").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
  byId(`${button.dataset.tab}Panel`).classList.add("active");
});

document.body.addEventListener("input", event => {
  const field = event.target.dataset.menuField;
  if (!field) return;
  const item = menu[Number(event.target.dataset.index)];
  if (!item) return;
  item[field] = field === "active" ? event.target.checked : field === "price" ? Number(event.target.value) : event.target.value;
  saveMenu();
  renderMetrics();
});

document.body.addEventListener("input", event => {
  const field = event.target.dataset.complementField;
  const itemField = event.target.dataset.complementItemField;
  if (!field && !itemField) return;

  const group = complementGroups[Number(event.target.dataset.cindex)];
  if (!group) return;

  if (field) {
    group[field] = field === "active"
      ? event.target.checked
      : ["minQty", "maxQty"].includes(field)
        ? Number(event.target.value)
        : event.target.value;
  }

  if (itemField) {
    const item = group.items?.[Number(event.target.dataset.iindex)];
    if (!item) return;
    item[itemField] = itemField === "active" ? event.target.checked : itemField === "price" ? Number(event.target.value) : event.target.value;
  }

  saveComplements();
  scheduleComplementSave(Number(event.target.dataset.cindex));
});

document.body.addEventListener("change", event => {
  if (event.target.dataset.orderStatus) {
    const order = orders.find(item => String(item.id) === String(event.target.dataset.orderStatus));
    if (order) {
      order.status = event.target.value;
      saveOrders();
      runOnline(() => window.TokyoDb.updateOrderStatus(order.id, order.status), "Falha ao atualizar pedido online.");
      renderAll();
    }
  }
  if (event.target.dataset.linkProduct) {
    const [groupIndex, productId] = event.target.dataset.linkProduct.split(":");
    const group = complementGroups[Number(groupIndex)];
    if (!group) return;
    const ids = new Set((group.linkedProductIds || []).map(String));
    event.target.checked ? ids.add(String(productId)) : ids.delete(String(productId));
    group.linkedProductIds = [...ids];
    saveComplements();
    scheduleComplementSave(Number(groupIndex));
    renderComplements();
  }
});

document.body.addEventListener("click", async event => {
  if (event.target.dataset.quickStatus) {
    const [id, status] = event.target.dataset.quickStatus.split(":");
    const order = orders.find(item => String(item.id) === String(id));
    if (order) {
      order.status = status;
      saveOrders();
      runOnline(() => window.TokyoDb.updateOrderStatus(order.id, order.status), "Falha ao atualizar pedido online.");
      renderAll();
    }
  }
  if (event.target.dataset.copyOrder) {
    const order = orders.find(item => String(item.id) === String(event.target.dataset.copyOrder));
    if (order) await navigator.clipboard.writeText(orderSummary(order));
  }
  if (event.target.dataset.removeProduct) {
    const index = Number(event.target.dataset.removeProduct);
    const item = menu[index];
    menu.splice(index, 1);
    saveMenu();
    runOnline(() => window.TokyoDb.deleteProduct(item.id), "Falha ao excluir produto online.");
    renderMenuEditor();
  }
  if (event.target.dataset.copyPromo) {
    const promo = promos[Number(event.target.dataset.copyPromo)];
    if (promo) await navigator.clipboard.writeText(promo.text);
  }
  if (event.target.dataset.removePromo) {
    const promo = promos[Number(event.target.dataset.removePromo)];
    promos.splice(Number(event.target.dataset.removePromo), 1);
    savePromos();
    if (promo?.id) runOnline(() => window.TokyoDb.deletePromo(promo.id), "Falha ao excluir promocao online.");
    renderPromos();
  }
  if (event.target.dataset.addComplementItem) {
    const group = complementGroups[Number(event.target.dataset.addComplementItem)];
    if (!group) return;
    group.items = group.items || [];
    group.items.push({ id: Date.now(), name: "Novo complemento", price: 0, active: true });
    saveComplements();
    scheduleComplementSave(Number(event.target.dataset.addComplementItem));
    renderComplements();
  }
  if (event.target.dataset.removeComplementItem) {
    const [groupIndex, itemIndex] = event.target.dataset.removeComplementItem.split(":").map(Number);
    const group = complementGroups[groupIndex];
    if (!group) return;
    group.items.splice(itemIndex, 1);
    saveComplements();
    scheduleComplementSave(groupIndex);
    renderComplements();
  }
  if (event.target.dataset.removeComplement) {
    const index = Number(event.target.dataset.removeComplement);
    const group = complementGroups[index];
    if (!confirm(`Excluir a lista "${group?.name || "sem nome"}"?`)) return;
    complementGroups.splice(index, 1);
    saveComplements();
    if (group?.id) runOnline(() => window.TokyoDb.deleteComplement(group.id), "Falha ao excluir complemento online.");
    renderComplements();
  }
  if (event.target.dataset.storeMode) {
    storeStatus = STORE_STATUS[event.target.dataset.storeMode] || STORE_STATUS.open;
    saveStoreStatus();
    renderStoreControls();
  }
});

byId("addProduct").addEventListener("click", () => {
  menu.unshift({
    id: Date.now(),
    cat: "Nova categoria",
    name: "Novo item",
    desc: "",
    price: 0,
    image: "",
    active: true
  });
  saveMenu();
  runOnline(() => window.TokyoDb.saveProduct(menu[0], 0), "Falha ao criar produto online.");
  renderMenuEditor();
});

byId("resetMenu").addEventListener("click", () => {
  if (!confirm("Restaurar o cardápio original importado?")) return;
  menu = DEFAULT_MENU.map(item => ({ ...item, active: true }));
  saveMenu();
  runOnline(() => window.TokyoDb.seedMenu(menu), "Falha ao restaurar cardapio online.");
  renderMenuEditor();
});

byId("clearDone").addEventListener("click", () => {
  orders = orders.filter(order => !["Finalizado", "Cancelado"].includes(order.status));
  saveOrders();
  runOnline(() => window.TokyoDb.deleteOrdersByStatus(["Finalizado", "Cancelado"]), "Falha ao limpar pedidos online.");
  renderAll();
});

byId("promoForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = byId("promoTitle").value.trim();
  const text = byId("promoText").value.trim();
  if (!title || !text) return;
  const promo = { title, text, created_at: new Date().toISOString() };
  promos.unshift({ ...promo, createdAt: promo.created_at });
  savePromos();
  runOnline(() => window.TokyoDb.savePromo(promo), "Falha ao salvar promocao online.");
  event.target.reset();
  renderPromos();
});

byId("addComplementGroup").addEventListener("click", () => {
  const group = {
    id: Date.now(),
    name: "Nova lista de complemento",
    minQty: 0,
    maxQty: 100,
    active: true,
    linkedProductIds: [],
    items: [{ id: Date.now() + 1, name: "Novo complemento", price: 0, active: true }]
  };
  complementGroups.unshift(group);
  saveComplements();
  runOnline(() => window.TokyoDb.saveComplement(group), "Falha ao criar complemento online.");
  renderComplements();
});

byId("complementSearch").addEventListener("input", renderComplements);

document.body.addEventListener("input", event => {
  const field = event.target.dataset.menuField;
  if (!field) return;
  scheduleProductSave(Number(event.target.dataset.index));
});

function unlockAdmin() {
  document.body.classList.remove("admin-locked");
  loadOnlineData().then(renderAll);
}

function initAdminLogin() {
  const password = window.TOKYO_CONFIG?.adminPassword || "tokyo2026";
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
    unlockAdmin();
    return;
  }

  byId("loginForm").addEventListener("submit", event => {
    event.preventDefault();
    const typed = byId("adminPassword").value.trim();
    if (typed !== password) {
      byId("loginMessage").textContent = "Senha incorreta.";
      byId("adminPassword").select();
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    unlockAdmin();
  });
}

byId("logoutAdmin").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
});

initAdminLogin();
