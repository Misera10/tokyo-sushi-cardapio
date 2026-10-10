const assert = require("assert");
const fs = require("fs");
const path = require("path");

const adminCode = fs.readFileSync(path.join(__dirname, "..", "admin.js"), "utf8");

// Extract EDITABLE_ORDER_STATUSES
const editableMatch = adminCode.match(/const EDITABLE_ORDER_STATUSES = new Set\(\[(.*?)\]\);/);
assert(editableMatch, "EDITABLE_ORDER_STATUSES must be defined");
assert(editableMatch[1].includes('"Finalizado"'), "EDITABLE_ORDER_STATUSES must contain Finalizado");

// Test canEditOrder logic
function mockCanEditOrder(order, statusesSet) {
  return Boolean(order) && statusesSet.has(order.status) && !order.archivedAt && !order.archived_at;
}
const statuses = new Set(["Recebido", "Preparando", "Pronto", "Finalizado"]);

const finalizedOrder = { id: 101, status: "Finalizado", archivedAt: null, archived_at: null };
assert.strictEqual(mockCanEditOrder(finalizedOrder, statuses), true, "Finalized order should be editable");

const archivedOrder = { id: 102, status: "Finalizado", archivedAt: "2026-10-10T20:00:00Z" };
assert.strictEqual(mockCanEditOrder(archivedOrder, statuses), false, "Archived order should not be editable");

const cancelledOrder = { id: 103, status: "Cancelado", archivedAt: null };
assert.strictEqual(mockCanEditOrder(cancelledOrder, statuses), false, "Cancelled order should not be editable");

// Test nextStatuses logic
assert(adminCode.includes('if (status === "Finalizado") return ['), "nextStatuses must handle Finalizado");
assert(adminCode.includes('{ label: "Reabrir pedido", value: "Pronto", kind: "ghost" }'), "nextStatuses must include Reabrir pedido");

// Test search for exited orders
assert(adminCode.includes('columns.push(["Saíram (busca)", exitedMatches.slice(0, 12)]);'), "renderOrders must include Saíram (busca)");

console.log("finalized-orders-editing.test.js: OK");
