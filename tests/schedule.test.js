const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("schedule.js", "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: "schedule.js" });

const schedule = {
  enabled: true,
  weekly: [
    { day: 0, enabled: true, open: "17:00", close: "22:00" },
    { day: 1, enabled: false, open: "", close: "" },
    { day: 2, enabled: false, open: "", close: "" },
    { day: 3, enabled: true, open: "17:00", close: "22:00" },
    { day: 4, enabled: false, open: "", close: "" },
    { day: 5, enabled: false, open: "", close: "" },
    { day: 6, enabled: false, open: "", close: "" }
  ]
};

const status = (iso, fallback = { mode: "closed", manualOverride: false }) =>
  context.window.TokyoSchedule.resolveStatus(schedule, fallback, new Date(iso));

assert.equal(status("2026-08-16T20:00:00.000Z").mode, "open", "domingo 17:00 em Brasília deve abrir pela agenda");
assert.equal(status("2026-08-17T00:59:00.000Z").mode, "open", "domingo 21:59 em Brasília deve permanecer aberto");
assert.equal(status("2026-08-17T01:00:00.000Z").mode, "closed", "domingo 22:00 em Brasília deve fechar");
assert.equal(status("2026-08-16T20:00:00.000Z", { mode: "closed", manualOverride: true, manualOverrideDate: "2026-08-16" }).mode, "closed", "fechamento manual deve prevalecer no mesmo dia");
assert.equal(status("2026-08-16T20:00:00.000Z", { mode: "closed", manualOverride: true, manualOverrideDate: "2026-08-15" }).mode, "open", "fechamento manual deve expirar ao virar o dia");
assert.equal(status("2026-08-17T20:00:00.000Z", { mode: "closed", manualOverride: true, manualOverrideDate: "2026-08-16" }).mode, "closed", "segunda desativada deve continuar fechada");
assert.equal(status("2026-08-18T20:00:00.000Z", { mode: "closed", manualOverride: true, manualOverrideDate: "2026-08-16" }).mode, "closed", "terça desativada deve continuar fechada");
assert.equal(status("2026-08-19T20:00:00.000Z", { mode: "closed", manualOverride: true, manualOverrideDate: "2026-08-16" }).mode, "open", "quarta habilitada deve reabrir pela agenda");

console.log("schedule.test.js: OK");
