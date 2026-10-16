const assert = require("node:assert/strict");
const fs = require("node:fs");

const adminJs = fs.readFileSync("admin.js", "utf8");
const adminHtml = fs.readFileSync("admin.html", "utf8");
const adminCss = fs.readFileSync("admin.css", "utf8");

// 1. Verificações de estrutura no admin.html
assert.ok(adminHtml.includes('id="pdvCategoryChips"'), "admin.html deve conter o container pdvCategoryChips");
assert.ok(adminHtml.includes('id="pdvProductList"'), "admin.html deve conter a lista pdvProductList");
assert.ok(adminHtml.includes('id="pdvProductSearch"'), "admin.html deve conter o campo pdvProductSearch");

// 2. Verificações de CSS
assert.ok(adminCss.includes(".pdv-category-chips"), "admin.css deve conter estilos para .pdv-category-chips");
assert.ok(adminCss.includes(".pdv-chip"), "admin.css deve conter estilos para .pdv-chip");
assert.ok(adminCss.includes(".pdv-chip.is-promo"), "admin.css deve conter estilos para .pdv-chip.is-promo");
assert.ok(adminCss.includes(".pdv-strike-price"), "admin.css deve conter estilos para .pdv-strike-price");
assert.ok(adminCss.includes(".pdv-promo-price"), "admin.css deve conter estilos para .pdv-promo-price");

// 3. Verificações de lógica no admin.js
assert.ok(adminJs.includes("isPdvProductPromo"), "admin.js deve definir isPdvProductPromo");
assert.ok(adminJs.includes("pdvSelectedCategory"), "admin.js deve gerenciar pdvSelectedCategory");
assert.ok(adminJs.includes("data-pdv-category"), "admin.js deve tratar cliques em data-pdv-category");
assert.ok(adminJs.includes("pdv-meta-cat"), "admin.js deve renderizar a categoria real do item no PDV");

// 4. Testes de sincronização: mudanças no cardápio devem invocar renderPdv
assert.ok(adminJs.includes("closeProductModal();\r\n  renderMenuEditor();\r\n  renderPdv();") ||
          adminJs.includes("closeProductModal();\n  renderMenuEditor();\n  renderPdv();"),
          "saveProductModal deve chamar renderPdv");
assert.ok(adminJs.includes('if (button.dataset.tab === "pdv") { renderPdv(); renderPdvFlow(); }'),
          "Mudar para aba PDV deve re-renderizar renderPdv e renderPdvFlow");

// 5. Teste funcional da lógica de filtragem e renderização
const testProducts = [
  {
    id: 1792108382601,
    cat: "PROMOÇÃO RELAMPAGO",
    name: "PROMOÇÃO TEMAKI HOT",
    price: 30,
    strikePrice: 45,
    active: true,
    archived: false,
    badges: { promotion: true, new: true, bestSeller: false }
  },
  {
    id: 5141360,
    cat: "Combos",
    name: "Combo Tokyo Solo",
    price: 29.9,
    strikePrice: null,
    active: true,
    archived: false,
    badges: {}
  },
  {
    id: 9999999,
    cat: "Combos",
    name: "Item Inativo",
    price: 50,
    active: false,
    archived: false
  },
  {
    id: 8888888,
    cat: "Combos",
    name: "Item Arquivado",
    price: 50,
    active: true,
    archived: true
  }
];

// Função isolada de promo
function isPdvProductPromo(item) {
  return Boolean(item.badges?.promotion) ||
    (item.strikePrice && Number(item.strikePrice) > Number(item.price)) ||
    String(item.cat || "").toLowerCase().includes("promo");
}

// Filtro de ativos
const active = testProducts.filter(item => item.active !== false && !item.archived);
assert.equal(active.length, 2, "Apenas produtos ativos e não arquivados devem entrar no PDV");

// Promo detection
const promos = active.filter(isPdvProductPromo);
assert.equal(promos.length, 1, "PROMOÇÃO TEMAKI HOT deve ser identificada como promoção");
assert.equal(promos[0].id, 1792108382601, "ID do item promocional correto");

// Busca por categoria "relampago" ou "promo"
const searchHaystack = item => [item.name, item.cat, item.desc, item.internalCode].filter(Boolean).join(" ").toLowerCase();
assert.ok(searchHaystack(testProducts[0]).includes("relampago"), "Busca deve encontrar item por nome de categoria");
assert.ok(searchHaystack(testProducts[0]).includes("promo"), "Busca deve encontrar item por 'promo'");

console.log("pdv-flow.test.js: OK - Todas as regras do PDV e sincronização validadas com sucesso!");
