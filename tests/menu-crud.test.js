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

// 1. Verificações de estrutura no db.js
assert.ok(db.includes("async deleteProduct(id)"), "db.js deve conter a função deleteProduct");
assert.ok(db.includes("method: \"DELETE\""), "deleteProduct deve disparar requisição DELETE");

// 2. Verificações de elementos no admin.html
assert.ok(adminHtml.includes('id="productModalOverlay"'), "admin.html deve conter o modal de produto");
assert.ok(adminHtml.includes('id="categoryModalOverlay"'), "admin.html deve conter o modal de categorias");
assert.ok(adminHtml.includes('id="prodSaveBtn"'), "admin.html deve ter botão explícito de Salvar item");
assert.ok(adminHtml.includes('id="prodDeleteBtn"'), "admin.html deve ter botão explícito de Excluir item");
assert.ok(adminHtml.includes('id="catSaveBtn"'), "admin.html deve ter botão explícito de Salvar categoria");
assert.ok(adminHtml.includes('id="openCategoryManagerBtn"'), "admin.html deve ter botão para gerenciar categorias");
assert.ok(adminHtml.includes('id="prodStrikePrice"'), "admin.html deve ter campo de preço riscado para promoções");
assert.ok(adminHtml.includes('id="prodBadgePromo"'), "admin.html deve ter checkbox de etiqueta Promoção");

// 3. Verificações de lógica no admin.js
assert.ok(admin.includes("openProductModal"), "admin.js deve ter openProductModal");
assert.ok(admin.includes("closeProductModal"), "admin.js deve ter closeProductModal");
assert.ok(admin.includes("saveProductModal"), "admin.js deve ter saveProductModal");
assert.ok(admin.includes("deleteProductDirect"), "admin.js deve ter deleteProductDirect");
assert.ok(admin.includes("openCategoryModal"), "admin.js deve ter openCategoryModal");
assert.ok(admin.includes("saveCategoryFromForm"), "admin.js deve ter saveCategoryFromForm");
assert.ok(admin.includes("deleteCategory"), "admin.js deve ter deleteCategory");

// 4. Teste funcional de normalização de grupos e ordenação
const sandbox = {
  menu: [
    { id: 101, name: "Combo Relâmpago", cat: "Promoção Relâmpago", price: 39.9, strikePrice: 59.9, active: true },
    { id: 102, name: "Temaki Especial", cat: "Entradas", price: 25.0, active: true }
  ],
  menuGroups: [
    { id: "g1", name: "Promoção Relâmpago", sortOrder: 0, active: true, description: "Ofertas hoje" },
    { id: "g2", name: "Entradas", sortOrder: 1, active: true, description: "" }
  ],
  publicMenuGroups: [
    { id: "g1", name: "Promoção Relâmpago", sortOrder: 0, active: true },
    { id: "g2", name: "Entradas", sortOrder: 1, active: true }
  ]
};

vm.createContext(sandbox);
vm.runInContext(extractFunction(admin, "normalizeMenuGroups"), sandbox);
const normalized = vm.runInContext("normalizeMenuGroups(menuGroups, menu)", sandbox);
assert.equal(normalized[0].name, "Promoção Relâmpago", "Primeiro grupo deve ser Promoção Relâmpago");
assert.equal(normalized[1].name, "Entradas", "Segundo grupo deve ser Entradas");

// 5. Teste funcional de ordenação no cardápio público (app.js)
vm.runInContext(extractFunction(app, "getOrderedCategories"), sandbox);
const ordered = vm.runInContext("getOrderedCategories(menu)", sandbox);
assert.deepEqual(Array.from(ordered), ["Promoção Relâmpago", "Entradas"], "Cardápio público deve listar Promoção Relâmpago no topo");

console.log("menu-crud.test.js: OK - Todos os testes de CRUD de produtos e categorias passaram!");
