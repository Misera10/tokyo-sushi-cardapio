(function createTokyoSchedule() {
  const DAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const DEFAULT_WEEKLY = DAY_LABELS.map((label, day) => ({ day, label, enabled: false, open: "", close: "" }));

  function normalizeTime(value) {
    const time = String(value || "");
    return TIME_PATTERN.test(time) ? time : "";
  }

  function normalizeWeekly(value) {
    const source = Array.isArray(value) ? value : [];
    return DEFAULT_WEEKLY.map(defaultDay => {
      const savedDay = source.find(item => Number(item?.day) === defaultDay.day) || {};
      return {
        ...defaultDay,
        enabled: savedDay.enabled === true,
        open: normalizeTime(savedDay.open),
        close: normalizeTime(savedDay.close)
      };
    });
  }

  function normalize(value = {}) {
    return {
      enabled: value?.enabled === true,
      weekly: normalizeWeekly(value?.weekly)
    };
  }

  function currentParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
    return {
      day: Number.isInteger(weekday) ? weekday : 0,
      time: `${parts.hour}:${parts.minute}`,
      dateKey: `${parts.year}-${parts.month}-${parts.day}`
    };
  }

  function toMinutes(time) {
    const [hour, minute] = String(time).split(":").map(Number);
    return hour * 60 + minute;
  }

  function resolveStatus(schedule, fallbackStatus, date = new Date()) {
    const normalized = normalize(schedule);
    const sourceFallback = fallbackStatus || { mode: "open", label: "Aberto" };
    const fallback = sourceFallback.mode === "open"
      ? { ...sourceFallback, label: "Aberto" }
      : { ...sourceFallback, mode: "closed", label: "Fechado" };
    const current = currentParts(date);
    // O fechamento manual vale somente no dia em que foi acionado.
    // O modo "closed" também pode ser o resultado calculado da própria agenda.
    const manualOverride = fallback.manualOverride === true
      && (!normalized.enabled || fallback.manualOverrideDate === current.dateKey);
    if (manualOverride || !normalized.enabled) return { ...fallback, source: "manual" };

    const today = normalized.weekly[current.day];
    const now = toMinutes(current.time);
    const previous = normalized.weekly[(current.day + 6) % 7];
    const validWindow = day => day?.enabled && TIME_PATTERN.test(day.open) && TIME_PATTERN.test(day.close) && day.open !== day.close;
    let activeDay = null;
    let isOpen = false;

    if (validWindow(today)) {
      const opening = toMinutes(today.open);
      const closing = toMinutes(today.close);
      if (opening < closing) isOpen = now >= opening && now < closing;
      else isOpen = now >= opening;
      if (isOpen) activeDay = today;
    }

    if (!isOpen && validWindow(previous) && toMinutes(previous.open) > toMinutes(previous.close) && now < toMinutes(previous.close)) {
      isOpen = true;
      activeDay = previous;
    }

    return {
      mode: isOpen ? "open" : "closed",
      label: isOpen ? "Aberto" : "Fechado",
      source: "schedule",
      reason: activeDay ? `${activeDay.label} · ${activeDay.open} às ${activeDay.close}` : today?.label || "Dia desabilitado"
    };
  }

  window.TokyoSchedule = Object.freeze({
    dayLabels: Object.freeze([...DAY_LABELS]),
    defaultWeekly: () => DEFAULT_WEEKLY.map(day => ({ ...day })),
    normalize,
    resolveStatus
  });
})();
