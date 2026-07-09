const DEFAULT_MENU = window.TOKYO_DATA.menu;
const STORE = window.TOKYO_DATA.store;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

let menu = JSON.parse(localStorage.getItem("tokyoMenu") || "null") || DEFAULT_MENU.map(item => ({ ...item, active: item.active !== false }));
let orders = JSON.parse(localStorage.getItem("tokyoOrders") || "[]");
let promos = JSON.parse(localStorage.getItem("tokyoPromos") || "[]");
const productTimers = {};

async function loadOnlineData() {
  if (!window.TokyoDb?.enabled) return;
  try {
    menu = await window.TokyoDb.loadMenu(DEFAULT_MENU);
    orders = await window.TokyoDb.loadOrders();
    promos = await window.TokyoDb.loadPromos();
    localStorage.setItem("tokyoMenu", JSON.stringify(menu));
    localStorage.setItem("tokyoOrders", JSON.stringify(orders));
    localStorage.setItem("tokyoPromos", JSON.stringify(promos));
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

function scheduleProductSave(index) {
  clearTimeout(productTimers[index]);
  productTimers[index] = setTimeout(() => {
    if (!window.TokyoDb?.enabled) return;
    window.TokyoDb.saveProduct(menu[index], index).catch(error => console.warn("Falha ao salvar produto online.", error));
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
    `Total: ${money(order.total)}`,
    "",
    ...order.items.map(item => `${item.qty}x ${item.name} - ${money(item.price * item.qty)}`)
  ].join("\n");
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

function renderOrders() {
  if (!orders.length) {
    byId("ordersList").innerHTML = `<div class="order-card"><p>Nenhum pedido salvo ainda.</p></div>`;
    return;
  }

  byId("ordersList").innerHTML = orders.map(order => `
    <article class="order-card">
      <div>
        <div class="order-title">
          <strong>#${order.id} - ${order.customerName || "Cliente"}</strong>
          <span class="pill">${order.status}</span>
          <span>${formatDate(order.createdAt)}</span>
        </div>
        <p>WhatsApp: ${order.customerPhone || "-"} | Pagamento: ${order.payment || "-"} | Total: <strong>${money(order.total)}</strong></p>
        <ul class="order-items">
          ${order.items.map(item => `<li>${item.qty}x ${item.name} - ${money(item.price * item.qty)}</li>`).join("")}
        </ul>
        ${order.notes ? `<p><strong>Obs.:</strong> ${order.notes}</p>` : ""}
      </div>
      <div class="order-actions">
        <select data-order-status="${order.id}">
          ${["Recebido", "Preparando", "Pronto", "Finalizado", "Cancelado"].map(status => (
            `<option ${status === order.status ? "selected" : ""}>${status}</option>`
          )).join("")}
        </select>
        <button class="ghost" data-copy-order="${order.id}">Copiar resumo</button>
        <a class="primary" href="https://wa.me/${whatsappNumber(order.customerPhone)}?text=${readyMessage(order)}" target="_blank" rel="noopener">Avisar pronto</a>
      </div>
    </article>
  `).join("");
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
  renderMetrics();
  renderOrders();
  renderMenuEditor();
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
});

document.body.addEventListener("click", async event => {
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

document.body.addEventListener("input", event => {
  const field = event.target.dataset.menuField;
  if (!field) return;
  scheduleProductSave(Number(event.target.dataset.index));
});

loadOnlineData().then(renderAll);
