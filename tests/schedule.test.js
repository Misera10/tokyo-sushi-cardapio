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
assert.equal(status("2026-08-19T20:00:00.000Z", { mode: "closed", manualOverride: true }).mode, "open", "status legado sem data não pode bloquear a agenda indefinidamente");

const emptyWeekly = Array.from({ length: 7 }, (_, day) => ({ day, enabled: false, open: "", close: "" }));
const manualOnlySchedule = { enabled: false, weekly: emptyWeekly };
const automaticEmptySchedule = { enabled: true, weekly: emptyWeekly };
const sunday = new Date("2026-09-27T20:00:00.000Z");

assert.equal(
  context.window.TokyoSchedule.resolveStatus(manualOnlySchedule, { mode: "open", manualOverride: false }, sunday).mode,
  "open",
  "modo manual deve continuar aberto mesmo com zero dias habilitados"
);
assert.equal(
  context.window.TokyoSchedule.resolveStatus(manualOnlySchedule, { mode: "closed", manualOverride: true, manualOverrideDate: "2026-09-27" }, sunday).mode,
  "closed",
  "modo manual deve continuar fechado quando o operador fechar"
);
assert.equal(
  context.window.TokyoSchedule.resolveStatus(automaticEmptySchedule, { mode: "open", manualOverride: false }, sunday).mode,
  "closed",
  "modo automático com zero dias habilitados deve permanecer fechado"
);
assert.equal(
  status("2026-08-16T20:00:00.000Z", { mode: "closed", manualOverride: false, manualOverrideDate: "" }).mode,
  "open",
  "fechamento feito no modo manual não pode bloquear a agenda ao ativar o automático"
);
assert.equal(
  context.window.TokyoSchedule.resolveStatus({
    enabled: true,
    weekly: Array.from({ length: 7 }, (_, day) => ({ day, enabled: day === 6, open: day === 6 ? "18:00" : "", close: day === 6 ? "02:00" : "" }))
  }, { mode: "closed", manualOverride: false }, new Date("2026-09-27T04:30:00.000Z")).mode,
  "open",
  "turno de sábado atravessando meia-noite deve permanecer aberto no domingo 01:30 de Brasília"
);

console.log("schedule.test.js: OK");
