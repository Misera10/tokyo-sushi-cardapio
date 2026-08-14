import webpush from "web-push";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" }
});

function isAuthorized(request, env) {
  const expected = String(env.TKS_WEBHOOK_SECRET || "");
  const received = request.headers.get("X-TKS-Webhook-Secret") || "";
  return Boolean(expected && received && received === expected);
}

async function supabaseRequest(env, path, options = {}) {
  const url = `${String(env.SUPABASE_URL || "").replace(/\/$/, "")}/rest/v1/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function loadSubscriptions(env) {
  const response = await supabaseRequest(env, "rpc/tks_get_push_subscriptions", {
    method: "POST",
    body: JSON.stringify({ p_secret: env.TKS_WEBHOOK_SECRET })
  });
  if (!response.ok) throw new Error(`Falha ao ler inscrições Push (${response.status}).`);
  const rows = await response.json();
  return rows
    .filter(row => row?.endpoint && row?.p256dh && row?.auth)
    .map(row => ({
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth
      }
    }));
}

async function removeSubscription(env, endpoint) {
  await supabaseRequest(env, "rpc/tks_remove_push_subscription", {
    method: "POST",
    body: JSON.stringify({ p_secret: env.TKS_WEBHOOK_SECRET, p_endpoint: endpoint })
  });
}

async function sendOrderPush(env, order) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const subscriptions = await loadSubscriptions(env);
  const title = "Novo pedido · Tokyo Sushi";
  const body = `${order?.customer_name || "Cliente"} · R$ ${Number(order?.total || 0).toFixed(2).replace(".", ",")} · confira os Recebidos.`;
  const payload = JSON.stringify({
    title,
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: `tokyo-order-${order?.id || "new"}`,
    url: "/admin.html#main-content"
  });

  const results = await Promise.allSettled(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 300, urgency: "high" });
      return { endpoint: subscription.endpoint, delivered: true };
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) await removeSubscription(env, subscription.endpoint);
      return { endpoint: subscription.endpoint, delivered: false, removed: statusCode === 404 || statusCode === 410 };
    }
  }));

  return {
    subscriptions: subscriptions.length,
    delivered: results.filter(result => result.status === "fulfilled" && result.value.delivered).length,
    failed: results.filter(result => result.status !== "fulfilled" || !result.value.delivered).length,
    removed: results.filter(result => result.status === "fulfilled" && result.value.removed).length
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") return json({ ok: true, service: "tokyo-sushi-push" });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
    if (!isAuthorized(request, env)) return json({ error: "Não autorizado." }, 401);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
      return json({ error: "Push server-side não configurado." }, 503);
    }

    try {
      const input = await request.json();
      if (!input?.order?.id) return json({ error: "Pedido ausente." }, 400);
      const result = await sendOrderPush(env, input.order);
      return json({ ok: true, ...result });
    } catch (error) {
      return json({ error: error.message || "Falha ao enviar Push." }, 500);
    }
  }
};
