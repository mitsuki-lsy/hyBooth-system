function localDateStart(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0);
}

function eventCountdownDays(event, nowMs = Date.now()) {
  const start = localDateStart(event?.startDate);
  if (!start) return 0;
  const diff = start.getTime() - nowMs;
  return diff > 0 ? Math.max(1, Math.ceil(diff / 86400000)) : 1;
}

function enterpriseLinkMaxDays(db) {
  return eventCountdownDays(db.settings?.event) || Math.max(1, Number(db.settings?.rules?.reserveWorkdays || 7));
}

function clampEnterpriseLinkDays(db, value) {
  const maxDays = enterpriseLinkMaxDays(db);
  const rawDays = Number(value || maxDays);
  return Math.min(maxDays, Math.max(1, Number.isFinite(rawDays) ? rawDays : maxDays));
}

module.exports = {
  localDateStart,
  eventCountdownDays,
  enterpriseLinkMaxDays,
  clampEnterpriseLinkDays
};
