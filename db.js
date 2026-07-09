(() => {
  const cfg = window.TOKYO_CONFIG || {};
  const tables = {
    products: "tokyo_products",
    orders: "tokyo_orders",
    promos: "tokyo_promos",
    complements: "tokyo_complements",
    settings: "tokyo_settings",
    ...(cfg.tables || {})
  };
  const enabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const baseUrl = String(cfg.supabaseUrl || "").replace(/\/$/, "");

  async function request(path, options = {}) {
    if (!enabled) throw new Error("Supabase nao configurado");
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) throw new Error(await response.text());
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
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
      sortOrder: row.sort_order || 0
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
      sort_order: Number(item.sortOrder ?? index)
    };
  }

  function orderFromDb(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      payment: row.payment,
      notes: row.notes || "",
      total: Number(row.total || 0),
      items: row.items || []
    };
  }

  function orderToDb(order) {
    return {
      id: Number(order.id),
      status: order.status || "Recebido",
      customer_name: order.customerName || "",
      customer_phone: order.customerPhone || "",
      payment: order.payment || "",
      notes: order.notes || "",
      total: Number(order.total || 0),
      items: order.items || [],
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
      items: row.items || []
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
      items: group.items || []
    };
  }

  window.TokyoDb = {
    enabled,
    async loadMenu(defaultMenu) {
      if (!enabled) return null;
      const rows = await request(`${tables.products}?select=*&order=sort_order.asc,id.asc`);
      if (rows.length) return rows.map(productFromDb);
      await this.seedMenu(defaultMenu);
      return defaultMenu.map((item, index) => ({ ...item, active: item.active !== false, sortOrder: index }));
    },
    async seedMenu(defaultMenu) {
      if (!enabled) return;
      await request(tables.products, {
        method: "POST",
        body: defaultMenu.map(productToDb),
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    },
    async saveProduct(item, index = 0) {
      if (!enabled) return;
      await request(tables.products, {
        method: "POST",
        body: productToDb(item, index),
        prefer: "resolution=merge-duplicates,return=minimal"
      });
    },
    async deleteProduct(id) {
      if (!enabled) return;
      await request(`${tables.products}?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async createOrder(order) {
      if (!enabled) return;
      await request(tables.orders, { method: "POST", body: orderToDb(order), prefer: "return=minimal" });
    },
    async loadOrders() {
      if (!enabled) return null;
      const rows = await request(`${tables.orders}?select=*&order=created_at.desc`);
      return rows.map(orderFromDb);
    },
    async updateOrderStatus(id, status) {
      if (!enabled) return;
      await request(`${tables.orders}?id=eq.${id}`, { method: "PATCH", body: { status }, prefer: "return=minimal" });
    },
    async deleteOrdersByStatus(statuses) {
      if (!enabled) return;
      await Promise.all(statuses.map(status => request(`${tables.orders}?status=eq.${encodeURIComponent(status)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      })));
    },
    async loadPromos() {
      if (!enabled) return null;
      return request(`${tables.promos}?select=*&order=created_at.desc`);
    },
    async savePromo(promo) {
      if (!enabled) return;
      await request(tables.promos, { method: "POST", body: promo, prefer: "return=minimal" });
    },
    async deletePromo(id) {
      if (!enabled) return;
      await request(`${tables.promos}?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async loadComplements(defaultComplements = []) {
      if (!enabled) return [];
      const rows = await request(`${tables.complements}?select=*&order=id.asc`);
      if (!rows.length && defaultComplements.length) {
        await Promise.all(defaultComplements.map(group => this.saveComplement(group)));
        return defaultComplements;
      }
      return rows.map(complementFromDb);
    },
    async saveComplement(group) {
      if (!enabled) return;
      await request(tables.complements, {
        method: "POST",
        body: complementToDb(group),
        prefer: "resolution=merge-duplicates,return=minimal"
      });
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
    }
  };
})();
