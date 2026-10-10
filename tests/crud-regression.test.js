const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const admin = fs.readFileSync("admin.js", "utf8");
const adminHtml = fs.readFileSync("admin.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const db = fs.readFileSync("db.js", "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} deve existir`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Não foi possível extrair ${name}`);
}

assert.ok(admin.includes('window.TokyoDb.saveSetting("menu_groups", menuGroups)'), "grupos devem persistir no Supabase");
assert.ok(admin.includes("renamedProducts.push(item)"), "renomear grupo deve rastrear produtos afetados");
assert.ok(admin.includes("renamedProducts.forEach(item => scheduleProductSave(item))"), "renomear grupo deve persistir a categoria dos produtos");
assert.ok(app.includes('window.TokyoDb.loadSetting("menu_groups", publicMenuGroups)'), "cardápio público deve carregar publicação dos grupos");
assert.ok(app.includes("const publishedGroup = isPublicGroupActive(item.cat)"), "produto deve respeitar Publicado do grupo");
assert.ok(app.includes("const products = visibleProducts();"), "navegação pública deve partir apenas de produtos visíveis");

assert.ok(adminHtml.includes('id="pdvPaymentStatus"'), "PDV deve permitir escolher status do pagamento");
assert.ok(admin.includes('paymentStatus: byId("pdvPaymentStatus").value === "paid" ? "paid" : "pending"'), "PDV deve enviar o status escolhido");

const expenseSave = admin.indexOf("if (window.TokyoDb?.enabled) await window.TokyoDb.saveExpense(expense);");
const expenseLocalUpdate = admin.indexOf("if (index >= 0) expenses[index] = expense;", expenseSave);
assert.ok(expenseSave >= 0 && expenseLocalUpdate > expenseSave, "despesa só deve mudar localmente depois da confirmação online");

const expenseDelete = admin.indexOf("if (expense.id && window.TokyoDb?.enabled) await window.TokyoDb.deleteExpense(expense.id);");
const expenseDeleteLocal = admin.indexOf("expenses = expenses.filter", expenseDelete);
assert.ok(expenseDelete >= 0 && expenseDeleteLocal > expenseDelete, "exclusão de despesa só deve mudar localmente depois da confirmação online");

for (const method of [
  "loadMenu", "saveProduct", "createOrder", "updateOrder", "loadOrders",
  "loadExpenses", "saveExpense", "deleteExpense", "loadDailyRevenues",
  "updateOrderStatus", "updateOrderPaymentStatus", "archiveOrder",
  "archiveOrdersByStatus", "loadPromos", "savePromo", "updatePromo",
  "deletePromo", "loadComplements", "saveComplement", "deleteComplement",
  "loadSetting", "saveSetting", "saveOperationSettingsBundle",
  "loadCashSession", "openCashSession", "recordCashMovement", "closeCashSession"
]) {
  assert.ok(db.includes(`async ${method}(`), `TokyoDb deve expor ${method}`);
}
assert.equal(db.includes("async deleteProduct("), false, "API morta deleteProduct não deve voltar");

const sandbox = {
  MENU: [
    { id: 1, name: "Visível", desc: "", cat: "Combos", active: true, archived: false, activeDays: [0, 1, 2, 3, 4, 5, 6], channels: { retirada: true }, stockControlled: false },
    { id: 2, name: "Oculto pelo grupo", desc: "", cat: "Bebidas", active: true, archived: false, activeDays: [0, 1, 2, 3, 4, 5, 6], channels: { retirada: true }, stockControlled: false },
    { id: 3, name: "Sem estoque", desc: "", cat: "Combos", active: true, archived: false, activeDays: [0, 1, 2, 3, 4, 5, 6], channels: { retirada: true }, stockControlled: true, stockQty: 0 }
  ],
  publicMenuGroups: [
    { name: "Combos", active: true },
    { name: "Bebidas", active: false }
  ],
  searchTerm: ""
};
vm.createContext(sandbox);
vm.runInContext(extractFunction(app, "isPublicGroupActive"), sandbox);
vm.runInContext(extractFunction(app, "visibleProducts"), sandbox);
const visible = vm.runInContext("visibleProducts()", sandbox);
assert.deepEqual(Array.from(visible, item => item.id), [1], "grupo não publicado e item sem estoque devem ficar fora do cardápio público");

console.log("crud-regression.test.js: OK");
