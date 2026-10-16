const assert = require("node:assert/strict");
const fs = require("node:fs");

const admin = fs.readFileSync("admin.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const db = fs.readFileSync("db.js", "utf8");
const schema = fs.readFileSync("supabase-schema.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260927120000_tks_restore_manual_schedule_semantics.sql", "utf8");

const saveSettingsStart = admin.indexOf("async function saveOperationSettings()");
const saveSettingsEnd = admin.indexOf("function renderOperationSettings", saveSettingsStart);
assert.ok(saveSettingsStart >= 0 && saveSettingsEnd > saveSettingsStart, "saveOperationSettings deve existir");
const saveSettings = admin.slice(saveSettingsStart, saveSettingsEnd);
assert.equal(saveSettings.includes('saveSetting("store_status"'), false, "salvar configurações não pode alterar store_status");
assert.equal(saveSettings.includes("STORE_STATUS.closed"), false, "salvar configurações não pode forçar fechamento");
assert.ok(admin.includes("function validateWeeklySchedule"), "agenda automática deve validar horários antes de salvar");
assert.ok(admin.includes("async function refreshStoreControlsFromDb"), "admin deve atualizar status/agenda do banco em segundo plano");
assert.ok(admin.includes("window.setInterval(refreshStoreControlsFromDb, 30000)"), "admin deve sincronizar disponibilidade periodicamente");
assert.ok(admin.includes("closingOverride = selectedMode === \"closed\" && operationSettings.scheduleEnabled"), "fechamento manual só pode virar override quando o automático já está ativo");
assert.ok(admin.includes("saveOperationSettingsBundle"), "admin deve salvar configurações por RPC atômica");
assert.ok(db.includes("async saveOperationSettingsBundle"), "db.js deve expor a RPC atômica de configurações");

for (const [name, sql] of [["schema", schema], ["migration", migration]]) {
  const manualBranch = sql.indexOf("if coalesce((schedule->>'enabled')::boolean, false) is not true then");
  const zeroDaysBranch = sql.indexOf("if not has_any_enabled_day then");
  assert.ok(manualBranch >= 0, `${name}: regra do modo manual deve existir`);
  assert.ok(zeroDaysBranch > manualBranch, `${name}: modo manual deve ser decidido antes da regra de zero dias`);
  assert.ok(sql.includes("tks_save_operation_settings"), `${name}: RPC atômica de configurações deve existir`);
}

assert.ok(app.includes("refreshStoreAvailabilityFromDb"), "cardápio deve atualizar status/agenda do banco em segundo plano");
assert.ok(app.includes("storeAvailabilityRefreshPending"), "cardápio deve repetir refresh perdido durante polling em andamento");
assert.ok(admin.includes("storeControlsRefreshPending"), "admin deve repetir refresh perdido durante polling em andamento");
assert.ok(app.includes("window.setInterval(refreshStoreAvailabilityFromDb, 30000)"), "cardápio deve sincronizar disponibilidade periodicamente");
assert.ok(/serviceWorker\.register\(["']\.\/sw-v2026(0927|1016)\.js["']\)/.test(admin), "admin deve usar o service worker ativo");
assert.ok(/serviceWorker\.register\(["']sw-v2026(0927|1016)\.js["']\)/.test(app), "cardápio deve usar o service worker ativo");
assert.ok(fs.existsSync("sw-v20261016.js"), "novo service worker deve existir");

console.log("store-status-regression.test.js: OK");
