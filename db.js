(() => {
  const cfg = window.TOKYO_CONFIG || {};
  const tables = {
    products: "tks_products",
    orders: "tks_orders",
    promos: "tks_promos",
    complements: "tks_complements",
    settings: "tks_settings",
    cashSessions: "tks_cash_sessions",
    cashMovements: "tks_cash_movements",
    expenses: "tks_expenses",
    dailyRevenues: "tks_finance_daily_revenues",
    pushSubscriptions: "tks_push_subscriptions",
    ...(cfg.tables || {})
  };
  const enabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const baseUrl = String(cfg.supabaseUrl || "").replace(/\/$/, "");
  const SESSION_KEY = "tokyoAdminSession";
  let session = readSession();

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSession(nextSession) {
    session = nextSession || null;
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function requestHeaders(options = {}) {
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${session?.access_token || cfg.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    };
  }

  async function refreshAdminSession() {
    if (!enabled || !session?.refresh_token) return false;
    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!response.ok) {
      writeSession(null);
      return false;
    }
    writeSession(await response.json());
    return true;
  }

  async function request(path, options = {}, canRefresh = true) {
    if (!enabled) throw new Error("Supabase nao configurado");
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: requestHeaders(options),
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (response.status === 401 && canRefresh && await refreshAdminSession()) {
      return request(path, options, false);
    }
    if (!response.ok) throw new Error(await response.text());
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function signInAdmin(email, password) {
    if (!enabled) throw new Error("Supabase nao configurado");
    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || data.msg || "Não foi possível entrar.");
    writeSession(data);
    return data;
  }

  async function signUpAdmin(email, password) {
    if (!enabled) throw new Error("Supabase nao configurado");
    const response = await fetch(`${baseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.error_description || "Não foi possível criar a conta.");
    if (data.access_token) writeSession(data);
    return data;
  }

  async function requestAdminPasswordReset(email, redirectTo) {
    if (!enabled) throw new Error("Supabase nao configurado");
    const params = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    const response = await fetch(`${baseUrl}/auth/v1/recover${params}`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429 || /rate limit/i.test(String(data.msg || data.error_description || ""))) {
      throw new Error("O limite de e-mails de recuperação foi atingido. Aguarde até 1 hora antes de solicitar outro link e use o e-mail mais recente recebido.");
    }
    if (!response.ok) throw new Error(data.msg || data.error_description || "Não foi possível enviar a recuperação.");
    return data;
  }

  async function updateAdminPassword(accessToken, password) {
    if (!enabled || !accessToken) throw new Error("Link de recuperação inválido ou expirado.");
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.error_description || "Não foi possível atualizar a senha.");
    return data;
  }

  async function validateAdminSession() {
    if (!enabled || !session?.access_token) return false;
    const userResponse = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`
      }
    });
    if (!userResponse.ok) {
      if (userResponse.status === 401 && await refreshAdminSession()) return validateAdminSession();
      writeSession(null);
      return false;
    }

    const roleResponse = await fetch(`${baseUrl}/rest/v1/rpc/tks_is_admin`, {
      method: "POST",
      headers: requestHeaders({ prefer: "return=representation" }),
      body: "{}"
    });
    if (roleResponse.status === 401 && await refreshAdminSession()) return validateAdminSession();
    if (!roleResponse.ok) return false;
    return (await roleResponse.json()) === true;
  }

  async function signOutAdmin() {
    if (enabled && session?.access_token) {
      await fetch(`${baseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`
        }
      }).catch(() => {});
    }
    writeSession(null);
  }

  function productFromDb(row) {
    return {
      id: row.id,
      cat: row.cat,
      name: row.name,
      desc: row.description || "",
      price: Number(row.price || 0),
      image: row.image_url || "",
      active: row.active !== false,
      sortOrder: row.sort_order || 0,
      archived: Boolean(row.archived_at),
      activeDays: Array.isArray(row.active_days) ? row.active_days : [0, 1, 2, 3, 4, 5, 6],
      channels: row.channels || { retirada: true, delivery: false, mesa: false },
      badges: row.badges || {},
      highlight: row.highlight === true,
      secondaryImages: Array.isArray(row.secondary_images) ? row.secondary_images : [],
      tags: Array.isArray(row.tags) ? row.tags : [],
      internalCode: row.internal_code || "",
      cost: Number(row.cost || 0),
      fromPrice: row.from_price == null ? "" : Number(row.from_price),
      strikePrice: row.strike_price == null ? "" : Number(row.strike_price),
      stockControlled: row.stock_controlled === true,
      stockQty: row.stock_qty == null ? null : Number(row.stock_qty)
    };
  }

  function productToDb(item, index = 0) {
    return {
      id: Number(item.id),
      cat: item.cat || "Sem categoria",
      name: item.name || "Sem nome",
      description: item.desc || "",
      price: Number(item.price || 0),
      image_url: item.image || "",
      active: item.active !== false,
      sort_order: Number(item.sortOrder ?? index),
      archived_at: item.archived ? (item.archivedAt || new Date().toISOString()) : null,
      active_days: Array.isArray(item.activeDays) ? item.activeDays : [0, 1, 2, 3, 4, 5, 6],
      channels: item.channels || { retirada: true, delivery: false, mesa: false },
      badges: item.badges || {},
      highlight: item.highlight === true,
      secondary_images: Array.isArray(item.secondaryImages) ? item.secondaryImages : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      internal_code: item.internalCode || "",
      cost: Number(item.cost || 0),
      from_price: item.fromPrice === "" || item.fromPrice == null ? null : Number(item.fromPrice),
      strike_price: item.strikePrice === "" || item.strikePrice == null ? null : Number(item.strikePrice),
      stock_controlled: item.stockControlled === true,
      stock_qty: item.stockQty == null || item.stockQty === "" ? null : Math.max(0, Number(item.stockQty))
    };
  }

  function productToLegacyDb(item, index = 0) {
    const row = productToDb(item, index);
    return {
      id: row.id,
      cat: row.cat,
      name: row.name,
      description: row.description,
      price: row.price,
      image_url: row.image_url,
      active: row.active,
      sort_order: row.sort_order
    };
  }

  function orderFromDb(row) {
    const discountAmount = Number(row.discount_amount || 0);
    const surchargeAmount = Number(row.surcharge_amount || 0);
    return {
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      payment: row.payment,
      paymentStatus: row.payment_status === "paid" ? "paid" : "pending",
      notes: row.notes || "",
      subtotal: Number(row.subtotal ?? row.total ?? 0),
      discountAmount,
      couponCode: row.coupon_code || "",
      couponDiscountAmount: Number(row.coupon_discount_amount || 0),
      surchargeAmount,
      amountReceived: row.amount_received == null ? null : Number(row.amount_received),
      changeAmount: Number(row.change_amount || 0),
      total: Number(row.total || 0),
      items: row.items || [],
      pricing: {
        discountType: discountAmount > 0 ? "fixed" : "none",
        discountValue: discountAmount,
        surchargeType: surchargeAmount > 0 ? "fixed" : "none",
        surchargeValue: surchargeAmount,
        couponCode: row.coupon_code || "",
        amountReceived: row.amount_received == null ? null : Number(row.amount_received)
      },
      source: row.order_source || "public",
      clientRequestId: row.client_request_id || "",
      archivedAt: row.archived_at || null
    };
  }

  function orderToDb(order) {
    return {
      id: Number(order.id),
      status: order.status || "Recebido",
      customer_name: order.customerName || "",
      customer_phone: order.customerPhone || "",
      payment: order.payment || "",
      payment_status: order.paymentStatus === "paid" ? "paid" : "pending",
      notes: order.notes || "",
      pricing: order.pricing ? {
        discount_type: order.pricing.discountType || "none",
        discount_value: Number(order.pricing.discountValue || 0),
        surcharge_type: order.pricing.surchargeType || "none",
        surcharge_value: Number(order.pricing.surchargeValue || 0),
        coupon_code: order.pricing.couponCode || "",
        amount_received: order.pricing.amountReceived == null ? "" : Number(order.pricing.amountReceived)
      } : {},
      total: Number(order.total || 0),
      items: order.items || [],
      order_source: order.source || "public",
      client_request_id: order.clientRequestId || null,
      created_at: order.createdAt || new Date().toISOString()
    };
  }

  function complementFromDb(row) {
    return {
      id: row.id,
      name: row.name || "",
      minQty: Number(row.min_qty || 0),
      maxQty: Number(row.max_qty || 100),
      active: row.active !== false,
      linkedProductIds: row.linked_product_ids || [],
      items: row.items || [],
      description: row.description || "",
      sortOrder: Number(row.sort_order || 0),
      activeDays: Array.isArray(row.active_days) ? row.active_days : [0, 1, 2, 3, 4, 5, 6],
      tags: Array.isArray(row.tags) ? row.tags : []
    };
  }

  function complementToDb(group) {
    return {
      id: Number(group.id),
      name: group.name || "Lista de complemento",
      min_qty: Number(group.minQty || 0),
      max_qty: Number(group.maxQty || 100),
      active: group.active !== false,
      linked_product_ids: group.linkedProductIds || [],
      items: group.items || [],
      description: group.description || "",
      sort_order: Number(group.sortOrder || 0),
      active_days: Array.isArray(group.activeDays) ? group.activeDays : [0, 1, 2, 3, 4, 5, 6],
      tags: Array.isArray(group.tags) ? group.tags : []
    };
  }

  function promoFromDb(row) {
    return {
      id: row.id,
      title: row.title || "",
      text: row.text || "",
      code: row.code || "",
      discountType: row.discount_type || "none",
      discountValue: Number(row.discount_value || 0),
      active: row.active !== false,
      startsAt: row.starts_at || "",
      endsAt: row.ends_at || "",
      createdAt: row.created_at || ""
    };
  }

  function complementToLegacyDb(group) {
    const row = complementToDb(group);
    return {
      id: row.id,
      name: row.name,
      min_qty: row.min_qty,
      max_qty: row.max_qty,
      active: row.active,
      linked_product_ids: row.linked_product_ids,
      items: row.items
    };
  }

  function promoToDb(promo) {
    return {
      title: promo.title || "",
      text: promo.text || "",
      code: String(promo.code || "").trim().toUpperCase() || null,
      discount_type: promo.discountType || "none",
      discount_value: Number(promo.discountValue || 0),
      active: promo.active !== false,
      starts_at: promo.startsAt || null,
      ends_at: promo.endsAt || null,
      created_at: promo.createdAt || promo.created_at || new Date().toISOString()
    };
  }

  function cashMovementFromDb(row) {
    return {
      id: row.id,
      type: row.type,
      description: row.description || "",
      value: Number(row.amount ?? row.value ?? 0),
      createdAt: row.created_at || row.createdAt
    };
  }

  function cashSessionFromDb(row, transactions = []) {
    if (!row) return { open: false, opening: 0, transactions: [] };
    return {
      id: row.id,
      open: row.open != null ? Boolean(row.open) : row.status === "open",
      opening: Number(row.opening ?? row.opening_amount ?? 0),
      openedAt: row.openedAt || row.opened_at,
      closedAt: row.closedAt || row.closed_at || null,
      countedAmount: row.countedAmount != null ? Number(row.countedAmount) : row.counted_amount == null ? null : Number(row.counted_amount),
      expectedAmount: row.expectedAmount != null ? Number(row.expectedAmount) : row.expected_amount == null ? null : Number(row.expected_amount),
      difference: row.difference == null ? null : Number(row.difference),
      transactions: transactions.length ? transactions : (row.transactions || []).map(cashMovementFromDb)
    };
  }

  function expenseFromDb(row) {
    return {
      id: row.id,
      expenseDate: row.expense_date || "",
      description: row.description || "",
      category: row.category || "Outros",
      supplier: row.supplier || "",
      amount: Number(row.amount || 0),
      notes: row.notes || "",
      source: row.source || "manual",
      sourceRecordId: row.source_record_id || null,
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function expenseToDb(expense) {
    return {
      id: expense.id,
      expense_date: expense.expenseDate || null,
      description: expense.description || "",
      category: expense.category || "Outros",
      supplier: expense.supplier || "",
      amount: Number(expense.amount || 0),
      notes: expense.notes || "",
      source: expense.source || "manual",
      source_record_id: expense.sourceRecordId || null,
      created_at: expense.createdAt || new Date().toISOString(),
      updated_at: expense.updatedAt || new Date().toISOString()
    };
  }

  function dailyRevenueFromDb(row) {
    return {
      id: row.id,
      revenueDate: row.revenue_date || "",
      revenue: Number(row.revenue || 0),
      orders: Number(row.orders || 0),
      source: row.source || "manual",
      sourceRecordId: row.source_record_id || null,
      notes: row.notes || "",
      createdAt: row.created_at || ""
    };
  }

  window.TokyoDb = {
    enabled,
    hasAdminSession: () => Boolean(session?.access_token),
    signInAdmin,
    signUpAdmin,
    requestAdminPasswordReset,
    updateAdminPassword,
    validateAdminSession,
    signOutAdmin,
    async loadMenu(defaultMenu, options = {}) {
      if (!enabled) return null;
      const rows = await request(`${tables.products}?select=*&order=sort_order.asc,id.asc`);
      if (rows.length) return rows.map(productFromDb);
      if (options.seed) await this.seedMenu(defaultMenu);
      return defaultMenu.map((item, index) => ({ ...item, active: item.active !== false, sortOrder: index }));
    },
    async seedMenu(defaultMenu) {
      if (!enabled) return;
      try {
        await request(tables.products, {
          method: "POST",
          body: defaultMenu.map(productToDb),
          prefer: "resolution=merge-duplicates,return=minimal"
        });
      } catch (error) {
        if (!/column|schema cache|archived_at|active_days/i.test(String(error?.message || error))) throw error;
        await request(tables.products, {
          method: "POST",
          body: defaultMenu.map(productToLegacyDb),
          prefer: "resolution=merge-duplicates,return=minimal"
        });
      }
    },
    async saveProduct(item, index = 0) {
      if (!enabled) return;
      try {
        await request(tables.products, {
          method: "POST",
          body: productToDb(item, index),
          prefer: "resolution=merge-duplicates,return=minimal"
        });
      } catch (error) {
        if (!/column|schema cache|archived_at|active_days/i.test(String(error?.message || error))) throw error;
        await request(tables.products, {
          method: "POST",
          body: productToLegacyDb(item, index),
          prefer: "resolution=merge-duplicates,return=minimal"
        });
      }
    },
    async deleteProduct(id) {
      if (!enabled) return;
      try {
        await request(`${tables.products}?id=eq.${id}`, {
          method: "PATCH",
          body: { active: false, archived_at: new Date().toISOString() },
          prefer: "return=minimal"
        });
      } catch (error) {
        if (!/column|schema cache|archived_at/i.test(String(error?.message || error))) throw error;
        await request(`${tables.products}?id=eq.${id}`, { method: "PATCH", body: { active: false }, prefer: "return=minimal" });
      }
    },
    async createOrder(order) {
      if (!enabled) return;
      return request("rpc/tks_create_order", {
        method: "POST",
        body: { p_order: orderToDb(order) },
        prefer: "return=representation"
      });
    },
    async updateOrder(order) {
      if (!enabled) return null;
      const rows = await request("rpc/tks_update_order", {
        method: "POST",
        body: { p_order_id: Number(order.id), p_order: orderToDb(order) },
        prefer: "return=representation"
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row?.id ? orderFromDb(row) : null;
    },
    async loadOrders() {
      if (!enabled) return null;
      const rows = await request(`${tables.orders}?select=*&archived_at=is.null&order=created_at.desc`);
      return rows.map(orderFromDb);
    },
    async loadExpenses() {
      if (!enabled) return null;
      const rows = await request(`${tables.expenses}?select=*&order=expense_date.desc,created_at.desc`);
      return rows.map(expenseFromDb);
    },
    async saveExpense(expense) {
      if (!enabled) return;
      await request(tables.expenses, {
        method: "POST",
        body: expenseToDb(expense),
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    },
    async deleteExpense(id) {
      if (!enabled) return;
      await request(`${tables.expenses}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async loadDailyRevenues() {
      if (!enabled) return null;
      const rows = await request(`${tables.dailyRevenues}?select=*&order=revenue_date.desc`);
      return rows.map(dailyRevenueFromDb);
    },
    async updateOrderStatus(id, status) {
      if (!enabled) return;
      await request(`${tables.orders}?id=eq.${id}`, { method: "PATCH", body: { status }, prefer: "return=minimal" });
    },
    async updateOrderPaymentStatus(id, paymentStatus) {
      if (!enabled) return;
      await request(`${tables.orders}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { payment_status: paymentStatus === "paid" ? "paid" : "pending" },
        prefer: "return=minimal"
      });
    },
    async archiveOrder(id) {
      if (!enabled) return;
      await request(`${tables.orders}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { archived_at: new Date().toISOString() },
        prefer: "return=minimal"
      });
    },
    async archiveOrdersByStatus(statuses) {
      if (!enabled) return;
      await Promise.all(statuses.map(status => request(`${tables.orders}?status=eq.${encodeURIComponent(status)}`, {
        method: "PATCH",
        body: { archived_at: new Date().toISOString() },
        prefer: "return=minimal"
      })));
    },
    async loadPromos() {
      if (!enabled) return null;
      const rows = await request(`${tables.promos}?select=*&order=created_at.desc`);
      return rows.map(promoFromDb);
    },
    async savePromo(promo) {
      if (!enabled) return;
      const rows = await request(tables.promos, { method: "POST", body: promoToDb(promo), prefer: "return=representation" });
      return Array.isArray(rows) && rows[0] ? promoFromDb(rows[0]) : null;
    },
    async updatePromo(id, promo) {
      if (!enabled) return;
      await request(`${tables.promos}?id=eq.${id}`, { method: "PATCH", body: promoToDb(promo), prefer: "return=minimal" });
    },
    async deletePromo(id) {
      if (!enabled) return;
      await request(`${tables.promos}?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async loadComplements(defaultComplements = [], options = {}) {
      if (!enabled) return [];
      const rows = await request(`${tables.complements}?select=*&order=id.asc`);
      if (!rows.length && defaultComplements.length) {
        if (options.seed) await Promise.all(defaultComplements.map(group => this.saveComplement(group)));
        return defaultComplements;
      }
      const groups = rows.map(complementFromDb);
      const missing = defaultComplements.filter(defaultGroup => !groups.some(group => String(group.id) === String(defaultGroup.id)));
      if (missing.length && options.seed) {
        await Promise.all(missing.map(group => this.saveComplement(group)));
        return [...groups, ...missing];
      }
      return groups;
    },
    async saveComplement(group) {
      if (!enabled) return;
      try {
        await request(tables.complements, {
          method: "POST",
          body: complementToDb(group),
          prefer: "resolution=merge-duplicates,return=minimal"
        });
      } catch (error) {
        if (!/column|schema cache|description|sort_order|active_days/i.test(String(error?.message || error))) throw error;
        await request(tables.complements, {
          method: "POST",
          body: complementToLegacyDb(group),
          prefer: "resolution=merge-duplicates,return=minimal"
        });
      }
    },
    async deleteComplement(id) {
      if (!enabled) return;
      await request(`${tables.complements}?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async loadSetting(key, fallback = null) {
      if (!enabled) return fallback;
      const rows = await request(`${tables.settings}?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
      return rows[0]?.value ?? fallback;
    },
    async saveSetting(key, value) {
      if (!enabled) return;
      await request(tables.settings, {
        method: "POST",
        body: { key, value },
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    },
    async savePushSubscription(subscription) {
      if (!enabled || !session?.access_token || !subscription?.endpoint) throw new Error("Painel não autenticado para ativar alertas.");
      const keys = subscription.keys || {};
      if (!keys.p256dh || !keys.auth) throw new Error("O navegador não forneceu as chaves da inscrição Push.");
      const userId = session?.user?.id || session?.user_id;
      if (!userId) throw new Error("A sessão do painel não informou o administrador deste dispositivo. Entre novamente.");
      const payload = {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        expiration_time: subscription.expirationTime == null ? null : Number(subscription.expirationTime),
        user_agent: navigator.userAgent.slice(0, 500)
      };
      try {
        const userFilter = encodeURIComponent(userId);
        const endpointFilter = encodeURIComponent(subscription.endpoint);
        const existing = await request(`${tables.pushSubscriptions}?user_id=eq.${userFilter}&endpoint=eq.${endpointFilter}&select=id&limit=1`);
        if (existing[0]?.id) {
          await request(`${tables.pushSubscriptions}?id=eq.${encodeURIComponent(existing[0].id)}`, {
            method: "PATCH",
            body: payload,
            prefer: "return=minimal"
          });
        } else {
          await request(tables.pushSubscriptions, {
            method: "POST",
            body: payload,
            prefer: "return=minimal"
          });
        }
      } catch (error) {
        const details = String(error?.message || error);
        if (/PGRST205|relation .* does not exist|schema cache|Could not find the table/i.test(details)) {
          throw new Error("O banco ainda não recebeu a configuração de alertas Push. Aplique a migration do sistema e tente novamente.");
        }
        if (/42501|permission denied|row-level security|violates row-level security/i.test(details)) {
          throw new Error("O dispositivo foi autorizado, mas o banco recusou o cadastro desta assinatura. Atualize o painel e entre novamente para tentar de novo.");
        }
        throw error;
      }
    },
    async deletePushSubscription(endpoint) {
      if (!enabled || !session?.access_token || !endpoint) return;
      await request(`${tables.pushSubscriptions}?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
    },
    async loadCashSession() {
      if (!enabled) return { open: false, opening: 0, transactions: [] };
      const rows = await request(`${tables.cashSessions}?select=*&status=eq.open&order=opened_at.desc&limit=1`);
      const row = rows[0];
      if (!row) return { open: false, opening: 0, transactions: [] };
      const movements = await request(`${tables.cashMovements}?select=*&session_id=eq.${encodeURIComponent(row.id)}&order=created_at.desc`);
      return cashSessionFromDb(row, movements.map(cashMovementFromDb));
    },
    async openCashSession(opening = 0) {
      if (!enabled) return null;
      const result = await request("rpc/tks_open_cash_session", {
        method: "POST",
        body: { p_opening_amount: Number(opening || 0) },
        prefer: "return=representation"
      });
      return cashSessionFromDb(result);
    },
    async recordCashMovement(sessionId, movement) {
      if (!enabled) return null;
      const result = await request("rpc/tks_record_cash_movement", {
        method: "POST",
        body: {
          p_session_id: Number(sessionId),
          p_type: movement.type,
          p_amount: Number(movement.value || 0),
          p_description: movement.description || ""
        },
        prefer: "return=representation"
      });
      return cashMovementFromDb(result);
    },
    async closeCashSession(sessionId, countedAmount) {
      if (!enabled) return null;
      const result = await request("rpc/tks_close_cash_session", {
        method: "POST",
        body: {
          p_session_id: Number(sessionId),
          p_counted_amount: Number(countedAmount || 0)
        },
        prefer: "return=representation"
      });
      return cashSessionFromDb(result, (result.transactions || []).map(cashMovementFromDb));
    }
  };
})();
