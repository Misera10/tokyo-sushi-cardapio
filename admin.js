const DEFAULT_MENU = window.TOKYO_DATA.menu;
const DEFAULT_COMPLEMENTS = window.TOKYO_DATA.complements || [];
const STORE = window.TOKYO_DATA.store;
const DEFAULT_WEEKLY_SCHEDULE = window.TokyoSchedule?.defaultWeekly?.() || [
  { day: 0, label: "Domingo", enabled: false, open: "", close: "" },
  { day: 1, label: "Segunda-feira", enabled: false, open: "", close: "" },
  { day: 2, label: "Terça-feira", enabled: false, open: "", close: "" },
  { day: 3, label: "Quarta-feira", enabled: false, open: "", close: "" },
  { day: 4, label: "Quinta-feira", enabled: false, open: "", close: "" },
  { day: 5, label: "Sexta-feira", enabled: false, open: "", close: "" },
  { day: 6, label: "Sábado", enabled: false, open: "", close: "" }
];
const DEFAULT_OPERATION_SETTINGS = {
  whatsappNumber: STORE.phone || "",
  pixKey: STORE.pix || "tokiosushituntum@gmail.com",
  pixBeneficiary: STORE.pixBeneficiary || "Fabiano R Fernandes",
  whatsappOrderTemplate: "Olá, {cliente}! 👋\n\nRecebemos seu pedido na {loja}.\n\n{resumo}\n\nA retirada é feita no balcão. Avisaremos por aqui assim que estiver pronto.\n\nObrigado por escolher a {loja}!",
  whatsappReadyTemplate: "Olá, {cliente}! 🍣\n\nSeu pedido #{pedido} da {loja} está pronto para retirada.\n\nPode retirar no balcão quando chegar. Se precisar falar com a gente, responda esta mensagem.\n\nObrigado!",
  printOnNewOrder: false,
  printerWidth: "80",
  printerMargin: 3,
  printerLayout: {
    showCustomer: true,
    showPhone: true,
    showPayment: true,
    showItemPrices: true,
    showNotes: true,
    showTotals: true
  },
  printCopies: 1,
  notifyNewOrder: true,
  scheduleEnabled: false,
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE
};
const LOCAL_IMAGE_IDS = new Set(DEFAULT_MENU.filter(item => String(item.image || "").startsWith("assets/menu/")).map(item => String(item.id)));
const normalizeMenuImages = products => (Array.isArray(products) ? products : []).map(item => {
  return LOCAL_IMAGE_IDS.has(String(item.id))
    ? { ...item, image: `assets/menu/${item.id}.jpeg` }
    : item;
});

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const PRINT_AGENT_URL = "http://127.0.0.1:4242";
const PRINT_AGENT_KEY_STORAGE = "tokyoPrintAgentKey";
let activeConfirm = null;
let deferredAdminInstallPrompt = null;
let orderAlertAudioContext = null;
let adminPushRegistration = null;
let pushSubscriptionRegistered = false;
let pushSubscriptionSupported = false;
let pushSubscriptionChecking = true;

function base64UrlToUint8Array(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function getAdminPushRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  if (adminPushRegistration) return adminPushRegistration;
  adminPushRegistration = await navigator.serviceWorker.ready;
  return adminPushRegistration;
}

async function refreshPushSubscriptionState(onChange) {
  pushSubscriptionChecking = true;
  pushSubscriptionSupported = Boolean(window.TOKYO_CONFIG?.pushVapidPublicKey && "serviceWorker" in navigator);
  if (!pushSubscriptionSupported) {
    pushSubscriptionRegistered = false;
    pushSubscriptionChecking = false;
    onChange?.();
    return false;
  }
  try {
    const registration = await getAdminPushRegistration();
    pushSubscriptionSupported = Boolean(registration?.pushManager);
    const subscription = await registration?.pushManager.getSubscription();
    pushSubscriptionRegistered = Boolean(subscription);
  } catch {
    pushSubscriptionRegistered = false;
  }
  pushSubscriptionChecking = false;
  onChange?.();
  return pushSubscriptionRegistered;
}

function getPushUnavailableDescription() {
  if (!window.isSecureContext) return "Abra o painel pelo endereço HTTPS para habilitar notificações Push.";
  if (!("serviceWorker" in navigator)) return "Este navegador não oferece Service Worker. Abra o painel no Chrome ou Edge atualizado.";
  if (adminPushRegistration && !adminPushRegistration.pushManager) return "Esta aba/navegador não oferece Push. Abra o endereço diretamente no Chrome ou Edge, fora de navegador incorporado.";
  if (!window.TOKYO_CONFIG?.pushVapidPublicKey) return "A configuração pública do Push não foi carregada. Atualize o painel e tente novamente.";
  return "O Push não está disponível neste dispositivo. Abra o painel diretamente no Chrome ou Edge atualizado.";
}

async function subscribeAdminDeviceToPush() {
  if (!window.TokyoDb?.hasAdminSession()) throw new Error("Entre no painel antes de ativar os alertas.");
  if (!pushSubscriptionSupported) throw new Error("Este navegador não oferece Push ou a chave pública ainda não foi configurada.");
  const registration = await getAdminPushRegistration();
  if (!registration?.pushManager) throw new Error("O service worker do painel ainda não está pronto. Atualize a página e tente novamente.");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(window.TOKYO_CONFIG.pushVapidPublicKey)
    });
  }
  await window.TokyoDb.savePushSubscription(subscription.toJSON());
  pushSubscriptionRegistered = true;
  return subscription;
}

async function ensureAdminPushSubscription() {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  if (!pushSubscriptionSupported || !operationSettings.notifyNewOrder) return false;
  try {
    await subscribeAdminDeviceToPush();
    return true;
  } catch (error) {
    console.warn("Não foi possível restaurar automaticamente a inscrição Push.", error);
    return false;
  }
}

async function disableAdminDevicePush() {
  const registration = await getAdminPushRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    await window.TokyoDb.deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
  pushSubscriptionRegistered = false;
}

function unlockOrderAlertSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    orderAlertAudioContext ||= new AudioContextClass();
    if (orderAlertAudioContext.state === "suspended") orderAlertAudioContext.resume().catch(() => {});
  } catch { /* alguns navegadores não expõem Web Audio */ }
}

function playOrderAlertSound() {
  const context = orderAlertAudioContext;
  if (!context || context.state !== "running") return;
  try {
    const now = context.currentTime;
    [880, 1175, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.16;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  } catch { /* o aviso visual continua disponível */ }
}

function notify(message, type = "error") {
  const region = byId("toastRegion");
  if (!region) return;
  const titles = { error: "Não foi possível concluir", success: "Tudo certo", info: "Atenção" };
  const toast = document.createElement("article");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div><strong>${titles[type] || titles.info}</strong><p>${escapeHtml(message)}</p></div><button class="toast-close" type="button" aria-label="Fechar mensagem">×</button>`;
  const dismiss = () => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  };
  toast.querySelector(".toast-close").addEventListener("click", dismiss);
  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  window.setTimeout(dismiss, type === "error" ? 5200 : 3600);
}

async function showOrderNotification(order) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = "Novo pedido · Tokyo Sushi";
  const body = `${order?.customerName || "Cliente"} · ${money(order?.total || 0)} · confira os Recebidos.`;
  const options = {
    body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: `tokyo-order-${order?.id || "new"}`,
    renotify: true,
    data: { url: "./admin.html#main-content" }
  };
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    try { new Notification(title, options); } catch { /* browser blocked the notification */ }
  }
}

function setupAdminPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw-v20260817.js")
      .then(registration => { adminPushRegistration = registration; })
      .catch(() => {});
  }

  const installButton = byId("adminInstallBtn");
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (installButton && !isStandalone) installButton.hidden = false;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredAdminInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!deferredAdminInstallPrompt) {
      notify("No Chrome ou Edge, abra o menu do navegador e escolha 'Instalar Tokyo Sushi' ou 'Adicionar à tela inicial'.", "info");
      return;
    }
    deferredAdminInstallPrompt.prompt();
    await deferredAdminInstallPrompt.userChoice.catch(() => null);
    deferredAdminInstallPrompt = null;
    installButton.hidden = true;
  });

  const notificationButton = byId("enableNotifications");
  const settingsNotificationButton = byId("enableNotificationsSettings");
  window.addEventListener("pointerdown", unlockOrderAlertSound, { once: true, passive: true });
  window.addEventListener("keydown", unlockOrderAlertSound, { once: true });
  const syncNotificationButton = () => {
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    const state = pushSubscriptionChecking
      ? "push-checking"
      : permission === "granted"
      ? !pushSubscriptionSupported ? "push-unavailable"
        : !pushSubscriptionRegistered ? "push-pending"
          : operationSettings.notifyNewOrder ? "active" : "config-off"
      : permission;
    const labels = {
      active: "Desativar alertas",
      "config-off": "Alertas desativados",
      "push-pending": "Ativar alertas",
      "push-checking": "Verificando alertas",
      "push-unavailable": "Push indisponível",
      denied: "Revisar alertas",
      default: "Ativar alertas",
      unsupported: "Alertas indisponíveis"
    };
    const descriptions = {
      active: "Alertas e som estão ativos neste dispositivo, inclusive com o app fechado.",
      "config-off": "A permissão está liberada, mas o alerta de novos pedidos está desativado nas configurações.",
      "push-pending": "A permissão está liberada, mas este dispositivo ainda não foi inscrito para receber alertas com o app fechado.",
      "push-checking": "Verificando o navegador e o Service Worker deste dispositivo...",
      "push-unavailable": getPushUnavailableDescription(),
      denied: "A permissão está bloqueada. Libere as notificações do site ou do app instalado e volte para revisar.",
      default: "Clique para liberar os alertas e o som neste dispositivo.",
      unsupported: "Este navegador não oferece notificações do sistema."
    };
    if (notificationButton) {
      notificationButton.hidden = false;
      notificationButton.disabled = permission === "unsupported" || state === "push-unavailable" || state === "push-checking";
      notificationButton.dataset.notificationState = state;
      notificationButton.setAttribute("aria-pressed", String(state === "active"));
      notificationButton.setAttribute("aria-label", descriptions[state]);
      notificationButton.title = descriptions[state];
      notificationButton.textContent = labels[state];
    }
    const settingsStatus = byId("settingsNotificationStatus");
    if (settingsStatus) {
      settingsStatus.dataset.notificationState = state;
      settingsStatus.textContent = descriptions[state];
    }
    if (settingsNotificationButton) {
      settingsNotificationButton.disabled = permission === "unsupported" || state === "push-unavailable" || state === "push-checking";
      settingsNotificationButton.textContent = state === "active"
        ? "Desativar alertas neste dispositivo"
        : state === "denied"
          ? "Revisar permissão"
          : "Ativar alertas e som neste dispositivo";
    }
  };
  syncNotificationButton();
  refreshPushSubscriptionState(syncNotificationButton).catch(() => syncNotificationButton());
  const requestNotificationPermission = async () => {
    unlockOrderAlertSound();
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    if (permission === "unsupported") {
      notify("Este navegador não oferece alertas do sistema. Use Chrome ou Edge para ativá-los.", "info");
      return;
    }
    if (permission === "denied") {
      syncNotificationButton();
      notify("No navegador: abra o cadeado/endereço do site e permita Notificações. Se estiver usando o app instalado, libere também as notificações de Tokyo Sushi em Configurações do celular > Apps. Depois volte e toque em Revisar alertas.", "info");
      return;
    }
    if (permission === "granted") {
      if (pushSubscriptionRegistered && operationSettings.notifyNewOrder) {
        try {
          await disableAdminDevicePush();
          operationSettings.notifyNewOrder = false;
          saveOperationSettings();
          renderOperationSettings();
          notify("Alertas desativados neste dispositivo.", "success");
        } catch (error) {
          notify(error.message || "Não foi possível desativar os alertas neste dispositivo.", "error");
        }
        syncNotificationButton();
        return;
      }
      try {
        await subscribeAdminDeviceToPush();
        if (!operationSettings.notifyNewOrder) {
          operationSettings.notifyNewOrder = true;
          saveOperationSettings();
          renderOperationSettings();
        }
        playOrderAlertSound();
        notify("Alertas ativos neste dispositivo, inclusive com o app fechado.", "success");
      } catch (error) {
        notify(error.message || "Não foi possível inscrever este dispositivo nos alertas.", "error");
      }
      syncNotificationButton();
      return;
    }
    const nextPermission = await Notification.requestPermission();
    if (nextPermission === "granted") {
      try {
        await subscribeAdminDeviceToPush();
        operationSettings.notifyNewOrder = true;
        saveOperationSettings();
        renderOperationSettings();
        playOrderAlertSound();
        notify("Alertas ativos neste dispositivo, inclusive com o app fechado.", "success");
      } catch (error) {
        notify(error.message || "A permissão foi liberada, mas não foi possível concluir a inscrição Push.", "error");
      }
    } else if (nextPermission === "denied") {
      notify("O navegador bloqueou os alertas. Você pode liberá-los nas permissões deste site.", "info");
    }
    syncNotificationButton();
  };
  notificationButton.addEventListener("click", requestNotificationPermission);
  settingsNotificationButton?.addEventListener("click", requestNotificationPermission);
  const refreshNotificationState = () => {
    syncNotificationButton();
    refreshPushSubscriptionState(syncNotificationButton).catch(() => syncNotificationButton());
  };
  window.addEventListener("focus", refreshNotificationState);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshNotificationState();
  });
  navigator.permissions?.query({ name: "notifications" }).then(status => {
    status.addEventListener?.("change", refreshNotificationState);
    status.onchange = refreshNotificationState;
  }).catch(() => {});
  window.syncNotificationButton = syncNotificationButton;
}

function askConfirm(message, { title = "Confirmar ação", confirmLabel = "Confirmar" } = {}) {
  const overlay = byId("confirmDialog");
  if (!overlay) return Promise.resolve(true);
  if (activeConfirm) activeConfirm(false);
  const previousFocus = document.activeElement;
  byId("confirmDialogTitle").textContent = title;
  byId("confirmDialogMessage").textContent = message;
  byId("confirmAccept").textContent = confirmLabel;
  overlay.hidden = false;
  return new Promise(resolve => {
    const finish = value => {
      if (activeConfirm !== finish) return;
      activeConfirm = null;
      overlay.hidden = true;
      document.removeEventListener("keydown", onKeydown);
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      resolve(value);
    };
    const onKeydown = event => {
      if (event.key === "Escape") finish(false);
      if (event.key === "Enter") finish(true);
    };
    activeConfirm = finish;
    byId("confirmCancel").onclick = () => finish(false);
    byId("confirmAccept").onclick = () => finish(true);
    overlay.onclick = event => { if (event.target === overlay) finish(false); };
    document.addEventListener("keydown", onKeydown);
    window.setTimeout(() => byId("confirmCancel")?.focus(), 0);
  });
}
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
function localDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
const todayKey = () => localDateKey();
const STORE_STATUS_KEY = "tokyoStoreStatus";
const METRICS_VISIBILITY_KEY = "tokyoMetricsHidden";
const STORE_STATUS = {
  open: { mode: "open", label: "Aberto", manualOverride: false },
  closed: { mode: "closed", label: "Fechado", manualOverride: true }
};

function normalizeStoreStatus(value) {
  const source = value || {};
  const manualOverrideDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.manualOverrideDate || ""))
    ? String(source.manualOverrideDate)
    : "";
  if (source.mode === "open") return { ...STORE_STATUS.open, manualOverride: source.manualOverride === true, manualOverrideDate };
  return { ...STORE_STATUS.closed, manualOverride: source.manualOverride !== false, manualOverrideDate };
}

const MENU_DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_PRODUCT_CHANNELS = { retirada: true, delivery: false, mesa: false };
const DEFAULT_ACTIVE_DAYS = [0, 1, 2, 3, 4, 5, 6];
const MENU_FILTER_KEY = "tokyoMenuEditorFilters";

function normalizeProduct(item, index = 0) {
  const source = item || {};
  return {
    ...source,
    id: source.id ?? Date.now() + index,
    cat: String(source.cat || "Sem categoria"),
    name: String(source.name || "Sem nome"),
    desc: String(source.desc || ""),
    price: Number(source.price || 0),
    image: String(source.image || ""),
    active: source.active !== false,
    archived: source.archived === true || Boolean(source.archivedAt),
    archivedAt: source.archivedAt || "",
    sortOrder: Number(source.sortOrder ?? index),
    activeDays: Array.isArray(source.activeDays) && source.activeDays.length ? source.activeDays.map(Number).filter(day => day >= 0 && day <= 6) : [...DEFAULT_ACTIVE_DAYS],
    channels: { ...DEFAULT_PRODUCT_CHANNELS, ...(source.channels || {}) },
    badges: { promotion: false, bestSeller: false, new: false, ...(source.badges || {}) },
    highlight: source.highlight === true,
    secondaryImages: Array.isArray(source.secondaryImages) ? source.secondaryImages.filter(Boolean).slice(0, 4) : [],
    tags: Array.isArray(source.tags) ? source.tags.filter(Boolean).slice(0, 3) : [],
    internalCode: String(source.internalCode || ""),
    cost: Number(source.cost || 0),
    fromPrice: source.fromPrice === "" || source.fromPrice == null ? "" : Number(source.fromPrice),
    strikePrice: source.strikePrice === "" || source.strikePrice == null ? "" : Number(source.strikePrice),
    stockControlled: source.stockControlled === true,
    stockQty: source.stockQty === "" || source.stockQty == null ? null : Math.max(0, Number(source.stockQty))
  };
}

function normalizeOrder(order = {}) {
  const discountAmount = Number(order.discountAmount ?? order.discount_amount ?? 0);
  const surchargeAmount = Number(order.surchargeAmount ?? order.surcharge_amount ?? 0);
  const sourcePricing = order.pricing || {};
  return {
    ...order,
    paymentStatus: order.paymentStatus === "paid" || order.payment_status === "paid" || order.paid === true ? "paid" : "pending",
    items: Array.isArray(order.items) ? order.items : [],
    archivedAt: order.archivedAt || order.archived_at || null,
    pricing: {
      discountType: sourcePricing.discountType || sourcePricing.discount_type || (discountAmount > 0 ? "fixed" : "none"),
      discountValue: sourcePricing.discountValue ?? sourcePricing.discount_value ?? discountAmount,
      surchargeType: sourcePricing.surchargeType || sourcePricing.surcharge_type || (surchargeAmount > 0 ? "fixed" : "none"),
      surchargeValue: sourcePricing.surchargeValue ?? sourcePricing.surcharge_value ?? surchargeAmount,
      couponCode: sourcePricing.couponCode || sourcePricing.coupon_code || order.couponCode || order.coupon_code || "",
      amountReceived: sourcePricing.amountReceived ?? sourcePricing.amount_received ?? order.amountReceived ?? order.amount_received ?? null
    }
  };
}

function normalizeMenuGroups(groups = [], products = []) {
  const result = (Array.isArray(groups) ? groups : []).map((group, index) => ({
    id: String(group.id || `group-${index + 1}`),
    name: String(group.name || "Sem categoria"),
    sortOrder: Number(group.sortOrder ?? index),
    active: group.active !== false,
    description: String(group.description || "")
  }));
  const seen = new Set(result.map(group => group.name.toLowerCase()));
  [...new Set(products.map(product => String(product.cat || "Sem categoria")))].forEach((name, index) => {
    if (seen.has(name.toLowerCase())) return;
    result.push({ id: `group-${Date.now()}-${index}`, name, sortOrder: result.length, active: true, description: "" });
    seen.add(name.toLowerCase());
  });
  return result.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
}

function readMenuFilters() {
  try { return JSON.parse(localStorage.getItem(MENU_FILTER_KEY) || "{}"); } catch { return {}; }
}

let menu = normalizeMenuImages(JSON.parse(localStorage.getItem("tokyoMenu") || "null") || DEFAULT_MENU.map(item => ({ ...item, active: item.active !== false }))).map(normalizeProduct);
let menuGroups = normalizeMenuGroups(JSON.parse(localStorage.getItem("tokyoMenuGroups") || "null") || [], menu);
let menuFilters = { search: "", group: "", status: "all", sort: "group", ...readMenuFilters() };
let orders = JSON.parse(localStorage.getItem("tokyoOrders") || "[]").map(normalizeOrder);
let metricsHidden = localStorage.getItem(METRICS_VISIBILITY_KEY) === "true";
let promos = (JSON.parse(localStorage.getItem("tokyoPromos") || "[]")).map((promo, idx) => ({
  ...promo,
  id: promo.id || `promo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`
}));
let complementGroups = JSON.parse(localStorage.getItem("tokyoComplements") || "null") || DEFAULT_COMPLEMENTS;
let storeStatus = normalizeStoreStatus(JSON.parse(localStorage.getItem(STORE_STATUS_KEY) || "null") || STORE_STATUS.open);
let cashSession = JSON.parse(localStorage.getItem("tokyoCashSession") || "null") || { open: false, opening: 0, transactions: [] };
let operationSettings = { ...DEFAULT_OPERATION_SETTINGS, printerWidth: localStorage.getItem("tokyoPrinterWidth") || DEFAULT_OPERATION_SETTINGS.printerWidth, ...(JSON.parse(localStorage.getItem("tokyoOperationSettings") || "{}") || {}) };
let expenses = JSON.parse(localStorage.getItem("tokyoExpenses") || "[]");
let dailyRevenues = JSON.parse(localStorage.getItem("tokyoDailyRevenues") || "[]");
let financeView = localStorage.getItem("tokyoFinanceView") || "overview";
let financeRange = "";
let expenseEditingId = "";
let customerProfiles = JSON.parse(localStorage.getItem("tokyoCustomerProfiles") || "{}");
let hiddenCustomerKeys = JSON.parse(localStorage.getItem("tokyoHiddenCustomers") || "[]");
let pdvCart = [];
let pdvPendingOptions = {};
let pdvSelectedProductId = "";
let pdvAppliedCoupon = null;
let pdvCouponMessage = "";
let pdvAppliedAdjustments = { discountType: "none", discountValue: 0, surchargeType: "none", surchargeValue: 0 };
let pdvAdjustmentMessage = "Digite um ajuste e confirme.";
let editingProductId = null;
let editingOrderId = null;
let orderEditorDraft = null;
let orderEditorSelectedProductId = "";
let orderEditorPendingOptions = {};
let ordersRefreshing = false;
let orderRefreshTimer = null;
let scheduleRefreshTimer = null;
let knownOrderIds = new Set();
const previewParam = new URLSearchParams(window.location.search).get("preview");
const LOCAL_PREVIEW_MODE = (
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && previewParam === "1"
) || (
  previewParam === "public" && (
    window.location.hostname.endsWith(".tokyo-sushi-7fu.pages.dev")
    || window.location.hostname === "tokyosushi.estudiofernandes.com.br"
  )
);
const productTimers = {};
const complementTimers = {};

function withDefaultComplements(groups = []) {
  const list = Array.isArray(groups) ? [...groups] : [];
  DEFAULT_COMPLEMENTS.forEach(defaultGroup => {
    const existing = list.find(group => String(group.id) === String(defaultGroup.id));
    if (!existing) {
      list.push(defaultGroup);
      return;
    }
    existing.tags = Array.from(new Set([
      ...(Array.isArray(existing.tags) ? existing.tags : []),
      ...(Array.isArray(defaultGroup.tags) ? defaultGroup.tags : [])
    ]));
  });
  return list;
}

complementGroups = withDefaultComplements(complementGroups);

async function loadOnlineData() {
  if (!window.TokyoDb?.enabled) return;
  try {
    const loadedMenu = normalizeMenuImages(await window.TokyoDb.loadMenu(DEFAULT_MENU, { seed: true })).map(normalizeProduct);
    const [loadedOrders, loadedPromos, loadedComplements, loadedMenuGroups, loadedStoreStatus, loadedCashSession, loadedOperationSettings, publicSchedule, loadedExpenses, loadedDailyRevenues, loadedCustomerProfiles, loadedHiddenCustomerKeys] = await Promise.all([
      window.TokyoDb.loadOrders(),
      window.TokyoDb.loadPromos(),
      window.TokyoDb.loadComplements(DEFAULT_COMPLEMENTS, { seed: true }).catch(() => complementGroups),
      window.TokyoDb.loadSetting("menu_groups", menuGroups).catch(() => menuGroups),
      window.TokyoDb.loadSetting("store_status", STORE_STATUS.open).catch(() => storeStatus),
      window.TokyoDb.loadCashSession().catch(() => window.TokyoDb.loadSetting("cash_session", cashSession).catch(() => cashSession)),
      window.TokyoDb.loadSetting("operation_settings", operationSettings).catch(() => operationSettings),
      window.TokyoDb.loadSetting("store_schedule", null).catch(() => null),
      window.TokyoDb.loadExpenses().catch(() => expenses),
      window.TokyoDb.loadDailyRevenues().catch(() => dailyRevenues),
      window.TokyoDb.loadSetting("customer_profiles", customerProfiles).catch(() => customerProfiles),
      window.TokyoDb.loadSetting("hidden_customers", hiddenCustomerKeys).catch(() => hiddenCustomerKeys)
    ]);
    menu = loadedMenu;
    orders = loadedOrders.map(normalizeOrder);
    promos = loadedPromos;
    complementGroups = withDefaultComplements(loadedComplements);
    menuGroups = normalizeMenuGroups(loadedMenuGroups, menu);
    storeStatus = normalizeStoreStatus(loadedStoreStatus);
    cashSession = loadedCashSession;
    operationSettings = normalizeOperationSettings(loadedOperationSettings);
    if (publicSchedule?.weekly) {
      operationSettings = normalizeOperationSettings({
        ...operationSettings,
        scheduleEnabled: publicSchedule.enabled === true,
        weeklySchedule: publicSchedule.weekly
      });
    }
    expenses = loadedExpenses || expenses;
    dailyRevenues = loadedDailyRevenues || dailyRevenues;
    customerProfiles = loadedCustomerProfiles;
    hiddenCustomerKeys = loadedHiddenCustomerKeys;
    knownOrderIds = new Set(orders.map(order => String(order.id)));
    localStorage.setItem("tokyoMenu", JSON.stringify(menu));
    localStorage.setItem("tokyoMenuGroups", JSON.stringify(menuGroups));
    localStorage.setItem("tokyoOrders", JSON.stringify(orders));
    localStorage.setItem("tokyoPromos", JSON.stringify(promos));
    localStorage.setItem("tokyoComplements", JSON.stringify(complementGroups));
    localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
    localStorage.setItem("tokyoCashSession", JSON.stringify(cashSession));
    localStorage.setItem("tokyoOperationSettings", JSON.stringify(operationSettings));
    localStorage.setItem("tokyoStoreSchedule", JSON.stringify({ enabled: operationSettings.scheduleEnabled, weekly: operationSettings.weeklySchedule }));
    localStorage.setItem("tokyoExpenses", JSON.stringify(expenses));
    localStorage.setItem("tokyoDailyRevenues", JSON.stringify(dailyRevenues));
    localStorage.setItem("tokyoCustomerProfiles", JSON.stringify(customerProfiles));
    localStorage.setItem("tokyoHiddenCustomers", JSON.stringify(hiddenCustomerKeys));
  } catch (error) {
    console.warn("Falha ao carregar dados online. Usando cache local.", error);
  }
}

async function refreshOrders() {
  if (!window.TokyoDb?.enabled || ordersRefreshing || !window.TokyoDb.hasAdminSession()) return;
  ordersRefreshing = true;
  try {
    const nextOrders = (await window.TokyoDb.loadOrders()).map(normalizeOrder);
    if (!Array.isArray(nextOrders)) return;
    const newOrder = nextOrders.find(order => !knownOrderIds.has(String(order.id)));
    const hasNewOrder = Boolean(newOrder);
    orders = nextOrders;
    knownOrderIds = new Set(orders.map(order => String(order.id)));
    localStorage.setItem("tokyoOrders", JSON.stringify(orders));
    renderMetrics();
    renderOrders();
    renderKds();
    renderReports();
    renderCash();
    renderCustomers();
    if (hasNewOrder) {
      document.title = "🔔 Novo pedido · Tokyo Sushi";
      window.setTimeout(() => { document.title = "Admin - Tokyo Sushi"; }, 5000);
      navigator.vibrate?.([120, 60, 120]);
      if (operationSettings.notifyNewOrder) {
        playOrderAlertSound();
        showOrderNotification(newOrder);
      }
      if (operationSettings.printOnNewOrder) printOrder(newOrder, "kitchen");
    }
  } catch (error) {
    console.warn("Falha ao atualizar pedidos em tempo real.", error);
  } finally {
    ordersRefreshing = false;
  }
}

function startOrderRefresh() {
  if (orderRefreshTimer) window.clearInterval(orderRefreshTimer);
  if (scheduleRefreshTimer) window.clearInterval(scheduleRefreshTimer);
  orderRefreshTimer = window.setInterval(refreshOrders, 15000);
  scheduleRefreshTimer = window.setInterval(() => renderStoreControls({ syncSettings: false }), 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshOrders();
  });
  window.addEventListener("focus", refreshOrders);
}

function saveMenu() {
  localStorage.setItem("tokyoMenu", JSON.stringify(menu));
}

function saveMenuGroups() {
  localStorage.setItem("tokyoMenuGroups", JSON.stringify(menuGroups));
  runOnline(() => window.TokyoDb.saveSetting("menu_groups", menuGroups), "Falha ao salvar grupos do cardápio online.");
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

async function saveStoreStatus() {
  localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
  if (!window.TokyoDb?.enabled) return true;
  try {
    await window.TokyoDb.saveSetting("store_status", storeStatus);
    const persisted = normalizeStoreStatus(await window.TokyoDb.loadSetting("store_status", null));
    const isSynced = persisted.mode === storeStatus.mode
      && persisted.manualOverride === storeStatus.manualOverride
      && persisted.manualOverrideDate === (storeStatus.manualOverrideDate || "");
    if (!isSynced) throw new Error("O status retornado pelo banco não corresponde ao estado escolhido.");
    return true;
  } catch (error) {
    notify("O status não foi sincronizado. Verifique sua conexão e tente novamente.");
    console.warn("Falha ao salvar status do cardápio online.", error);
    return false;
  }
}

function saveCashSession() {
  localStorage.setItem("tokyoCashSession", JSON.stringify(cashSession));
}

function normalizeOperationSettings(value = {}) {
  const settings = { ...DEFAULT_OPERATION_SETTINGS, ...(value || {}) };
  const printerLayout = { ...DEFAULT_OPERATION_SETTINGS.printerLayout, ...(settings.printerLayout || {}) };
  const legacyOrderTemplate = "Olá, {cliente}! Aqui é do {loja}.\n\nResumo do seu pedido:\n{resumo}\n\nSe precisar ajustar alguma coisa, pode responder por aqui.";
  const legacyReadyTemplate = "Olá, {cliente}! Seu pedido #{pedido} do {loja} está pronto para retirada.";
  const weeklySchedule = window.TokyoSchedule?.normalize
    ? window.TokyoSchedule.normalize({ weekly: settings.weeklySchedule }).weekly
    : DEFAULT_WEEKLY_SCHEDULE.map(day => ({ ...day, ...(settings.weeklySchedule || []).find(item => Number(item?.day) === day.day) }));
  return {
    ...settings,
    pixKey: String(settings.pixKey || DEFAULT_OPERATION_SETTINGS.pixKey || "").trim(),
    pixBeneficiary: String(settings.pixBeneficiary || DEFAULT_OPERATION_SETTINGS.pixBeneficiary || "").trim(),
    whatsappNumber: String(settings.whatsappNumber || DEFAULT_OPERATION_SETTINGS.whatsappNumber).replace(/\D/g, ""),
    whatsappOrderTemplate: String(settings.whatsappOrderTemplate || DEFAULT_OPERATION_SETTINGS.whatsappOrderTemplate) === legacyOrderTemplate
      ? DEFAULT_OPERATION_SETTINGS.whatsappOrderTemplate
      : String(settings.whatsappOrderTemplate || DEFAULT_OPERATION_SETTINGS.whatsappOrderTemplate),
    whatsappReadyTemplate: String(settings.whatsappReadyTemplate || DEFAULT_OPERATION_SETTINGS.whatsappReadyTemplate) === legacyReadyTemplate
      ? DEFAULT_OPERATION_SETTINGS.whatsappReadyTemplate
      : String(settings.whatsappReadyTemplate || DEFAULT_OPERATION_SETTINGS.whatsappReadyTemplate),
    printOnNewOrder: settings.printOnNewOrder === true,
    printerWidth: ["58", "80"].includes(String(settings.printerWidth)) ? String(settings.printerWidth) : "80",
    printerMargin: Math.min(16, Math.max(0, Number(settings.printerMargin ?? 3))),
    printerLayout: Object.fromEntries(Object.entries(printerLayout).map(([key, enabled]) => [key, enabled === true])),
    printCopies: Math.min(3, Math.max(1, Number(settings.printCopies || 1))),
    notifyNewOrder: settings.notifyNewOrder !== false,
    scheduleEnabled: settings.scheduleEnabled === true,
    weeklySchedule
  };
}

function saveOperationSettings() {
  operationSettings = normalizeOperationSettings(operationSettings);
  localStorage.setItem("tokyoOperationSettings", JSON.stringify(operationSettings));
  localStorage.setItem("tokyoStoreSchedule", JSON.stringify({ enabled: operationSettings.scheduleEnabled, weekly: operationSettings.weeklySchedule }));
  runOnline(() => window.TokyoDb.saveSetting("operation_settings", operationSettings), "Falha ao salvar configurações online.");
  runOnline(() => window.TokyoDb.saveSetting("whatsapp_contact", operationSettings.whatsappNumber), "Falha ao salvar WhatsApp público online.");
  runOnline(() => window.TokyoDb.saveSetting("pix_key", operationSettings.pixKey), "Falha ao salvar chave Pix online.");
  runOnline(() => window.TokyoDb.saveSetting("pix_beneficiary", operationSettings.pixBeneficiary), "Falha ao salvar beneficiário Pix online.");
  runOnline(() => window.TokyoDb.saveSetting("store_schedule", { enabled: operationSettings.scheduleEnabled, weekly: operationSettings.weeklySchedule }), "Falha ao salvar horário de funcionamento online.");
}

function renderOperationSettings() {
  const fields = {
    settingsWhatsappNumber: operationSettings.whatsappNumber,
    settingsPixKey: operationSettings.pixKey || DEFAULT_OPERATION_SETTINGS.pixKey,
    settingsPixBeneficiary: operationSettings.pixBeneficiary || DEFAULT_OPERATION_SETTINGS.pixBeneficiary,
    settingsWhatsappOrderTemplate: operationSettings.whatsappOrderTemplate,
    settingsWhatsappReadyTemplate: operationSettings.whatsappReadyTemplate,
    settingsPrinterWidth: operationSettings.printerWidth,
    settingsPrinterMargin: String(operationSettings.printerMargin),
    settingsPrintCopies: String(operationSettings.printCopies)
  };
  Object.entries(fields).forEach(([id, value]) => { if (byId(id)) byId(id).value = value; });
  if (byId("settingsPrintOnNewOrder")) byId("settingsPrintOnNewOrder").checked = operationSettings.printOnNewOrder;
  Object.entries({
    settingsPrintShowCustomer: operationSettings.printerLayout.showCustomer,
    settingsPrintShowPhone: operationSettings.printerLayout.showPhone,
    settingsPrintShowPayment: operationSettings.printerLayout.showPayment,
    settingsPrintShowItemPrices: operationSettings.printerLayout.showItemPrices,
    settingsPrintShowNotes: operationSettings.printerLayout.showNotes,
    settingsPrintShowTotals: operationSettings.printerLayout.showTotals
  }).forEach(([id, checked]) => { if (byId(id)) byId(id).checked = checked; });
  if (byId("settingsPrintAgentKey")) byId("settingsPrintAgentKey").value = localStorage.getItem(PRINT_AGENT_KEY_STORAGE) || "";
  renderPrintAgentStatus();
  if (byId("settingsNotifyNewOrder")) byId("settingsNotifyNewOrder").checked = operationSettings.notifyNewOrder;
  if (byId("settingsScheduleEnabled")) byId("settingsScheduleEnabled").checked = operationSettings.scheduleEnabled;
  operationSettings.weeklySchedule.forEach(day => {
    const enabled = document.querySelector(`[data-schedule-enabled="${day.day}"]`);
    const open = document.querySelector(`[data-schedule-open="${day.day}"]`);
    const close = document.querySelector(`[data-schedule-close="${day.day}"]`);
    if (enabled) enabled.checked = day.enabled;
    if (open) { open.value = day.open; open.disabled = !day.enabled; }
    if (close) { close.value = day.close; close.disabled = !day.enabled; }
  });
  if (byId("settingsPrintStatus")) byId("settingsPrintStatus").textContent = operationSettings.printOnNewOrder ? "Impressão automática ativada para novos pedidos." : "Impressão automática desativada.";
  window.syncNotificationButton?.();
  if (byId("settingsScheduleStatus")) {
    const manualOverride = storeStatus.manualOverride === true
      && (effectiveStoreStatus().source === "manual" || !operationSettings.scheduleEnabled);
    byId("settingsScheduleStatus").textContent = manualOverride
      ? "Controle manual ativo. O cardápio fica neste estado até você clicar em Abrir."
      : operationSettings.scheduleEnabled
        ? "Modo automático ativo. Fechar pode sobrescrever a agenda; Abrir retoma o automático."
        : "Modo manual ativo. A agenda está salva, mas não controla o status.";
  }
}

function printAgentKey() {
  return String(localStorage.getItem(PRINT_AGENT_KEY_STORAGE) || byId("settingsPrintAgentKey")?.value || "").trim();
}

async function requestPrintAgent(path, options = {}) {
  const key = printAgentKey();
  const authorization = key ? { Authorization: `Bearer ${key}` } : {};
  const headers = { ...authorization, ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"] && !headers["content-type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(`${PRINT_AGENT_URL}${path}`, {
    ...options,
    headers
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Agente respondeu ${response.status}.`);
  return body;
}

