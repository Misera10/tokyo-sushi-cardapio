const DEFAULT_MENU = window.TOKYO_DATA.menu;
const DEFAULT_COMPLEMENTS = window.TOKYO_DATA.complements || [];
const STORE = window.TOKYO_DATA.store;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
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
let cashSession = JSON.parse(localStorage.getItem("tokyoCashSession") || "null") || { open: false, opening: 0, transactions: [] };
let customerProfiles = JSON.parse(localStorage.getItem("tokyoCustomerProfiles") || "{}");
let hiddenCustomerKeys = JSON.parse(localStorage.getItem("tokyoHiddenCustomers") || "[]");
let pdvCart = [];
let editingProductId = null;
const productTimers = {};
const complementTimers = {};

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

async function loadOnlineData() {
  if (!window.TokyoDb?.enabled) return;
  try {
    menu = await window.TokyoDb.loadMenu(DEFAULT_MENU);
    orders = await window.TokyoDb.loadOrders();
    promos = await window.TokyoDb.loadPromos();
    complementGroups = withDefaultComplements(await window.TokyoDb.loadComplements(DEFAULT_COMPLEMENTS).catch(() => complementGroups));
    storeStatus = await window.TokyoDb.loadSetting("store_status", STORE_STATUS.open).catch(() => storeStatus);
    cashSession = await window.TokyoDb.loadSetting("cash_session", cashSession).catch(() => cashSession);
    customerProfiles = await window.TokyoDb.loadSetting("customer_profiles", customerProfiles).catch(() => customerProfiles);
    hiddenCustomerKeys = await window.TokyoDb.loadSetting("hidden_customers", hiddenCustomerKeys).catch(() => hiddenCustomerKeys);
    localStorage.setItem("tokyoMenu", JSON.stringify(menu));
    localStorage.setItem("tokyoOrders", JSON.stringify(orders));
    localStorage.setItem("tokyoPromos", JSON.stringify(promos));
    localStorage.setItem("tokyoComplements", JSON.stringify(complementGroups));
    localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
    localStorage.setItem("tokyoCashSession", JSON.stringify(cashSession));
    localStorage.setItem("tokyoCustomerProfiles", JSON.stringify(customerProfiles));
    localStorage.setItem("tokyoHiddenCustomers", JSON.stringify(hiddenCustomerKeys));
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

function saveCashSession() {
  localStorage.setItem("tokyoCashSession", JSON.stringify(cashSession));
  runOnline(() => window.TokyoDb.saveSetting("cash_session", cashSession), "Falha ao salvar o caixa online.");
}

function saveCustomerData() {
  localStorage.setItem("tokyoCustomerProfiles", JSON.stringify(customerProfiles));
  localStorage.setItem("tokyoHiddenCustomers", JSON.stringify(hiddenCustomerKeys));
  runOnline(() => window.TokyoDb.saveSetting("customer_profiles", customerProfiles), "Falha ao salvar clientes online.");
  runOnline(() => window.TokyoDb.saveSetting("hidden_customers", hiddenCustomerKeys), "Falha ao salvar clientes removidos online.");
}

function customerKey(name, phone) {
  return String(phone || "").replace(/\D/g, "") || String(name || "").trim().toLowerCase() || `cliente-${Date.now()}`;
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

function printOrder(order) {
  const width = localStorage.getItem("tokyoPrinterWidth") || "80";
  const receipt = window.open("", "_blank", "width=420,height=720");
  if (!receipt) return alert("Permita pop-ups para imprimir a comanda.");
  const items = order.items.map(item => `
    <div class="item"><strong>${item.qty}x ${escapeHtml(item.name)}</strong><span>${money(Number(item.price || 0) * Number(item.qty || 0))}</span></div>
    ${(item.options || []).map(option => `<small>+ ${option.qty}x ${escapeHtml(option.name)}</small>`).join("")}
  `).join("");
  receipt.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido ${escapeHtml(order.id)}</title><style>
    @page{size:${width}mm auto;margin:3mm}*{box-sizing:border-box}body{width:${width - 6}mm;margin:0;color:#000;font:13px/1.35 "Courier New",monospace}h1,p{margin:0 0 6px}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}.item{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.item strong{max-width:70%}small{display:block;margin-left:10px}.total{display:flex;justify-content:space-between;font-size:16px;font-weight:bold}.notes{border:1px solid #000;padding:6px;margin-top:8px}
  </style></head><body>
    <div class="center"><h1>TOKYO SUSHI</h1><strong>PEDIDO #${escapeHtml(order.id)}</strong><p>${escapeHtml(formatDate(order.createdAt))}</p></div>
    <div class="line"></div><p><strong>Cliente:</strong> ${escapeHtml(order.customerName || "Cliente")}</p><p><strong>Celular:</strong> ${escapeHtml(order.customerPhone || "-")}</p><p><strong>Pagamento:</strong> ${escapeHtml(order.payment || "-")}</p>
    <div class="line"></div>${items}<div class="line"></div><div class="total"><span>TOTAL</span><span>${money(order.total)}</span></div>
    ${order.notes ? `<div class="notes"><strong>OBSERVAÇÃO</strong><br>${escapeHtml(order.notes)}</div>` : ""}
    <div class="line"></div><p class="center">RETIRADA NO BALCÃO</p>
  </body></html>`);
  receipt.document.close();
  receipt.focus();
  setTimeout(() => receipt.print(), 250);
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
  if (byId("settingsStoreStatus")) byId("settingsStoreStatus").textContent = storeStatus.label || STORE_STATUS.open.label;
  if (byId("databaseStatus")) byId("databaseStatus").textContent = window.TokyoDb?.enabled ? "Online e sincronizado pelo Supabase." : "Modo local neste dispositivo.";
  document.querySelectorAll("[data-store-mode]").forEach(button => {
    button.classList.toggle("active-mode", button.dataset.storeMode === storeStatus.mode);
  });
}

function filteredOrders() {
  const term = (byId("orderSearch")?.value || "").toLowerCase().trim();
  const status = byId("orderStatusFilter")?.value || "";
  return orders.filter(order => {
    const text = `${order.id} ${order.customerName || ""} ${order.customerPhone || ""}`.toLowerCase();
    return (!term || text.includes(term)) && (!status || order.status === status);
  });
}

function nextStatuses(status) {
  if (status === "Recebido") return [
    { label: "Preparar", value: "Preparando", kind: "primary" },
    { label: "Cancelar", value: "Cancelado", kind: "danger" }
  ];
  if (status === "Preparando") return [
    { label: "Marcar pronto", value: "Pronto", kind: "primary" },
    { label: "Cancelar", value: "Cancelado", kind: "danger" }
  ];
  if (status === "Pronto") return [
    { label: "Finalizar", value: "Finalizado", kind: "primary" }
  ];
  return [];
}

function orderCard(order) {
  const actions = nextStatuses(order.status);
  return `
    <article class="order-card compact">
      <div>
        <div class="order-title">
          <strong>${order.customerName || "Cliente"}</strong>
          <span>#${order.id}</span>
        </div>
        <div class="order-meta">
          <span>${formatDate(order.createdAt)}</span>
          <span>${order.customerPhone || "-"}</span>
          <span>${order.payment || "-"}</span>
          <strong>${money(order.total)}</strong>
        </div>
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
        ${actions.map(action => `<button class="action-btn ${action.kind}" data-quick-status="${order.id}:${action.value}">${action.label}</button>`).join("")}
        <a class="action-btn whatsapp-action" href="https://wa.me/${whatsappNumber(order.customerPhone)}?text=${orderWhatsappMessage(order)}" target="_blank" rel="noopener" title="Abrir WhatsApp do cliente">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.45 15.09L2.4 21.6l4.62-1.16A9.95 9.95 0 1 0 12.04 2Zm0 2a7.95 7.95 0 0 1 6.72 12.2 7.93 7.93 0 0 1-10.93 2.32l-.38-.23-2.24.56.58-2.17-.25-.4A7.95 7.95 0 0 1 12.04 4Zm-3.05 3.7c-.18 0-.46.06-.7.33-.24.26-.92.9-.92 2.2s.94 2.55 1.07 2.73c.13.18 1.82 2.91 4.51 3.96 2.23.88 2.68.7 3.16.66.49-.05 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.06-.11-.24-.18-.51-.31-.27-.13-1.57-.78-1.82-.87-.24-.09-.42-.13-.6.13-.18.27-.69.87-.85 1.04-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.8-.71-1.34-1.59-1.49-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.44.09-.18.05-.33-.02-.47-.07-.13-.6-1.45-.82-1.99-.22-.52-.44-.45-.6-.46h-.44Z"/></svg>
          WhatsApp
        </a>
        <button class="action-btn ghost icon-action" data-print-order="${order.id}" aria-label="Imprimir comanda" title="Imprimir comanda">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V2h12v7h1a3 3 0 0 1 3 3v6h-4v4H6v-4H2v-6a3 3 0 0 1 3-3h1Zm2-5v5h8V4H8Zm8 12H8v4h8v-4Zm3-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
        </button>
        <button class="action-btn ghost" data-copy-order="${order.id}">Copiar</button>
        <a class="action-btn ghost" href="https://wa.me/${whatsappNumber(order.customerPhone)}?text=${readyMessage(order)}" target="_blank" rel="noopener">Avisar</a>
      </div>
    </article>
  `;
}

function renderOrders() {
  const visibleOrders = filteredOrders();
  if (!visibleOrders.length) {
    byId("ordersList").innerHTML = `<div class="order-card"><p>Nenhum pedido salvo ainda.</p></div>`;
    return;
  }

  const columns = [
    ["Recebidos", visibleOrders.filter(order => order.status === "Recebido")],
    ["Preparando", visibleOrders.filter(order => order.status === "Preparando")],
    ["Prontos", visibleOrders.filter(order => order.status === "Pronto")],
    ["Fechados", visibleOrders.filter(order => ["Finalizado", "Cancelado"].includes(order.status)).slice(0, 24)]
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
    .filter(({ group }) => {
      const linkedNames = menu.filter(product => (group.linkedProductIds || []).map(String).includes(String(product.id))).map(product => product.name).join(" ");
      return !term || `${group.name} ${(group.items || []).map(item => item.name).join(" ")} ${linkedNames}`.toLowerCase().includes(term);
    });

  byId("complementEditor").innerHTML = groups.map(({ group, index }) => `
    <article class="complement-card">
      <div class="complement-head">
        <label>Nome da lista<input data-complement-field="name" data-cindex="${index}" value="${group.name || ""}"></label>
        <label>Mínimo<input type="number" min="0" data-complement-field="minQty" data-cindex="${index}" value="${group.minQty || 0}"></label>
        <label>Máximo<input type="number" min="1" data-complement-field="maxQty" data-cindex="${index}" value="${group.maxQty || 100}"></label>
        <label class="check-line"><input type="checkbox" data-complement-field="active" data-cindex="${index}" ${group.active !== false ? "checked" : ""}> Ativo</label>
        <div class="row-actions"><button class="ghost" data-duplicate-complement="${index}">Duplicar</button><button class="danger" data-remove-complement="${index}">Excluir</button></div>
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
  byId("menuEditor").innerHTML = menu.map((item, index) => {
    const editing = String(editingProductId) === String(item.id);
    return `
    <article class="product-edit ${editing ? "editing" : ""}">
      <img src="${item.image || ""}" alt="">
      <label>Nome<input data-menu-field="name" data-index="${index}" value="${item.name || ""}" ${editing ? "" : "disabled"}></label>
      <label>Categoria<input data-menu-field="cat" data-index="${index}" value="${item.cat || ""}" ${editing ? "" : "disabled"}></label>
      <label>Preço<input data-menu-field="price" data-index="${index}" type="number" step="0.01" value="${item.price || 0}" ${editing ? "" : "disabled"}></label>
      <label>Descrição<textarea data-menu-field="desc" data-index="${index}" ${editing ? "" : "disabled"}>${item.desc || ""}</textarea></label>
      <label>Imagem<input data-menu-field="image" data-index="${index}" value="${item.image || ""}" ${editing ? "" : "disabled"}></label>
      <div class="checks"><input data-menu-field="active" data-index="${index}" type="checkbox" ${item.active !== false ? "checked" : ""}> Ativo</div>
      <div class="row-actions">
        <button class="ghost" data-edit-product="${index}">${editing ? "Salvar" : "Editar"}</button>
        <button class="ghost" data-duplicate-product="${index}">Duplicar</button>
        <button class="ghost" data-product-complements="${index}">Complementos</button>
        <button class="danger" data-remove-product="${index}">Excluir</button>
      </div>
      <p class="product-links">Complementos: ${complementGroups.filter(group => (group.linkedProductIds || []).map(String).includes(String(item.id))).map(group => group.name).join(", ") || "nenhum vinculado"}</p>
    </article>
  `}).join("");
}

function pdvTotal() {
  return pdvCart.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0);
}

function renderPdv() {
  byId("pdvProduct").innerHTML = menu.filter(item => item.active !== false).map(item => `<option value="${item.id}">${item.name} - ${money(item.price)}</option>`).join("");
  byId("pdvCart").innerHTML = `
    <h2>Pedido atual</h2>
    ${pdvCart.map((line, index) => `<div class="pdv-cart-row"><span>${line.qty}x ${line.name}</span><strong>${money(line.qty * line.price)}</strong><button class="danger" data-remove-pdv="${index}" type="button">Excluir</button></div>`).join("") || `<p>Nenhum item adicionado.</p>`}
    <div class="pdv-total"><span>Total</span><strong>${money(pdvTotal())}</strong></div>
  `;
}

function renderKds() {
  const active = orders.filter(order => ["Recebido", "Preparando"].includes(order.status));
  byId("kdsGrid").innerHTML = active.map(order => `
    <article class="kds-card ${order.status === "Preparando" ? "preparing" : ""}">
      <h2>#${order.id} · ${order.customerName || "Cliente"}</h2>
      <small>${formatDate(order.createdAt)} · ${order.status}</small>
      <ul>${order.items.map(item => `<li><strong>${item.qty}x</strong> ${item.name}${(item.options || []).length ? `<small>${item.options.map(option => ` + ${option.qty}x ${option.name}`).join("<br>")}</small>` : ""}</li>`).join("")}</ul>
      ${order.notes ? `<p><strong>Observação:</strong> ${order.notes}</p>` : ""}
      <div class="actions"><button class="primary" data-quick-status="${order.id}:${order.status === "Recebido" ? "Preparando" : "Pronto"}">${order.status === "Recebido" ? "Iniciar preparo" : "Marcar pronto"}</button><button class="ghost" data-print-order="${order.id}">Imprimir</button></div>
    </article>
  `).join("") || `<p>Nenhum pedido aguardando preparo.</p>`;
}

function reportOrders() {
  const start = byId("reportStart")?.value || "";
  const end = byId("reportEnd")?.value || "";
  return orders.filter(order => {
    const date = String(order.createdAt || "").slice(0, 10);
    return order.status !== "Cancelado" && (!start || date >= start) && (!end || date <= end);
  });
}

function renderReports() {
  const selectedOrders = reportOrders();
  const total = selectedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const byPayment = {};
  const byProduct = {};

  selectedOrders.forEach(order => {
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
    <article class="report-box"><h2>Total de pedidos</h2><strong>${selectedOrders.length}</strong></article>
    <article class="report-box"><h2>Pagamentos</h2>${paymentRows}</article>
    <article class="report-box"><h2>Mais vendidos</h2>${productRows}</article>
  `;
}

function renderCash() {
  const today = todayKey();
  const todayOrders = orders.filter(order => order.createdAt?.slice(0, 10) === today && order.status !== "Cancelado");
  const payments = todayOrders.reduce((result, order) => {
    const name = order.payment || "Não informado";
    result[name] = (result[name] || 0) + Number(order.total || 0);
    return result;
  }, {});
  const sales = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const entries = (cashSession.transactions || []).filter(item => item.type === "entrada").reduce((sum, item) => sum + Number(item.value || 0), 0);
  const exits = (cashSession.transactions || []).filter(item => item.type === "saida").reduce((sum, item) => sum + Number(item.value || 0), 0);
  const balance = Number(cashSession.opening || 0) + sales + entries - exits;
  byId("cashOpenForm").hidden = cashSession.open;
  byId("cashEntryForm").hidden = !cashSession.open;
  byId("cashSummary").innerHTML = `
    <article class="report-box"><h2>Status</h2><strong>${cashSession.open ? "Aberto" : "Fechado"}</strong></article>
    <article class="report-box"><h2>Faturamento hoje</h2><strong>${money(sales)}</strong></article>
    <article class="report-box"><h2>Pedidos válidos</h2><strong>${todayOrders.length}</strong></article>
    <article class="report-box"><h2>Por pagamento</h2>${Object.entries(payments).map(([name, value]) => `<p>${name}: <strong>${money(value)}</strong></p>`).join("") || "<p>Sem vendas hoje.</p>"}</article>
    <article class="report-box"><h2>Saldo esperado</h2><strong>${money(balance)}</strong></article>
  `;
  byId("cashMovements").innerHTML = `<strong>Entradas e saídas</strong>${(cashSession.transactions || []).map(item => `<div class="cash-movement"><span>${item.description || (item.type === "entrada" ? "Entrada" : "Saída")}</span><small>${formatDate(item.createdAt)}</small><strong class="${item.type}">${item.type === "entrada" ? "+" : "-"} ${money(item.value)}</strong></div>`).join("") || `<p>Nenhum movimento registrado.</p>`}`;
}

function customerRecord(key) {
  const profile = customerProfiles?.[key];
  if (profile) return { key, ...profile };
  const order = orders.find(item => customerKey(item.customerName, item.customerPhone) === key);
  return order ? { key, name: order.customerName || "Cliente", phone: order.customerPhone || "", notes: "" } : null;
}

function openCustomerEditor(key = "") {
  const customer = key ? customerRecord(key) : null;
  byId("customerKey").value = key;
  byId("customerNameEdit").value = customer?.name || "";
  byId("customerPhoneEdit").value = customer?.phone || "";
  byId("customerNotesEdit").value = customer?.notes || "";
  byId("customerForm").hidden = false;
  byId("customerNameEdit").focus();
}

function renderCustomers() {
  const term = (byId("customerSearch")?.value || "").toLowerCase().trim();
  const customers = new Map();
  orders.forEach(order => {
    const key = customerKey(order.customerName, order.customerPhone);
    if (!key) return;
    const current = customers.get(key) || { key, name: order.customerName || "Cliente", phone: order.customerPhone || "", notes: "", count: 0, total: 0, last: order.createdAt };
    current.count += 1;
    current.total += Number(order.total || 0);
    if (String(order.createdAt || "") > String(current.last || "")) current.last = order.createdAt;
    customers.set(key, current);
  });
  Object.entries(customerProfiles || {}).forEach(([key, profile]) => {
    const current = customers.get(key) || { key, count: 0, total: 0, last: profile.createdAt || "" };
    customers.set(key, { ...current, ...profile, key });
  });
  const hidden = new Set(hiddenCustomerKeys || []);
  const rows = [...customers.values()]
    .filter(customer => !hidden.has(customer.key))
    .filter(customer => !term || `${customer.name} ${customer.phone} ${customer.notes || ""}`.toLowerCase().includes(term))
    .sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")));
  byId("customerList").innerHTML = rows.map(customer => `
    <article class="customer-row">
      <div><strong>${escapeHtml(customer.name || "Cliente")}</strong>${customer.notes ? `<small>${escapeHtml(customer.notes)}</small>` : ""}</div>
      <span>${escapeHtml(customer.phone || "-")}</span>
      <span>${customer.count} pedido(s)</span>
      <strong>${money(customer.total)}</strong>
      <div class="customer-actions">
        <button class="ghost" data-customer-orders="${encodeURIComponent(customer.key)}">Pedidos</button>
        <a class="action-btn whatsapp-action" href="https://wa.me/${whatsappNumber(customer.phone)}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="ghost" data-edit-customer="${encodeURIComponent(customer.key)}">Editar</button>
        <button class="danger" data-remove-customer="${encodeURIComponent(customer.key)}">Excluir</button>
      </div>
    </article>
  `).join("") || `<p>Nenhum cliente encontrado.</p>`;
}

function exportReportCsv() {
  const rows = reportOrders();
  const csv = [["Pedido", "Data", "Cliente", "Celular", "Pagamento", "Status", "Total"], ...rows.map(order => [order.id, formatDate(order.createdAt), order.customerName, order.customerPhone, order.payment, order.status, Number(order.total || 0).toFixed(2)])]
    .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = `relatorio-tokyo-sushi-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderPromos() {
  byId("promoList").innerHTML = promos.map((promo, index) => `
    <article class="promo-card">
      <strong>${promo.title}</strong>
      <p>${promo.text}</p>
      <button class="ghost" data-edit-promo="${index}">Editar</button>
      <button class="ghost" data-duplicate-promo="${index}">Duplicar</button>
      <button class="ghost" data-copy-promo="${index}">Copiar mensagem</button>
      <button class="danger" data-remove-promo="${index}">Excluir</button>
    </article>
  `).join("") || `<p>Nenhuma promoção cadastrada.</p>`;
}

function renderAll() {
  renderStoreControls();
  renderMetrics();
  renderOrders();
  renderPdv();
  renderKds();
  renderMenuEditor();
  renderComplements();
  renderReports();
  renderCash();
  renderCustomers();
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
  const target = event.target.closest("button, a") || event.target;
  if (target.dataset.removePdv) {
    pdvCart.splice(Number(target.dataset.removePdv), 1);
    renderPdv();
  }
  if (target.dataset.quickStatus) {
    const [id, status] = target.dataset.quickStatus.split(":");
    const order = orders.find(item => String(item.id) === String(id));
    if (order) {
      order.status = status;
      saveOrders();
      runOnline(() => window.TokyoDb.updateOrderStatus(order.id, order.status), "Falha ao atualizar pedido online.");
      renderAll();
    }
  }
  if (target.dataset.copyOrder) {
    const order = orders.find(item => String(item.id) === String(target.dataset.copyOrder));
    if (order) await navigator.clipboard.writeText(orderSummary(order));
  }
  if (target.dataset.printOrder) {
    const order = orders.find(item => String(item.id) === String(target.dataset.printOrder));
    if (order) printOrder(order);
  }
  if (target.dataset.editProduct) {
    const item = menu[Number(target.dataset.editProduct)];
    editingProductId = String(editingProductId) === String(item?.id) ? null : item?.id;
    renderMenuEditor();
    if (editingProductId) document.querySelector(`[data-menu-field="name"][data-index="${target.dataset.editProduct}"]`)?.focus();
  }
  if (target.dataset.duplicateProduct) {
    const index = Number(target.dataset.duplicateProduct);
    const source = menu[index];
    if (source) {
      const copy = { ...source, id: Date.now(), name: `${source.name} (cópia)`, active: false };
      menu.splice(index + 1, 0, copy);
      saveMenu();
      runOnline(() => window.TokyoDb.saveProduct(copy, index + 1), "Falha ao duplicar produto online.");
      renderMenuEditor();
    }
  }
  if (target.dataset.productComplements) {
    const product = menu[Number(target.dataset.productComplements)];
    document.querySelector('[data-tab="complements"]')?.click();
    byId("complementSearch").value = product?.name || "";
    renderComplements();
  }
  if (target.dataset.removeProduct) {
    const index = Number(target.dataset.removeProduct);
    const item = menu[index];
    if (!item || !confirm(`Excluir o item "${item.name}"?`)) return;
    menu.splice(index, 1);
    saveMenu();
    runOnline(() => window.TokyoDb.deleteProduct(item.id), "Falha ao excluir produto online.");
    renderMenuEditor();
  }
  if (target.dataset.editPromo) {
    const index = Number(target.dataset.editPromo);
    const promo = promos[index];
    if (promo) {
      byId("promoTitle").value = promo.title || "";
      byId("promoText").value = promo.text || "";
      byId("promoForm").dataset.editIndex = index;
      byId("promoTitle").focus();
    }
  }
  if (target.dataset.duplicatePromo) {
    const promo = promos[Number(target.dataset.duplicatePromo)];
    if (promo) {
      const copy = { title: `${promo.title} (cópia)`, text: promo.text, created_at: new Date().toISOString() };
      promos.unshift({ ...copy, createdAt: copy.created_at });
      savePromos();
      runOnline(() => window.TokyoDb.savePromo(copy), "Falha ao duplicar promoção online.");
      renderPromos();
    }
  }
  if (target.dataset.copyPromo) {
    const promo = promos[Number(target.dataset.copyPromo)];
    if (promo) await navigator.clipboard.writeText(promo.text);
  }
  if (target.dataset.removePromo) {
    const index = Number(target.dataset.removePromo);
    const promo = promos[index];
    if (!promo || !confirm(`Excluir a promoção "${promo.title}"?`)) return;
    promos.splice(index, 1);
    savePromos();
    if (promo?.id) runOnline(() => window.TokyoDb.deletePromo(promo.id), "Falha ao excluir promocao online.");
    renderPromos();
  }
  if (target.dataset.duplicateComplement) {
    const source = complementGroups[Number(target.dataset.duplicateComplement)];
    if (source) {
      const stamp = Date.now();
      const copy = { ...source, id: stamp, name: `${source.name} (cópia)`, items: (source.items || []).map((item, index) => ({ ...item, id: stamp + index + 1 })) };
      complementGroups.unshift(copy);
      saveComplements();
      runOnline(() => window.TokyoDb.saveComplement(copy), "Falha ao duplicar complemento online.");
      renderComplements();
    }
  }
  if (target.dataset.addComplementItem) {
    const group = complementGroups[Number(target.dataset.addComplementItem)];
    if (!group) return;
    group.items = group.items || [];
    group.items.push({ id: Date.now(), name: "Novo complemento", price: 0, active: true });
    saveComplements();
    scheduleComplementSave(Number(target.dataset.addComplementItem));
    renderComplements();
  }
  if (target.dataset.removeComplementItem) {
    const [groupIndex, itemIndex] = target.dataset.removeComplementItem.split(":").map(Number);
    const group = complementGroups[groupIndex];
    if (!group) return;
    if (!confirm(`Excluir o complemento "${group.items?.[itemIndex]?.name || "sem nome"}"?`)) return;
    group.items.splice(itemIndex, 1);
    saveComplements();
    scheduleComplementSave(groupIndex);
    renderComplements();
  }
  if (target.dataset.removeComplement) {
    const index = Number(target.dataset.removeComplement);
    const group = complementGroups[index];
    if (!confirm(`Excluir a lista "${group?.name || "sem nome"}"?`)) return;
    complementGroups.splice(index, 1);
    saveComplements();
    if (group?.id) runOnline(() => window.TokyoDb.deleteComplement(group.id), "Falha ao excluir complemento online.");
    renderComplements();
  }
  if (target.dataset.editCustomer) openCustomerEditor(decodeURIComponent(target.dataset.editCustomer));
  if (target.dataset.removeCustomer) {
    const key = decodeURIComponent(target.dataset.removeCustomer);
    const customer = customerRecord(key);
    if (!customer || !confirm(`Excluir o cadastro de "${customer.name}"? O histórico de pedidos será preservado.`)) return;
    hiddenCustomerKeys = [...new Set([...(hiddenCustomerKeys || []), key])];
    delete customerProfiles[key];
    saveCustomerData();
    renderCustomers();
  }
  if (target.dataset.customerOrders) {
    const customer = customerRecord(decodeURIComponent(target.dataset.customerOrders));
    byId("orderSearch").value = customer?.phone || customer?.name || "";
    document.querySelector('[data-tab="orders"]')?.click();
    renderOrders();
  }
  if (target.dataset.storeMode) {
    storeStatus = STORE_STATUS[target.dataset.storeMode] || STORE_STATUS.open;
    saveStoreStatus();
    renderStoreControls();
  }
});

byId("addProduct").addEventListener("click", () => {
  const item = {
    id: Date.now(),
    cat: "Nova categoria",
    name: "Novo item",
    desc: "",
    price: 0,
    image: "",
    active: true
  };
  menu.unshift(item);
  editingProductId = item.id;
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
  const editIndex = event.target.dataset.editIndex;
  if (editIndex !== undefined && promos[Number(editIndex)]) {
    const promo = promos[Number(editIndex)];
    promo.title = title;
    promo.text = text;
    if (promo.id) runOnline(() => window.TokyoDb.updatePromo(promo.id, { title, text }), "Falha ao atualizar promoção online.");
    delete event.target.dataset.editIndex;
  } else {
    const promo = { title, text, created_at: new Date().toISOString() };
    promos.unshift({ ...promo, createdAt: promo.created_at });
    runOnline(() => window.TokyoDb.savePromo(promo), "Falha ao salvar promocao online.");
  }
  savePromos();
  event.target.reset();
  renderPromos();
});

byId("addCustomer").addEventListener("click", () => openCustomerEditor());
byId("cancelCustomer").addEventListener("click", () => {
  byId("customerForm").reset();
  byId("customerForm").hidden = true;
});
byId("customerForm").addEventListener("submit", event => {
  event.preventDefault();
  const existingKey = byId("customerKey").value;
  const name = byId("customerNameEdit").value.trim();
  const phone = byId("customerPhoneEdit").value.trim();
  const key = existingKey || customerKey(name, phone);
  customerProfiles[key] = { ...(customerProfiles[key] || {}), name, phone, notes: byId("customerNotesEdit").value.trim(), createdAt: customerProfiles[key]?.createdAt || new Date().toISOString() };
  hiddenCustomerKeys = (hiddenCustomerKeys || []).filter(item => item !== key);
  saveCustomerData();
  event.target.reset();
  event.target.hidden = true;
  renderCustomers();
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
byId("orderSearch").addEventListener("input", renderOrders);
byId("orderStatusFilter").addEventListener("change", renderOrders);
byId("customerSearch").addEventListener("input", renderCustomers);
byId("reportStart").addEventListener("change", renderReports);
byId("reportEnd").addEventListener("change", renderReports);
byId("exportReport").addEventListener("click", exportReportCsv);
byId("printerWidth").value = localStorage.getItem("tokyoPrinterWidth") || "80";
byId("printerWidth").addEventListener("change", event => localStorage.setItem("tokyoPrinterWidth", event.target.value));

byId("pdvAddItem").addEventListener("click", () => {
  const product = menu.find(item => String(item.id) === String(byId("pdvProduct").value));
  const qty = Math.max(1, Number(byId("pdvQty").value || 1));
  if (!product) return;
  const current = pdvCart.find(item => String(item.id) === String(product.id));
  if (current) current.qty += qty;
  else pdvCart.push({ id: product.id, name: product.name, price: Number(product.price || 0), qty, options: [] });
  byId("pdvQty").value = 1;
  renderPdv();
});

byId("pdvForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!pdvCart.length) return alert("Adicione pelo menos um item ao pedido.");
  const order = {
    id: Date.now(), status: "Recebido",
    customerName: byId("pdvCustomer").value.trim(),
    customerPhone: byId("pdvPhone").value.trim(),
    payment: byId("pdvPayment").value,
    notes: byId("pdvNotes").value.trim(),
    total: pdvTotal(), items: pdvCart.map(item => ({ ...item })), createdAt: new Date().toISOString()
  };
  orders.unshift(order);
  saveOrders();
  runOnline(() => window.TokyoDb.createOrder(order), "Falha ao salvar pedido do PDV online.");
  pdvCart = [];
  event.target.reset();
  renderAll();
  document.querySelector('[data-tab="orders"]').click();
});

byId("cashOpenForm").addEventListener("submit", event => {
  event.preventDefault();
  cashSession = { open: true, opening: Number(byId("cashOpening").value || 0), openedAt: new Date().toISOString(), transactions: [] };
  saveCashSession();
  renderCash();
});

byId("cashEntryForm").addEventListener("submit", event => {
  event.preventDefault();
  cashSession.transactions = cashSession.transactions || [];
  cashSession.transactions.unshift({ id: Date.now(), type: byId("cashEntryType").value, description: byId("cashEntryDescription").value.trim(), value: Number(byId("cashEntryValue").value || 0), createdAt: new Date().toISOString() });
  saveCashSession();
  event.target.reset();
  renderCash();
});

byId("closeCash").addEventListener("click", () => {
  if (!confirm("Fechar o caixa atual?")) return;
  cashSession.open = false;
  cashSession.closedAt = new Date().toISOString();
  saveCashSession();
  renderCash();
});

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