function renderPrintAgentStatus(message) {
  const status = byId("settingsPrintAgentStatus");
  if (!status) return;
  status.textContent = message || "Impressora local não detectada.";
}

async function connectPrintAgent() {
  const status = byId("settingsPrintAgentStatus");
  if (status) status.textContent = "Detectando o Tokyo Print neste notebook...";
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let health;
    try {
      health = await fetch(`${PRINT_AGENT_URL}/health`, { cache: "no-store", signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!health.ok) throw new Error("O Tokyo Print não respondeu. Abra o aplicativo neste notebook.");
    const healthData = await health.json().catch(() => ({}));
    if (healthData.app !== "tokyo-print") throw new Error("A porta local não pertence ao Tokyo Print.");
    const printers = await requestPrintAgent("/printers");
    const activePrinter = printers.printers?.find(printer => printer.isDefault || printer.IsDefault) || printers.printers?.[0];
    const active = activePrinter?.name || activePrinter?.Name || "nenhuma";
    renderPrintAgentStatus(`Conectado · ${active}`);
    notify("Tokyo Print conectado e pronto para receber pedidos.", "success");
  } catch (error) {
    const message = error.name === "AbortError"
      ? "O Tokyo Print não respondeu em 5 segundos. Abra o aplicativo neste notebook."
      : error.message || "Não foi possível conectar ao Tokyo Print.";
    renderPrintAgentStatus(message);
    notify(message);
  }
}

function mapOrderToPrintRequest(order, mode = "customer") {
  const kitchen = mode === "kitchen";
  return {
    orderId: String(order.id || "LOCAL"),
    storePhone: operationSettings.whatsappNumber || STORE.phone || "",
    printMode: mode,
    createdAt: order.createdAt || new Date().toISOString(),
    customerName: order.customerName || "Cliente",
    customerPhone: order.customerPhone || "",
    payment: order.payment || "Não informado",
    paymentStatus: paymentStatusLabel(order),
    total: Number(order.total || 0),
    subtotal: order.subtotal == null ? null : Number(order.subtotal || 0),
    discount: Number(order.discountAmount || 0),
    couponDiscount: Number(order.couponDiscountAmount || 0),
    surcharge: Number(order.surchargeAmount || 0),
    amountReceived: order.amountReceived == null ? null : Number(order.amountReceived || 0),
    change: Number(order.changeAmount || 0),
    notes: order.notes || "",
    paperWidth: operationSettings.printerWidth || "80",
    margin: Math.min(16, Math.max(0, Number(operationSettings.printerMargin ?? 3))),
    copies: Math.min(3, Math.max(1, Number(operationSettings.printCopies || 1))),
    showCustomer: kitchen ? true : operationSettings.printerLayout.showCustomer,
    showPhone: kitchen ? false : operationSettings.printerLayout.showPhone,
    showPayment: kitchen ? false : operationSettings.printerLayout.showPayment,
    showItemPrices: kitchen ? false : operationSettings.printerLayout.showItemPrices,
    showNotes: operationSettings.printerLayout.showNotes,
    showTotals: kitchen ? false : operationSettings.printerLayout.showTotals,
    items: (order.items || []).map(item => ({
      qty: Math.max(1, Number(item.qty || 1)),
      name: item.name || "Item",
      price: Number(item.price || 0),
      unitExtra: Number(item.unitExtra || 0),
      options: (item.options || []).map(option => ({ qty: Math.max(1, Number(option.qty || 1)), name: option.name || "Adicional", price: Number(option.price || 0) }))
    }))
  };
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

function pdvCustomerOptions() {
  const customers = new Map();
  const add = (key, data) => {
    if (!key || (!data.name && !data.phone)) return;
    const current = customers.get(key) || { key, name: "", phone: "", notes: "" };
    customers.set(key, { ...current, ...data, key });
  };
  orders.forEach(order => {
    const name = String(order.customerName || "").trim();
    const phone = String(order.customerPhone || "").trim();
    if (name || phone) add(customerKey(name, phone), { name, phone });
  });
  Object.entries(customerProfiles || {}).forEach(([key, profile]) => add(key, profile));
  return [...customers.values()].sort((a, b) => String(a.name || a.phone).localeCompare(String(b.name || b.phone), "pt-BR"));
}

function rememberPdvCustomer(name, phone) {
  const cleanName = String(name || "").trim();
  const cleanPhone = String(phone || "").trim();
  if (!cleanName && !cleanPhone) return;
  const key = customerKey(cleanName, cleanPhone);
  customerProfiles[key] = {
    ...(customerProfiles[key] || {}),
    name: cleanName,
    phone: cleanPhone,
    createdAt: customerProfiles[key]?.createdAt || new Date().toISOString()
  };
  hiddenCustomerKeys = (hiddenCustomerKeys || []).filter(item => item !== key);
  saveCustomerData();
}

function fillPdvCustomer(field) {
  const input = byId(field === "name" ? "pdvCustomer" : "pdvPhone");
  const value = String(input?.value || "").trim();
  if (!value) return;
  const normalized = field === "phone" ? value.replace(/\D/g, "") : value.toLowerCase().replace(/\s+/g, " ");
  const customer = pdvCustomerOptions().find(item => {
    const candidate = field === "phone" ? String(item.phone || "").replace(/\D/g, "") : String(item.name || "").toLowerCase().replace(/\s+/g, " ");
    return candidate && candidate === normalized;
  });
  if (!customer) return;
  if (field === "name" && customer.phone) byId("pdvPhone").value = customer.phone;
  if (field === "phone" && customer.name) byId("pdvCustomer").value = customer.name;
}

function scheduleProductSave(targetRef) {
  let product = null;
  let timerKey = "";
  if (typeof targetRef === "object" && targetRef !== null) {
    product = targetRef;
    timerKey = String(product.id);
  } else if (typeof targetRef === "number" && menu[targetRef]) {
    product = menu[targetRef];
    timerKey = String(product.id || targetRef);
  } else {
    product = menu.find(item => String(item.id) === String(targetRef));
    timerKey = String(targetRef);
  }
  if (!product) return;
  const targetId = product.id;
  clearTimeout(productTimers[timerKey]);
  productTimers[timerKey] = setTimeout(() => {
    if (!window.TokyoDb?.enabled) return;
    const currentIndex = menu.findIndex(item => String(item.id) === String(targetId));
    const currentProduct = currentIndex >= 0 ? menu[currentIndex] : product;
    runOnline(() => window.TokyoDb.saveProduct(currentProduct, currentIndex >= 0 ? currentIndex : 0), "Falha ao salvar produto online. O item ficou salvo localmente, mas precisa ser sincronizado.");
  }, 500);
}

function scheduleComplementSave(targetRef) {
  let group = null;
  let timerKey = "";
  if (typeof targetRef === "object" && targetRef !== null) {
    group = targetRef;
    timerKey = String(group.id);
  } else if (typeof targetRef === "number" && complementGroups[targetRef]) {
    group = complementGroups[targetRef];
    timerKey = String(group.id || targetRef);
  } else {
    group = complementGroups.find(item => String(item.id) === String(targetRef));
    timerKey = String(targetRef);
  }
  if (!group) return;
  const targetId = group.id;
  clearTimeout(complementTimers[timerKey]);
  complementTimers[timerKey] = setTimeout(() => {
    const currentGroup = complementGroups.find(item => String(item.id) === String(targetId)) || group;
    runOnline(() => window.TokyoDb.saveComplement(currentGroup), "Falha ao salvar complemento online.");
  }, 500);
}

function runOnline(action, message) {
  if (!window.TokyoDb?.enabled) return;
  action().catch(error => {
    notify(message);
    console.warn(message, error);
  });
}

async function persistOrderStatus(order, nextStatus) {
  if (nextStatus === "Finalizado" && !isOrderPaid(order)) {
    notify("Marque o pedido como pago antes de dar baixa.", "info");
    return false;
  }
  const previousStatus = order.status;
  order.status = nextStatus;
  saveOrders();
  renderAll();
  if (!window.TokyoDb?.enabled) return;
  try {
    await window.TokyoDb.updateOrderStatus(order.id, nextStatus);
  } catch (error) {
    order.status = previousStatus;
    saveOrders();
    renderAll();
    notify("Não foi possível atualizar o pedido no banco. A alteração foi desfeita.");
    console.warn("Falha ao atualizar pedido online.", error);
  }
  return true;
}

async function persistOrderPaymentStatus(order, nextPaymentStatus) {
  const previousPaymentStatus = order.paymentStatus;
  order.paymentStatus = nextPaymentStatus === "paid" ? "paid" : "pending";
  saveOrders();
  renderAll();
  if (!window.TokyoDb?.enabled) return;
  try {
    await window.TokyoDb.updateOrderPaymentStatus(order.id, order.paymentStatus);
  } catch (error) {
    order.paymentStatus = previousPaymentStatus;
    saveOrders();
    renderAll();
    notify("Não foi possível atualizar o pagamento no banco. A alteração foi desfeita.");
    console.warn("Falha ao atualizar pagamento online.", error);
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function dateOnlyValue(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return localDateKey(raw);
}

function formatDateOnly(value) {
  const date = dateOnlyValue(value);
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "-";
}

function orderSummary(order) {
  const pricingLines = order.subtotal != null && (
    Number(order.discountAmount || 0) || Number(order.couponDiscountAmount || 0) || Number(order.surchargeAmount || 0)
  ) ? [
    `Subtotal: ${money(order.subtotal)}`,
    ...(Number(order.discountAmount || 0) ? [`Desconto: - ${money(order.discountAmount)}`] : []),
    ...(Number(order.couponDiscountAmount || 0) ? [`Cupom ${order.couponCode || ""}: - ${money(order.couponDiscountAmount)}`] : []),
    ...(Number(order.surchargeAmount || 0) ? [`Acréscimo: + ${money(order.surchargeAmount)}`] : [])
  ] : [];
  const paymentLines = order.amountReceived != null ? [`Valor recebido: ${money(order.amountReceived)}`, `Troco: ${money(order.changeAmount || 0)}`] : [];
  const isPix = String(order.payment || "").toLowerCase().includes("pix");
  const pixKey = operationSettings.pixKey || STORE.pix || "tokiosushituntum@gmail.com";
  const pixBeneficiary = operationSettings.pixBeneficiary || STORE.pixBeneficiary || "Fabiano R Fernandes";
  const pixLines = (isPix && order.paymentStatus !== "paid") ? [
    "",
    "*DADOS DO PIX*",
    "Chave Pix (E-mail):",
    pixKey,
    "",
    `Valor: ${money(order.total)}`,
    `Beneficiário: ${pixBeneficiary}`,
    "_(Envie o comprovante nesta conversa para confirmarmos o recebimento)_"
  ] : [];
  return [
    `Pedido #${order.id}`,
    `Cliente: ${order.customerName}`,
    `Pagamento: ${order.payment || "-"} · ${paymentStatusLabel(order)}`,
    ...pricingLines,
    `Total: ${money(order.total)}`,
    ...paymentLines,
    ...pixLines,
    "",
    ...order.items.flatMap(item => [
      `${item.qty}x ${item.name} - ${money((Number(item.price || 0) + Number(item.unitExtra || 0)) * item.qty)}`,
      ...(item.options || []).map(option => `  + ${option.qty}x ${option.name}`)
    ])
  ].join("\n");
}

function orderWhatsappMessage(order) {
  const template = order?.status === "Pronto"
    ? operationSettings.whatsappReadyTemplate
    : operationSettings.whatsappOrderTemplate;
  return encodeURIComponent(renderWhatsappTemplate(template, order));
}

function renderWhatsappTemplate(template, order) {
  const pixKey = operationSettings.pixKey || STORE.pix || "tokiosushituntum@gmail.com";
  const pixBeneficiary = operationSettings.pixBeneficiary || STORE.pixBeneficiary || "Fabiano R Fernandes";
  const values = {
    cliente: order.customerName || "cliente",
    pedido: order.id || "",
    total: money(order.total || 0),
    resumo: orderSummary(order),
    loja: STORE.name,
    pix: pixKey,
    beneficiario: pixBeneficiary
  };
  return String(template || "").replace(/\{(cliente|pedido|total|resumo|loja|pix|beneficiario)\}/gi, (_, token) => values[token.toLowerCase()] ?? "");
}

async function printOrder(order, mode = "customer") {
  try {
    const result = await requestPrintAgent("/v1/print-order", {
      method: "POST",
      body: JSON.stringify(mapOrderToPrintRequest(order, mode))
    });
    notify(`Pedido ${order.id} entrou na fila da impressora.`, "success");
    return result;
  } catch (error) {
    renderPrintAgentStatus("Agente indisponível · impressão do navegador usada como alternativa.");
    notify(`Tokyo Print indisponível: ${error.message || "verifique o aplicativo"}.`, "info");
  }

  return browserPrintOrder(order, mode);
}

function browserPrintOrder(order, mode = "customer") {
  const kitchen = mode === "kitchen";
  const width = operationSettings.printerWidth || "80";
  const copies = Math.min(3, Math.max(1, Number(operationSettings.printCopies || 1)));
  const receipt = window.open("", "_blank", "width=420,height=720");
  if (!receipt) return notify("Permita pop-ups para imprimir a comanda.");
  const items = order.items.map(item => `
    <div class="item"><strong>${item.qty}x ${escapeHtml(item.name)}</strong>${kitchen ? "" : `<span>${money((Number(item.price || 0) + Number(item.unitExtra || 0)) * Number(item.qty || 0))}</span>`}</div>
    ${(item.options || []).map(option => `<small>+ ${option.qty}x ${escapeHtml(option.name)}</small>`).join("")}
  `).join("");
  const receiptMarkup = `
    <div><h1>TOKYO SUSHI</h1><strong>${kitchen ? "COMANDA DE PRODUÇÃO" : "COMANDA DE RETIRADA"}</strong><h2>PEDIDO #${escapeHtml(order.id)}</h2><p>${escapeHtml(formatDate(order.createdAt))}</p></div>
    <div class="line"></div><p><strong>CLIENTE:</strong> ${escapeHtml(order.customerName || "Cliente")}</p>${kitchen ? "" : `<p><strong>CELULAR:</strong> ${escapeHtml(order.customerPhone || "-")}</p><p><strong>PAGAMENTO:</strong> ${escapeHtml(order.payment || "-")}</p>`}
    <div class="line"></div>${items}<div class="line"></div>
    ${kitchen ? "" : `${order.subtotal != null ? `<p>Subtotal: ${money(order.subtotal)}</p>${Number(order.discountAmount || 0) ? `<p>Desconto: - ${money(order.discountAmount)}</p>` : ""}${Number(order.couponDiscountAmount || 0) ? `<p>Cupom: - ${money(order.couponDiscountAmount)}</p>` : ""}${Number(order.surchargeAmount || 0) ? `<p>Acréscimo: + ${money(order.surchargeAmount)}</p>` : ""}` : ""}<div class="total"><span>TOTAL</span><span>${money(order.total)}</span></div>${order.amountReceived != null ? `<p>Recebido: ${money(order.amountReceived)} · Troco: ${money(order.changeAmount || 0)}</p>` : ""}`}
    ${order.notes ? `<div class="notes"><strong>*** OBSERVAÇÕES ***</strong><br>*** ${escapeHtml(order.notes)} ***</div>` : ""}
    <div class="line"></div><p>${kitchen ? "PRODUÇÃO" : "OBRIGADO!"}</p>
  `;
  const copiesMarkup = Array.from({ length: copies }, (_, index) => `${index ? '<div class="copy-break"></div>' : ""}${receiptMarkup}`).join("");
  receipt.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido ${escapeHtml(order.id)}</title><style>
    @page{size:${width}mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}body{width:${width}mm;padding:3mm;font:600 12px/1.3 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1{font-size:17px;font-weight:700;margin:0 0 3px}h2{font-size:15px;font-weight:700;margin:5px 0}p{margin:0 0 6px}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}.item{display:flex;justify-content:space-between;gap:8px;margin:8px 0}.item strong{max-width:70%;font-weight:700}small{display:block;margin-left:10px;font-weight:600}.total{display:flex;justify-content:space-between;font-size:16px;font-weight:700}.notes{border:1px solid #000;padding:6px;margin-top:8px;font-weight:600}.copy-break{break-before:page;page-break-before:always}
  </style></head><body>${copiesMarkup}</body></html>`);
  receipt.document.close();
  receipt.focus();
  setTimeout(() => receipt.print(), 250);
}

function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function isOperationalSale(order) {
  return order?.status !== "Cancelado" && !order?.archivedAt && !order?.archived_at;
}

function isOrderPaid(order) {
  return order?.paymentStatus === "paid"
    || order?.payment_status === "paid"
    || order?.paid === true
    || Boolean(order?.paidAt);
}

function isReceivedSale(order) {
  return isOperationalSale(order) && isOrderPaid(order);
}

function renderMetrics() {
  const today = todayKey();
  const todayOrders = orders.filter(order => localDateKey(order.createdAt) === today && isOperationalSale(order));
  const todaySales = todayOrders.filter(isReceivedSale);
  const revenue = todaySales.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pending = orders.filter(order => !["Finalizado", "Cancelado"].includes(order.status) && !order.archivedAt && !order.archived_at).length;
  const avg = todaySales.length ? revenue / todaySales.length : 0;

  const metricRows = [
    ["Vendas hoje", money(revenue)],
    ["Pedidos hoje", todayOrders.length],
    ["Em aberto", pending],
    ["Ticket médio", money(avg)]
  ];
  byId("metrics").classList.toggle("is-private", metricsHidden);
  byId("metrics").innerHTML = metricRows.map(([label, value]) => `
    <article class="metric">
      <span>${label}</span>
      <strong aria-label="${metricsHidden ? "Valor oculto" : escapeHtml(value)}">${metricsHidden ? "••••" : escapeHtml(value)}</strong>
    </article>
  `).join("");
  const privacyButton = byId("toggleMetricsVisibility");
  if (privacyButton) {
    privacyButton.setAttribute("aria-pressed", String(metricsHidden));
    privacyButton.setAttribute("aria-label", metricsHidden ? "Mostrar valores do resumo" : "Ocultar valores do resumo");
    privacyButton.title = metricsHidden ? "Mostrar valores" : "Ocultar valores";
    privacyButton.querySelector("span:last-child").textContent = metricsHidden ? "Mostrar valores" : "Ocultar valores";
    privacyButton.classList.toggle("is-private", metricsHidden);
  }
}

function effectiveStoreStatus() {
  const schedule = { enabled: operationSettings.scheduleEnabled, weekly: operationSettings.weeklySchedule };
  return window.TokyoSchedule?.resolveStatus
    ? window.TokyoSchedule.resolveStatus(schedule, storeStatus)
    : storeStatus;
}

function renderStoreControls({ syncSettings = true } = {}) {
  operationSettings = normalizeOperationSettings(operationSettings);
  const status = effectiveStoreStatus();
  const statusLabel = status.mode === "open" ? "Aberto" : "Fechado";
  byId("storeStatusAdmin").textContent = statusLabel;
  const statusBar = byId("storeStatusAdmin")?.closest(".pdv-bar");
  if (statusBar) statusBar.dataset.storeStatus = status.mode;
  if (byId("settingsStoreStatus")) byId("settingsStoreStatus").textContent = statusLabel;
  if (byId("databaseStatus")) byId("databaseStatus").textContent = window.TokyoDb?.enabled ? "Online e sincronizado pelo Supabase." : "Modo local neste dispositivo.";
  document.querySelectorAll("[data-store-mode]").forEach(button => {
    button.disabled = false;
    const isSelected = button.dataset.storeMode === status.mode;
    button.title = isSelected
      ? `Estado atual do cardápio: ${statusLabel}.`
      : operationSettings.scheduleEnabled
        ? "Selecionar este estado manualmente. Abrir retoma a agenda automática."
        : `Mudar o cardápio para ${button.dataset.storeMode === "open" ? "aberto" : "fechado"}.`;
    button.classList.toggle("active-mode", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  if (syncSettings) renderOperationSettings();
}

function filteredOrders() {
  const term = (byId("orderSearch")?.value || "").toLowerCase().trim();
  const status = byId("orderStatusFilter")?.value || "";
  return orders.filter(order => {
    if (order.archivedAt || order.archived_at) return false;
    const text = `${order.id} ${order.customerName || ""} ${order.customerPhone || ""}`.toLowerCase();
    return (!term || text.includes(term)) && (!status || order.status === status);
  });
}

function statusLabel(status) {
  if (status === "Preparando") return "Aceito";
  if (status === "Finalizado") return "Saiu";
  return status;
}

function paymentStatusLabel(order) {
  return order.paymentStatus === "paid" ? "Pago" : "Não pago";
}

const EDITABLE_ORDER_STATUSES = new Set(["Recebido", "Preparando", "Pronto"]);

function canEditOrder(order) {
  return Boolean(order) && EDITABLE_ORDER_STATUSES.has(order.status) && !order.archivedAt && !order.archived_at;
}

function cloneOrderItem(item) {
  return {
    ...item,
    id: Number(item.id),
    qty: Math.max(1, Number(item.qty || 1)),
    options: (item.options || []).map(option => ({ ...option, qty: Math.max(1, Number(option.qty || 1)) }))
  };
}

function orderEditorOptionKey(options = []) {
  return (options || []).map(option => `${option.groupId}:${option.itemId}:${option.qty}`).sort().join("|");
}

function orderEditorSelectedGroupTotal(groupId) {
  return Object.entries(orderEditorPendingOptions)
    .filter(([key]) => key.startsWith(`${groupId}:`))
    .reduce((sum, [, quantity]) => sum + Number(quantity || 0), 0);
}

function changeOrderEditorOption(key, amount) {
  const [groupId] = String(key).split(":");
  const group = complementGroups.find(item => String(item.id) === String(groupId));
  const current = Number(orderEditorPendingOptions[key] || 0);
  const max = Number(group?.maxQty || 100);
  if (amount > 0 && orderEditorSelectedGroupTotal(groupId) >= max) return;
  orderEditorPendingOptions[key] = Math.max(0, current + amount);
  if (!orderEditorPendingOptions[key]) delete orderEditorPendingOptions[key];
  renderOrders({ preserveEditorViewport: true });
}

function openOrderEditor(orderId) {
  const order = orders.find(item => String(item.id) === String(orderId));
  if (!order) return;
  if (!canEditOrder(order)) {
    notify("Pedidos finalizados ou cancelados não podem ser editados.", "info");
    return;
  }
  editingOrderId = String(order.id);
  orderEditorDraft = {
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    notes: order.notes || "",
    pricing: { ...(order.pricing || {}) },
    items: order.items.map(cloneOrderItem)
  };
  orderEditorSelectedProductId = menu.find(item => item.active !== false && !item.archived)?.id || "";
  orderEditorPendingOptions = {};
  renderOrders({ preserveEditorViewport: true });
  window.setTimeout(() => byId(`order-editor-name-${order.id}`)?.focus(), 0);
}

function closeOrderEditor() {
  editingOrderId = null;
  orderEditorDraft = null;
  orderEditorPendingOptions = {};
  renderOrders({ preserveEditorViewport: true });
}

function orderEditorAddItem() {
  if (!orderEditorDraft) return;
  const product = menu.find(item => String(item.id) === String(orderEditorSelectedProductId));
  if (!product) return notify("Escolha um item disponível para adicionar.");
  const quantity = Math.max(1, Math.min(50, Number(byId("order-editor-add-qty")?.value || 1)));
  const groups = pdvProductComplements(product.id);
  for (const group of groups) {
    const selected = orderEditorSelectedGroupTotal(group.id);
    if (selected < Number(group.minQty || 0)) {
      notify(`Escolha pelo menos ${group.minQty} adicional(is) em ${group.name}.`);
      return;
    }
  }
  const options = Object.entries(orderEditorPendingOptions).map(([key, qty]) => {
    const [groupId, itemId] = key.split(":");
    const group = complementGroups.find(item => String(item.id) === String(groupId));
    const option = group?.items?.find(item => String(item.id) === String(itemId));
    return option ? { groupId: group.id, groupName: group.name, itemId: option.id, name: option.name, price: Number(option.price || 0), qty: Number(qty) } : null;
  }).filter(Boolean);
  const key = `${product.id}|${orderEditorOptionKey(options)}`;
  const existing = orderEditorDraft.items.find(item => `${item.id}|${orderEditorOptionKey(item.options)}` === key);
  if (existing) existing.qty = Math.min(50, Number(existing.qty || 0) + quantity);
  else orderEditorDraft.items.push({ id: product.id, name: product.name, price: Number(product.price || 0), basePrice: Number(product.price || 0), unitExtra: options.reduce((sum, option) => sum + option.price * option.qty, 0), qty: quantity, options });
  orderEditorPendingOptions = {};
  renderOrders({ preserveEditorViewport: true });
}

function orderEditorChangeQty(index, delta) {
  if (!orderEditorDraft?.items[index]) return;
  orderEditorDraft.items[index].qty = Math.max(0, Math.min(50, Number(orderEditorDraft.items[index].qty || 0) + delta));
  if (!orderEditorDraft.items[index].qty) orderEditorDraft.items.splice(index, 1);
  renderOrders({ preserveEditorViewport: true });
}

function orderEditorRemoveItem(index) {
  if (!orderEditorDraft?.items[index]) return;
  orderEditorDraft.items.splice(index, 1);
  renderOrders({ preserveEditorViewport: true });
}

function orderEditorSubtotal() {
  return Math.round((orderEditorDraft?.items || []).reduce((sum, item) => {
    const product = menu.find(candidate => String(candidate.id) === String(item.id));
    const basePrice = Number(product?.price ?? item.price ?? 0);
    const optionsTotal = (item.options || []).reduce((total, option) => total + Number(option.price || 0) * Number(option.qty || 0), 0);
    return sum + (basePrice + optionsTotal) * Number(item.qty || 0);
  }, 0) * 100) / 100;
}

function orderEditorPricing(order) {
  const source = orderEditorDraft?.pricing || order?.pricing || {};
  return {
    discountType: source.discountType || "none",
    discountValue: Math.max(0, Number(source.discountValue || 0)),
    surchargeType: source.surchargeType || "none",
    surchargeValue: Math.max(0, Number(source.surchargeValue || 0)),
    couponCode: source.couponCode || order?.couponCode || "",
    amountReceived: source.amountReceived ?? order?.amountReceived ?? null
  };
}

function orderEditorPricingTotals(order, subtotal = orderEditorSubtotal()) {
  const pricing = orderEditorPricing(order);
  const discountAmount = pdvAdjustmentAmount(pricing.discountType, pricing.discountValue, subtotal);
  const couponDiscountAmount = Math.min(Math.max(0, subtotal - discountAmount), Number(order?.couponDiscountAmount || 0));
  const afterDiscounts = Math.max(0, subtotal - discountAmount - couponDiscountAmount);
  const surchargeAmount = pdvAdjustmentAmount(pricing.surchargeType, pricing.surchargeValue, afterDiscounts, false);
  const total = Math.round((afterDiscounts + surchargeAmount) * 100) / 100;
  const amountReceived = String(order?.payment || "").toLowerCase() === "dinheiro" && pricing.amountReceived != null
    ? Math.max(0, Number(pricing.amountReceived || 0))
    : null;
  const change = amountReceived != null && amountReceived >= total ? Math.round((amountReceived - total) * 100) / 100 : 0;
  return { ...pricing, subtotal, discountAmount, couponDiscountAmount, surchargeAmount, total, amountReceived, change };
}

function readOrderEditorPricing(form, order) {
  const current = orderEditorPricing(order);
  return {
    ...current,
    discountType: form.elements.discountType?.value || "none",
    discountValue: Math.max(0, Number(form.elements.discountValue?.value || 0)),
    surchargeType: form.elements.surchargeType?.value || "none",
    surchargeValue: Math.max(0, Number(form.elements.surchargeValue?.value || 0))
  };
}

function renderOrderEditor(order) {
  const draft = orderEditorDraft || { customerName: order.customerName || "", customerPhone: order.customerPhone || "", notes: order.notes || "", pricing: { ...(order.pricing || {}) }, items: order.items.map(cloneOrderItem) };
  const groups = pdvProductComplements(orderEditorSelectedProductId);
  const subtotal = orderEditorSubtotal();
  const pricing = orderEditorPricingTotals(order, subtotal);
  const selectedDiscountType = pricing.discountType;
  const selectedSurchargeType = pricing.surchargeType;
  return `
    <form class="order-editor" data-order-edit-form="${escapeHtml(order.id)}" aria-label="Editar pedido #${escapeHtml(order.id)}">
      <div class="order-editor-head"><div><strong>Editar pedido #${escapeHtml(order.id)}</strong><small>O número e o status permanecem os mesmos.</small></div><button class="ghost" type="button" data-close-order-editor="${escapeHtml(order.id)}">Fechar</button></div>
      <div class="order-editor-fields">
        <label>Nome<input id="order-editor-name-${escapeHtml(order.id)}" name="customerName" value="${escapeHtml(draft.customerName)}" required maxlength="120"></label>
        <label>Celular<input name="customerPhone" value="${escapeHtml(draft.customerPhone)}" required inputmode="tel" maxlength="15"></label>
        <div class="order-editor-readonly"><span>Pagamento</span><strong>${escapeHtml(order.payment || "-")}</strong><small>Altere Pago/Não pago no botão do pedido.</small></div>
        <label class="wide">Observações<textarea name="notes" maxlength="1000" rows="2" placeholder="Ex.: acrescentar um detalhe…">${escapeHtml(draft.notes)}</textarea></label>
      </div>
      <div class="order-editor-items">
        <div class="order-editor-section-head"><strong>Itens do pedido</strong><small>Adicione o que ficou faltando ou ajuste a quantidade.</small></div>
        ${draft.items.map((item, index) => `<div class="order-editor-item"><div><strong>${item.qty}x ${escapeHtml(item.name || "Item")}</strong>${(item.options || []).length ? `<small>${item.options.map(option => `+ ${option.qty}x ${escapeHtml(option.name)}`).join(" · ")}</small>` : ""}</div><div class="order-editor-item-actions"><button class="ghost" type="button" data-order-edit-qty="${index}:-1" aria-label="Diminuir ${escapeHtml(item.name)}">−</button><span>${item.qty}</span><button class="ghost" type="button" data-order-edit-qty="${index}:1" aria-label="Aumentar ${escapeHtml(item.name)}">+</button><button class="danger" type="button" data-order-edit-remove="${index}">Remover</button></div></div>`).join("") || `<p class="order-editor-empty">O pedido precisa ter pelo menos um item.</p>`}
      </div>
      <div class="order-editor-add">
        <div class="order-editor-section-head"><strong>Adicionar item</strong><small>Os adicionais disponíveis aparecem ao escolher o produto.</small></div>
        <div class="order-editor-add-row"><select data-order-edit-product aria-label="Produto para adicionar">${menu.filter(item => item.active !== false && !item.archived).map(item => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(orderEditorSelectedProductId) ? "selected" : ""}>${escapeHtml(item.name)} · ${money(item.price)}</option>`).join("")}</select><input id="order-editor-add-qty" type="number" min="1" max="50" value="1" inputmode="numeric" aria-label="Quantidade a adicionar"><button class="primary" type="button" data-order-edit-add>Adicionar item</button></div>
        ${groups.length ? `<div class="order-editor-options">${groups.map(group => `<section><div class="order-editor-option-head"><strong>${escapeHtml(group.name)}</strong><small>${group.minQty ? `Obrigatório · mínimo ${group.minQty}` : "Opcional"}</small></div>${(group.items || []).filter(item => item.active !== false).map(item => { const key = `${group.id}:${item.id}`; const quantity = Number(orderEditorPendingOptions[key] || 0); return `<div class="order-editor-option-row"><span>${escapeHtml(item.name)} <small>${money(item.price || 0)}</small></span><div><button class="ghost" type="button" data-order-edit-option-minus="${escapeHtml(key)}">−</button><strong>${quantity}</strong><button class="ghost" type="button" data-order-edit-option-plus="${escapeHtml(key)}">+</button></div></div>`; }).join("")}</section>`).join("")}</div>` : ""}
      </div>
      <div class="order-editor-adjustments">
        <div class="order-editor-section-head"><strong>Ajustar valores</strong><small>Use quando precisar corrigir o preço antes de concluir.</small></div>
        <div class="order-editor-adjustment-row">
          <label>Desconto<select name="discountType" data-order-edit-adjustment="discountType" aria-label="Tipo de desconto"><option value="none" ${selectedDiscountType === "none" ? "selected" : ""}>Sem desconto</option><option value="fixed" ${selectedDiscountType === "fixed" ? "selected" : ""}>Em R$</option><option value="percent" ${selectedDiscountType === "percent" ? "selected" : ""}>Em %</option></select></label>
          <label>Valor<input name="discountValue" data-order-edit-adjustment="discountValue" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(pricing.discountValue)}" aria-label="Valor do desconto"></label>
          <label>Acréscimo<select name="surchargeType" data-order-edit-adjustment="surchargeType" aria-label="Tipo de acréscimo"><option value="none" ${selectedSurchargeType === "none" ? "selected" : ""}>Sem acréscimo</option><option value="fixed" ${selectedSurchargeType === "fixed" ? "selected" : ""}>Em R$</option><option value="percent" ${selectedSurchargeType === "percent" ? "selected" : ""}>Em %</option></select></label>
          <label>Valor<input name="surchargeValue" data-order-edit-adjustment="surchargeValue" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(pricing.surchargeValue)}" aria-label="Valor do acréscimo"></label>
        </div>
        ${pricing.couponDiscountAmount ? `<p class="order-editor-coupon">Cupom preservado: <strong>${escapeHtml(pricing.couponCode || "aplicado")}</strong> · - ${money(pricing.couponDiscountAmount)}</p>` : ""}
      </div>
      <div class="order-editor-total"><span>Subtotal estimado <strong>${money(subtotal)}</strong></span>${pricing.discountAmount ? `<span>Desconto <strong>- ${money(pricing.discountAmount)}</strong></span>` : ""}${pricing.couponDiscountAmount ? `<span>Cupom <strong>- ${money(pricing.couponDiscountAmount)}</strong></span>` : ""}${pricing.surchargeAmount ? `<span>Acréscimo <strong>+ ${money(pricing.surchargeAmount)}</strong></span>` : ""}<span>Total estimado <strong>${money(pricing.total)}</strong></span></div>
      <div class="order-editor-footer"><small>O banco recalcula os valores antes de salvar. Se o pedido já estiver pronto, reimprima a comanda se necessário.</small><button class="primary" type="submit">Salvar alterações</button></div>
    </form>
  `;
}

async function saveOrderEditor(order, form) {
  if (!orderEditorDraft?.items.length) return notify("O pedido precisa ter pelo menos um item.");
  const previous = normalizeOrder(JSON.parse(JSON.stringify(order)));
  const pricing = readOrderEditorPricing(form, order);
  if (pricing.discountType === "percent" && pricing.discountValue > 100) return notify("O desconto percentual não pode passar de 100%.");
  if (pricing.surchargeType === "percent" && pricing.surchargeValue > 100) return notify("O acréscimo percentual não pode passar de 100%.");
  orderEditorDraft.pricing = pricing;
  const draft = normalizeOrder({ ...order, customerName: form.elements.customerName.value.trim(), customerPhone: form.elements.customerPhone.value.replace(/\D/g, ""), notes: form.elements.notes.value.trim(), pricing, items: orderEditorDraft.items.map(item => ({ ...item, id: Number(item.id), qty: Number(item.qty), options: (item.options || []).map(option => ({ ...option, groupId: Number(option.groupId), itemId: Number(option.itemId), qty: Number(option.qty) })) })) });
  if (draft.customerName.length < 2 || draft.customerPhone.length < 10) return notify("Confira nome e celular antes de salvar.");
  const index = orders.findIndex(item => String(item.id) === String(order.id));
  if (index < 0) return;
  orders[index] = draft;
  saveOrders();
  renderAll();
  try {
    if (window.TokyoDb?.enabled) {
      const saved = await window.TokyoDb.updateOrder(draft);
      if (!saved) throw new Error("O banco não retornou o pedido atualizado.");
      orders[index] = normalizeOrder(saved);
    } else {
      const subtotal = orderEditorSubtotal();
      const totals = orderEditorPricingTotals(draft, subtotal);
      orders[index] = { ...draft, subtotal, discountAmount: totals.discountAmount, couponDiscountAmount: totals.couponDiscountAmount, surchargeAmount: totals.surchargeAmount, total: totals.total, changeAmount: totals.change, amountReceived: totals.amountReceived };
    }
    saveOrders();
    editingOrderId = null;
    orderEditorDraft = null;
    orderEditorPendingOptions = {};
    renderAll();
    notify(`Pedido #${order.id} atualizado com sucesso.${order.status === "Pronto" ? " Se necessário, reimprima a comanda." : ""}`, "success");
  } catch (error) {
    orders[index] = previous;
    saveOrders();
    editingOrderId = null;
    orderEditorDraft = null;
    orderEditorPendingOptions = {};
    renderAll();
    notify(error.message || "Não foi possível atualizar o pedido. A alteração foi desfeita.");
    console.warn("Falha ao editar pedido online.", error);
  }
}

function nextStatuses(order) {
  const status = typeof order === "string" ? order : order?.status;
  if (status === "Recebido") return [
    { label: "Aceitar pedido", value: "Preparando", kind: "primary" },
    { label: "Cancelar", value: "Cancelado", kind: "danger" }
  ];
  if (status === "Preparando") return [
    { label: "Marcar pronto", value: "Pronto", kind: "primary" },
    { label: "Cancelar", value: "Cancelado", kind: "danger" }
  ];
  if (status === "Pronto") return [
    { label: "Dar baixa", value: "Finalizado", kind: "primary", disabled: !isOrderPaid(order) }
  ];
  return [];
}

function orderCard(order) {
  const actions = nextStatuses(order);
  return `
    <article class="order-card compact">
      <div>
        <div class="order-title">
          <strong>${escapeHtml(order.customerName || "Cliente")}</strong>
          <span>#${escapeHtml(order.id)}</span>
        </div>
        <div class="order-meta">
          <span>${formatDate(order.createdAt)}</span>
          <span>${escapeHtml(order.customerPhone || "-")}</span>
          <span>${escapeHtml(order.payment || "-")}</span>
          ${order.amountReceived != null && String(order.payment).toLowerCase() === "dinheiro" ? `<span>Troco ${money(order.changeAmount || 0)}</span>` : ""}
          <button class="payment-chip ${order.paymentStatus === "paid" ? "is-paid" : "is-pending"}" data-payment-toggle="${order.id}" aria-pressed="${order.paymentStatus === "paid"}" title="Alternar status do pagamento">${paymentStatusLabel(order)}</button>
          <strong>${money(order.total)}</strong>
        </div>
        <ul class="order-items">
          ${order.items.map(item => `
            <li>
              ${item.qty}x ${escapeHtml(item.name)}
              ${(item.options || []).length ? `<small>${item.options.map(option => `+ ${option.qty}x ${escapeHtml(option.name)}`).join("<br>")}</small>` : ""}
            </li>
          `).join("")}
        </ul>
        ${order.notes ? `<p><strong>Obs.:</strong> ${escapeHtml(order.notes)}</p>` : ""}
      </div>
      <div class="order-actions" aria-label="Ações do pedido #${escapeHtml(order.id)}">
        ${actions.map(action => `<button class="action-btn ${action.kind}${action.disabled ? " requires-payment" : ""}" data-quick-status="${order.id}:${action.value}"${action.disabled ? ` aria-disabled="true" title="Marque como pago para dar baixa"` : ""}>${action.label}</button>`).join("")}
        ${canEditOrder(order) ? `<button class="action-btn ghost" data-edit-order="${escapeHtml(order.id)}">Editar</button>` : ""}
        ${order.status === "Pronto" ? `<button class="action-btn danger" data-archive-finance-order="${escapeHtml(order.id)}">Excluir</button>` : ""}
        <a class="action-btn whatsapp-action" href="https://wa.me/${whatsappNumber(order.customerPhone)}?text=${orderWhatsappMessage(order)}" target="_blank" rel="noopener" title="Abrir WhatsApp do cliente">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.45 15.09L2.4 21.6l4.62-1.16A9.95 9.95 0 1 0 12.04 2Zm0 2a7.95 7.95 0 0 1 6.72 12.2 7.93 7.93 0 0 1-10.93 2.32l-.38-.23-2.24.56.58-2.17-.25-.4A7.95 7.95 0 0 1 12.04 4Zm-3.05 3.7c-.18 0-.46.06-.7.33-.24.26-.92.9-.92 2.2s.94 2.55 1.07 2.73c.13.18 1.82 2.91 4.51 3.96 2.23.88 2.68.7 3.16.66.49-.05 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.06-.11-.24-.18-.51-.31-.27-.13-1.57-.78-1.82-.87-.24-.09-.42-.13-.6.13-.18.27-.69.87-.85 1.04-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.8-.71-1.34-1.59-1.49-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.44.09-.18.05-.33-.02-.47-.07-.13-.6-1.45-.82-1.99-.22-.52-.44-.45-.6-.46h-.44Z"/></svg>
          WhatsApp
        </a>
        <button class="action-btn ghost icon-action" data-print-order="${order.id}" data-print-dialog="true" data-print-mode="${order.status === "Pronto" ? "customer" : "kitchen"}" aria-label="${order.status === "Pronto" ? "Imprimir comprovante do cliente" : "Imprimir comanda de produção"}" title="${order.status === "Pronto" ? "Imprimir comprovante do cliente" : "Imprimir comanda de produção"}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V2h12v7h1a3 3 0 0 1 3 3v6h-4v4H6v-4H2v-6a3 3 0 0 1 3-3h1Zm2-5v5h8V4H8Zm8 12H8v4h8v-4Zm3-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
        </button>
      </div>
      ${String(editingOrderId) === String(order.id) ? renderOrderEditor(order) : ""}
    </article>
  `;
}

function renderOrders({ preserveEditorViewport = false } = {}) {
  const editorViewport = preserveEditorViewport ? { left: window.scrollX, top: window.scrollY } : null;
  const visibleOrders = filteredOrders();
  const selectedStatus = byId("orderStatusFilter")?.value || "";
  const showActiveOrders = byId("showActiveOrders");
  if (showActiveOrders) {
    showActiveOrders.hidden = !selectedStatus;
    showActiveOrders.setAttribute("aria-hidden", String(!selectedStatus));
  }

  const columns = [
    ["Recebidos", visibleOrders.filter(order => order.status === "Recebido")],
    ["Aceitos", visibleOrders.filter(order => order.status === "Preparando")],
    ["Prontos", visibleOrders.filter(order => order.status === "Pronto")]
  ];
  if (["Finalizado", "Cancelado"].includes(selectedStatus)) {
    columns.splice(0, columns.length, ["Histórico", visibleOrders.filter(order => order.status === selectedStatus).slice(0, 24)]);
  }

  const exited = orders.filter(order => order.status === "Finalizado" && !order.archivedAt && !order.archived_at).length;
  const cancelled = orders.filter(order => order.status === "Cancelado" && !order.archivedAt && !order.archived_at).length;

  byId("ordersList").innerHTML = `
    <div class="kanban">
      ${columns.map(([title, items]) => `
        <section class="order-column ${title === "Recebidos" ? "received-column" : ""}">
          <h2>${title} <span>${items.length}</span></h2>
          ${items.map(orderCard).join("") || `<p class="empty-column">${selectedStatus ? `Nenhum pedido em ${statusLabel(selectedStatus).toLowerCase()}.` : "Aguardando pedido."}</p>`}
        </section>
      `).join("")}
    </div>
    <div class="order-summary" aria-label="Resumo do histórico">
      <button type="button" class="order-summary-button exited" data-order-filter="Finalizado">Saíram <strong>${exited}</strong></button>
      <button type="button" class="order-summary-button cancelled" data-order-filter="Cancelado">Cancelados <strong>${cancelled}</strong></button>
    </div>
  `;
  if (editorViewport) {
    window.requestAnimationFrame(() => window.scrollTo({ left: editorViewport.left, top: editorViewport.top, behavior: "auto" }));
  }
}

function renderComplements() {
  const term = (byId("complementSearch")?.value || "").toLowerCase().trim();
  const groups = complementGroups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => {
      const linkedNames = menu.filter(product => (group.linkedProductIds || []).map(String).includes(String(product.id))).map(product => product.name).join(" ");
      return !term || `${group.name} ${(group.items || []).map(item => item.name).join(" ")} ${linkedNames}`.toLowerCase().includes(term);
    });

  byId("complementEditor").innerHTML = groups.map(({ group, index }) => {
    const isPdvGlobal = (group.tags || []).map(String).includes("pdv-global");
    return `
      <article class="complement-card ${isPdvGlobal ? "is-pdv-global" : ""}">
        <header class="complement-card-header">
          <div class="complement-card-title">
            <div class="complement-title-row">
              <span class="complement-kicker">Lista de adicionais</span>
              ${isPdvGlobal ? `<span class="complement-badge">Disponível no PDV</span>` : ""}
            </div>
            <label class="complement-name-field">Nome da lista<input data-complement-field="name" data-cindex="${index}" value="${escapeHtml(group.name || "")}"></label>
          </div>
          <div class="complement-header-actions" aria-label="Ações da lista">
            <button class="ghost complement-action" type="button" data-duplicate-complement="${index}">Duplicar lista</button>
            <button class="danger complement-action" type="button" data-remove-complement="${index}">Excluir lista</button>
          </div>
        </header>

        <div class="complement-settings">
          <label>Mínimo<input type="number" min="0" data-complement-field="minQty" data-cindex="${index}" value="${group.minQty || 0}"></label>
          <label>Máximo<input type="number" min="1" data-complement-field="maxQty" data-cindex="${index}" value="${group.maxQty || 100}"></label>
          <label>Ordem<input type="number" min="0" data-complement-field="sortOrder" data-cindex="${index}" value="${group.sortOrder || 0}"></label>
          <label class="check-line"><input type="checkbox" data-complement-field="active" data-cindex="${index}" ${group.active !== false ? "checked" : ""}> Lista ativa</label>
        </div>

        <div class="complement-group-meta">
          <label>Descrição ou aviso<input data-complement-field="description" data-cindex="${index}" value="${escapeHtml(group.description || "")}" placeholder="Ex.: escolha até 2 opções"></label>
        </div>

        <details class="complement-disclosure" open>
          <summary>Produtos vinculados <span>${(group.linkedProductIds || []).length}</span></summary>
          <div class="linked-products">
            ${menu.map(product => `
              <label>
                <input type="checkbox" data-link-product="${index}:${escapeHtml(product.id)}" ${(group.linkedProductIds || []).map(String).includes(String(product.id)) ? "checked" : ""}>
                ${escapeHtml(product.name)}
              </label>
            `).join("")}
          </div>
        </details>

        <div class="complement-items">
          <div class="complement-items-head">
            <div>
              <strong>Itens disponíveis</strong>
              <small>Defina preço, limite e disponibilidade de cada opção.</small>
            </div>
            <button class="ghost complement-add-item" type="button" data-add-complement-item="${index}">Adicionar item</button>
          </div>
          ${(group.items || []).map((item, itemIndex) => `
            <div class="complement-item">
              <label class="complement-item-field">Nome<input data-complement-item-field="name" data-cindex="${index}" data-iindex="${itemIndex}" value="${escapeHtml(item.name || "")}" placeholder="Ex.: Cream Cheese"></label>
              <label class="complement-item-field">Preço<input type="number" step="0.01" data-complement-item-field="price" data-cindex="${index}" data-iindex="${itemIndex}" value="${item.price || 0}" placeholder="0,00"></label>
              <label class="complement-item-field">Máximo<input type="number" min="0" step="1" data-complement-item-field="maxQty" data-cindex="${index}" data-iindex="${itemIndex}" value="${item.maxQty ?? 100}" placeholder="100"></label>
              <label class="complement-item-field">Custo<input type="number" min="0" step="0.01" data-complement-item-field="cost" data-cindex="${index}" data-iindex="${itemIndex}" value="${item.cost || 0}" placeholder="0,00"></label>
              <label class="complement-item-field">Descrição<input data-complement-item-field="description" data-cindex="${index}" data-iindex="${itemIndex}" value="${escapeHtml(item.description || "")}" placeholder="Opcional"></label>
              <label class="complement-item-field">Tags<input data-complement-item-field="tags" data-cindex="${index}" data-iindex="${itemIndex}" value="${escapeHtml((item.tags || []).join(", "))}" placeholder="Opcional"></label>
              <label class="check-line complement-item-active"><input type="checkbox" data-complement-item-field="active" data-cindex="${index}" data-iindex="${itemIndex}" ${item.active !== false ? "checked" : ""}> Ativo</label>
              <div class="complement-item-actions"><button class="danger" type="button" data-remove-complement-item="${index}:${itemIndex}">Excluir item</button></div>
            </div>
          `).join("") || `<p class="complement-empty">Nenhum item cadastrado nesta lista.</p>`}
        </div>
      </article>
    `;
  }).join("") || `<div class="editor-empty"><strong>Nenhuma lista de complemento cadastrada.</strong><span>Crie uma lista para começar.</span></div>`;
}

function menuProductsForEditor() {
  const term = String(menuFilters.search || "").toLowerCase().trim();
  return menu
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const text = `${item.name} ${item.desc} ${item.cat} ${item.internalCode} ${(item.tags || []).join(" ")}`.toLowerCase();
      const matchesTerm = !term || text.includes(term);
      const matchesGroup = !menuFilters.group || item.cat === menuFilters.group;
      const matchesStatus = menuFilters.status === "all"
        || (menuFilters.status === "active" && item.active !== false && !item.archived)
        || (menuFilters.status === "inactive" && item.active === false && !item.archived)
        || (menuFilters.status === "archived" && item.archived);
      return matchesTerm && matchesGroup && matchesStatus;
    })
    .sort((a, b) => {
      if (menuFilters.sort === "name") return a.item.name.localeCompare(b.item.name, "pt-BR");
      if (menuFilters.sort === "priceAsc") return Number(a.item.price) - Number(b.item.price);
      if (menuFilters.sort === "priceDesc") return Number(b.item.price) - Number(a.item.price);
      return Number(a.item.sortOrder ?? a.index) - Number(b.item.sortOrder ?? b.index);
    });
}

function productBadges(item) {
  return Object.entries({ promotion: "Promoção", bestSeller: "Mais vendido", new: "Novidade" })
    .filter(([key]) => item.badges?.[key])
    .map(([, label]) => `<span class="menu-chip">${label}</span>`).join("");
}

function renderMenuGroups() {
  const editor = byId("menuGroupEditor");
  if (!editor) return;
  editor.innerHTML = menuGroups.map((group, index) => `
    <div class="menu-group-row">
      <span class="menu-group-order">${index + 1}</span>
      <label>Nome do grupo<input data-group-field="name" data-gindex="${index}" value="${escapeHtml(group.name)}"></label>
      <label>Descrição<input data-group-field="description" data-gindex="${index}" value="${escapeHtml(group.description)}" placeholder="Opcional"></label>
      <label class="check-line"><input type="checkbox" data-group-field="active" data-gindex="${index}" ${group.active !== false ? "checked" : ""}> Publicado</label>
      <div class="row-actions compact-actions">
        <button class="ghost" type="button" data-reorder-group="${index}:-1" aria-label="Mover grupo para cima">↑</button>
        <button class="ghost" type="button" data-reorder-group="${index}:1" aria-label="Mover grupo para baixo">↓</button>
        <button class="danger" type="button" data-remove-group="${index}">Arquivar</button>
      </div>
    </div>
  `).join("") || `<p class="editor-empty">Nenhum grupo criado. Ao adicionar um item, o grupo será criado automaticamente.</p>`;
}

function renderMenuEditor() {
  const groupFilter = byId("menuGroupFilter");
  const groupNames = menuGroups.map(group => group.name);
  if (groupFilter) {
    groupFilter.innerHTML = `<option value="">Todos os grupos</option>${groupNames.map(name => `<option value="${escapeHtml(name)}" ${menuFilters.group === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}`;
    groupFilter.value = menuFilters.group;
  }
  const entries = menuProductsForEditor();
  byId("menuEditor").innerHTML = entries.map(({ item, index }) => {
    const editing = String(editingProductId) === String(item.id);
    const imageUrl = safeImageUrl(item.image);
    const linked = complementGroups.filter(group => (group.linkedProductIds || []).map(String).includes(String(item.id))).map(group => group.name);
    const channels = [item.channels?.retirada !== false ? "Retirada" : "", item.channels?.delivery ? "Delivery" : "", item.channels?.mesa ? "Mesa" : ""].filter(Boolean);
    const statusLabel = item.archived ? "Arquivado" : item.active === false ? "Pausado" : "Publicado";
    const groupOptions = menuGroups.map(group => `<option value="${escapeHtml(group.name)}" ${item.cat === group.name ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
    return `
      <article class="product-edit ${editing ? "editing" : ""} ${item.archived ? "is-archived" : ""}">
        <div class="product-edit-summary">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async">` : `<div class="product-placeholder" aria-hidden="true">TS</div>`}
          <div class="product-edit-copy">
            <div class="product-edit-title"><strong>${escapeHtml(item.name)}</strong><span>${money(item.price)}</span></div>
            <p>${escapeHtml(item.desc || "Sem descrição cadastrada.")}</p>
            <div class="menu-chips"><span class="menu-chip status-${item.archived ? "archived" : item.active === false ? "paused" : "active"}">${statusLabel}</span><span class="menu-chip">${escapeHtml(item.cat)}</span>${productBadges(item)}${item.highlight ? `<span class="menu-chip highlight">Destaque</span>` : ""}</div>
            <small>${escapeHtml(channels.join(" · ") || "Nenhum canal publicado")} · ${(item.activeDays || DEFAULT_ACTIVE_DAYS).length}/7 dias${item.stockControlled ? ` · estoque ${item.stockQty ?? 0}` : ""}</small>
          </div>
          <div class="product-edit-actions">
            <button class="ghost" type="button" data-edit-product="${index}">${editing ? "Fechar edição" : "Editar"}</button>
            ${item.archived ? "" : `<button class="${item.active === false ? "success" : "warning"}" type="button" data-toggle-product="${index}" aria-label="${item.active === false ? "Reativar" : "Pausar"} ${escapeHtml(item.name)}">${item.active === false ? "Ativar" : "Pausar"}</button>`}
            <button class="ghost" type="button" data-duplicate-product="${index}">Duplicar</button>
            <button class="ghost" type="button" data-product-complements="${index}">Adicionais</button>
            ${item.archived ? `<button class="success" type="button" data-restore-product="${index}">Restaurar</button>` : `<button class="danger" type="button" data-archive-product="${index}">Arquivar</button>`}
          </div>
        </div>
        ${editing ? `
          <div class="product-edit-form">
            <div class="product-form-grid">
              <label>Nome<input data-menu-field="name" data-index="${index}" value="${escapeHtml(item.name)}" autocomplete="off"></label>
              <label>Grupo<select data-menu-field="cat" data-index="${index}">${groupOptions}</select></label>
              <label>Preço<input data-menu-field="price" data-index="${index}" type="number" min="0" step="0.01" value="${item.price}"></label>
              <label>Preço a partir de<input data-menu-field="fromPrice" data-index="${index}" type="number" min="0" step="0.01" value="${item.fromPrice}"></label>
              <label>Preço riscado<input data-menu-field="strikePrice" data-index="${index}" type="number" min="0" step="0.01" value="${item.strikePrice}"></label>
              <label>Código interno<input data-menu-field="internalCode" data-index="${index}" value="${escapeHtml(item.internalCode)}" placeholder="Opcional"></label>
              <label>Custo<input data-menu-field="cost" data-index="${index}" type="number" min="0" step="0.01" value="${item.cost}"></label>
              <label class="wide-field">Descrição<textarea data-menu-field="desc" data-index="${index}" rows="2">${escapeHtml(item.desc)}</textarea></label>
              <label class="wide-field">Imagem principal<input data-menu-field="image" data-index="${index}" value="${escapeHtml(item.image)}" placeholder="URL ou caminho local"></label>
              <label class="wide-field">Imagens secundárias <small>(uma por linha, até 4)</small><textarea data-menu-field="secondaryImages" data-index="${index}" rows="2">${escapeHtml((item.secondaryImages || []).join("\n"))}</textarea></label>
            </div>
            <div class="product-editor-section">
              <strong>Publicação</strong>
              <div class="editor-checks">
                <label class="check-line"><input type="checkbox" data-menu-meta="active" data-index="${index}" ${item.active !== false ? "checked" : ""}> Publicado</label>
                <label class="check-line"><input type="checkbox" data-menu-meta="highlight" data-index="${index}" ${item.highlight ? "checked" : ""}> Destaque</label>
                <label class="check-line"><input type="checkbox" data-menu-meta="channels:retirada" data-index="${index}" ${item.channels?.retirada !== false ? "checked" : ""}> Retirada</label>
                <label class="check-line"><input type="checkbox" data-menu-meta="channels:delivery" data-index="${index}" ${item.channels?.delivery ? "checked" : ""}> Delivery</label>
                <label class="check-line"><input type="checkbox" data-menu-meta="channels:mesa" data-index="${index}" ${item.channels?.mesa ? "checked" : ""}> Mesa</label>
              </div>
            </div>
            <div class="product-editor-section">
              <strong>Dias ativos</strong>
              <div class="editor-checks days-checks">${MENU_DAY_LABELS.map((label, day) => `<label class="check-line"><input type="checkbox" data-menu-meta="activeDays:${day}" data-index="${index}" ${(item.activeDays || DEFAULT_ACTIVE_DAYS).includes(day) ? "checked" : ""}> ${label}</label>`).join("")}</div>
            </div>
            <div class="product-editor-section">
              <strong>Etiquetas</strong>
              <div class="editor-checks">
                <label class="check-line"><input type="checkbox" data-menu-meta="badges:promotion" data-index="${index}" ${item.badges?.promotion ? "checked" : ""}> Promoção</label>
                <label class="check-line"><input type="checkbox" data-menu-meta="badges:bestSeller" data-index="${index}" ${item.badges?.bestSeller ? "checked" : ""}> Mais vendido</label>
                <label class="check-line"><input type="checkbox" data-menu-meta="badges:new" data-index="${index}" ${item.badges?.new ? "checked" : ""}> Novidade</label>
              </div>
              <label>Tags internas <input data-menu-field="tags" data-index="${index}" value="${escapeHtml((item.tags || []).join(", "))}" placeholder="ex.: salmão, combo, promoção"></label>
            </div>
            <div class="product-editor-section stock-section">
              <strong>Estoque rápido</strong>
              <label class="check-line"><input type="checkbox" data-menu-meta="stockControlled" data-index="${index}" ${item.stockControlled ? "checked" : ""}> Controlar estoque</label>
              <label>Quantidade<input data-menu-field="stockQty" data-index="${index}" type="number" min="0" step="1" value="${item.stockQty ?? ""}" placeholder="Sem limite"></label>
            </div>
          </div>
        ` : ""}
        <p class="product-links">Adicionais: ${escapeHtml(linked.join(", ") || "nenhum vinculado")}</p>
      </article>
    `;
  }).join("") || `<div class="editor-empty"><strong>Nenhum item encontrado.</strong><span>Limpe os filtros ou crie um novo item para começar.</span></div>`;
  renderMenuGroups();
}

function pdvTotal() {
  return pdvPricing().total;
}

function pdvSubtotal() {
  return pdvCart.reduce((sum, line) => sum + (Number(line.price || 0) + Number(line.unitExtra || 0)) * Number(line.qty || 0), 0);
}

function pdvAdjustmentAmount(type, value, base, clampFixed = true) {
  const amount = Math.max(0, Number(value || 0));
  if (type === "percent") return Math.round(base * Math.min(amount, 100) / 100 * 100) / 100;
  if (type === "fixed") return clampFixed ? Math.min(amount, base) : amount;
  return 0;
}

function promoField(promo, camel, snake, fallback = "") {
  return promo?.[camel] ?? promo?.[snake] ?? fallback;
}

function isPromoAvailable(promo) {
  if (!promo || promo.active === false) return false;
  const today = todayKey();
  const startsAt = dateOnlyValue(promoField(promo, "startsAt", "starts_at"));
  const endsAt = dateOnlyValue(promoField(promo, "endsAt", "ends_at"));
  return (!startsAt || startsAt <= today) && (!endsAt || endsAt >= today) && promoField(promo, "discountType", "discount_type", "none") !== "none" && Number(promoField(promo, "discountValue", "discount_value", 0)) > 0;
}

function pdvPricing() {
  const subtotal = Math.round(pdvSubtotal() * 100) / 100;
  const discountType = pdvAppliedAdjustments.discountType || "none";
  const surchargeType = pdvAppliedAdjustments.surchargeType || "none";
  const discountInput = Math.max(0, Number(pdvAppliedAdjustments.discountValue || 0));
  const surchargeInput = Math.max(0, Number(pdvAppliedAdjustments.surchargeValue || 0));
  const discountAmount = pdvAdjustmentAmount(discountType, discountInput, subtotal);
  const couponType = pdvAppliedCoupon ? promoField(pdvAppliedCoupon, "discountType", "discount_type", "none") : "none";
  const couponValue = pdvAppliedCoupon ? Number(promoField(pdvAppliedCoupon, "discountValue", "discount_value", 0)) : 0;
  const couponDiscountAmount = isPromoAvailable(pdvAppliedCoupon) ? pdvAdjustmentAmount(couponType, couponValue, Math.max(0, subtotal - discountAmount)) : 0;
  const afterDiscounts = Math.max(0, subtotal - discountAmount - couponDiscountAmount);
  const surchargeAmount = pdvAdjustmentAmount(surchargeType, surchargeInput, afterDiscounts, false);
  const total = Math.round((afterDiscounts + surchargeAmount) * 100) / 100;
  const isCash = byId("pdvPayment")?.value === "Dinheiro";
  const amountReceived = isCash ? Math.max(0, Number(byId("pdvAmountReceived")?.value || 0)) : null;
  const change = isCash && amountReceived >= total ? Math.round((amountReceived - total) * 100) / 100 : 0;
  const missing = isCash && amountReceived < total ? Math.round((total - amountReceived) * 100) / 100 : 0;
  const couponCode = pdvAppliedCoupon ? String(promoField(pdvAppliedCoupon, "code", "code", "")).trim().toUpperCase() : "";
  return { subtotal, discountType, discountInput, discountAmount, couponType, couponValue, couponCode, couponDiscountAmount, surchargeType, surchargeInput, surchargeAmount, total, isCash, amountReceived, change, missing };
}

function pdvInputAdjustments() {
  return {
    discountType: byId("pdvDiscountType")?.value || "none",
    discountValue: Math.max(0, Number(byId("pdvDiscountValue")?.value || 0)),
    surchargeType: byId("pdvSurchargeType")?.value || "none",
    surchargeValue: Math.max(0, Number(byId("pdvSurchargeValue")?.value || 0))
  };
}

function pdvAdjustmentsEqual(left, right) {
  return left.discountType === right.discountType && Number(left.discountValue || 0) === Number(right.discountValue || 0) && left.surchargeType === right.surchargeType && Number(left.surchargeValue || 0) === Number(right.surchargeValue || 0);
}

function markPdvAdjustmentsPending() {
  const draft = pdvInputAdjustments();
  pdvAdjustmentMessage = pdvAdjustmentsEqual(draft, pdvAppliedAdjustments)
    ? "Digite um ajuste e confirme."
    : "Ajuste pendente — clique em Aplicar ajustes.";
  renderPdvPricing();
}

function applyPdvAdjustments() {
  const draft = pdvInputAdjustments();
  if (draft.discountType === "percent" && draft.discountValue > 100) {
    notify("O desconto percentual não pode passar de 100%.");
    return;
  }
  pdvAppliedAdjustments = draft;
  const hasAdjustment = (draft.discountType !== "none" && draft.discountValue > 0) || (draft.surchargeType !== "none" && draft.surchargeValue > 0);
  pdvAdjustmentMessage = hasAdjustment ? "Ajustes aplicados ao pedido." : "Ajustes removidos do pedido.";
  renderPdv();
}

function renderPdvPricing() {
  const pricing = pdvPricing();
  const cartTotal = byId("pdvCart")?.querySelector(".pdv-total strong");
  if (cartTotal) cartTotal.textContent = money(pricing.total);
  const cartSummary = byId("pdvCartSummary");
  if (cartSummary) {
    cartSummary.innerHTML = `
      <p><span>Subtotal</span><strong>${money(pricing.subtotal)}</strong></p>
      ${pricing.discountAmount ? `<p class="discount"><span>Desconto</span><strong>- ${money(pricing.discountAmount)}</strong></p>` : ""}
      ${pricing.couponDiscountAmount ? `<p class="discount"><span>Cupom ${escapeHtml(pricing.couponCode)}</span><strong>- ${money(pricing.couponDiscountAmount)}</strong></p>` : ""}
      ${pricing.surchargeAmount ? `<p class="surcharge"><span>Acréscimo</span><strong>+ ${money(pricing.surchargeAmount)}</strong></p>` : ""}
      <p class="total"><span>Total</span><strong>${money(pricing.total)}</strong></p>
    `;
  }
  const receivedWrap = byId("pdvReceivedWrap");
  if (receivedWrap) receivedWrap.hidden = !pricing.isCash;
  if (byId("pdvAmountReceived")) byId("pdvAmountReceived").required = pricing.isCash;
  const summary = byId("pdvPricingSummary");
  if (summary) {
    summary.innerHTML = `
      <p><span>Subtotal</span><strong>${money(pricing.subtotal)}</strong></p>
      ${pricing.discountAmount ? `<p class="negative"><span>Desconto</span><strong>- ${money(pricing.discountAmount)}</strong></p>` : ""}
      ${pricing.couponDiscountAmount ? `<p class="negative"><span>Cupom ${escapeHtml(String(promoField(pdvAppliedCoupon, "code", "code", "")).toUpperCase())}</span><strong>- ${money(pricing.couponDiscountAmount)}</strong></p>` : ""}
      ${pricing.surchargeAmount ? `<p class="surcharge"><span>Acréscimo</span><strong>+ ${money(pricing.surchargeAmount)}</strong></p>` : ""}
      <p class="pricing-total"><span>Total</span><strong>${money(pricing.total)}</strong></p>
    `;
  }
  const changeLabel = byId("pdvChangeLabel");
  const changeValue = byId("pdvChange");
  if (changeLabel) changeLabel.textContent = pricing.missing ? "Falta pagar" : "Troco";
  if (changeValue) {
    changeValue.textContent = money(pricing.missing || pricing.change);
    changeValue.className = pricing.missing ? "negative" : "positive";
  }
  const adjustmentMessage = byId("pdvAdjustmentMessage");
  if (adjustmentMessage) {
    const isPending = !pdvAdjustmentsEqual(pdvInputAdjustments(), pdvAppliedAdjustments);
    adjustmentMessage.textContent = pdvAdjustmentMessage;
    adjustmentMessage.className = isPending ? "is-pending" : pdvAdjustmentMessage.includes("aplicados") ? "is-applied" : "";
  }
  const couponMessage = byId("pdvCouponMessage");
  if (couponMessage) {
    couponMessage.textContent = pdvCouponMessage;
    couponMessage.className = pdvAppliedCoupon ? "coupon-success" : "coupon-error";
  }
}

function applyPdvCoupon() {
  const code = String(byId("pdvCouponCode")?.value || "").trim().toUpperCase();
  pdvAppliedCoupon = null;
  if (!code) {
    pdvCouponMessage = "";
    renderPdvPricing();
    return;
  }
  const promo = promos.find(item => String(promoField(item, "code", "code", "")).trim().toUpperCase() === code);
  if (!isPromoAvailable(promo)) {
    pdvCouponMessage = "Cupom inválido, inativo ou expirado.";
    renderPdvPricing();
    return;
  }
  pdvAppliedCoupon = promo;
  pdvCouponMessage = `Cupom ${code} aplicado.`;
  byId("pdvCouponCode").value = code;
  renderPdvPricing();
}

const PDV_GLOBAL_COMPLEMENT_TAG = "pdv-global";

function pdvAllowsGlobalComplements(product) {
  const category = String(product?.cat || "").trim().toLocaleLowerCase("pt-BR");
  return Boolean(product) && category !== "bebidas" && category !== "combos";
}

function pdvProductComplements(productId) {
  const product = menu.find(item => String(item.id) === String(productId));
  return complementGroups.filter(group => {
    const linkedToProduct = (group.linkedProductIds || []).map(String).includes(String(productId));
    const globalForPdv = pdvAllowsGlobalComplements(product) &&
      (group.tags || []).map(String).includes(PDV_GLOBAL_COMPLEMENT_TAG);
    return group.active !== false &&
      (linkedToProduct || globalForPdv) &&
      (group.items || []).some(item => item.active !== false);
  });
}

function pdvSelectedGroupTotal(groupId) {
  return Object.entries(pdvPendingOptions)
    .filter(([key]) => key.startsWith(`${groupId}:`))
    .reduce((sum, [, qty]) => sum + Number(qty || 0), 0);
}

function changePdvOption(key, amount) {
  const [groupId] = key.split(":");
  const group = complementGroups.find(item => String(item.id) === String(groupId));
  const current = Number(pdvPendingOptions[key] || 0);
  const max = Number(group?.maxQty || 100);
  if (amount > 0 && pdvSelectedGroupTotal(groupId) >= max) return;
  pdvPendingOptions[key] = Math.max(0, current + amount);
  if (!pdvPendingOptions[key]) delete pdvPendingOptions[key];
  renderPdvComplements();
}

function renderPdvCustomerSuggestions() {
  const customers = pdvCustomerOptions();
  byId("pdvCustomerSuggestions").innerHTML = customers.map(customer => `<option value="${escapeHtml(customer.name)}" label="${escapeHtml(customer.phone || "Celular não cadastrado")}"></option>`).join("");
  byId("pdvPhoneSuggestions").innerHTML = customers.filter(customer => customer.phone).map(customer => `<option value="${escapeHtml(customer.phone)}" label="${escapeHtml(customer.name || "Cliente")}"></option>`).join("");
}

function renderPdvComplements() {
  const productId = byId("pdvProduct")?.value || pdvSelectedProductId;
  const groups = pdvProductComplements(productId);
  const wrap = byId("pdvComplements");
  if (!wrap) return;
  const product = menu.find(item => String(item.id) === String(productId));
  wrap.hidden = !groups.length;
  wrap.innerHTML = groups.length ? `
    <div class="pdv-complements-head">
      <strong>Adicionais deste item</strong>
      <small>Escolha antes de adicionar ao pedido</small>
    </div>
    ${groups.map(group => {
      const max = Number(group.maxQty || 100);
      const total = pdvSelectedGroupTotal(group.id);
      const activeItems = (group.items || []).filter(item => item.active !== false);
      return `
        <section class="pdv-option-group">
          <div class="pdv-option-group-head"><strong>${escapeHtml(group.name)}</strong><span>${group.minQty ? "Obrigatório" : "Opcional"} · ${total}/${max}</span></div>
          <div class="pdv-option-list">
            ${activeItems.map(item => {
              const key = `${group.id}:${item.id}`;
              const quantity = Number(pdvPendingOptions[key] || 0);
              return `<div class="pdv-option-row"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price || 0)} cada</small></div><div class="pdv-option-stepper"><button type="button" class="ghost" data-pdv-option-minus="${key}" aria-label="Remover ${escapeHtml(item.name)}">−</button><strong>${quantity}</strong><button type="button" class="ghost" data-pdv-option-plus="${key}" aria-label="Adicionar ${escapeHtml(item.name)}">+</button></div></div>`;
            }).join("")}
          </div>
        </section>
      `;
    }).join("")}
    <div class="pdv-complements-actions">
      <span>Adicionais opcionais podem ficar zerados.</span>
      <button class="primary" data-pdv-confirm-item type="button">Adicionar ${escapeHtml(product?.name || "item")}</button>
    </div>
  ` : "";
}

function renderPdv() {
  const productSelect = byId("pdvProduct");
  const selectedProductId = pdvSelectedProductId || productSelect.value || menu.find(item => item.active !== false)?.id || "";
  const activeProducts = menu.filter(item => item.active !== false);
  const search = String(byId("pdvProductSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = activeProducts.filter(item => !search || [item.name, item.group, item.description].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(search));
  productSelect.innerHTML = activeProducts.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${pdvProductComplements(item.id).length ? " · adicionais" : ""} - ${money(item.price)}</option>`).join("");
  productSelect.value = String(activeProducts.some(item => String(item.id) === String(selectedProductId)) ? selectedProductId : activeProducts[0]?.id || "");
  pdvSelectedProductId = productSelect.value;
  byId("pdvProductList").innerHTML = visibleProducts.length ? visibleProducts.map(item => {
    const hasComplements = pdvProductComplements(item.id).length > 0;
    const selected = String(item.id) === String(pdvSelectedProductId);
    return `
      <article class="pdv-product-row${selected ? " is-selected" : ""}">
        <button class="pdv-product-info" data-pdv-select-product="${escapeHtml(item.id)}" type="button" aria-pressed="${selected}">
          <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.group || "Cardápio")}${hasComplements ? " · adicionais" : ""}</small></span>
          <b>${money(item.price)}</b>
        </button>
        <input class="pdv-product-qty" data-pdv-quick-qty="${escapeHtml(item.id)}" type="number" min="1" value="1" inputmode="numeric" aria-label="Quantidade de ${escapeHtml(item.name)}">
        <button class="primary pdv-product-add" data-pdv-quick-add="${escapeHtml(item.id)}" type="button">Adicionar</button>
      </article>
    `;
  }).join("") : `<p class="pdv-product-empty">Nenhum item encontrado. Tente outro nome.</p>`;
  renderPdvCustomerSuggestions();
  byId("pdvCart").innerHTML = `
    <div class="pdv-cart-head"><h2>Pedido atual</h2><button class="ghost" data-clear-pdv="true" type="button" ${pdvCart.length ? "" : "disabled"}>Limpar</button></div>
    ${pdvCart.map((line, index) => `<div class="pdv-cart-row"><div><strong>${line.qty}x ${escapeHtml(line.name)}</strong>${(line.options || []).length ? `<small>${line.options.map(option => `${option.qty}x ${escapeHtml(option.name)}`).join(" · ")}</small>` : ""}</div><div class="pdv-cart-actions"><strong>${money(line.qty * (Number(line.price || 0) + Number(line.unitExtra || 0)))}</strong><div class="pdv-cart-stepper"><button class="ghost" data-pdv-qty="${index}:-1" type="button" aria-label="Diminuir quantidade de ${escapeHtml(line.name)}">−</button><span>${line.qty}</span><button class="ghost" data-pdv-qty="${index}:1" type="button" aria-label="Aumentar quantidade de ${escapeHtml(line.name)}">+</button></div><button class="danger" data-remove-pdv="${index}" type="button">Excluir</button></div></div>`).join("") || `<p>Nenhum item adicionado.</p>`}
    <div id="pdvCartSummary" class="pdv-cart-summary"></div>
  `;
  renderPdvComplements();
  renderPdvPricing();
}

const PDV_FLOW_COLUMNS = [
  { status: "Recebido", title: "Recebidos", hint: "Aceite o pedido", tone: "received" },
  { status: "Preparando", title: "Aceitos", hint: "Em produção", tone: "preparing" },
  { status: "Pronto", title: "Prontos", hint: "Aguardando retirada", tone: "ready" }
];

function orderAge(order) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes === 1) return "há 1 min";
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)}h`;
}

function flowOrderCard(order) {
  const actions = nextStatuses(order);
  return `
    <article class="flow-order-card">
      <div class="flow-order-top">
        <strong>#${escapeHtml(order.id)}</strong>
        <span>${escapeHtml(orderAge(order))}</span>
      </div>
      <div class="flow-order-customer">
        <strong>${escapeHtml(order.customerName || "Cliente")}</strong>
        <span>${escapeHtml(order.source === "pdv" ? "Balcão / PDV" : "Cardápio online")}</span>
      </div>
      <ul>${order.items.slice(0, 4).map(item => `<li><strong>${item.qty}x</strong> ${escapeHtml(item.name)}</li>`).join("")}</ul>
      ${order.items.length > 4 ? `<small class="flow-more-items">+ ${order.items.length - 4} item(ns)</small>` : ""}
      ${order.notes ? `<p class="flow-note">${escapeHtml(order.notes)}</p>` : ""}
      <div class="flow-order-bottom">
        <strong>${money(order.total)}</strong>
        <span>${escapeHtml(order.payment || "Pagamento não informado")} · ${paymentStatusLabel(order)}${order.amountReceived != null && String(order.payment).toLowerCase() === "dinheiro" ? ` · Troco ${money(order.changeAmount || 0)}` : ""}</span>
      </div>
      <div class="flow-order-actions">
        ${actions.map(action => `<button class="action-btn ${action.kind}${action.disabled ? " requires-payment" : ""}" data-quick-status="${order.id}:${action.value}"${action.disabled ? ` aria-disabled="true" title="Marque como pago para dar baixa"` : ""}>${action.label}</button>`).join("")}
        ${order.status === "Pronto" ? `<button class="action-btn danger" data-archive-finance-order="${escapeHtml(order.id)}">Excluir</button>` : ""}
        <button class="action-btn ghost" data-print-order="${order.id}" data-print-dialog="true" data-print-mode="${order.status === "Pronto" ? "customer" : "kitchen"}">${order.status === "Pronto" ? "Comprovante" : "Produção"}</button>
      </div>
    </article>
  `;
}

function renderPdvFlow() {
  const flowOrders = orders.filter(order => !["Cancelado"].includes(order.status) && !order.archivedAt && !order.archived_at);
  byId("pdvFlow").innerHTML = PDV_FLOW_COLUMNS.map(column => {
    const columnOrders = flowOrders
      .filter(order => order.status === column.status)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return `
      <section class="pdv-flow-column ${column.tone}">
        <header>
          <div><h3>${column.title}</h3><small>${column.hint}</small></div>
          <strong>${columnOrders.length}</strong>
        </header>
        <div class="pdv-flow-list">${columnOrders.map(flowOrderCard).join("") || `<p class="empty-column">Nenhum pedido nesta etapa.</p>`}</div>
      </section>
    `;
  }).join("");
}

function renderKds() {
  const active = orders.filter(order => ["Recebido", "Preparando"].includes(order.status));
  byId("kdsGrid").innerHTML = active.map(order => `
    <article class="kds-card ${order.status === "Preparando" ? "preparing" : ""}">
      <h2>#${escapeHtml(order.id)} · ${escapeHtml(order.customerName || "Cliente")}</h2>
      <small>${escapeHtml(formatDate(order.createdAt))} · ${escapeHtml(statusLabel(order.status))}</small>
      <ul>${order.items.map(item => `<li><strong>${item.qty}x</strong> ${escapeHtml(item.name)}${(item.options || []).length ? `<small>${item.options.map(option => ` + ${option.qty}x ${escapeHtml(option.name)}`).join("<br>")}</small>` : ""}</li>`).join("")}</ul>
      ${order.notes ? `<p><strong>Observação:</strong> ${escapeHtml(order.notes)}</p>` : ""}
      <div class="actions"><button class="primary" data-quick-status="${order.id}:${order.status === "Recebido" ? "Preparando" : "Pronto"}">${order.status === "Recebido" ? "Aceitar e iniciar" : "Marcar pronto"}</button><button class="ghost" data-print-order="${order.id}" data-print-dialog="true" data-print-mode="kitchen">Imprimir produção</button></div>
    </article>
  `).join("") || `<p>Nenhum pedido aguardando preparo.</p>`;
}

function reportOrders() {
  const start = byId("reportStart")?.value || "";
  const end = byId("reportEnd")?.value || "";
  const customerTerm = (byId("financeCustomerFilter")?.value || "").toLowerCase().trim();
  const customerDigits = customerTerm.replace(/\D/g, "");
  const status = byId("financeStatusFilter")?.value || "all";
  const payment = (byId("financePaymentFilter")?.value || "all").toLowerCase();
  const source = byId("financeSourceFilter")?.value || "all";
  const onlyDiscount = Boolean(byId("financeOnlyDiscount")?.checked);
  const onlySurcharge = Boolean(byId("financeOnlySurcharge")?.checked);
  const onlyPaid = Boolean(byId("financeOnlyPaid")?.checked);
  const onlyScheduled = Boolean(byId("financeOnlyScheduled")?.checked);
  return orders.filter(order => {
    if (order.archivedAt || order.archived_at) return false;
    const date = localDateKey(order.createdAt);
    const customerText = `${order.customerName || ""} ${order.customerPhone || ""}`.toLowerCase();
    const phoneDigits = String(order.customerPhone || "").replace(/\D/g, "");
    const normalizedPayment = String(order.payment || "").toLowerCase();
    const normalizedSource = String(order.source || order.orderSource || "public").toLowerCase();
    const orderType = String(order.orderType || order.type || "").toLowerCase();
    const hasDiscount = Number(order.discountAmount || 0) + Number(order.couponDiscountAmount || 0) > 0;
    const hasSurcharge = Number(order.surchargeAmount || 0) > 0;
    const isPaid = Boolean(order.paid || order.isPaid || order.paidAt || order.paymentStatus === "paid" || order.statusPayment === "paid");
    const isScheduled = Boolean(order.scheduledAt || order.scheduledFor || order.scheduled || order.agendado || orderType.includes("agend"));
    const statusMatches = status === "all"
      || (status === "valid" && order.status !== "Cancelado")
      || (status === "finished" && order.status === "Finalizado")
      || (status === "open" && !["Finalizado", "Cancelado"].includes(order.status))
      || (status === "cancelled" && order.status === "Cancelado");
    const paymentMatches = payment === "all" || normalizedPayment.includes(payment);
    const sourceMatches = source === "all"
      || (source === "pdv" && normalizedSource === "pdv")
      || (source === "public" && normalizedSource === "public")
      || (source === "pickup" && ["public", "pdv", "retirada", "pickup"].includes(normalizedSource) && !["delivery", "mesa"].includes(orderType));
    return (!customerTerm || customerText.includes(customerTerm) || (customerDigits.length >= 3 && phoneDigits.includes(customerDigits)))
      && statusMatches && paymentMatches && sourceMatches
      && (!onlyDiscount || hasDiscount)
      && (!onlySurcharge || hasSurcharge)
      && (!onlyPaid || isPaid)
      && (!onlyScheduled || isScheduled)
      && (!start || date >= start) && (!end || date <= end);
  });
}

function financeNumbers(selectedOrders) {
  const result = {
    gross: 0,
    net: 0,
    discounts: 0,
    surcharges: 0,
    orders: selectedOrders.length,
    byPayment: {},
    byDay: {},
    byStatus: {},
    products: {},
    complements: {},
    historicalRevenue: 0,
    pendingOrders: 0,
    pendingTotal: 0,
    paidOrders: 0
  };
  selectedOrders.forEach(order => {
    const discount = Number(order.discountAmount || 0) + Number(order.couponDiscountAmount || 0);
    const surcharge = Number(order.surchargeAmount || 0);
    const total = Number(order.total || 0);
    const storedSubtotal = Number(order.subtotal || 0);
    const subtotal = storedSubtotal > 0 ? storedSubtotal : Math.max(0, total + discount - surcharge);
    const day = localDateKey(order.createdAt);
    const paid = isOrderPaid(order);
    result.byStatus[order.status || "Sem status"] = (result.byStatus[order.status || "Sem status"] || 0) + 1;
    if (!paid) {
      result.pendingOrders += 1;
      result.pendingTotal += total;
      return;
    }
    result.paidOrders += 1;
    const payment = order.payment || "Não informado";
    result.gross += subtotal;
    result.net += total;
    result.discounts += discount;
    result.surcharges += surcharge;
    result.byPayment[payment] = (result.byPayment[payment] || 0) + total;
    result.byDay[day] ||= { orders: 0, total: 0 };
    result.byDay[day].orders += 1;
    result.byDay[day].total += total;
    (order.items || []).forEach(item => {
      const key = String(item.id || item.productId || item.name || "item");
      const product = menu.find(candidate => String(candidate.id) === key || candidate.name === item.name);
      const quantity = Number(item.qty || 0);
      const revenue = (Number(item.price || 0) + Number(item.unitExtra || 0)) * quantity;
      const cost = Number(product?.cost || item.cost || 0) * quantity;
      result.products[key] ||= { name: item.name || "Item", qty: 0, revenue: 0, cost: 0 };
      result.products[key].qty += quantity;
      result.products[key].revenue += revenue;
      result.products[key].cost += cost;
      (item.options || []).forEach(option => {
        const optionKey = String(option.id || option.itemId || option.name || "adicional");
        const optionQty = Number(option.qty || 0) * quantity;
        const optionRevenue = Number(option.price || 0) * optionQty;
        result.complements[optionKey] ||= { name: option.name || "Adicional", qty: 0, revenue: 0 };
        result.complements[optionKey].qty += optionQty;
        result.complements[optionKey].revenue += optionRevenue;
      });
    });
  });
  const status = byId("financeStatusFilter")?.value || "valid";
  const payment = (byId("financePaymentFilter")?.value || "all").toLowerCase();
  const source = byId("financeSourceFilter")?.value || "all";
  const canUseHistorical = status === "valid" && payment === "all" && source === "all"
    && !byId("financeOnlyDiscount")?.checked
    && !byId("financeOnlySurcharge")?.checked
    && !byId("financeOnlyPaid")?.checked
    && !byId("financeOnlyScheduled")?.checked;
  if (canUseHistorical) {
    const start = byId("reportStart")?.value || "";
    const end = byId("reportEnd")?.value || "";
    dailyRevenues.filter(item => item.source === "gestao_tokyo" && (!start || item.revenueDate >= start) && (!end || item.revenueDate <= end)).forEach(item => {
      const day = item.revenueDate;
      if (result.byDay[day]?.orders) return;
      const revenue = Number(item.revenue || 0);
      const ordersCount = Number(item.orders || 0);
      result.byDay[day] = { orders: ordersCount, total: revenue, historical: true };
      result.gross += revenue;
      result.net += revenue;
      result.orders += ordersCount;
      result.historicalRevenue += revenue;
    });
  }
  return result;
}

function reportExpenses() {
  const start = byId("reportStart")?.value || "";
  const end = byId("reportEnd")?.value || "";
  return expenses.filter(item => (!start || item.expenseDate >= start) && (!end || item.expenseDate <= end));
}

function financePeriodLabel() {
  const start = byId("reportStart")?.value || "";
  const end = byId("reportEnd")?.value || "";
  if (!start && !end) return "Todo o período";
  const format = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "início";
  if (start && end && start === end) return `Dia ${format(start)}`;
  return `${format(start)} até ${format(end)}`;
}

function expenseCategories() {
  const preferred = ["Insumos", "Operação", "Bebidas", "Embalagens", "Marketing", "Outros"];
  const existing = expenses.map(item => String(item.category || "Outros").trim()).filter(Boolean);
  return [...new Set([...preferred, ...existing])].sort((a, b) => {
    const aIndex = preferred.indexOf(a);
    const bIndex = preferred.indexOf(b);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return a.localeCompare(b, "pt-BR");
  });
}

let expenseCategoryFilter = "";

function captureExpenseFormDraft() {
  if (!byId("expenseForm")) return null;
  return Object.fromEntries([
    "expenseId",
    "expenseDate",
    "expenseDescription",
    "expenseCategory",
    "expenseSupplier",
    "expenseAmount",
    "expenseNotes"
  ].map(id => [id, byId(id)?.value || ""]));
}

function restoreExpenseFormDraft(draft) {
  if (!draft) return;
  Object.entries(draft).forEach(([id, value]) => {
    const field = byId(id);
    if (field) field.value = value;
  });
}

function parseExpenseAmount(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function financeExpenseForm() {
  const entry = expenses.find(item => String(item.id) === String(expenseEditingId));
  const date = entry?.expenseDate || byId("reportEnd")?.value || todayKey();
  const categories = expenseCategories();
  return `
    <form id="expenseForm" class="finance-expense-form" novalidate>
      <input type="hidden" id="expenseId" value="${escapeHtml(entry?.id || "")}">
      <label>Data<input id="expenseDate" type="date" value="${escapeHtml(date)}" required></label>
      <label class="expense-wide-field">Compra ou despesa<input id="expenseDescription" value="${escapeHtml(entry?.description || "")}" placeholder="Ex.: salmão, embalagens, gás" required></label>
      <label>Categoria<select id="expenseCategory">${categories.map(category => `<option value="${escapeHtml(category)}" ${category === (entry?.category || "Insumos") ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>
      <label>Fornecedor<input id="expenseSupplier" value="${escapeHtml(entry?.supplier || "")}" placeholder="Opcional"></label>
      <label>Valor<input id="expenseAmount" type="text" inputmode="decimal" autocomplete="off" value="${entry?.amount || ""}" placeholder="0,00" required></label>
      <label class="expense-wide-field">Observação<input id="expenseNotes" value="${escapeHtml(entry?.notes || "")}" placeholder="Opcional"></label>
      <div class="finance-entry-actions"><button class="primary" type="submit">${entry ? "Salvar compra" : "Adicionar compra"}</button>${entry ? `<button class="ghost" type="button" data-expense-action="cancel-edit">Cancelar</button>` : ""}</div>
    </form>`;
}

function financeExpensesView() {
  const categories = expenseCategories();
  const rows = reportExpenses().filter(item => !expenseCategoryFilter || item.category === expenseCategoryFilter).slice().sort((a, b) => String(b.expenseDate).localeCompare(String(a.expenseDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const sourceLabel = source => source === "gestao_tokyo" ? "Gestão Tóquio" : "Lançamento manual";
  const categorySummary = categories.map(category => ({ category, total: rows.filter(item => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0) })).filter(item => item.total > 0);
  const body = rows.map(entry => `<tr><td>${escapeHtml(formatDateOnly(entry.expenseDate))}</td><td><strong>${escapeHtml(entry.description)}</strong><small>${escapeHtml(entry.supplier || entry.notes || "Sem observação")}</small></td><td>${escapeHtml(entry.category || "Outros")}</td><td>${money(entry.amount)}</td><td><span class="finance-pill ${entry.source === "gestao_tokyo" ? "historical" : "paid"}">${sourceLabel(entry.source)}</span></td><td class="table-actions"><button class="ghost" data-expense-action="edit" data-expense-id="${escapeHtml(entry.id)}">Editar</button><button class="danger" data-expense-action="delete" data-expense-id="${escapeHtml(entry.id)}">Excluir</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty-cell">Nenhuma compra ou despesa no período.</td></tr>`;
  return `
    <div class="finance-account-head">${financeMetric("Compras no período", money(total), "negative")}${financeMetric("Lançamentos", rows.length)}${financeMetric("Histórico importado", money(rows.filter(item => item.source === "gestao_tokyo").reduce((sum, item) => sum + Number(item.amount || 0), 0)), "primary")}</div>
    <div class="finance-section-head"><div><h2>Compras e despesas</h2><p>Registre o que foi gasto e acompanhe o impacto no lucro operacional.</p></div></div>
    <div class="expense-category-filter" aria-label="Filtrar despesas por categoria"><span>Categorias</span><button type="button" class="${!expenseCategoryFilter ? "active" : ""}" data-expense-category="">Todas</button>${categories.map(category => `<button type="button" class="${expenseCategoryFilter === category ? "active" : ""}" data-expense-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div>
    <div class="expense-category-summary">${categorySummary.map(item => `<div><span>${escapeHtml(item.category)}</span><strong>${money(item.total)}</strong></div>`).join("") || `<span>Nenhum gasto categorizado neste período.</span>`}</div>
    ${financeExpenseForm()}
    <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Origem</th><th>Ações</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function financeCashTotals() {
  const transactions = cashSession.transactions || [];
  const entries = transactions.filter(item => item.type === "entrada").reduce((sum, item) => sum + Number(item.value || 0), 0);
  const exits = transactions.filter(item => item.type === "saida").reduce((sum, item) => sum + Number(item.value || 0), 0);
  return { entries, exits, balance: Number(cashSession.opening || 0) + entries - exits };
}

function financeMetric(label, value, tone = "") {
  return `<article class="finance-metric ${tone ? `tone-${tone}` : ""}"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`;
}

function financePaymentRows(numbers) {
  const rows = Object.entries(numbers.byPayment).sort((a, b) => b[1] - a[1]);
  const total = numbers.net || 1;
  return rows.map(([name, value]) => `
    <div class="finance-breakdown-row"><div><span>${escapeHtml(name)}</span><strong>${money(value)}</strong></div><div class="bar"><span style="width:${Math.round((value / total) * 100)}%"></span></div></div>
  `).join("") || `<p class="empty-state">Nenhum pedido no período.</p>`;
}

function financeProductRows(numbers, includeCost = true) {
  const rows = Object.values(numbers.products).sort((a, b) => b.revenue - a.revenue).slice(0, 12);
  return rows.map(item => {
    const profit = item.revenue - item.cost;
    return `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${item.qty}</td><td>${money(item.revenue)}</td>${includeCost ? `<td>${money(item.cost)}</td><td class="${profit < 0 ? "negative" : "positive"}">${money(profit)}</td>` : ""}</tr>`;
  }).join("") || `<tr><td colspan="${includeCost ? 5 : 3}" class="empty-cell">Nenhum produto vendido no período.</td></tr>`;
}

function financeChartPoints(numbers, selectedExpenses, granularity) {
  const points = new Map();
  const ensure = (key, label) => {
    if (!points.has(key)) points.set(key, { key, label, revenue: 0, expenses: 0, orders: 0 });
    return points.get(key);
  };
  const bucket = date => {
    const day = String(date || "");
    if (granularity === "day") return { key: day, label: new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
    if (granularity === "month") {
      const key = day.slice(0, 7);
      return { key, label: new Date(`${key}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "") };
    }
    const key = day.slice(0, 4);
    return { key, label: key };
  };
  Object.entries(numbers.byDay).forEach(([day, value]) => {
    const group = bucket(day);
    const point = ensure(group.key, group.label);
    point.revenue += Number(value.total || 0);
    point.orders += Number(value.orders || 0);
  });
  selectedExpenses.forEach(item => {
    const group = bucket(item.expenseDate);
    const point = ensure(group.key, group.label);
    point.expenses += Number(item.amount || 0);
  });
  const sorted = [...points.values()].sort((a, b) => a.key.localeCompare(b.key));
  return granularity === "day" ? sorted.slice(-31) : sorted;
}

function financeChartCard(title, description, points) {
  if (!points.length) return `<article class="finance-chart-card"><div class="finance-section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div><p class="empty-state">Sem dados neste período.</p></article>`;
  const max = Math.max(1, ...points.flatMap(point => [point.revenue, point.expenses, Math.abs(point.revenue - point.expenses)]));
  const bars = points.map(point => {
    const profit = point.revenue - point.expenses;
    const bar = (value, tone) => `<div class="finance-chart-bar-wrap" title="${escapeHtml(money(value))}"><span class="finance-chart-bar-value">${money(value)}</span><i class="finance-chart-bar ${tone}" style="height:${Math.max(5, Math.round((Math.abs(value) / max) * 100))}%"></i></div>`;
    return `<div class="finance-chart-group"><div class="finance-chart-bars">${bar(point.revenue, "revenue")}${bar(point.expenses, "expenses")}${bar(profit, profit < 0 ? "profit-negative" : "profit")}</div><small>${escapeHtml(point.label)}</small></div>`;
  }).join("");
  return `<article class="finance-chart-card"><div class="finance-section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div><div class="finance-chart-legend"><span><i class="revenue"></i>Faturamento</span><span><i class="expenses"></i>Despesas</span><span><i class="profit"></i>Lucro</span><span><i class="profit-negative"></i>Prejuízo</span></div><div class="finance-chart-scroll"><div class="finance-chart-groups">${bars}</div></div></article>`;
}

function financeChartsView(numbers, selectedExpenses) {
  return `
    <div class="finance-section-head"><div><h2>Saúde financeira</h2><p>Compare faturamento, despesas e lucro no período escolhido. Use os filtros acima para alternar entre dia, mês e ano.</p></div></div>
    <div class="finance-chart-grid">
      ${financeChartCard("Visão diária", "Últimos 31 dias do recorte selecionado.", financeChartPoints(numbers, selectedExpenses, "day"))}
      ${financeChartCard("Visão mensal", "Consolidação por mês do recorte selecionado.", financeChartPoints(numbers, selectedExpenses, "month"))}
      ${financeChartCard("Visão anual", "Consolidação por ano do recorte selecionado.", financeChartPoints(numbers, selectedExpenses, "year"))}
    </div>`;
}

function renderReports({ preserveExpenseDraft = true } = {}) {
  if (!["overview", "sales", "products", "expenses", "cash"].includes(financeView)) financeView = "overview";
  const expenseDraft = preserveExpenseDraft && financeView === "expenses"
    ? captureExpenseFormDraft()
    : null;
  document.querySelectorAll("[data-finance-view]").forEach(button => {
    const active = button.dataset.financeView === financeView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  syncFinanceRangeButtons();
  const selectedOrders = reportOrders();
  const numbers = financeNumbers(selectedOrders);
  const selectedExpenses = reportExpenses();
  const expenseTotal = selectedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const operatingProfit = numbers.net - expenseTotal;
  const cash = financeCashTotals();
  const average = numbers.paidOrders ? numbers.net / numbers.paidOrders : 0;
  const view = financeView;
  if (view === "expenses") {
    byId("reports").innerHTML = financeExpensesView();
    restoreExpenseFormDraft(expenseDraft);
    return;
  }
  const viewBody = view === "sales" ? financeChartsView(numbers, selectedExpenses) : view === "products" ? `
    <div class="finance-section-head"><div><h2>Produtos e complementos</h2><p>Faturamento e margem usando o custo cadastrado no cardápio.</p></div></div>
    <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Item</th><th>Qtd.</th><th>Faturamento</th><th>Custo</th><th>Lucro estimado</th></tr></thead><tbody>${financeProductRows(numbers)}</tbody></table></div>
    <div class="finance-section-head"><div><h2>Complementos</h2><p>Adicionais vendidos no período.</p></div></div>
    <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Adicional</th><th>Qtd.</th><th>Faturamento</th></tr></thead><tbody>${Object.values(numbers.complements).sort((a, b) => b.revenue - a.revenue).map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.qty}</td><td>${money(item.revenue)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty-cell">Nenhum adicional vendido no período.</td></tr>`}</tbody></table></div>` : view === "cash" ? `
    <div class="finance-section-head"><div><h2>Fluxo de caixa</h2><p>Resumo operacional sem exigir abertura de caixa.</p></div><button class="ghost" data-tab-jump="cash">Abrir controle de caixa</button></div>
    <div class="finance-mini-grid">${financeMetric("Status", cashSession.open ? "Aberto" : "Fechado", cashSession.open ? "positive" : "")}${financeMetric("Entradas manuais", money(cash.entries), "positive")}${financeMetric("Saídas manuais", money(cash.exits), "negative")}${financeMetric("Saldo de movimentos", money(cash.balance))}</div>
    <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${(cashSession.transactions || []).map(item => `<tr><td>${escapeHtml(formatDate(item.createdAt))}</td><td>${escapeHtml(item.description || "Movimento")}</td><td>${item.type === "entrada" ? "Entrada" : "Saída"}</td><td class="${item.type === "entrada" ? "positive" : "negative"}">${item.type === "entrada" ? "+" : "-"} ${money(item.value)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty-cell">Nenhum movimento manual registrado.</td></tr>`}</tbody></table></div>` : `
    <div class="finance-section-head"><div><h2>Visão geral</h2><p>O essencial para decidir rápido no dia a dia do Tokyo Sushi.</p></div></div>
    <div class="finance-mini-grid">${financeMetric("Compras e despesas", money(expenseTotal), "negative")}${financeMetric("Lucro operacional", money(operatingProfit), operatingProfit < 0 ? "negative" : "positive")}${financeMetric("Receita histórica", money(numbers.historicalRevenue))}</div>
    <div class="finance-dashboard-grid"><article class="finance-card"><h2>Formas de pagamento</h2><div class="finance-breakdown">${financePaymentRows(numbers)}</div></article><article class="finance-card"><h2>Faturamento por dia</h2><div class="finance-table-wrap compact-table"><table class="finance-table"><thead><tr><th>Dia</th><th>Pedidos</th><th>Total</th></tr></thead><tbody>${Object.entries(numbers.byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7).map(([day, value]) => `<tr><td>${escapeHtml(new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR"))}</td><td>${value.orders}</td><td>${money(value.total)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty-cell">Sem vendas.</td></tr>`}</tbody></table></div></article></div>
    <div class="finance-section-head"><div><h2>Itens mais rentáveis</h2><p>Itens ordenados pelo faturamento; custo depende do cadastro do cardápio.</p></div><button class="ghost" data-finance-view="products">Ver produtos</button></div>
    <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Item</th><th>Qtd.</th><th>Faturamento</th><th>Custo</th><th>Lucro estimado</th></tr></thead><tbody>${financeProductRows(numbers)}</tbody></table></div>`;
  byId("reports").innerHTML = `
    <div class="finance-period-summary"><span>Período analisado</span><strong>${escapeHtml(financePeriodLabel())}</strong><small>Altere os botões ou as datas para comparar dia, mês, ano e histórico.</small></div>
    <div class="finance-metrics">${financeMetric("Faturamento recebido", money(numbers.net), "primary")}${financeMetric("A receber", money(numbers.pendingTotal), numbers.pendingTotal ? "negative" : "")}${financeMetric("Compras e despesas", money(expenseTotal), "negative")}${financeMetric("Lucro operacional", money(operatingProfit), operatingProfit < 0 ? "negative" : "positive")}${financeMetric("Pedidos", numbers.orders)}${financeMetric("Ticket médio", money(average))}${financeMetric("Descontos", `- ${money(numbers.discounts)}`, "negative")}${financeMetric("Acréscimos", `+ ${money(numbers.surcharges)}`, "positive")}</div>
    <div class="finance-view-content">${viewBody}</div>`;
}

function syncFinanceRangeButtons() {
  document.querySelectorAll("[data-finance-range]").forEach(button => {
    const selected = button.dataset.financeRange === financeRange;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderCash() {
  const today = todayKey();
  const todayOrders = orders.filter(order => localDateKey(order.createdAt) === today && isOperationalSale(order));
  const todaySales = todayOrders.filter(isReceivedSale);
  const payments = todaySales.reduce((result, order) => {
    const name = order.payment || "Não informado";
    result[name] = (result[name] || 0) + Number(order.total || 0);
    return result;
  }, {});
  const sales = todaySales.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const entries = (cashSession.transactions || []).filter(item => item.type === "entrada").reduce((sum, item) => sum + Number(item.value || 0), 0);
  const exits = (cashSession.transactions || []).filter(item => item.type === "saida").reduce((sum, item) => sum + Number(item.value || 0), 0);
  const balance = Number(cashSession.opening || 0) + sales + entries - exits;
  const expected = cashSession.expectedAmount == null ? balance : Number(cashSession.expectedAmount);
  byId("cashOpenForm").hidden = cashSession.open;
  byId("cashEntryForm").hidden = !cashSession.open;
  byId("cashSummary").innerHTML = `
    <article class="report-box"><h2>Status</h2><strong>${cashSession.open ? "Aberto" : "Fechado"}</strong></article>
    <article class="report-box"><h2>Faturamento hoje</h2><strong>${money(sales)}</strong></article>
    <article class="report-box"><h2>Pedidos válidos</h2><strong>${todayOrders.length}</strong></article>
    <article class="report-box"><h2>Por pagamento</h2>${Object.entries(payments).map(([name, value]) => `<p>${escapeHtml(name)}: <strong>${money(value)}</strong></p>`).join("") || "<p>Sem vendas hoje.</p>"}</article>
    <article class="report-box"><h2>Saldo esperado</h2><strong>${money(expected)}</strong></article>
    ${cashSession.open ? "" : `<article class="report-box"><h2>Valor contado</h2><strong>${money(cashSession.countedAmount || 0)}</strong></article><article class="report-box"><h2>Diferença</h2><strong class="${Number(cashSession.difference || 0) < 0 ? "negative" : "positive"}">${money(cashSession.difference || 0)}</strong></article>`}
  `;
  byId("cashMovements").innerHTML = `<strong>Entradas e saídas</strong>${(cashSession.transactions || []).map(item => `<div class="cash-movement"><span>${escapeHtml(item.description || (item.type === "entrada" ? "Entrada" : "Saída"))}</span><small>${escapeHtml(formatDate(item.createdAt))}</small><strong class="${item.type === "entrada" ? "entrada" : "saida"}">${item.type === "entrada" ? "+" : "-"} ${money(item.value)}</strong></div>`).join("") || `<p>Nenhum movimento registrado.</p>`}`;
}

function customerRecord(key) {
  const profile = customerProfiles?.[key];
  if (profile) return { key, ...profile };
  const order = orders.find(item => isOperationalSale(item) && customerKey(item.customerName, item.customerPhone) === key);
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
  orders.filter(isOperationalSale).forEach(order => {
    const key = customerKey(order.customerName, order.customerPhone);
    if (!key) return;
    const current = customers.get(key) || { key, name: order.customerName || "Cliente", phone: order.customerPhone || "", notes: "", last: order.createdAt };
    if (String(order.createdAt || "") > String(current.last || "")) current.last = order.createdAt;
    customers.set(key, current);
  });
  Object.entries(customerProfiles || {}).forEach(([key, profile]) => {
    const current = customers.get(key) || { key, last: profile.createdAt || "" };
    customers.set(key, { ...current, ...profile, key });
  });
  const hidden = new Set(hiddenCustomerKeys || []);
  const rows = [...customers.values()]
    .filter(customer => !hidden.has(customer.key))
    .filter(customer => !term || `${customer.name} ${customer.phone} ${customer.notes || ""}`.toLowerCase().includes(term))
    .sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")));
  byId("customerList").innerHTML = rows.map(customer => {
    const name = customer.name || "Cliente";
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    return `
      <article class="customer-row">
        <div class="customer-identity"><span class="customer-avatar" aria-hidden="true">${escapeHtml(initials || "C")}</span><div><strong>${escapeHtml(name)}</strong><small>${customer.notes ? escapeHtml(customer.notes) : "Sem observações cadastradas"}</small></div></div>
        <div class="customer-detail"><strong>${escapeHtml(customer.phone || "Não informado")}</strong></div>
        <div class="customer-actions">
          <a class="action-btn whatsapp-action" href="https://wa.me/${whatsappNumber(customer.phone)}" target="_blank" rel="noopener">WhatsApp</a>
          <button class="ghost" data-edit-customer="${encodeURIComponent(customer.key)}">Editar</button>
          <button class="danger" data-remove-customer="${encodeURIComponent(customer.key)}">Excluir</button>
        </div>
      </article>`;
  }).join("") || `<p class="customer-empty">Nenhum cliente encontrado.</p>`;
}

function exportReportCsv() {
  const ordersRows = reportOrders();
  const expenseRows = reportExpenses();
  const start = byId("reportStart")?.value || "";
  const end = byId("reportEnd")?.value || "";
  const historicalRows = dailyRevenues.filter(item => item.source === "gestao_tokyo" && (!start || item.revenueDate >= start) && (!end || item.revenueDate <= end));
  const rows = [
    ["Tipo", "ID", "Data", "Descrição/Cliente", "Celular/Fornecedor", "Pagamento/Categoria", "Status/Origem", "Subtotal", "Desconto", "Cupom", "Acréscimo", "Troco", "Total"],
    ...ordersRows.map(order => ["Venda", order.id, formatDate(order.createdAt), order.customerName, order.customerPhone, order.payment, order.status, Number(order.subtotal ?? order.total ?? 0).toFixed(2), Number((order.discountAmount || 0) + (order.couponDiscountAmount || 0)).toFixed(2), order.couponCode || "", Number(order.surchargeAmount || 0).toFixed(2), Number(order.changeAmount || 0).toFixed(2), Number(order.total || 0).toFixed(2)]),
    ...expenseRows.map(item => ["Despesa", item.id, formatDateOnly(item.expenseDate), item.description, item.supplier, item.category, item.source === "gestao_tokyo" ? "Gestão Tóquio" : "Manual", "", "", "", "", "", Number(item.amount || 0).toFixed(2)]),
    ...historicalRows.map(item => ["Receita histórica", item.id, formatDateOnly(item.revenueDate), `${item.orders} pedido(s)`, "", "", "Gestão Tóquio", "", "", "", "", "", Number(item.revenue || 0).toFixed(2)])
  ];
  const csv = rows
    .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = `financeiro-tokyo-sushi-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetPromoForm() {
  const form = byId("promoForm");
  if (!form) return;
  form.reset();
  delete form.dataset.editId;
  delete form.dataset.editIndex;
  const submitBtn = byId("promoSubmitButton") || form.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Salvar promoção";
  const cancelBtn = byId("cancelPromoEdit");
  if (cancelBtn) cancelBtn.hidden = true;
  renderPromos();
}

function renderPromos() {
  const currentEditId = byId("promoForm")?.dataset?.editId || "";
  byId("promoList").innerHTML = promos.map((promo, index) => {
    const promoId = String(promo.id || `promo-${index}`);
    const isEditing = currentEditId && currentEditId === promoId;
    return `
    <article class="promo-card ${isEditing ? "is-editing" : ""}">
      <div><strong>${escapeHtml(promo.title)}</strong>${promoField(promo, "code", "code") ? `<span class="promo-code">${escapeHtml(String(promoField(promo, "code", "code")).toUpperCase())}</span>` : ""}<span class="promo-discount">${promoField(promo, "discountType", "discount_type", "none") === "percent" ? `${Number(promoField(promo, "discountValue", "discount_value", 0))}%` : promoField(promo, "discountType", "discount_type", "none") === "fixed" ? money(promoField(promo, "discountValue", "discount_value", 0)) : "Sem desconto"}</span></div>
      <p>${escapeHtml(promo.text)}</p>
      <small>${promo.active === false ? "Inativo" : "Ativo"}${promoField(promo, "startsAt", "starts_at") ? ` · começa ${escapeHtml(formatDateOnly(promoField(promo, "startsAt", "starts_at")))}` : ""}${promoField(promo, "endsAt", "ends_at") ? ` · termina ${escapeHtml(formatDateOnly(promoField(promo, "endsAt", "ends_at")))}` : ""}</small>
      <button class="ghost" data-edit-promo="${escapeHtml(promoId)}">${isEditing ? "Editando..." : "Editar"}</button>
      <button class="ghost" data-duplicate-promo="${escapeHtml(promoId)}">Duplicar</button>
      <button class="ghost" data-copy-promo="${escapeHtml(promoId)}">Copiar mensagem</button>
      <button class="danger" data-remove-promo="${escapeHtml(promoId)}">Excluir</button>
    </article>
  `;
  }).join("") || `<p>Nenhuma promoção cadastrada.</p>`;
}

function renderAll() {
  renderOrders();
  renderPdv();
  renderPdvFlow();
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
  document.querySelectorAll(".tabs button").forEach(item => {
    const active = item === button;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
  byId(`${button.dataset.tab}Panel`).classList.add("active");
  if (button.dataset.tab === "settings") renderOperationSettings();
});

document.body.addEventListener("input", event => {
  const form = event.target.closest("[data-order-edit-form]");
  if (!form || !orderEditorDraft) return;
  if (event.target.name === "customerName") orderEditorDraft.customerName = event.target.value;
  if (event.target.name === "customerPhone") orderEditorDraft.customerPhone = event.target.value;
  if (event.target.name === "notes") orderEditorDraft.notes = event.target.value;
});

document.body.addEventListener("input", event => {
  const field = event.target.dataset.menuField;
  if (!field) return;
  const item = menu[Number(event.target.dataset.index)];
  if (!item) return;
  const numericFields = ["price", "fromPrice", "strikePrice", "cost", "stockQty"];
  if (numericFields.includes(field)) item[field] = event.target.value === "" ? "" : Math.max(0, Number(event.target.value));
  else if (field === "secondaryImages") item[field] = event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean).slice(0, 4);
  else if (field === "tags") item[field] = event.target.value.split(",").map(value => value.trim()).filter(Boolean).slice(0, 3);
  else item[field] = event.target.value;
  Object.assign(item, normalizeProduct(item));
  saveMenu();
  scheduleProductSave(Number(event.target.dataset.index));
  renderMetrics();
});

document.body.addEventListener("input", event => {
  const field = event.target.dataset.groupField;
  if (!field) return;
  const group = menuGroups[Number(event.target.dataset.gindex)];
  if (!group) return;
  const previousName = group.name;
  group[field] = field === "active" ? event.target.checked : event.target.value;
  if (field === "name" && previousName !== group.name) {
    menu.forEach(item => { if (item.cat === previousName) item.cat = group.name; });
    if (menuFilters.group === previousName) menuFilters.group = group.name;
    saveMenu();
  }
  group.sortOrder = Number(group.sortOrder || 0);
  menuGroups = normalizeMenuGroups(menuGroups, menu);
  saveMenuGroups();
  renderMenuGroups();
});

function handleComplementInput(event) {
  const field = event.target.dataset.complementField;
  const itemField = event.target.dataset.complementItemField;
  if (!field && !itemField) return;

  const groupIndex = Number(event.target.dataset.cindex);
  const group = complementGroups[groupIndex];
  if (!group) return;

  if (field) {
    group[field] = field === "active"
      ? event.target.checked
      : ["minQty", "maxQty", "sortOrder"].includes(field)
        ? Math.max(0, Number(event.target.value || 0))
        : event.target.value;
  }

  if (itemField) {
    const itemIndex = Number(event.target.dataset.iindex);
    const item = group.items?.[itemIndex];
    if (!item) return;
    if (itemField === "active") item[itemField] = event.target.checked;
    else if (["price", "maxQty", "cost"].includes(itemField)) item[itemField] = Math.max(0, Number(event.target.value || 0));
    else if (itemField === "tags") item[itemField] = event.target.value.split(",").map(value => value.trim()).filter(Boolean).slice(0, 3);
    else item[itemField] = event.target.value;
  }

  saveComplements();
  scheduleComplementSave(group.id || groupIndex);
}

document.body.addEventListener("input", event => {
  if (event.target.dataset.complementField || event.target.dataset.complementItemField) {
    handleComplementInput(event);
  }
});

document.body.addEventListener("change", async event => {
  if (event.target.dataset.complementField || event.target.dataset.complementItemField) {
    handleComplementInput(event);
    return;
  }
  if (event.target.dataset.orderEditAdjustment) {
    if (!orderEditorDraft) return;
    orderEditorDraft.pricing = {
      ...orderEditorDraft.pricing,
      [event.target.dataset.orderEditAdjustment]: event.target.type === "number"
        ? Math.max(0, Number(event.target.value || 0))
        : event.target.value
    };
    renderOrders({ preserveEditorViewport: true });
    return;
  }
  if (event.target.dataset.orderEditProduct !== undefined) {
    orderEditorSelectedProductId = event.target.value;
    orderEditorPendingOptions = {};
    renderOrders({ preserveEditorViewport: true });
    return;
  }
  if (event.target.id === "pdvProduct") {
    pdvSelectedProductId = event.target.value;
    pdvPendingOptions = {};
    renderPdvComplements();
  }
  if (event.target.dataset.orderStatus) {
    const order = orders.find(item => String(item.id) === String(event.target.dataset.orderStatus));
    if (order) {
      await persistOrderStatus(order, event.target.value);
    }
  }
  if (event.target.dataset.menuMeta) {
    const item = menu[Number(event.target.dataset.index)];
    if (!item) return;
    const [field, key] = event.target.dataset.menuMeta.split(":");
    if (field === "channels" || field === "badges") item[field][key] = event.target.checked;
    else if (field === "activeDays") {
      const day = Number(key);
      const days = new Set(item.activeDays || DEFAULT_ACTIVE_DAYS);
      event.target.checked ? days.add(day) : days.delete(day);
      item.activeDays = [...days].sort((a, b) => a - b);
    } else if (field === "active") item.active = event.target.checked;
    else if (field === "highlight" || field === "stockControlled") item[field] = event.target.checked;
    Object.assign(item, normalizeProduct(item));
    saveMenu();
    scheduleProductSave(Number(event.target.dataset.index));
    renderMenuEditor();
  }
  if (event.target.dataset.groupField === "active") {
    const group = menuGroups[Number(event.target.dataset.gindex)];
    if (!group) return;
    group.active = event.target.checked;
    saveMenuGroups();
    renderMenuEditor();
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
  if (event.target.id === "settingsScheduleEnabled") {
    const enabled = event.target.checked;
    document.querySelectorAll("[data-schedule-open], [data-schedule-close]").forEach(input => {
      const day = input.dataset.scheduleOpen ?? input.dataset.scheduleClose;
      const dayEnabled = document.querySelector(`[data-schedule-enabled="${day}"]`)?.checked;
      input.disabled = !enabled || !dayEnabled;
    });
  }
  if (event.target.dataset.scheduleEnabled !== undefined) {
    const day = event.target.dataset.scheduleEnabled;
    document.querySelector(`[data-schedule-open="${day}"]`)?.toggleAttribute("disabled", !event.target.checked);
    document.querySelector(`[data-schedule-close="${day}"]`)?.toggleAttribute("disabled", !event.target.checked);
  }
});

document.body.addEventListener("click", async event => {
  const target = event.target.closest("button, a") || event.target;
  if (target.id === "showActiveOrders") {
    const filter = byId("orderStatusFilter");
    if (filter) filter.value = "";
    renderOrders();
    return;
  }
  if (target.dataset.orderFilter) {
    const filter = byId("orderStatusFilter");
    if (filter) {
      const nextFilter = target.dataset.orderFilter;
      filter.value = filter.value === nextFilter ? "" : nextFilter;
    }
    renderOrders();
    return;
  }
  if (target.dataset.editOrder) {
    openOrderEditor(target.dataset.editOrder);
    return;
  }
  if (target.dataset.closeOrderEditor) {
    closeOrderEditor();
    return;
  }
  if (target.dataset.orderEditAdd !== undefined) {
    orderEditorAddItem();
    return;
  }
  if (target.dataset.orderEditQty) {
    const [index, delta] = target.dataset.orderEditQty.split(":").map(Number);
    orderEditorChangeQty(index, delta);
    return;
  }
  if (target.dataset.orderEditRemove !== undefined) {
    orderEditorRemoveItem(Number(target.dataset.orderEditRemove));
    return;
  }
  if (target.dataset.orderEditOptionPlus) {
    changeOrderEditorOption(target.dataset.orderEditOptionPlus, 1);
    return;
  }
  if (target.dataset.orderEditOptionMinus) {
    changeOrderEditorOption(target.dataset.orderEditOptionMinus, -1);
    return;
  }
  if (target.dataset.scheduleCopy !== undefined) {
    const sourceDay = Number(target.dataset.scheduleCopy);
    const sourceOpen = document.querySelector(`[data-schedule-open="${sourceDay}"]`)?.value || "";
    const sourceClose = document.querySelector(`[data-schedule-close="${sourceDay}"]`)?.value || "";
    document.querySelectorAll("[data-schedule-open]").forEach(input => { if (input.dataset.scheduleOpen !== String(sourceDay)) input.value = sourceOpen; });
    document.querySelectorAll("[data-schedule-close]").forEach(input => { if (input.dataset.scheduleClose !== String(sourceDay)) input.value = sourceClose; });
    const sourceLabel = document.querySelector(`[data-schedule-row="${sourceDay}"] .schedule-day span`)?.textContent || "Este dia";
    notify(`Horários de ${sourceLabel.toLowerCase()} copiados para os outros dias. Clique em “Salvar configurações” para confirmar.`, "success");
    return;
  }
  if (target.dataset.removePdv) {
    pdvCart.splice(Number(target.dataset.removePdv), 1);
    renderPdv();
    return;
  }
  if (target.dataset.pdvSelectProduct) {
    const productId = String(target.dataset.pdvSelectProduct);
    byId("pdvProduct").value = productId;
    pdvSelectedProductId = productId;
    pdvPendingOptions = {};
    renderPdvComplements();
    return;
  }
  if (target.dataset.pdvQuickAdd) {
    const productId = String(target.dataset.pdvQuickAdd);
    const qtyInput = byId("pdvProductList")?.querySelector(`[data-pdv-quick-qty="${CSS.escape(productId)}"]`);
    byId("pdvProduct").value = productId;
    byId("pdvQty").value = Math.max(1, Number(qtyInput?.value || 1));
    if (pdvSelectedProductId !== productId) pdvPendingOptions = {};
    pdvSelectedProductId = productId;
    renderPdvComplements();
    byId("pdvAddItem").click();
    return;
  }
  if (target.dataset.pdvConfirmItem !== undefined) {
    byId("pdvAddItem").click();
    return;
  }
  if (target.dataset.pdvQty) {
    const [index, delta] = target.dataset.pdvQty.split(":").map(Number);
    const line = pdvCart[index];
    if (!line) return;
    line.qty = Math.max(0, Number(line.qty || 0) + delta);
    if (!line.qty) pdvCart.splice(index, 1);
    renderPdv();
    return;
  }
  if (target.dataset.clearPdv) {
    if (!pdvCart.length) return;
    if (!await askConfirm("Todos os itens deste pedido serão removidos da montagem atual.", { title: "Limpar pedido?", confirmLabel: "Limpar pedido" })) return;
    pdvCart = [];
    pdvPendingOptions = {};
    pdvAppliedAdjustments = { discountType: "none", discountValue: 0, surchargeType: "none", surchargeValue: 0 };
    pdvAdjustmentMessage = "Digite um ajuste e confirme.";
    byId("pdvDiscountType").value = "none";
    byId("pdvDiscountValue").value = "0";
    byId("pdvSurchargeType").value = "none";
    byId("pdvSurchargeValue").value = "0";
    renderPdv();
    return;
  }
  if (target.dataset.pdvOptionPlus) changePdvOption(target.dataset.pdvOptionPlus, 1);
  if (target.dataset.pdvOptionMinus) changePdvOption(target.dataset.pdvOptionMinus, -1);
  if (target.dataset.quickStatus) {
    const [id, status] = target.dataset.quickStatus.split(":");
    const order = orders.find(item => String(item.id) === String(id));
    if (order) {
      await persistOrderStatus(order, status);
    }
  }
  if (target.dataset.paymentToggle) {
    const order = orders.find(item => String(item.id) === String(target.dataset.paymentToggle));
    if (order) await persistOrderPaymentStatus(order, order.paymentStatus === "paid" ? "pending" : "paid");
  }
  if (target.dataset.archiveFinanceOrder) {
    const order = orders.find(item => String(item.id) === String(target.dataset.archiveFinanceOrder));
    if (!order || !await askConfirm(`A venda #${order.id} será retirada dos pedidos e do Financeiro. O registro ficará arquivado para não apagar o histórico do banco.`, { title: "Excluir venda?", confirmLabel: "Excluir venda" })) return;
    const previousOrders = orders;
    orders = orders.filter(item => String(item.id) !== String(order.id));
    saveOrders();
    renderAll();
    if (window.TokyoDb?.enabled) {
      try {
        await window.TokyoDb.archiveOrder(order.id);
      } catch (error) {
        orders = previousOrders;
        saveOrders();
        renderAll();
        notify("Não foi possível excluir a venda online. A alteração foi desfeita.");
        console.warn("Falha ao arquivar venda online.", error);
        return;
      }
    }
    notify(`Venda #${order.id} retirada do Financeiro.`, "success");
  }
  if (target.dataset.printOrder) {
    const order = orders.find(item => String(item.id) === String(target.dataset.printOrder));
    if (order) {
      const mode = target.dataset.printMode || (order.status === "Pronto" ? "customer" : "kitchen");
      if (target.dataset.printDialog === "true") {
        browserPrintOrder(order, mode);
        notify("Prévia de impressão aberta. Confira a impressora e confirme no Windows.", "info");
      } else {
        printOrder(order, mode);
      }
    }
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
      const copy = normalizeProduct({ ...source, id: Date.now(), name: `${source.name} (cópia)`, active: false, archived: false, archivedAt: "", sortOrder: index + 1 });
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
  if (target.dataset.reorderProduct) {
    const [index, delta] = target.dataset.reorderProduct.split(":").map(Number);
    const nextIndex = index + delta;
    if (menu[nextIndex]) {
      [menu[index], menu[nextIndex]] = [menu[nextIndex], menu[index]];
      menu.forEach((item, itemIndex) => { item.sortOrder = itemIndex; });
      saveMenu();
      runOnline(() => Promise.all([window.TokyoDb.saveProduct(menu[index], index), window.TokyoDb.saveProduct(menu[nextIndex], nextIndex)]), "Falha ao reordenar produto online.");
      renderMenuEditor();
    }
  }
  if (target.dataset.toggleProduct) {
    const index = Number(target.dataset.toggleProduct);
    const item = menu[index];
    if (!item || item.archived) return;
    item.active = item.active === false;
    saveMenu();
    runOnline(() => window.TokyoDb.saveProduct(item, index), `Falha ao ${item.active ? "reativar" : "pausar"} produto online.`);
    notify(`${item.name} foi ${item.active ? "reativado" : "pausado"} no cardápio.`, "success");
    renderMenuEditor();
  }
  if (target.dataset.archiveProduct) {
    const index = Number(target.dataset.archiveProduct);
    const item = menu[index];
    if (!item || !await askConfirm(`O item "${item.name}" ficará arquivado e poderá ser restaurado depois.`, { title: "Arquivar item?", confirmLabel: "Arquivar item" })) return;
    item.archived = true;
    item.archivedAt = new Date().toISOString();
    item.active = false;
    saveMenu();
    runOnline(() => window.TokyoDb.saveProduct(item, index), "Falha ao arquivar produto online.");
    renderMenuEditor();
  }
  if (target.dataset.restoreProduct) {
    const index = Number(target.dataset.restoreProduct);
    const item = menu[index];
    if (!item) return;
    item.archived = false;
    item.archivedAt = "";
    item.active = true;
    saveMenu();
    runOnline(() => window.TokyoDb.saveProduct(item, index), "Falha ao restaurar produto online.");
    renderMenuEditor();
  }
  if (target.dataset.editPromo) {
    const promoId = String(target.dataset.editPromo);
    const promo = promos.find(item => String(item.id) === promoId);
    if (promo) {
      byId("promoTitle").value = promo.title || "";
      byId("promoCode").value = promoField(promo, "code", "code");
      byId("promoDiscountType").value = promoField(promo, "discountType", "discount_type", "none");
      byId("promoDiscountValue").value = promoField(promo, "discountValue", "discount_value", 0);
      byId("promoStartsAt").value = dateOnlyValue(promoField(promo, "startsAt", "starts_at"));
      byId("promoEndsAt").value = dateOnlyValue(promoField(promo, "endsAt", "ends_at"));
      byId("promoActive").checked = promo.active !== false;
      byId("promoText").value = promo.text || "";
      byId("promoForm").dataset.editId = promoId;
      delete byId("promoForm").dataset.editIndex;
      const submitBtn = byId("promoSubmitButton") || byId("promoForm").querySelector("button[type=submit]");
      if (submitBtn) submitBtn.textContent = "Atualizar promoção";
      const cancelBtn = byId("cancelPromoEdit");
      if (cancelBtn) cancelBtn.hidden = false;
      byId("promoForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
      byId("promoTitle").focus();
      renderPromos();
    }
  }
  if (target.dataset.duplicatePromo) {
    const promoId = String(target.dataset.duplicatePromo);
    const promo = promos.find(item => String(item.id) === promoId);
    if (promo) {
      const copy = { ...promo, id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: `${promo.title} (cópia)`, code: promoField(promo, "code", "code") ? `${promoField(promo, "code", "code")}_COPY` : "", createdAt: new Date().toISOString() };
      delete copy.created_at;
      promos.unshift(copy);
      savePromos();
      runOnline(() => window.TokyoDb.savePromo(copy), "Falha ao duplicar promoção online.");
      renderPromos();
      notify("Promoção duplicada.", "success");
    }
  }
  if (target.dataset.copyPromo) {
    const promoId = String(target.dataset.copyPromo);
    const promo = promos.find(item => String(item.id) === promoId);
    if (promo) {
      await navigator.clipboard.writeText(promo.text);
      notify("Mensagem copiada para a área de transferência.", "success");
    }
  }
  if (target.dataset.removePromo) {
    const promoId = String(target.dataset.removePromo);
    const promo = promos.find(item => String(item.id) === promoId);
    if (!promo || !await askConfirm(`A promoção "${promo.title}" será removida.`, { title: "Excluir promoção?", confirmLabel: "Excluir promoção" })) return;
    if (byId("promoForm")?.dataset?.editId === promoId) {
      resetPromoForm();
    }
    promos = promos.filter(item => String(item.id) !== promoId);
    savePromos();
    if (promo?.id) runOnline(() => window.TokyoDb.deletePromo(promo.id), "Falha ao excluir promoção online.");
    renderPromos();
    notify("Promoção excluída.", "success");
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
    group.items.push({ id: Date.now(), name: "Novo complemento", price: 0, maxQty: 100, cost: 0, description: "", tags: [], active: true });
    saveComplements();
    scheduleComplementSave(Number(target.dataset.addComplementItem));
    renderComplements();
  }
  if (target.dataset.removeComplementItem) {
    const [groupIndex, itemIndex] = target.dataset.removeComplementItem.split(":").map(Number);
    const group = complementGroups[groupIndex];
    if (!group) return;
    if (!await askConfirm(`O adicional "${group.items?.[itemIndex]?.name || "sem nome"}" será removido desta lista.`, { title: "Excluir adicional?", confirmLabel: "Excluir adicional" })) return;
    group.items.splice(itemIndex, 1);
    saveComplements();
    scheduleComplementSave(groupIndex);
    renderComplements();
  }
  if (target.dataset.removeComplement) {
    const index = Number(target.dataset.removeComplement);
    const group = complementGroups[index];
    if (!await askConfirm(`A lista "${group?.name || "sem nome"}" e seus adicionais serão removidos.`, { title: "Excluir lista?", confirmLabel: "Excluir lista" })) return;
    complementGroups.splice(index, 1);
    saveComplements();
    if (group?.id) runOnline(() => window.TokyoDb.deleteComplement(group.id), "Falha ao excluir complemento online.");
    renderComplements();
  }
  if (target.dataset.reorderGroup) {
    const [index, delta] = target.dataset.reorderGroup.split(":").map(Number);
    const nextIndex = index + delta;
    if (menuGroups[nextIndex]) {
      [menuGroups[index], menuGroups[nextIndex]] = [menuGroups[nextIndex], menuGroups[index]];
      menuGroups.forEach((group, groupIndex) => { group.sortOrder = groupIndex; });
      saveMenuGroups();
      renderMenuEditor();
    }
  }
  if (target.dataset.removeGroup) {
    const index = Number(target.dataset.removeGroup);
    const group = menuGroups[index];
    if (!group || !await askConfirm(`Os itens do grupo "${group.name}" serão movidos para Sem categoria.`, { title: "Arquivar grupo?", confirmLabel: "Arquivar grupo" })) return;
    const fallbackName = "Sem categoria";
    menu.forEach(item => { if (item.cat === group.name) item.cat = fallbackName; });
    group.active = false;
    menuGroups = normalizeMenuGroups(menuGroups, menu);
    saveMenu();
    saveMenuGroups();
    runOnline(() => Promise.all(menu.map((item, itemIndex) => window.TokyoDb.saveProduct(item, itemIndex))), "Falha ao atualizar os itens do grupo online.");
    renderMenuEditor();
  }
  if (target.dataset.editCustomer) openCustomerEditor(decodeURIComponent(target.dataset.editCustomer));
  if (target.dataset.removeCustomer) {
    const key = decodeURIComponent(target.dataset.removeCustomer);
    const customer = customerRecord(key);
    if (!customer || !await askConfirm(`O cadastro de "${customer.name}" será ocultado, mas o histórico de pedidos será preservado.`, { title: "Ocultar cliente?", confirmLabel: "Ocultar cliente" })) return;
    hiddenCustomerKeys = [...new Set([...(hiddenCustomerKeys || []), key])];
    delete customerProfiles[key];
    saveCustomerData();
    renderCustomers();
  }
  if (target.dataset.storeMode) {
    const selectedMode = target.dataset.storeMode;
    const previousStatus = storeStatus;
    storeStatus = selectedMode === "open"
      ? { ...STORE_STATUS.open, manualOverride: false, manualOverrideDate: "" }
      : { ...STORE_STATUS.closed, manualOverride: true, manualOverrideDate: localDateKey() };
    renderStoreControls();
    const saved = await saveStoreStatus();
    if (!saved) {
      storeStatus = previousStatus;
      localStorage.setItem(STORE_STATUS_KEY, JSON.stringify(storeStatus));
      renderStoreControls();
      return;
    }
    notify(`Cardápio ${selectedMode === "open" ? "aberto" : "fechado"} e sincronizado.`, "success");
  }
  if (target.dataset.financeRange) {
    const range = target.dataset.financeRange;
    financeRange = range;
    if (range === "all") {
      byId("reportStart").value = "";
      byId("reportEnd").value = "";
    } else {
      const today = new Date();
      const end = todayKey();
      const startDate = new Date(today);
      if (range === "7d") startDate.setDate(startDate.getDate() - 6);
      if (range === "month") startDate.setDate(1);
      if (range === "year") startDate.setMonth(0, 1);
      byId("reportStart").value = range === "today" ? end : localDateKey(startDate.toISOString());
      byId("reportEnd").value = end;
    }
    byId("financeStatusFilter").value = "valid";
    syncFinanceRangeButtons();
    renderReports();
  }
  if (target.dataset.financeView) {
    financeView = target.dataset.financeView;
    expenseEditingId = "";
    localStorage.setItem("tokyoFinanceView", financeView);
    document.querySelectorAll("[data-finance-view]").forEach(button => {
      const active = button.dataset.financeView === financeView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderReports();
  }
  if (target.dataset.expenseCategory !== undefined) {
    expenseCategoryFilter = target.dataset.expenseCategory || "";
    financeView = "expenses";
    renderReports();
  }
  if (target.dataset.expenseAction) {
    const action = target.dataset.expenseAction;
    const expense = expenses.find(item => String(item.id) === String(target.dataset.expenseId));
    if (action === "cancel-edit") {
      expenseEditingId = "";
      renderReports({ preserveExpenseDraft: false });
    } else if (action === "edit" && expense) {
      expenseEditingId = expense.id;
      financeView = "expenses";
      renderReports({ preserveExpenseDraft: false });
      byId("expenseForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
      byId("expenseDescription")?.focus();
    } else if (action === "delete" && expense && await askConfirm(`A compra "${expense.description}" será removida do resultado.`, { title: "Excluir compra?", confirmLabel: "Excluir compra" })) {
      expenses = expenses.filter(item => String(item.id) !== String(expense.id));
      localStorage.setItem("tokyoExpenses", JSON.stringify(expenses));
      if (expense.id) runOnline(() => window.TokyoDb.deleteExpense(expense.id), "Falha ao excluir compra online.");
      notify("Compra excluída do Financeiro.", "success");
      renderReports();
    }
  }
  if (target.dataset.tabJump) document.querySelector(`[data-tab="${target.dataset.tabJump}"]`)?.click();
  if (target.dataset.settingsAction === "test-print") {
    printOrder({
      id: "TESTE",
      createdAt: new Date().toISOString(),
      customerName: "Teste de impressão",
      customerPhone: operationSettings.whatsappNumber || "-",
      payment: "Teste",
      total: 0,
      items: [{ qty: 1, name: "Comanda de teste", price: 0, unitExtra: 0, options: [] }],
      notes: "Se esta comanda apareceu, a impressão está configurada."
    });
  }
  if (target.dataset.settingsAction === "connect-print-agent") {
    await connectPrintAgent();
  }
});

document.body.addEventListener("submit", async event => {
  if (event.target.dataset.orderEditForm !== undefined) {
    event.preventDefault();
    const order = orders.find(item => String(item.id) === String(event.target.dataset.orderEditForm));
    if (order) await saveOrderEditor(order, event.target);
    return;
  }
});

document.body.addEventListener("submit", event => {
  if (event.target.id === "operationSettingsForm") {
    event.preventDefault();
    const weeklySchedule = DEFAULT_WEEKLY_SCHEDULE.map(day => ({
      ...day,
      enabled: document.querySelector(`[data-schedule-enabled="${day.day}"]`)?.checked === true,
      open: document.querySelector(`[data-schedule-open="${day.day}"]`)?.value || "",
      close: document.querySelector(`[data-schedule-close="${day.day}"]`)?.value || ""
    }));
    operationSettings = normalizeOperationSettings({
      whatsappNumber: byId("settingsWhatsappNumber").value,
      pixKey: byId("settingsPixKey")?.value?.trim() || DEFAULT_OPERATION_SETTINGS.pixKey,
      pixBeneficiary: byId("settingsPixBeneficiary")?.value?.trim() || DEFAULT_OPERATION_SETTINGS.pixBeneficiary,
      whatsappOrderTemplate: byId("settingsWhatsappOrderTemplate").value,
      whatsappReadyTemplate: byId("settingsWhatsappReadyTemplate").value,
      printerWidth: byId("settingsPrinterWidth").value,
      printerMargin: byId("settingsPrinterMargin").value,
      printerLayout: {
        showCustomer: byId("settingsPrintShowCustomer").checked,
        showPhone: byId("settingsPrintShowPhone").checked,
        showPayment: byId("settingsPrintShowPayment").checked,
        showItemPrices: byId("settingsPrintShowItemPrices").checked,
        showNotes: byId("settingsPrintShowNotes").checked,
        showTotals: byId("settingsPrintShowTotals").checked
      },
      printCopies: byId("settingsPrintCopies").value,
      printOnNewOrder: byId("settingsPrintOnNewOrder").checked,
      notifyNewOrder: byId("settingsNotifyNewOrder").checked,
      scheduleEnabled: byId("settingsScheduleEnabled").checked,
      weeklySchedule
    });
    saveOperationSettings();
    renderStoreControls({ syncSettings: false });
    renderOperationSettings();
    notify("Configurações operacionais salvas.", "success");
    return;
  }
  if (event.target.id === "expenseForm") {
    event.preventDefault();
    const id = byId("expenseId").value || crypto.randomUUID();
    const existing = expenses.find(item => String(item.id) === String(id));
    const expense = {
      id,
      expenseDate: byId("expenseDate").value,
      description: byId("expenseDescription").value.trim(),
      category: byId("expenseCategory").value.trim() || "Outros",
      supplier: byId("expenseSupplier").value.trim(),
      amount: Math.max(0, parseExpenseAmount(byId("expenseAmount").value)),
      notes: byId("expenseNotes").value.trim(),
      source: existing?.source || "manual",
      sourceRecordId: existing?.sourceRecordId || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!expense.expenseDate || !expense.description || !expense.amount) {
      notify("Preencha data, descrição e um valor maior que zero.");
      return;
    }
    const index = expenses.findIndex(item => String(item.id) === String(id));
    if (index >= 0) expenses[index] = expense;
    else expenses.unshift(expense);
    expenseEditingId = "";
    localStorage.setItem("tokyoExpenses", JSON.stringify(expenses));
    runOnline(() => window.TokyoDb.saveExpense(expense), "Falha ao salvar compra online.");
    notify(index >= 0 ? "Compra atualizada." : "Compra adicionada.", "success");
    renderReports({ preserveExpenseDraft: false });
    return;
  }
});

byId("addProduct").addEventListener("click", () => {
  const item = normalizeProduct({
    id: Date.now(),
    cat: menuGroups.find(group => group.active !== false)?.name || "Nova categoria",
    name: "Novo item",
    desc: "",
    price: 0,
    image: "",
    active: true,
    sortOrder: 0
  });
  if (!menuGroups.some(group => group.name === item.cat)) {
    menuGroups.push({ id: `group-${Date.now()}`, name: item.cat, sortOrder: menuGroups.length, active: true, description: "" });
    saveMenuGroups();
  }
  menu.unshift(item);
  menu.forEach((product, index) => { product.sortOrder = index; });
  editingProductId = item.id;
  saveMenu();
  runOnline(() => window.TokyoDb.saveProduct(menu[0], 0), "Falha ao criar produto online.");
  renderMenuEditor();
});

byId("addMenuGroup").addEventListener("click", () => {
  const group = { id: `group-${Date.now()}`, name: "Novo grupo", sortOrder: menuGroups.length, active: true, description: "" };
  menuGroups.push(group);
  saveMenuGroups();
  const manager = document.querySelector(".menu-group-manager");
  if (manager) manager.open = true;
  renderMenuEditor();
  window.setTimeout(() => document.querySelector(`[data-group-field="name"][data-gindex="${menuGroups.length - 1}"]`)?.select(), 0);
});

byId("resetMenu").addEventListener("click", async () => {
  if (!await askConfirm("Os produtos atuais serão substituídos pelo cardápio original importado.", { title: "Restaurar cardápio?", confirmLabel: "Restaurar" })) return;
  menu = DEFAULT_MENU.map((item, index) => normalizeProduct({ ...item, active: true, archived: false, archivedAt: "", sortOrder: index }));
  menuGroups = normalizeMenuGroups([], menu);
  saveMenu();
  saveMenuGroups();
  runOnline(() => window.TokyoDb.seedMenu(menu), "Falha ao restaurar cardapio online.");
  renderMenuEditor();
});

byId("clearDone").addEventListener("click", async () => {
  const archivedOrders = orders.filter(order => ["Finalizado", "Cancelado"].includes(order.status) && !order.archivedAt && !order.archived_at);
  if (!archivedOrders.length) return notify("Não há pedidos finalizados ou cancelados para limpar.", "info");
  if (!await askConfirm(`${archivedOrders.length} pedido(s) sairão da tela de pedidos e do Financeiro, mas permanecerão arquivados no banco.`, { title: "Limpar histórico?", confirmLabel: "Arquivar pedidos" })) return;
  const previousOrders = orders;
  orders = orders.filter(order => !["Finalizado", "Cancelado"].includes(order.status));
  saveOrders();
  renderAll();
  if (window.TokyoDb?.enabled) {
    try {
      await window.TokyoDb.archiveOrdersByStatus(["Finalizado", "Cancelado"]);
    } catch (error) {
      orders = previousOrders;
      saveOrders();
      renderAll();
      notify("Não foi possível limpar o histórico online. A alteração foi desfeita.");
      console.warn("Falha ao arquivar pedidos online.", error);
      return;
    }
  }
  notify(`${archivedOrders.length} pedido(s) arquivado(s) com segurança.`, "success");
});

byId("promoForm").addEventListener("submit", async event => {
  event.preventDefault();
  const title = byId("promoTitle").value.trim();
  const text = byId("promoText").value.trim();
  if (!title) {
    notify("Informe o nome da promoção antes de salvar.");
    byId("promoTitle").focus();
    return;
  }
  if (!text) {
    notify("Escreva a mensagem que será enviada aos clientes.");
    byId("promoText").focus();
    return;
  }
  const promoData = {
    title,
    text,
    code: byId("promoCode").value.trim().toUpperCase(),
    discountType: byId("promoDiscountType").value,
    discountValue: Math.max(0, Number(byId("promoDiscountValue").value || 0)),
    active: byId("promoActive").checked,
    startsAt: byId("promoStartsAt").value || "",
    endsAt: byId("promoEndsAt").value || ""
  };
  if (promoData.discountType === "percent" && promoData.discountValue > 100) return notify("O desconto percentual não pode passar de 100%.");
  if (promoData.code && promoData.discountType === "none") return notify("Escolha o tipo e o valor do desconto para ativar um cupom.");
  const editId = event.target.dataset.editId;
  const submitButton = byId("promoSubmitButton") || event.target.querySelector("button[type=submit]");
  const originalLabel = submitButton?.textContent || (editId ? "Atualizar promoção" : "Salvar promoção");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = editId ? "Atualizando promoção..." : "Salvando promoção...";
  }
  let syncedOnline = false;
  try {
    if (editId) {
      const promo = promos.find(item => String(item.id) === String(editId));
      if (promo) {
        Object.assign(promo, promoData);
        if (promo.id && window.TokyoDb?.enabled) {
          await window.TokyoDb.updatePromo(promo.id, promo);
          syncedOnline = true;
        }
      }
    } else {
      const promo = { ...promoData, id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() };
      if (window.TokyoDb?.enabled) {
        const savedPromo = await window.TokyoDb.savePromo(promo);
        if (savedPromo?.id) promo.id = savedPromo.id;
        syncedOnline = true;
      }
      promos.unshift(promo);
    }
    savePromos();
    resetPromoForm();
    notify(syncedOnline ? "Promoção salva e sincronizada com o painel online." : "Promoção salva neste dispositivo.", "success");
  } catch (error) {
    savePromos();
    renderPromos();
    notify("A promoção ficou salva neste dispositivo, mas não foi sincronizada online. Verifique a conexão e tente novamente.");
    console.warn("Falha ao sincronizar promoção online.", error);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = event.target.dataset.editId ? "Atualizar promoção" : "Salvar promoção";
    }
  }
});

byId("cancelPromoEdit")?.addEventListener("click", resetPromoForm);

byId("addCustomer").addEventListener("click", () => openCustomerEditor());
byId("cancelCustomer").addEventListener("click", () => {
  byId("customerForm").reset();
  byId("customerKey").value = "";
  byId("customerForm").hidden = true;
});
byId("customerForm").addEventListener("submit", event => {
  event.preventDefault();
  const existingKey = byId("customerKey").value;
  const name = byId("customerNameEdit").value.trim();
  const phone = byId("customerPhoneEdit").value.trim();
  const newKey = customerKey(name, phone);
  const key = newKey || existingKey;

  const previousData = existingKey ? customerProfiles[existingKey] : null;
  const updatedProfile = {
    ...(previousData || {}),
    name,
    phone,
    notes: byId("customerNotesEdit").value.trim(),
    createdAt: previousData?.createdAt || new Date().toISOString()
  };

  if (existingKey && existingKey !== key) {
    delete customerProfiles[existingKey];
    hiddenCustomerKeys = (hiddenCustomerKeys || []).map(k => k === existingKey ? key : k);
  }

  customerProfiles[key] = updatedProfile;
  hiddenCustomerKeys = (hiddenCustomerKeys || []).filter(item => item !== key);
  saveCustomerData();
  event.target.reset();
  byId("customerKey").value = "";
  event.target.hidden = true;
  renderCustomers();
  notify(existingKey ? "Cliente atualizado." : "Cliente cadastrado.", "success");
});
byId("addComplementGroup").addEventListener("click", () => {
  const group = {
    id: Date.now(),
    name: "Nova lista de complemento",
    minQty: 0,
    maxQty: 100,
    active: true,
    linkedProductIds: [],
    items: [{ id: Date.now() + 1, name: "Novo complemento", price: 0, maxQty: 100, cost: 0, description: "", tags: [], active: true }],
    description: "",
    sortOrder: complementGroups.length,
    activeDays: [...DEFAULT_ACTIVE_DAYS],
    tags: []
  };
  complementGroups.unshift(group);
  saveComplements();
  runOnline(() => window.TokyoDb.saveComplement(group), "Falha ao criar complemento online.");
  renderComplements();
});

byId("complementSearch").addEventListener("input", renderComplements);
byId("menuSearch").addEventListener("input", event => {
  menuFilters.search = event.target.value;
  localStorage.setItem(MENU_FILTER_KEY, JSON.stringify(menuFilters));
  renderMenuEditor();
});
byId("menuGroupFilter").addEventListener("change", event => {
  menuFilters.group = event.target.value;
  localStorage.setItem(MENU_FILTER_KEY, JSON.stringify(menuFilters));
  renderMenuEditor();
});
byId("menuStatusFilter").addEventListener("change", event => {
  menuFilters.status = event.target.value;
  localStorage.setItem(MENU_FILTER_KEY, JSON.stringify(menuFilters));
  renderMenuEditor();
});
byId("menuSort").addEventListener("change", event => {
  menuFilters.sort = event.target.value;
  localStorage.setItem(MENU_FILTER_KEY, JSON.stringify(menuFilters));
  renderMenuEditor();
});
byId("orderSearch").addEventListener("input", renderOrders);
byId("orderStatusFilter").addEventListener("change", renderOrders);
byId("customerSearch").addEventListener("input", renderCustomers);
const clearFinanceRange = () => {
  financeRange = "";
  syncFinanceRangeButtons();
  renderReports();
};
byId("reportStart").addEventListener("change", clearFinanceRange);
byId("reportEnd").addEventListener("change", clearFinanceRange);
byId("financeCustomerFilter").addEventListener("input", renderReports);
byId("financeStatusFilter").addEventListener("change", renderReports);
byId("financePaymentFilter").addEventListener("change", renderReports);
byId("financeSourceFilter").addEventListener("change", renderReports);
["financeOnlyDiscount", "financeOnlySurcharge", "financeOnlyPaid", "financeOnlyScheduled"].forEach(id => byId(id).addEventListener("change", renderReports));
byId("exportReport").addEventListener("click", exportReportCsv);
byId("pdvCustomer").addEventListener("input", () => fillPdvCustomer("name"));
byId("pdvCustomer").addEventListener("change", () => fillPdvCustomer("name"));
byId("pdvPhone").addEventListener("input", () => fillPdvCustomer("phone"));
byId("pdvPhone").addEventListener("change", () => fillPdvCustomer("phone"));
[
  "pdvPayment", "pdvAmountReceived"
].forEach(id => {
  byId(id).addEventListener("input", renderPdvPricing);
  byId(id).addEventListener("change", renderPdvPricing);
});
["pdvDiscountType", "pdvDiscountValue", "pdvSurchargeType", "pdvSurchargeValue"].forEach(id => {
  byId(id).addEventListener("input", markPdvAdjustmentsPending);
  byId(id).addEventListener("change", markPdvAdjustmentsPending);
});
byId("pdvApplyAdjustments").addEventListener("click", applyPdvAdjustments);
byId("pdvCouponCode").addEventListener("input", () => {
  pdvAppliedCoupon = null;
  pdvCouponMessage = "";
  renderPdvPricing();
});

byId("menuSearch").value = menuFilters.search || "";
byId("menuStatusFilter").value = menuFilters.status || "all";
byId("menuSort").value = menuFilters.sort || "group";
byId("pdvApplyCoupon").addEventListener("click", applyPdvCoupon);
byId("pdvProductSearch").addEventListener("input", renderPdv);

byId("pdvAddItem").addEventListener("click", () => {
  const product = menu.find(item => String(item.id) === String(byId("pdvProduct").value));
  const qty = Math.max(1, Number(byId("pdvQty").value || 1));
  if (!product) return;
  const groups = pdvProductComplements(product.id);
  const invalid = groups.find(group => pdvSelectedGroupTotal(group.id) < Number(group.minQty || 0));
  if (invalid) return notify(`Escolha pelo menos ${invalid.minQty} adicional(is) em ${invalid.name}.`);
  const options = Object.entries(pdvPendingOptions).flatMap(([key, optionQty]) => {
    const [groupId, itemId] = key.split(":");
    const group = groups.find(item => String(item.id) === String(groupId));
    const option = group?.items?.find(item => String(item.id) === String(itemId));
    return option && optionQty > 0 ? [{ groupId: Number(groupId), groupName: group.name, itemId: Number(itemId), name: option.name, price: Number(option.price || 0), qty: Number(optionQty) }] : [];
  });
  const optionKey = JSON.stringify(options.map(option => [option.groupId, option.itemId, option.qty]).sort());
  const unitExtra = options.reduce((sum, option) => sum + Number(option.price || 0) * Number(option.qty || 0), 0);
  const current = pdvCart.find(item => String(item.id) === String(product.id) && (item.optionKey || "[]") === optionKey);
  if (current) current.qty += qty;
  else pdvCart.push({ id: product.id, name: product.name, price: Number(product.price || 0), qty, options, unitExtra, optionKey });
  byId("pdvQty").value = 1;
  pdvPendingOptions = {};
  renderPdv();
});

byId("pdvForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!pdvCart.length) return notify("Adicione pelo menos um item ao pedido.");
  const pricing = pdvPricing();
  if (pricing.missing) return notify(`Falta receber ${money(pricing.missing)} para concluir o pedido.`);
  const submitButton = event.target.querySelector('button[type="submit"]');
  const order = {
    id: Date.now(), status: "Recebido",
    customerName: byId("pdvCustomer").value.trim(),
    customerPhone: byId("pdvPhone").value.trim(),
    payment: byId("pdvPayment").value,
    paymentStatus: "pending",
    notes: byId("pdvNotes").value.trim(),
    subtotal: pricing.subtotal,
    discountAmount: pricing.discountAmount,
    couponCode: pdvAppliedCoupon ? String(promoField(pdvAppliedCoupon, "code", "code", "")).toUpperCase() : "",
    couponDiscountAmount: pricing.couponDiscountAmount,
    surchargeAmount: pricing.surchargeAmount,
    amountReceived: pricing.amountReceived,
    changeAmount: pricing.change,
    total: pricing.total,
    pricing: {
      discountType: pricing.discountType,
      discountValue: pricing.discountInput,
      surchargeType: pricing.surchargeType,
      surchargeValue: pricing.surchargeInput,
      couponCode: pricing.couponCode || (pdvAppliedCoupon ? String(promoField(pdvAppliedCoupon, "code", "code", "")).toUpperCase() : ""),
      amountReceived: pricing.amountReceived
    },
    items: pdvCart.map(item => ({ ...item })), createdAt: new Date().toISOString(), source: "pdv",
    clientRequestId: window.crypto?.randomUUID?.() || `pdv-${Date.now()}-${Math.random().toString(16).slice(2)}`
  };
  submitButton.disabled = true;
  try {
    if (window.TokyoDb?.enabled) {
      const result = await window.TokyoDb.createOrder(order);
      const persisted = Array.isArray(result) ? result[0] : result;
      if (persisted?.id) order.id = persisted.id;
      if (persisted?.total != null) order.total = Number(persisted.total);
      if (persisted?.items) order.items = persisted.items;
    }
    orders.unshift(order);
    saveOrders();
    rememberPdvCustomer(order.customerName, order.customerPhone);
    pdvCart = [];
    pdvPendingOptions = {};
    pdvAppliedCoupon = null;
    pdvCouponMessage = "";
    pdvAppliedAdjustments = { discountType: "none", discountValue: 0, surchargeType: "none", surchargeValue: 0 };
    pdvAdjustmentMessage = "Digite um ajuste e confirme.";
    event.target.reset();
    renderAll();
    notify("Pedido criado e enviado para a etapa Recebidos.", "success");
    document.querySelector('[data-tab="orders"]').click();
  } catch (error) {
    notify("Não foi possível confirmar o pedido no banco. Nada foi removido do PDV.");
    console.warn("Falha ao salvar pedido do PDV online.", error);
  } finally {
    submitButton.disabled = false;
  }
});

byId("cashOpenForm").addEventListener("submit", async event => {
  event.preventDefault();
  const opening = 0;
  try {
    cashSession = window.TokyoDb?.enabled
      ? await window.TokyoDb.openCashSession(opening)
      : { open: true, opening, openedAt: new Date().toISOString(), transactions: [] };
  } catch (error) {
    notify("Não foi possível abrir o caixa no banco. Verifique se o schema atualizado foi aplicado.");
    console.warn("Falha ao abrir caixa online.", error);
    return;
  }
  saveCashSession();
  renderCash();
  notify("Caixa aberto e pronto para registrar movimentos.", "success");
});

byId("cashEntryForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!cashSession.open) return notify("Abra o caixa antes de registrar movimentos.");
  const movement = {
    id: Date.now(),
    type: byId("cashEntryType").value,
    description: byId("cashEntryDescription").value.trim(),
    value: Number(byId("cashEntryValue").value || 0),
    createdAt: new Date().toISOString()
  };
  if (!movement.value || movement.value <= 0) return notify("Informe um valor maior que zero.");
  try {
    const persisted = window.TokyoDb?.enabled
      ? await window.TokyoDb.recordCashMovement(cashSession.id, movement)
      : movement;
    cashSession.transactions = cashSession.transactions || [];
    cashSession.transactions.unshift(persisted || movement);
  } catch (error) {
    notify("Não foi possível registrar o movimento no banco.");
    console.warn("Falha ao registrar movimento de caixa online.", error);
    return;
  }
  saveCashSession();
  event.target.reset();
  renderCash();
  notify("Movimento registrado no caixa.", "success");
});

byId("closeCash").addEventListener("click", async () => {
  if (!await askConfirm("O caixa será encerrado e o valor contado ficará registrado no fechamento.", { title: "Fechar caixa?", confirmLabel: "Fechar caixa" })) return;
  const counted = Number(byId("cashCounted").value || 0);
  if (counted < 0) return notify("O valor contado não pode ser negativo.");
  try {
    if (window.TokyoDb?.enabled) {
      const previousTransactions = cashSession.transactions || [];
      cashSession = { ...(await window.TokyoDb.closeCashSession(cashSession.id, counted)), transactions: previousTransactions };
    } else {
      const todaySales = orders.filter(order => localDateKey(order.createdAt) === todayKey() && order.status !== "Cancelado").reduce((sum, order) => sum + Number(order.total || 0), 0);
      const entries = (cashSession.transactions || []).filter(item => item.type === "entrada").reduce((sum, item) => sum + Number(item.value || 0), 0);
      const exits = (cashSession.transactions || []).filter(item => item.type === "saida").reduce((sum, item) => sum + Number(item.value || 0), 0);
      cashSession = { ...cashSession, open: false, closedAt: new Date().toISOString(), countedAmount: counted, expectedAmount: Number(cashSession.opening || 0) + todaySales + entries - exits, difference: counted - (Number(cashSession.opening || 0) + todaySales + entries - exits) };
    }
  } catch (error) {
    notify("Não foi possível fechar o caixa no banco.");
    console.warn("Falha ao fechar caixa online.", error);
    return;
  }
  saveCashSession();
  byId("cashCounted").value = "0";
  renderCash();
  notify("Caixa fechado com o valor contado registrado.", "success");
});

byId("refreshPdvFlow").addEventListener("click", () => {
  refreshOrders();
  renderPdvFlow();
});

document.body.addEventListener("input", event => {
  const field = event.target.dataset.menuField;
  if (!field) return;
  scheduleProductSave(Number(event.target.dataset.index));
});

async function unlockAdmin() {
  if (LOCAL_PREVIEW_MODE) {
    window.TokyoDb.enabled = false;
    document.body.classList.remove("admin-locked");
    byId("previewBanner").hidden = false;
    if (!byId("reportStart").value && !byId("reportEnd").value) {
      const today = new Date();
      byId("reportStart").value = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1).toISOString());
      byId("reportEnd").value = todayKey();
    }
    renderAll();
    return true;
  }
  if (!window.TokyoDb?.enabled) {
    byId("loginMessage").textContent = "Supabase não configurado.";
    return false;
  }
  if (!window.TokyoDb.hasAdminSession() || !(await window.TokyoDb.validateAdminSession())) {
    document.body.classList.add("admin-locked");
    byId("loginMessage").textContent = "Conta sem acesso de administrador ou sessão expirada.";
    return false;
  }
  document.body.classList.remove("admin-locked");
  if (!byId("reportStart").value && !byId("reportEnd").value) {
    const today = new Date();
    byId("reportStart").value = localDateKey(new Date(today.getFullYear(), today.getMonth(), 1).toISOString());
    byId("reportEnd").value = todayKey();
  }
  renderAll();
  await loadOnlineData();
  await refreshPushSubscriptionState();
  await ensureAdminPushSubscription();
  refreshPushSubscriptionState();
  renderAll();
  startOrderRefresh();
  return true;
}

async function initAdminLogin() {
  let authMode = "login";
  let recoveryToken = "";
  // O Supabase deste projeto é compartilhado com a Audiometria. O callback
  // precisa permanecer no Admin do domínio em que o operador iniciou o reset.
  const adminRecoveryRedirect = new URL("admin.html", window.location.origin).href;
  const loginTitle = byId("loginScreen").querySelector("h1");
  const loginDescription = byId("loginScreen").querySelector(".login-card > p");
  const loginButton = byId("loginButton");
  const signupModeButton = byId("signupModeButton");
  const forgotPasswordButton = byId("forgotPasswordButton");
  const authHelper = byId("authHelper");
  const emailInput = byId("adminEmail");
  const passwordInput = byId("adminPassword");
  const setAuthMode = mode => {
    authMode = mode;
    const signup = mode === "signup";
    const forgot = mode === "forgot";
    const recovery = mode === "recovery";
    loginTitle.textContent = signup ? "Criar acesso" : recovery ? "Definir nova senha" : forgot ? "Recuperar acesso" : "Administração";
    loginDescription.textContent = signup
      ? "Crie seu acesso com e-mail e senha. A conta só entra após ser autorizada como administradora."
      : recovery
        ? "Escolha uma nova senha para voltar a acessar o painel."
        : forgot
          ? "Informe seu e-mail e enviaremos um link para criar uma nova senha."
          : "Entre para acessar pedidos, cardápio e relatórios.";
    loginButton.textContent = signup ? "Criar conta" : recovery ? "Salvar nova senha" : forgot ? "Enviar recuperação" : "Entrar";
    signupModeButton.textContent = signup ? "Já tenho uma conta" : "Criar uma conta nova";
    signupModeButton.hidden = forgot || recovery;
    forgotPasswordButton.hidden = signup || forgot || recovery;
    authHelper.textContent = signup
      ? "Use um e-mail que você consiga confirmar."
      : recovery
        ? "Depois, entre novamente com seu e-mail e a nova senha."
        : forgot
          ? "Se o e-mail estiver cadastrado, o link chegará em alguns instantes."
          : "Use seu e-mail e sua senha para acessar o painel.";
    emailInput.hidden = recovery;
    emailInput.required = !recovery;
    passwordInput.hidden = forgot;
    passwordInput.required = !forgot;
    passwordInput.autocomplete = signup || recovery ? "new-password" : "current-password";
    byId("loginMessage").textContent = "";
  };
  signupModeButton.addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login"));
  forgotPasswordButton.addEventListener("click", () => setAuthMode("forgot"));
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const recoveryParams = hashParams.has("access_token") ? hashParams : queryParams;
  if (LOCAL_PREVIEW_MODE) {
    await unlockAdmin();
    return;
  }
  if (recoveryParams.get("type") === "recovery" && recoveryParams.get("access_token")) {
    recoveryToken = recoveryParams.get("access_token");
    setAuthMode("recovery");
  }
  if (window.TokyoDb?.hasAdminSession()) {
    if (await unlockAdmin()) return;
  }

  byId("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const button = byId("loginButton");
    if ((authMode !== "recovery" && !email) || (authMode !== "forgot" && !password)) return;
    button.disabled = true;
    byId("loginMessage").textContent = authMode === "signup" ? "Criando conta..." : authMode === "forgot" ? "Enviando recuperação..." : authMode === "recovery" ? "Atualizando senha..." : "Entrando...";
    try {
      if (authMode === "forgot") {
        await window.TokyoDb.requestAdminPasswordReset(email, adminRecoveryRedirect);
        setAuthMode("login");
        byId("loginMessage").textContent = "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.";
        return;
      }
      if (authMode === "recovery") {
        await window.TokyoDb.updateAdminPassword(recoveryToken, password);
        recoveryToken = "";
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        setAuthMode("login");
        passwordInput.value = "";
        byId("loginMessage").textContent = "Senha atualizada. Entre com seu e-mail e a nova senha.";
        return;
      }
      if (authMode === "signup") {
        const data = await window.TokyoDb.signUpAdmin(email, password);
        if (!data?.access_token) {
          setAuthMode("login");
          byId("loginMessage").textContent = "Conta criada. Confirme o e-mail recebido e depois entre com sua senha.";
          return;
        }
      } else {
        await window.TokyoDb.signInAdmin(email, password);
      }
      if (!(await unlockAdmin())) byId("loginMessage").textContent = "Conta autenticada, mas ainda não autorizada no painel. Registre este usuário em tks_admins.";
    } catch (error) {
      byId("loginMessage").textContent = error.message || "Não foi possível entrar.";
      if (!passwordInput.hidden) passwordInput.select();
    } finally {
      button.disabled = false;
    }
  });

}

byId("logoutAdmin").addEventListener("click", async () => {
  await window.TokyoDb?.signOutAdmin();
  location.reload();
});

byId("toggleMetricsVisibility").addEventListener("click", () => {
  metricsHidden = !metricsHidden;
  localStorage.setItem(METRICS_VISIBILITY_KEY, String(metricsHidden));
  renderMetrics();
});

setupAdminPwa();
initAdminLogin();
