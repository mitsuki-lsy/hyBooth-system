const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { URL } = require("url");
const eventRules = require("./lib/domain/eventRules");
const boothMath = require("./lib/domain/boothMath");
const orderWorkflow = require("./lib/domain/orderWorkflow");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "storage", "uploads");
const SQLITE_FILE = process.env.SQLITE_FILE
  ? path.resolve(process.env.SQLITE_FILE)
  : path.join(DATA_DIR, "expo_sales.db");
const SQLITE_HELPER = path.join(ROOT, "sqlite_store.py");
const MYSQL_HELPER = path.join(ROOT, "mysql_store.py");
const PDF_RENDER_HELPER = path.join(ROOT, "scripts", "pdf_first_page_to_png.py");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === "PYTHONPATH") {
      value = value
        .split(path.delimiter)
        .map((entry) => entry && !path.isAbsolute(entry) ? path.join(ROOT, entry) : entry)
        .join(path.delimiter);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  });
}

loadEnvFile(path.join(DATA_DIR, "mysql-app.env"));

const DB_DRIVER = String(process.env.DB_DRIVER || (process.env.MYSQL_HOST || process.env.DATABASE_URL ? "mysql" : "sqlite")).toLowerCase();
const BUNDLED_PYTHON_BIN = path.join(
  process.env.USERPROFILE || "",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe"
);
const PYTHON_BIN = process.env.PYTHON_BIN || (fs.existsSync(BUNDLED_PYTHON_BIN) ? BUNDLED_PYTHON_BIN : (process.platform === "win32" ? "python" : "python3"));
const NODE_BIN = process.env.NODE_BIN || process.execPath;
const PASSWORD_SECRET = "expo-sales-mvp-local-secret";
const DEFAULT_ZONE_COLORS = ["#2f80ed", "#27ae60", "#f2994a", "#9b51e0", "#eb5757", "#00a3a3", "#6f42c1", "#0f766e"];
const IMAGE_UPLOAD_LIMIT = 3 * 1024 * 1024;
const PDF_BACKGROUND_SCALE = Number(process.env.PDF_BACKGROUND_SCALE || 2);
const CLOSED_ORDER_STATUSES = new Set(["released", "cancelled"]);
const CLOSED_OR_SOLD_ORDER_STATUSES = new Set(["released", "cancelled", "sold"]);
const REVIEW_STATUSES = new Set(["pending", "approved", "rejected"]);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!["sqlite", "mysql"].includes(DB_DRIVER)) {
  throw new Error("DB_DRIVER 浠呮敮鎸?sqlite 鎴?mysql");
}

function normalizeColor(value, index = 0) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_ZONE_COLORS[index % DEFAULT_ZONE_COLORS.length];
}

function normalizeZones(zones) {
  const source = Array.isArray(zones) && zones.length ? zones : ["A区", "B区", "C区", "D区"];
  return source.map((zone, index) => {
    if (typeof zone === "string") {
      return { name: zone.trim(), color: normalizeColor("", index) };
    }
    return {
      name: String(zone?.name || "").trim(),
      color: normalizeColor(zone?.color, index)
    };
  }).filter((zone) => zone.name);
}

function normalizeHalls(halls) {
  const source = Array.isArray(halls) && halls.length ? halls : ["1鍙烽"];
  return source.map((hall) => String(typeof hall === "string" ? hall : hall?.name || "").trim()).filter(Boolean);
}

function zoneName(zone) {
  if (typeof zone === "string") return zone;
  return zone?.name || "";
}

function isImageFile(mimeType, fileName = "") {
  const type = String(mimeType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
}

function isPdfFile(mimeType, fileName = "") {
  const type = String(mimeType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  return type === "application/pdf" || /\.pdf$/i.test(name);
}

function convertedPdfImageName(fileName = "") {
  const safeName = String(fileName || "map-background.pdf").replace(/[\\/:*?"<>|]/g, "_");
  return safeName.replace(/\.pdf$/i, "") + ".png";
}

function isClosedOrderStatus(status) {
  return CLOSED_ORDER_STATUSES.has(String(status || ""));
}

function isClosedOrSoldOrderStatus(status) {
  return CLOSED_OR_SOLD_ORDER_STATUSES.has(String(status || ""));
}

function isActiveOrder(order) {
  return order && !isClosedOrderStatus(order.status);
}

function isReviewStatus(status) {
  return REVIEW_STATUSES.has(String(status || ""));
}

function normalizeDiscountRules(rules) {
  return (Array.isArray(rules) ? rules : []).map((rule) => ({
    id: String(rule?.id || `discount-${randomToken(5)}`),
    reason: String(rule?.reason || rule?.name || "").trim(),
    price: Math.max(0, Number(rule?.price || rule?.amount || 0))
  })).filter((rule) => rule.reason);
}

function defaultCountryRegions() {
  return [
    { code: "HK", name: "中国香港" },
    { code: "MO", name: "中国澳门" },
    { code: "TW", name: "中国台湾" },
    { code: "US", name: "美国" },
    { code: "JP", name: "日本" },
    { code: "KR", name: "韩国" },
    { code: "SG", name: "新加坡" },
    { code: "MY", name: "马来西亚" },
    { code: "TH", name: "泰国" },
    { code: "VN", name: "越南" },
    { code: "ID", name: "印度尼西亚" },
    { code: "DE", name: "德国" },
    { code: "FR", name: "法国" },
    { code: "GB", name: "英国" },
    { code: "AU", name: "澳大利亚" },
    { code: "CA", name: "加拿大" }
  ];
}

function normalizeCountryRegions(regions) {
  const source = Array.isArray(regions) && regions.length ? regions : defaultCountryRegions();
  const forced = new Map([["HK", "涓浗棣欐腐"], ["MO", "涓浗婢抽棬"], ["TW", "涓浗鍙版咕"]]);
  const seen = new Set();
  return source.map((item) => {
    const code = String(item?.code || item?.cca2 || "").trim().toUpperCase();
    const name = forced.get(code) || String(item?.name || item?.common || "").trim();
    return { code, name };
  }).filter((item) => item.code && item.name && item.code !== "CN" && !seen.has(item.code) && seen.add(item.code));
}

function normalizeEvents(events, currentEvent) {
  const source = Array.isArray(events) ? events : [];
  const map = new Map();
  source.concat(currentEvent ? [currentEvent] : []).forEach((event) => {
    const idValue = String(event?.id || "").trim();
    if (!idValue) return;
    map.set(idValue, {
      id: idValue,
      name: String(event?.name || "鏈懡鍚嶅睍浼?").trim(),
      startDate: String(event?.startDate || "").trim(),
      endDate: String(event?.endDate || "").trim(),
      location: String(event?.location || "").trim(),
      category: eventCategory(event),
      linkedEventId: String(event?.linkedEventId || "").trim()
    });
  });
  return [...map.values()];
}

function eventCategory(event) {
  return String(event?.category || "榛樿绫诲埆").trim() || "榛樿绫诲埆";
}

function localDateStart(value) {
  return eventRules.localDateStart(value);
}

function eventCountdownDays(event) {
  return eventRules.eventCountdownDays(event);
}

function enterpriseLinkMaxDays(db) {
  return eventRules.enterpriseLinkMaxDays(db);
}

function clampEnterpriseLinkDays(db, value) {
  return eventRules.clampEnterpriseLinkDays(db, value);
}

function normalizeEventCategories(categories, events = []) {
  const seen = new Set();
  const usedCategories = new Set((Array.isArray(events) ? events : []).map(eventCategory).filter(Boolean));
  const source = [
    ...(Array.isArray(categories) ? categories : []),
    ...usedCategories
  ];
  const rows = source
    .map((item) => String(item || "").trim())
    .filter((item) => item && (item !== "榛樿绫诲埆" || usedCategories.has(item)) && !seen.has(item) && seen.add(item))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  return rows;
}

function normalizeEventRoles(roles) {
  const seen = new Set();
  return (Array.isArray(roles) ? roles : []).map((row) => ({
    eventId: String(row?.eventId || "").trim(),
    userId: Number(row?.userId || 0),
    role: row?.role === "manager" ? "manager" : row?.role === "sales" ? "sales" : ""
  })).filter((row) => {
    const key = `${row.eventId}:${row.userId}`;
    if (!row.eventId || !row.userId || !row.role || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultMapConfig() {
  return {
    width: 1680,
    height: 980,
    scalePxPerMeter: 16,
    backgroundAttachmentId: null,
    backgroundName: ""
  };
}

function normalizeMapConfig(map) {
  const source = map && typeof map === "object" ? map : {};
  return {
    ...source,
    width: Number(source.width || 1680),
    height: Number(source.height || 980),
    scalePxPerMeter: Number(source.scalePxPerMeter || 16),
    backgroundAttachmentId: source.backgroundAttachmentId || null,
    backgroundName: String(source.backgroundName || "")
  };
}

function currentEventId(db) {
  return String(db.settings?.event?.id || "event-2026").trim();
}

function ensureEventMap(db, eventId = currentEventId(db)) {
  const idValue = String(eventId || currentEventId(db)).trim();
  db.maps = db.maps && typeof db.maps === "object" && !Array.isArray(db.maps) ? db.maps : {};
  if (!db.maps[idValue]) {
    db.maps[idValue] = normalizeMapConfig(defaultMapConfig());
  }
  db.maps[idValue] = normalizeMapConfig(db.maps[idValue]);
  if (idValue === currentEventId(db)) db.map = db.maps[idValue];
  return db.maps[idValue];
}

function eventById(db, eventId) {
  const idValue = String(eventId || "").trim();
  return (db.settings?.events || []).find((event) => event.id === idValue) || null;
}

function eventCategoryById(db, eventId) {
  return eventCategory(eventById(db, eventId) || db.settings?.event || {});
}

function isAdminLike(user) {
  return user?.role === "admin" || user?.role === "manager";
}

function isSuperAdmin(user) {
  return user?.role === "admin";
}

function effectiveEventRole(db, user, eventId) {
  if (!user) return "";
  if (user.role === "admin" || user.role === "enterprise") return user.role;
  const row = (db.eventRoles || []).find((item) => (
    String(item.eventId) === String(eventId)
    && Number(item.userId) === Number(user.id)
  ));
  return row?.role || "";
}

function ensureDefaultEventRoles(db) {
  const eventId = String(db.settings?.event?.id || "").trim();
  if (!eventId) return;
  if (db.eventRoles.length) return;
  db.users
    .filter((user) => user.role === "manager" || user.role === "sales")
    .forEach((user) => {
      const exists = db.eventRoles.some((row) => row.eventId === eventId && Number(row.userId) === Number(user.id));
      if (!exists) db.eventRoles.push({ eventId, userId: user.id, role: user.role === "manager" ? "manager" : "sales" });
    });
}

function normalizeSalesTargets(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    userId: Number(row?.userId || 0),
    taskCount: Math.max(0, Number(row?.taskCount || 0)),
    protectionLimit: Math.max(0, Number(row?.protectionLimit || 0))
  })).filter((row) => row.userId);
}

function normalizeDepartments(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row?.id || 0),
    name: String(row?.name || "").trim()
  })).filter((row) => {
    if (!row.id || !row.name || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function normalizeDepartmentTargets(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    departmentId: Number(row?.departmentId || 0),
    taskCount: Math.max(0, Number(row?.taskCount || 0)),
    protectionLimit: Math.max(0, Number(row?.protectionLimit || 0))
  })).filter((row) => row.departmentId);
}

function salesTargetFor(db, userId) {
  const row = (db.settings.salesTargets || []).find((item) => Number(item.userId) === Number(userId));
  return row || { userId: Number(userId), taskCount: 0, protectionLimit: 0 };
}

function departmentTargetFor(db, departmentId) {
  const row = (db.settings.departmentTargets || []).find((item) => Number(item.departmentId) === Number(departmentId));
  return row || { departmentId: Number(departmentId), taskCount: 0, protectionLimit: 0 };
}

function customerTargetMode(db) {
  return db.settings?.rules?.customerTargetMode === "department" ? "department" : "sales";
}

function adminContactMaskMode(db) {
  return db.settings?.rules?.adminContactMaskMode === "department" ? "department" : "off";
}

function sameDepartment(db, userId, otherUserId) {
  const userDepartment = Number(db.users.find((item) => Number(item.id) === Number(userId))?.departmentId || 0);
  const otherDepartment = Number(db.users.find((item) => Number(item.id) === Number(otherUserId))?.departmentId || 0);
  return Boolean(userDepartment && otherDepartment && userDepartment === otherDepartment);
}

function canAccessSalesOwner(db, user, ownerSalesId) {
  if (!user) return false;
  if (isAdminLike(user)) return true;
  if (user.role !== "sales") return false;
  if (Number(ownerSalesId) === Number(user.id)) return true;
  return customerTargetMode(db) === "department" && sameDepartment(db, user.id, ownerSalesId);
}

function userDepartmentId(db, userId) {
  return Number(db.users.find((item) => Number(item.id) === Number(userId))?.departmentId || 0) || null;
}

function contactScopeForOwner(db, ownerSalesId) {
  const salesId = Number(ownerSalesId || 0);
  if (!salesId) return "";
  if (customerTargetMode(db) === "department") {
    const departmentId = userDepartmentId(db, salesId);
    if (departmentId) return `department:${departmentId}`;
  }
  return `sales:${salesId}`;
}

function normalizeLeadContactVersions(versions) {
  const seen = new Set();
  return (Array.isArray(versions) ? versions : []).map((row) => {
    const scopeKey = String(row?.scopeKey || "").trim();
    if (!scopeKey || seen.has(scopeKey)) return null;
    seen.add(scopeKey);
    return {
      scopeKey,
      ownerSalesId: Number(row?.ownerSalesId || 0) || null,
      departmentId: Number(row?.departmentId || 0) || null,
      contactName: String(row?.contactName || "").trim(),
      phone: String(row?.phone || "").trim(),
      savedAt: String(row?.savedAt || "").trim()
    };
  }).filter(Boolean);
}

function leadContactVersionForOwner(db, lead, ownerSalesId) {
  const scopeKey = contactScopeForOwner(db, ownerSalesId);
  if (!scopeKey) return null;
  const versions = normalizeLeadContactVersions(lead?.contactVersions);
  return versions.find((item) => item.scopeKey === scopeKey) || null;
}

function maskCompanyContact(row) {
  row.contactName = "";
  row.phone = "";
  row.contactMasked = true;
  return row;
}

function canAdminSeeLeadContact(db, user, lead) {
  if (!user || !lead) return false;
  if (user.role === "admin") return true;
  if (user.role !== "manager") return false;
  if (adminContactMaskMode(db) !== "department") return true;
  const owner = db.users.find((item) => Number(item.id) === Number(lead.ownerSalesId));
  return Boolean(user.departmentId && owner?.departmentId && Number(user.departmentId) === Number(owner.departmentId));
}

function saveLeadContactVersion(db, lead, ownerSalesId, company) {
  const scopeKey = contactScopeForOwner(db, ownerSalesId);
  if (!lead || !company || !scopeKey) return;
  const versions = normalizeLeadContactVersions(lead.contactVersions);
  const existing = versions.find((item) => item.scopeKey === scopeKey);
  const payload = {
    scopeKey,
    ownerSalesId: Number(ownerSalesId || 0) || null,
    departmentId: userDepartmentId(db, ownerSalesId),
    contactName: String(company.contactName || "").trim(),
    phone: String(company.phone || "").trim(),
    savedAt: nowIso()
  };
  if (existing) Object.assign(existing, payload);
  else versions.push(payload);
  lead.contactVersions = versions;
}

function rememberLeadContactOwner(db, lead, ownerSalesId) {
  const salesId = Number(ownerSalesId || 0);
  if (!lead || !salesId) return;
  const versions = normalizeLeadContactVersions(lead.contactVersions);
  if (versions.some((item) => item.scopeKey === contactScopeForOwner(db, salesId))) {
    lead.contactVersions = versions;
    lead.previousOwnerSalesId = salesId;
    return;
  }
  const company = db.companies.find((item) => Number(item.id) === Number(lead.companyId));
  if (company && !versions.length && !lead.previousOwnerSalesId) saveLeadContactVersion(db, lead, salesId, company);
  lead.previousOwnerSalesId = salesId;
}

function companyForUser(db, user, company, lead) {
  const row = { ...company };
  if (!user || !lead) return row;
  if (isAdminLike(user) && user.role !== "sales") {
    return canAdminSeeLeadContact(db, user, lead) ? row : maskCompanyContact(row);
  }
  if (user.role !== "sales") return row;
  const versions = normalizeLeadContactVersions(lead.contactVersions);
  const version = leadContactVersionForOwner(db, lead, user.id);
  if (version) {
    row.contactName = version.contactName;
    row.phone = version.phone;
    row.contactMasked = false;
    return row;
  }
  const hasPrivacyHistory = versions.length > 0 || Boolean(lead.previousOwnerSalesId);
  const protectedOwnerVisible = lead.status === "protected" && canAccessSalesOwner(db, user, lead.ownerSalesId);
  const publicOwnerVisible = lead.status === "public"
    && (lead.previousOwnerSalesId || lead.ownerSalesId)
    && canAccessSalesOwner(db, user, lead.previousOwnerSalesId || lead.ownerSalesId);
  if ((protectedOwnerVisible || publicOwnerVisible) && !hasPrivacyHistory) return row;
  return maskCompanyContact(row);
}

function leadForUser(user, lead) {
  if (isAdminLike(user)) return lead;
  const { contactVersions, ...safeLead } = lead;
  return safeLead;
}

function salesFlowMode(db) {
  return db.settings?.rules?.salesFlowMode === "contract_first" ? "contract_first" : "voucher_direct";
}

function deadlineDayMode(db) {
  return db.settings?.rules?.deadlineDayMode === "natural" ? "natural" : "workday";
}

function deadlineDayModeText(db) {
  return deadlineDayMode(db) === "natural" ? "自然日" : "工作日";
}

function contractApprovedVoucherWorkdays(db) {
  return Math.max(0, Number(db.settings?.rules?.contractApprovedVoucherWorkdays ?? db.settings?.rules?.reserveWorkdays ?? 7));
}

function normalizeCustomerLeads(leads) {
  return (Array.isArray(leads) ? leads : []).map((lead) => ({
    id: Number(lead?.id || 0),
    eventId: String(lead?.eventId || "").trim(),
    companyId: Number(lead?.companyId || 0),
    customerType: lead?.customerType === "old" ? "old" : "new",
    status: ["protected", "public", "converted"].includes(lead?.status) ? lead.status : "protected",
    ownerSalesId: Number(lead?.ownerSalesId || 0) || null,
    protectedUntil: String(lead?.protectedUntil || "").trim(),
    sourceOrderId: Number(lead?.sourceOrderId || 0) || null,
    sourceEventName: String(lead?.sourceEventName || "").trim(),
    sourceAmount: Number(lead?.sourceAmount || 0),
    contractAttachmentIds: Array.isArray(lead?.contractAttachmentIds) ? lead.contractAttachmentIds.map(Number).filter(Boolean) : [],
    voucherAttachmentIds: Array.isArray(lead?.voucherAttachmentIds) ? lead.voucherAttachmentIds.map(Number).filter(Boolean) : [],
    contractReviewStatus: isReviewStatus(lead?.contractReviewStatus) ? lead.contractReviewStatus : (Array.isArray(lead?.contractAttachmentIds) && lead.contractAttachmentIds.length ? "pending" : "none"),
    contractReviewedBy: Number(lead?.contractReviewedBy || 0) || null,
    contractReviewedAt: String(lead?.contractReviewedAt || "").trim(),
    contractReviewRemark: String(lead?.contractReviewRemark || "").trim(),
    voucherReviewStatus: isReviewStatus(lead?.voucherReviewStatus) ? lead.voucherReviewStatus : (Array.isArray(lead?.voucherAttachmentIds) && lead.voucherAttachmentIds.length ? "pending" : "none"),
    voucherReviewedBy: Number(lead?.voucherReviewedBy || 0) || null,
    voucherReviewedAt: String(lead?.voucherReviewedAt || "").trim(),
    voucherReviewRemark: String(lead?.voucherReviewRemark || "").trim(),
    voucherDueAt: String(lead?.voucherDueAt || "").trim(),
    publicReason: String(lead?.publicReason || "").trim(),
    previousOwnerSalesId: Number(lead?.previousOwnerSalesId || 0) || null,
    contactVersions: normalizeLeadContactVersions(lead?.contactVersions),
    createdAt: String(lead?.createdAt || nowIso()).trim(),
    claimedAt: String(lead?.claimedAt || "").trim(),
    releasedAt: String(lead?.releasedAt || "").trim(),
    convertedAt: String(lead?.convertedAt || "").trim()
  })).filter((lead) => lead.id && lead.eventId && lead.companyId);
}

function customerLeadDepositMet(db, lead) {
  return db.orders.some((order) => (
    String(order.eventId) === String(lead.eventId)
    && Number(order.companyId) === Number(lead.companyId)
    && isActiveOrder(order)
    && Number(order.paidApprovedAmount || 0) >= Number(order.depositRequired || 0)
    && Number(order.depositRequired || 0) > 0
  ));
}

function protectedLeadCount(db, eventId, userId) {
  return db.customerLeads.filter((lead) => (
    String(lead.eventId) === String(eventId)
    && Number(lead.ownerSalesId) === Number(userId)
    && lead.status === "protected"
    && !customerLeadDepositMet(db, lead)
  )).length;
}

function departmentProtectedLeadCount(db, eventId, departmentId) {
  const userIds = new Set(db.users
    .filter((user) => Number(user.departmentId || 0) === Number(departmentId))
    .map((user) => Number(user.id)));
  return db.customerLeads.filter((lead) => (
    String(lead.eventId) === String(eventId)
    && userIds.has(Number(lead.ownerSalesId))
    && lead.status === "protected"
    && !customerLeadDepositMet(db, lead)
  )).length;
}

function protectionUsage(db, eventId, userId) {
  const sales = db.users.find((item) => Number(item.id) === Number(userId));
  if (customerTargetMode(db) === "department") {
    const departmentId = Number(sales?.departmentId || 0);
    const department = (db.settings.departments || []).find((item) => Number(item.id) === departmentId);
    const target = departmentTargetFor(db, departmentId);
    return {
      mode: "department",
      unitId: departmentId,
      unitName: department?.name || "未分配部门",
      taskCount: Number(target.taskCount || 0),
      protectionLimit: Number(target.protectionLimit || 0),
      used: departmentId ? departmentProtectedLeadCount(db, eventId, departmentId) : 0
    };
  }
  const target = salesTargetFor(db, userId);
  return {
    mode: "sales",
    unitId: Number(userId),
    unitName: sales?.displayName || "该业务员",
    taskCount: Number(target.taskCount || 0),
    protectionLimit: Number(target.protectionLimit || 0),
    used: protectedLeadCount(db, eventId, userId)
  };
}

function ensureProtectionCapacity(db, eventId, userId) {
  const usage = protectionUsage(db, eventId, userId);
  const limit = Number(usage.protectionLimit || 0);
  const name = usage.mode === "department" ? `${usage.unitName}部门` : usage.unitName;
  if (usage.mode === "department" && !usage.unitId) return { ok: false, error: "该业务员未分配部门，不能新增保护客户" };
  if (limit <= 0) return { ok: false, error: `${name}无客保名额，不能新增保护客户` };
  const used = Number(usage.used || 0);
  if (used >= limit) {
    return { ok: false, error: `${name}客户保护名额已满，${used}/${limit}` };
  }
  return { ok: true };
}

function leadHasPendingReview(lead) {
  return lead?.contractReviewStatus === "pending" || lead?.voucherReviewStatus === "pending";
}

function activeLeadForOrder(db, order) {
  if (!order) return null;
  return db.customerLeads.find((lead) => (
    String(lead.eventId) === String(order.eventId)
    && Number(lead.companyId) === Number(order.companyId)
    && lead.status !== "public"
  )) || null;
}

function releaseOrderBooths(db, order, reason, actor) {
  if (!order || isClosedOrSoldOrderStatus(order.status)) return false;
  order.status = "released";
  order.releasedAt = nowIso();
  order.releaseReason = reason;
  order.updatedAt = nowIso();
  order.boothIds.forEach((boothId) => {
    const booth = db.booths.find((item) => item.id === boothId && item.orderId === order.id);
    if (booth) {
      booth.status = "available";
      booth.orderId = null;
      booth.reservedAt = null;
      booth.reservedBy = null;
      booth.updatedAt = nowIso();
    }
  });
  notify(db, order.salespersonId, "灞曚綅宸查噴鏀?", `${order.orderNo} ${reason}`);
  writeLog(db, actor || null, "閲婃斁灞曚綅", `${order.orderNo}锛?{reason}`, "order", order.id);
  return true;
}

function releaseLeadToPublic(db, lead, reason, actor) {
  if (!lead || lead.status === "public" || lead.status === "converted") return false;
  rememberLeadContactOwner(db, lead, lead.ownerSalesId);
  lead.status = "public";
  lead.releasedAt = nowIso();
  lead.protectedUntil = "";
  lead.publicReason = reason;
  if (lead.ownerSalesId) notify(db, lead.ownerSalesId, "瀹㈡埛宸茶繘鍏ュ叕娴?", reason);
  writeLog(db, actor || null, "瀹㈡埛杩涘叆鍏捣", `${lead.companyId}锛?{reason}`, "customerLead", lead.id);
  return true;
}

function releaseLeadAndActiveOrder(db, lead, reason, actor) {
  let changed = releaseLeadToPublic(db, lead, reason, actor);
  const order = activeCurrentOrderForCompany(db, lead?.eventId, lead?.companyId);
  if (order) changed = releaseOrderBooths(db, order, reason, actor) || changed;
  return changed;
}

function extendActiveOrderReserve(db, lead, untilIso) {
  const order = activeCurrentOrderForCompany(db, lead?.eventId, lead?.companyId);
  if (!order || isClosedOrSoldOrderStatus(order.status) || !untilIso) return;
  const current = new Date(order.reserveExpiresAt || 0).getTime();
  const next = new Date(untilIso).getTime();
  if (!Number.isFinite(current) || next > current) {
    order.reserveExpiresAt = untilIso;
    order.updatedAt = nowIso();
  }
}

function isLegacyEndOfDayDeadline(value) {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  return date.getHours() === 23 && date.getMinutes() === 59 && date.getSeconds() === 59;
}

function normalizeWorkdayDeadlineTimes(db) {
  db.customerLeads.forEach((lead) => {
    if (isLegacyEndOfDayDeadline(lead.voucherDueAt) && lead.contractReviewedAt) {
      lead.voucherDueAt = addDeadlineDays(db, lead.contractReviewedAt, contractApprovedVoucherWorkdays(db));
    }
  });
  db.orders.forEach((order) => {
    if (!isLegacyEndOfDayDeadline(order.reserveExpiresAt) || isClosedOrderStatus(order.status)) return;
    const lead = activeLeadForOrder(db, order);
    if (lead && salesFlowMode(db) === "contract_first" && lead.contractReviewStatus === "approved" && lead.voucherDueAt) {
      order.reserveExpiresAt = lead.voucherDueAt;
      return;
    }
    order.reserveExpiresAt = addDeadlineDays(db, order.reservedAt || order.createdAt || order.reserveExpiresAt, db.settings.rules.reserveWorkdays);
  });
}

function workflowHoldLead(db, lead) {
  if (leadHasPendingReview(lead)) return true;
  if (lead?.voucherReviewStatus === "approved") return true;
  const order = activeCurrentOrderForCompany(db, lead?.eventId, lead?.companyId);
  if (order && db.payments.some((payment) => payment.orderId === order.id && payment.status === "pending")) return true;
  if (salesFlowMode(db) === "contract_first" && lead?.contractReviewStatus === "approved") {
    const due = new Date(lead.voucherDueAt || 0).getTime();
    return !Number.isFinite(due) || due > Date.now();
  }
  return false;
}

function releaseExpiredCustomerLeads(db) {
  const now = Date.now();
  let changed = false;
  db.customerLeads.forEach((lead) => {
    if (lead.status !== "protected" || !lead.protectedUntil) return;
    if (customerLeadDepositMet(db, lead)) return;
    if (workflowHoldLead(db, lead)) return;
    const end = new Date(lead.protectedUntil).getTime();
    if (Number.isFinite(end) && end <= now) {
      rememberLeadContactOwner(db, lead, lead.ownerSalesId);
      lead.status = "public";
      lead.ownerSalesId = null;
      lead.releasedAt = nowIso();
      lead.publicReason = lead.customerType === "old" ? "老客户保护到期" : "新客户保护到期";
      changed = true;
    }
  });
  return changed;
}

function activeCurrentOrderForCompany(db, eventId, companyId) {
  return db.orders.find((order) => (
    String(order.eventId) === String(eventId)
    && Number(order.companyId) === Number(companyId)
    && isActiveOrder(order)
  ));
}

function materializeOldCustomerLeads(db) {
  const event = db.settings.event || {};
  const linkedEventId = String(event.linkedEventId || "").trim();
  if (!linkedEventId) return false;
  let changed = false;
  db.orders
    .filter((order) => order.status === "sold" && String(order.eventId) === linkedEventId)
    .forEach((order) => {
      if (activeCurrentOrderForCompany(db, event.id, order.companyId)) return;
      const exists = db.customerLeads.some((lead) => (
        String(lead.eventId) === String(event.id)
        && Number(lead.companyId) === Number(order.companyId)
      ));
      if (exists) return;
      db.customerLeads.push({
        id: id(db, "customerLead"),
        eventId: event.id,
        companyId: order.companyId,
        customerType: "old",
        status: "protected",
        ownerSalesId: order.salespersonId,
        protectedUntil: addDays(nowIso(), Number(db.settings.rules.oldCustomerProtectDays ?? 30)),
        sourceOrderId: order.id,
        sourceEventName: order.eventName || eventById(db, order.eventId)?.name || "",
        sourceAmount: Number(order.totalAmount || 0),
        contractAttachmentIds: [],
        voucherAttachmentIds: [],
        contractReviewStatus: "none",
        contractReviewedBy: null,
        contractReviewedAt: "",
        contractReviewRemark: "",
        voucherReviewStatus: "none",
        voucherReviewedBy: null,
        voucherReviewedAt: "",
        voucherReviewRemark: "",
        voucherDueAt: "",
        publicReason: "",
        createdAt: nowIso(),
        claimedAt: "",
        releasedAt: "",
        convertedAt: ""
      });
      changed = true;
    });
  return changed;
}

function syncCustomerLeadsForCurrentEvent(db) {
  const changedOld = materializeOldCustomerLeads(db);
  const changedRelease = releaseExpiredCustomerLeads(db);
  return changedOld || changedRelease;
}

function markCustomerLeadConverted(db, eventId, companyId, leadId = 0) {
  db.customerLeads.forEach((lead) => {
    const sameLead = leadId && Number(lead.id) === Number(leadId);
    const sameCompany = String(lead.eventId) === String(eventId) && Number(lead.companyId) === Number(companyId);
    if ((sameLead || sameCompany) && lead.status !== "converted") {
      lead.status = "converted";
      lead.convertedAt = nowIso();
      lead.publicReason = "";
    }
  });
}

function reminderDueSoon(value, hours = 48) {
  const due = new Date(value || 0).getTime();
  if (!Number.isFinite(due)) return false;
  const left = due - Date.now();
  return left > 0 && left <= hours * 3600 * 1000;
}

function profileCompleteForReminder(profile) {
  if (!profile) return false;
  const catalog = profile.catalog || {};
  return Boolean(
    catalog.companyIntro
    || catalog.productIntro
    || Number(catalog.videoAttachmentId || 0)
    || (catalog.productImageIds || []).length
    || (profile.badges || []).length
    || profile.fascia?.requestedName
    || (profile.rentals || []).length
  );
}

function syncWorkflowReminders(db) {
  const eventId = currentEventId(db);
  let changed = false;
  const eventOrders = db.orders.filter((order) => String(order.eventId || eventId) === String(eventId) && isActiveOrder(order));
  const admins = eventAdminUsers(db, eventId);
  const adminReminder = (title, count) => {
    if (!count) return;
    admins.forEach((admin) => {
      changed = notifyOnce(db, admin.id, title, `${count} 椤瑰緟澶勭悊锛岃鍒板鏍告ā鍧楁煡鐪媊`, eventId) || changed;
    });
  };

  adminReminder("寰呭鏍稿鎴峰悎鍚?", db.customerLeads.filter((lead) => String(lead.eventId) === String(eventId) && lead.contractReviewStatus === "pending").length);
  adminReminder("寰呭鏍稿鎴锋按鍗?", db.customerLeads.filter((lead) => String(lead.eventId) === String(eventId) && lead.voucherReviewStatus === "pending").length);
  adminReminder("寰呭鏍搁攢鍞按鍗?", db.payments.filter((payment) => {
    const order = db.orders.find((item) => item.id === payment.orderId);
    return payment.status === "pending" && order && String(order.eventId || eventId) === String(eventId);
  }).length);
  adminReminder("寰呭鏍歌鍗曞彉鏇?", db.changeRequests.filter((request) => {
    const order = db.orders.find((item) => item.id === request.orderId);
    return request.status === "pending" && order && String(order.eventId || eventId) === String(eventId);
  }).length);
  adminReminder("寰呭鏍告ィ鏉?灞曞叿", db.profiles.filter((profile) => {
    const order = db.orders.find((item) => item.id === profile.orderId);
    if (!order || String(order.eventId || eventId) !== String(eventId)) return false;
    return profile.fascia?.status === "pending" || (profile.rentals || []).some((rental) => rental.status === "pending");
  }).length);

  eventOrders.filter((order) => order.type === "booth").forEach((order) => {
    const company = db.companies.find((item) => item.id === order.companyId);
    const companyName = company?.name || order.orderNo;
    const lead = activeLeadForOrder(db, order);
    if (order.status !== "sold") {
      if (salesFlowMode(db) === "contract_first") {
        if (!lead || !["pending", "approved"].includes(lead.contractReviewStatus)) {
          changed = notifyOnce(db, order.salespersonId, "寰呬笂浼犲悎鍚?", `${companyName} ${order.orderNo} 灏氭湭涓婁紶鍚堝悓`, eventId) || changed;
        } else if (lead.contractReviewStatus === "approved" && !["pending", "approved"].includes(lead.voucherReviewStatus)) {
          changed = notifyOnce(db, order.salespersonId, "待上传水单", `${companyName} ${order.orderNo} 合同已通过，尚未上传水单`, eventId) || changed;
        }
      } else if (!lead || !["pending", "approved"].includes(lead.voucherReviewStatus)) {
        changed = notifyOnce(db, order.salespersonId, "寰呬笂浼犳按鍗?", `${companyName} ${order.orderNo} 灏氭湭涓婁紶姘村崟`, eventId) || changed;
      }
      if (reminderDueSoon(order.reserveExpiresAt, 48) && !leadHasPendingReview(lead)) {
        changed = notifyOnce(db, order.salespersonId, "灞曚綅鍗冲皢閲婃斁", `${companyName} ${order.orderNo} 棰勭暀鍗冲皢鍒版湡`, eventId) || changed;
      }
    } else if (order.enterpriseUserId) {
      const profile = db.profiles.find((item) => item.orderId === order.id);
      if (!profileCompleteForReminder(profile)) {
        changed = notifyOnce(db, order.enterpriseUserId, "灞曞姟璧勬枡寰呭～鍐?", `${companyName} 璇疯ˉ鍏呬細鍒娿€佽瘉浠躲€佹ィ鏉挎垨灞曞叿淇℃伅`, eventId) || changed;
        changed = notifyOnce(db, order.salespersonId, "浼佷笟璧勬枡鏈彁浜?", `${companyName} 灏氭湭鎻愪氦瀹屾暣灞曞姟璧勬枡`, eventId) || changed;
      }
    }
  });

  return changed;
}

function applySessionEvent(db, session) {
  const event = eventById(db, session?.eventId) || db.settings.event;
  db.settings.event = {
    id: String(event.id || db.settings.event.id).trim(),
    name: String(event.name || db.settings.event.name || "").trim(),
    startDate: String(event.startDate || "").trim(),
    endDate: String(event.endDate || "").trim(),
    location: String(event.location || "").trim(),
    category: eventCategory(event),
    linkedEventId: String(event.linkedEventId || "").trim()
  };
  db.settings.events = normalizeEvents(db.settings.events, db.settings.event);
  ensureEventMap(db, db.settings.event.id);
  if (session) session.eventId = db.settings.event.id;
  return db.settings.event;
}

function eventAdminUsers(db, eventId) {
  return db.users.filter((item) => (
    item.role === "admin"
    || db.eventRoles.some((row) => row.eventId === eventId && Number(row.userId) === Number(item.id) && row.role === "manager")
  ));
}

function deleteEventsById(db, eventIds) {
  const ids = new Set(eventIds.map((idValue) => String(idValue || "").trim()).filter(Boolean));
  const existing = (db.settings.events || []).filter((event) => ids.has(String(event.id)));
  if (!existing.length) return { deletedEvents: [], removed: {} };

  const removeOrderIds = new Set(db.orders.filter((order) => ids.has(String(order.eventId))).map((order) => order.id));
  const removeLeadIds = new Set(db.customerLeads.filter((lead) => ids.has(String(lead.eventId))).map((lead) => lead.id));
  const removeBoothIds = new Set(db.booths.filter((booth) => ids.has(String(booth.eventId))).map((booth) => booth.id));
  const removeProfileIds = new Set(db.profiles.filter((profile) => removeOrderIds.has(profile.orderId)).map((profile) => profile.id));
  const removedCompanyIds = new Set();
  db.orders.filter((order) => removeOrderIds.has(order.id)).forEach((order) => removedCompanyIds.add(order.companyId));
  db.customerLeads.filter((lead) => removeLeadIds.has(lead.id)).forEach((lead) => removedCompanyIds.add(lead.companyId));
  db.profiles.filter((profile) => removeProfileIds.has(profile.id)).forEach((profile) => removedCompanyIds.add(profile.companyId));

  const oldCounts = {
    events: db.settings.events.length,
    eventRoles: db.eventRoles.length,
    booths: db.booths.length,
    obstacles: db.obstacles.length,
    activityAreas: db.activityAreas.length,
    orders: db.orders.length,
    payments: db.payments.length,
    profiles: db.profiles.length,
    changeRequests: db.changeRequests.length,
    customerLeads: db.customerLeads.length,
    notifications: db.notifications.length,
    logs: db.logs.length,
    attachments: db.attachments.length,
    sessions: Object.keys(db.sessions || {}).length
  };

  db.settings.events = db.settings.events.filter((event) => !ids.has(String(event.id)));
  existing.forEach((event) => { if (db.maps) delete db.maps[event.id]; });
  db.eventRoles = db.eventRoles.filter((row) => !ids.has(String(row.eventId)));
  db.booths = db.booths.filter((booth) => !ids.has(String(booth.eventId)));
  db.obstacles = db.obstacles.filter((obstacle) => !ids.has(String(obstacleEventId(db, obstacle))) && !removeBoothIds.has(Number(obstacle.boothId)));
  db.activityAreas = db.activityAreas.filter((area) => !ids.has(String(area.eventId)));
  db.orders = db.orders.filter((order) => !removeOrderIds.has(order.id));
  db.payments = db.payments.filter((payment) => !removeOrderIds.has(payment.orderId));
  db.profiles = db.profiles.filter((profile) => !removeProfileIds.has(profile.id));
  db.changeRequests = db.changeRequests.filter((request) => !removeOrderIds.has(request.orderId));
  db.customerLeads = db.customerLeads.filter((lead) => !removeLeadIds.has(lead.id));
  db.notifications = db.notifications.filter((notification) => !ids.has(String(notification.eventId)));
  db.logs = db.logs.filter((log) => !ids.has(String(log.eventId)));
  Object.keys(db.sessions || {}).forEach((token) => {
    if (ids.has(String(db.sessions[token]?.eventId))) delete db.sessions[token];
  });

  const remainingCompanyRefs = new Set();
  db.orders.forEach((order) => remainingCompanyRefs.add(order.companyId));
  db.customerLeads.forEach((lead) => remainingCompanyRefs.add(lead.companyId));
  db.profiles.forEach((profile) => remainingCompanyRefs.add(profile.companyId));
  db.companies = db.companies.filter((company) => remainingCompanyRefs.has(company.id) || !removedCompanyIds.has(company.id));

  const retainedAttachmentIds = new Set();
  Object.values(db.maps || {}).forEach((map) => {
    if (map?.backgroundAttachmentId) retainedAttachmentIds.add(Number(map.backgroundAttachmentId));
  });
  db.settings.furniture.forEach((item) => {
    const imageId = Number(item.image || 0);
    if (imageId) retainedAttachmentIds.add(imageId);
  });
  const removedStorageNames = [];
  db.attachments = db.attachments.filter((attachment) => {
    const remove = ids.has(String(attachment.eventId))
      || removeOrderIds.has(Number(attachment.orderId))
      || removeLeadIds.has(Number(attachment.leadId))
      || removeProfileIds.has(Number(attachment.profileId));
    if (!remove || retainedAttachmentIds.has(Number(attachment.id))) return true;
    removedStorageNames.push(attachment.storageName);
    return false;
  });
  removedStorageNames.filter(Boolean).forEach((storageName) => {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, storageName));
    } catch (_) {
      // Missing local files are harmless during event cleanup.
    }
  });

  if (!db.settings.events.length) {
    db.settings.events.push({ ...db.settings.event, id: "event-2026", name: "榛樿灞曚細", linkedEventId: "" });
  }
  if (ids.has(String(db.settings.event.id))) {
    db.settings.event = db.settings.events[0];
  }
  ensureEventMap(db, db.settings.event.id);
  return {
    deletedEvents: existing.map((event) => event.id),
    removed: Object.fromEntries(Object.entries(oldCounts).map(([key, value]) => [key, value - (
      key === "sessions" ? Object.keys(db.sessions || {}).length : key === "events" ? db.settings.events.length : db[key]?.length ?? db.settings[key]?.length ?? value
    )]))
  };
}

function eventOrderCount(db, eventId) {
  return (db.orders || []).filter((order) => String(order.eventId) === String(eventId)).length;
}

function userOrderCount(db, userId) {
  const idValue = Number(userId);
  const orderRefs = (db.orders || []).filter((order) => (
    Number(order.salespersonId) === idValue
    || Number(order.enterpriseUserId) === idValue
  )).length;
  const directUser = (db.users || []).find((item) => Number(item.id) === idValue);
  return orderRefs + (directUser?.orderId ? 1 : 0);
}

function companyNameKey(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function companyTaxKey(value) {
  return String(value || "").trim().replace(/[\s-]/g, "").toUpperCase();
}

function sameCompanyIdentity(left, right) {
  const leftTax = companyTaxKey(left?.taxNo);
  const rightTax = companyTaxKey(right?.taxNo);
  if (leftTax && rightTax && leftTax === rightTax) return true;
  return companyNameKey(left?.name) && companyNameKey(left?.name) === companyNameKey(right?.name);
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWorkday(db, date) {
  const key = dateKey(date);
  const year = String(date.getFullYear());
  const override = db.workdayCalendar?.[year]?.days?.[key];
  if (override && typeof override.isWorkday === "boolean") return override.isWorkday;
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function addWorkdays(db, dateLike, workdays) {
  const date = new Date(dateLike);
  let remaining = Number(workdays || 0);
  if (remaining <= 0) return date.toISOString();
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (isWorkday(db, date)) remaining -= 1;
  }
  return date.toISOString();
}

function addDeadlineDays(db, dateLike, days) {
  return deadlineDayMode(db) === "natural" ? addDays(dateLike, days) : addWorkdays(db, dateLike, days);
}

async function syncChinaWorkdays(db, year) {
  const sourceTemplate = db.settings.workdaySync?.sourceUrl || "https://timor.tech/api/holiday/year/{year}/";
  const url = sourceTemplate.replace("{year}", String(year));
  const payload = await fetchJson(url);
  const holiday = payload.holiday || payload.data || {};
  const days = {};
  Object.keys(holiday).forEach((key) => {
    const item = holiday[key] || {};
    const fullDate = item.date || (key.length === 5 ? `${year}-${key}` : key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fullDate)) return;
    days[fullDate] = {
      isWorkday: item.holiday === false,
      name: item.name || item.target || "",
      holiday: item.holiday === true,
      sourceType: item.holiday === false ? "makeup_workday" : "holiday"
    };
  });
  db.workdayCalendar[String(year)] = {
    year: Number(year),
    source: url,
    syncedAt: nowIso(),
    days
  };
  db.settings.workdaySync = {
    sourceUrl: sourceTemplate,
    lastSyncedAt: nowIso(),
    lastStatus: "success",
    lastMessage: `宸插悓姝?${year} 骞?${Object.keys(days).length} 鏉¤妭鍋囨棩/璋冧紤鏁版嵁`
  };
  return db.workdayCalendar[String(year)];
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(`${password}:${PASSWORD_SECRET}`).digest("hex");
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function simpleEnterprisePassword() {
  return String(crypto.randomInt(100000, 1000000));
}

function ensureEnterpriseUserForOrder(db, order, password = "") {
  const company = db.companies.find((item) => item.id === order.companyId);
  let enterpriseUser = db.users.find((item) => item.id === order.enterpriseUserId);
  const initialPassword = password || simpleEnterprisePassword();
  if (!enterpriseUser) {
    enterpriseUser = {
      id: id(db, "user"),
      username: `ent${order.orderNo.toLowerCase()}`,
      passwordHash: hashPassword(initialPassword),
      displayName: company ? company.name : `浼佷笟${order.id}`,
      role: "enterprise",
      active: true,
      companyId: order.companyId,
      orderId: order.id,
      createdAt: nowIso(),
      lastLoginAt: null
    };
    db.users.push(enterpriseUser);
    order.enterpriseUserId = enterpriseUser.id;
    order.enterpriseAccountIssuedAt = nowIso();
  } else {
    enterpriseUser.active = true;
    enterpriseUser.companyId = order.companyId;
    enterpriseUser.orderId = order.id;
    if (password) enterpriseUser.passwordHash = hashPassword(password);
  }
  ensureProfile(db, order);
  return enterpriseUser;
}

function id(db, key) {
  db.nextIds[key] = (db.nextIds[key] || 1) + 1;
  return db.nextIds[key] - 1;
}

function defaultDb() {
  const db = {
    nextIds: {
      user: 1,
      booth: 1,
      company: 1,
      order: 1,
      payment: 1,
      profile: 1,
      customerLead: 1,
      attachment: 1,
      log: 1,
      changeRequest: 1,
      notification: 1,
      obstacle: 1,
      activityArea: 1
    },
    settings: {
      event: { id: "event-2026", name: "默认展会", category: "默认类别", mode: "single-first" },
      eventCategories: ["默认类别"],
      rules: {
        standardPrice: 9800,
        rawPrice: 1200,
        depositRate: 0.3,
        reserveWorkdays: 7,
        noticeDaysBeforeRelease: 2,
        newCustomerProtectDays: 30,
        oldCustomerProtectDays: 30,
        deadlineDayMode: "workday",
        salesFlowMode: "voucher_direct",
        adminContactMaskMode: "off",
        contractApprovedVoucherWorkdays: 7,
        enterpriseLinkDays: 1,
        enterpriseLinkDaysCustomized: false
      },
      reviewRejectTemplates: ["合同未盖章", "金额不一致", "水单不清晰", "企业名称不一致"],
      salesTargets: [],
      departmentTargets: [],
      departments: [],
      workdaySync: {
        sourceUrl: "https://timor.tech/api/holiday/year/{year}/",
        lastSyncedAt: "",
        lastStatus: "not_synced",
        lastMessage: "灏氭湭鍚屾锛岀郴缁熶細鍏堟寜鍛ㄤ竴鍒板懆浜旇绠楀伐浣滄棩"
      },
      zones: normalizeZones(["A区", "B区", "C区", "D区"]),
      halls: normalizeHalls(["1号馆"]),
      countryRegions: defaultCountryRegions(),
      attributes: [
        { code: "standard", name: "标摊", unit: "booth" },
        { code: "raw", name: "光地", unit: "sqm" }
      ],
      furniture: [
        { id: "chair", name: "洽谈椅", size: "标准", price: 45, image: "", active: true },
        { id: "table", name: "咨询桌", size: "1200x600mm", price: 160, image: "", active: true },
        { id: "power", name: "电源插座", size: "500W", price: 220, image: "", active: true },
        { id: "shelf", name: "资料架", size: "A4三层", price: 120, image: "", active: true }
      ],
      discountRules: []
    },
    map: defaultMapConfig(),
    maps: {},
    users: [
      {
        id: 1,
        username: "admin",
        passwordHash: hashPassword("admin123"),
        displayName: "瓒呯骇绠＄悊鍛?",
        role: "admin",
        active: true,
        companyId: null,
        orderId: null,
        createdAt: nowIso(),
        lastLoginAt: null
      },
      {
        id: 2,
        username: "sales01",
        passwordHash: hashPassword("sales123"),
        displayName: "涓氬姟鍛樹竴鍙?",
        role: "sales",
        active: true,
        companyId: null,
        orderId: null,
        createdAt: nowIso(),
        lastLoginAt: null
      }
    ],
    sessions: {},
    eventRoles: [],
    customerLeads: [],
    booths: [],
    obstacles: [],
    activityAreas: [],
    companies: [],
    orders: [],
    payments: [],
    profiles: [],
    attachments: [],
    changeRequests: [],
    notifications: [],
    logs: []
  };
  db.nextIds.user = 3;
  db.workdayCalendar = {};
  writeLog(db, null, "绯荤粺鍒濆鍖?", "鍒涘缓榛樿璐﹀彿锛屽睍浣嶅浘涓虹┖鐧斤紝绛夊緟绠＄悊鍛樹笂浼犲簳鍥惧苟缁樺埗灞曚綅");
  return db;
}

function runStoreProcess(command, args, input = "", label = "database helper") {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    maxBuffer: 1024 * 1024 * 80
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${label} failed`).trim());
  }
  return result.stdout || "";
}

function renderPdfFirstPageToPng(inputPath, outputPath) {
  if (!fs.existsSync(PDF_RENDER_HELPER)) {
    throw new Error("PDF 底图转换组件不存在");
  }
  const stdout = runStoreProcess(
    PYTHON_BIN,
    [PDF_RENDER_HELPER, inputPath, outputPath, String(PDF_BACKGROUND_SCALE)],
    "",
    "PDF renderer"
  ).trim();
  const dimensions = stdout ? JSON.parse(stdout) : {};
  const width = Number(dimensions.width || 0);
  const height = Number(dimensions.height || 0);
  if (!width || !height || !fs.existsSync(outputPath)) {
    throw new Error("PDF 底图转换后未生成有效图片");
  }
  return { width, height };
}

function runSqliteHelper(command, input = "") {
  return runStoreProcess(PYTHON_BIN, [SQLITE_HELPER, SQLITE_FILE, command], input, "SQLite helper");
}

function sqliteRead() {
  return runSqliteHelper("read").trim();
}

function sqliteWrite(jsonText) {
  runSqliteHelper("write", jsonText);
}

function runMysqlHelper(command, input = "") {
  return runStoreProcess(PYTHON_BIN, [MYSQL_HELPER, command], input, "MySQL helper");
}

function mysqlRead() {
  return runMysqlHelper("read").trim();
}

function mysqlWrite(jsonText) {
  runMysqlHelper("write", jsonText);
}

function storeRead() {
  return DB_DRIVER === "mysql" ? mysqlRead() : sqliteRead();
}

function storeWrite(jsonText) {
  if (DB_DRIVER === "mysql") {
    mysqlWrite(jsonText);
    return;
  }
  sqliteWrite(jsonText);
}

function normalizeDb(db) {
  db.nextIds = db.nextIds || {};
  db.settings = db.settings || {};
  db.settings.rules = db.settings.rules || {};
  if (db.settings.rules.reserveWorkdays === undefined) {
    db.settings.rules.reserveWorkdays = Number(db.settings.rules.reserveDays || 7);
  }
  if (db.settings.rules.newCustomerProtectDays === undefined) db.settings.rules.newCustomerProtectDays = 30;
  if (db.settings.rules.oldCustomerProtectDays === undefined) db.settings.rules.oldCustomerProtectDays = 30;
  db.settings.rules.deadlineDayMode = deadlineDayMode(db);
  db.settings.rules.salesFlowMode = salesFlowMode(db);
  db.settings.rules.customerTargetMode = customerTargetMode(db);
  db.settings.rules.adminContactMaskMode = adminContactMaskMode(db);
  db.settings.rules.contractApprovedVoucherWorkdays = contractApprovedVoucherWorkdays(db);
  const eventLinkDefaultDays = enterpriseLinkMaxDays(db);
  if (!db.settings.rules.enterpriseLinkDaysCustomized || db.settings.rules.enterpriseLinkDays === undefined || Number(db.settings.rules.enterpriseLinkDays) === 30) {
    db.settings.rules.enterpriseLinkDays = eventLinkDefaultDays;
  }
  db.settings.rules.enterpriseLinkDays = clampEnterpriseLinkDays(db, db.settings.rules.enterpriseLinkDays);
  db.settings.rules.enterpriseLinkDaysCustomized = Boolean(db.settings.rules.enterpriseLinkDaysCustomized);
  delete db.settings.rules.reserveDays;
  db.settings.reviewRejectTemplates = Array.isArray(db.settings.reviewRejectTemplates) && db.settings.reviewRejectTemplates.length
    ? db.settings.reviewRejectTemplates.map((item) => String(item || "").trim()).filter(Boolean)
    : ["合同未盖章", "金额不一致", "水单不清晰", "企业名称不一致"];
  db.settings.workdaySync = db.settings.workdaySync || {
    sourceUrl: "https://timor.tech/api/holiday/year/{year}/",
    lastSyncedAt: "",
    lastStatus: "not_synced",
    lastMessage: ""
  };
  db.workdayCalendar = db.workdayCalendar || {};
  db.map = normalizeMapConfig(db.map || defaultMapConfig());
  db.settings.event = db.settings.event || { id: "event-2026", name: "默认展会" };
  db.settings.event.id = String(db.settings.event.id || "event-2026").trim();
  db.settings.event.name = String(db.settings.event.name || "默认展会").trim();
  db.settings.event.startDate = String(db.settings.event.startDate || "").trim();
  db.settings.event.endDate = String(db.settings.event.endDate || "").trim();
  db.settings.event.location = String(db.settings.event.location || "").trim();
  db.settings.event.category = eventCategory(db.settings.event);
  db.settings.event.linkedEventId = String(db.settings.event.linkedEventId || "").trim();
  db.settings.events = normalizeEvents(db.settings.events, db.settings.event);
  db.settings.eventCategories = normalizeEventCategories(db.settings.eventCategories, db.settings.events);
  db.maps = db.maps && typeof db.maps === "object" && !Array.isArray(db.maps) ? db.maps : {};
  if (!db.maps[db.settings.event.id]) db.maps[db.settings.event.id] = db.map;
  Object.keys(db.maps).forEach((eventId) => {
    db.maps[eventId] = normalizeMapConfig(db.maps[eventId]);
  });
  db.map = ensureEventMap(db, db.settings.event.id);
  db.settings.countryRegions = normalizeCountryRegions(db.settings.countryRegions);
  db.settings.zones = normalizeZones(db.settings.zones);
  db.settings.halls = normalizeHalls(db.settings.halls);
  db.settings.furniture = Array.isArray(db.settings.furniture) ? db.settings.furniture : [];
  db.settings.discountRules = normalizeDiscountRules(db.settings.discountRules || db.settings.rules.discountRules || db.settings.rules.discounts);
  db.settings.departments = normalizeDepartments(db.settings.departments);
  db.settings.salesTargets = normalizeSalesTargets(db.settings.salesTargets);
  db.settings.departmentTargets = normalizeDepartmentTargets(db.settings.departmentTargets);
  ["booths", "obstacles", "activityAreas", "companies", "orders", "payments", "profiles", "attachments", "changeRequests", "notifications", "logs"].forEach((key) => {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  });
  db.customerLeads = normalizeCustomerLeads(db.customerLeads);
  db.nextIds.customerLead = Math.max(Number(db.nextIds.customerLead || 1), ...db.customerLeads.map((lead) => lead.id + 1), 1);
  db.eventRoles = normalizeEventRoles(db.eventRoles);
  db.users = Array.isArray(db.users) ? db.users : [];
  db.users.forEach((user) => {
    if (!["admin", "manager", "sales", "enterprise"].includes(user.role)) user.role = "sales";
    user.departmentId = user.role === "admin" || user.role === "enterprise" ? null : Number(user.departmentId || 0) || null;
  });
  const departmentIds = new Set(db.settings.departments.map((item) => Number(item.id)));
  db.users.forEach((user) => {
    if (user.departmentId && !departmentIds.has(Number(user.departmentId))) user.departmentId = null;
  });
  db.nextIds.department = Math.max(Number(db.nextIds.department || 1), ...db.settings.departments.map((item) => item.id + 1), 1);
  ensureDefaultEventRoles(db);
  db.booths.forEach((booth) => {
    booth.hall = String(booth.hall || db.settings.halls[0] || "1鍙烽").trim();
    booth.locked = Boolean(booth.locked);
  });
  db.companies.forEach((company) => {
    company.shortName = String(company.shortName || "").trim();
    company.locationType = company.locationType === "overseas" ? "overseas" : "domestic";
    company.countryRegion = String(company.countryRegion || "").trim();
    company.province = String(company.province || "").trim();
    company.city = String(company.city || "").trim();
  });
  db.orders.forEach((order) => {
    order.eventId = String(order.eventId || db.settings.event.id).trim();
    const eventInfo = db.settings.events.find((event) => event.id === order.eventId);
    order.eventName = String(order.eventName || eventInfo?.name || db.settings.event.name).trim();
  });
  db.obstacles.forEach((obstacle) => {
    obstacle.type = obstacle.type === "internal" ? "internal" : "external";
    obstacle.shape = obstacleShape(obstacle);
    obstacle.boothId = obstacle.type === "internal" ? Number(obstacle.boothId || 0) || null : null;
    const booth = obstacle.boothId ? db.booths.find((item) => Number(item.id) === Number(obstacle.boothId)) : null;
    obstacle.eventId = String(obstacle.eventId || booth?.eventId || db.settings.event.id).trim();
    ["x", "y", "width", "height", "area"].forEach((key) => {
      if (obstacle[key] !== undefined) obstacle[key] = Number(obstacle[key] || 0);
    });
    const scale = Math.max(1, Number(db.map?.scalePxPerMeter || 16));
    obstacle.widthM = Number((obstacle.widthM !== undefined ? Number(obstacle.widthM || 0) : Number(obstacle.width || 0) / scale).toFixed(3));
    obstacle.depthM = Number((obstacle.depthM !== undefined ? Number(obstacle.depthM || 0) : Number(obstacle.height || 0) / scale).toFixed(3));
    obstacle.area = obstacleAreaFromSize(obstacle.widthM, obstacle.depthM, obstacle.shape);
  });
  db.activityAreas.forEach((area) => {
    area.id = Number(area.id || 0);
    area.eventId = String(area.eventId || db.settings.event.id).trim();
    area.name = String(area.name || "活动区").trim() || "活动区";
    ["x", "y", "width", "height"].forEach((key) => {
      area[key] = Number(area[key] || 0);
    });
    area.createdAt = area.createdAt || nowIso();
    area.updatedAt = area.updatedAt || nowIso();
  });
  (db.settings.events || []).forEach((event) => {
    const eventId = event.id;
    const map = db.maps[eventId];
    const hasEventData = db.booths.some((booth) => String(booth.eventId || "") === String(eventId))
      || db.orders.some((order) => String(order.eventId || "") === String(eventId))
      || db.customerLeads.some((lead) => String(lead.eventId || "") === String(eventId))
      || db.obstacles.some((obstacle) => String(obstacleEventId(db, obstacle)) === String(eventId))
      || db.activityAreas.some((area) => String(area.eventId || "") === String(eventId));
    const hasOwnedMapAttachment = db.attachments.some((attachment) => (
      Number(attachment.id) === Number(map?.backgroundAttachmentId)
      && String(attachment.eventId || "") === String(eventId)
    ));
    if (!hasEventData && !hasOwnedMapAttachment) db.maps[eventId] = normalizeMapConfig(defaultMapConfig());
  });
  db.map = ensureEventMap(db, db.settings.event.id);
  db.logs.forEach((log) => {
    log.eventId = String(log.eventId || db.settings.event.id).trim();
  });
  db.notifications.forEach((notification) => {
    notification.eventId = String(notification.eventId || db.settings.event.id).trim();
  });
  normalizeWorkdayDeadlineTimes(db);
  refreshAllBoothBilling(db);
  return db;
}

function loadDb() {
  const raw = storeRead();
  if (!raw) {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
  const db = JSON.parse(raw);
  normalizeDb(db);
  return db;
}

function saveDb(db) {
  normalizeDb(db);
  storeWrite(JSON.stringify(db, (_key, value) => {
    if (typeof value === "string") return value.replace(/[\uD800-\uDFFF]/g, "");
    return value;
  }));
}

function writeLog(db, user, action, detail, targetType = "", targetId = "") {
  db.logs.push({
    id: id(db, "log"),
    eventId: currentEventId(db),
    at: nowIso(),
    userId: user ? user.id : null,
    userName: user ? user.displayName : "System",
    action,
    detail,
    targetType,
    targetId
  });
}

function notify(db, userId, title, content) {
  db.notifications.push({
    id: id(db, "notification"),
    eventId: currentEventId(db),
    userId,
    title,
    content,
    read: false,
    createdAt: nowIso()
  });
}

function notifyOnce(db, userId, title, content, eventId = currentEventId(db)) {
  if (!userId) return false;
  const since = Date.now() - 24 * 3600 * 1000;
  const exists = db.notifications.some((item) => (
    Number(item.userId) === Number(userId)
    && String(item.eventId || eventId) === String(eventId)
    && item.title === title
    && item.content === content
    && new Date(item.createdAt || 0).getTime() >= since
  ));
  if (exists) return false;
  db.notifications.push({
    id: id(db, "notification"),
    eventId,
    userId,
    title,
    content,
    read: false,
    createdAt: nowIso()
  });
  return true;
}

function obstacleShape(obstacle) {
  return boothMath.obstacleShape(obstacle);
}

function obstacleAreaFromSize(widthM, depthM, shape = "rect") {
  return boothMath.obstacleAreaFromSize(widthM, depthM, shape);
}

function obstacleAreaSqm(db, obstacle) {
  return boothMath.obstacleAreaSqm(db, obstacle);
}

function boothObstacleArea(db, booth) {
  return boothMath.boothObstacleArea(db, booth);
}

function boothBillableArea(db, booth) {
  return boothMath.boothBillableArea(db, booth);
}

function boothPrice(db, booth) {
  return boothMath.boothPrice(db, booth);
}

function refreshBoothBilling(db, booth) {
  if (!booth) return;
  booth.obstacleArea = boothObstacleArea(db, booth);
  booth.billableArea = boothBillableArea(db, booth);
  booth.price = boothPrice(db, booth);
}

function refreshAllBoothBilling(db) {
  db.booths.forEach((booth) => refreshBoothBilling(db, booth));
}

function obstacleEventId(db, obstacle) {
  if (obstacle?.eventId) return String(obstacle.eventId);
  const booth = obstacle?.boothId ? db.booths.find((item) => Number(item.id) === Number(obstacle.boothId)) : null;
  return String(booth?.eventId || currentEventId(db));
}

function eventBooths(db, eventId = currentEventId(db)) {
  return db.booths.filter((booth) => String(booth.eventId || eventId) === String(eventId));
}

function eventObstacles(db, eventId = currentEventId(db)) {
  return db.obstacles.filter((obstacle) => String(obstacleEventId(db, obstacle)) === String(eventId));
}

function eventActivityAreas(db, eventId = currentEventId(db)) {
  return (db.activityAreas || []).filter((area) => String(area.eventId || eventId) === String(eventId));
}

function boothNoValidationError(db, boothNo, eventId = currentEventId(db), currentBoothId = null) {
  const value = String(boothNo || "").trim();
  if (!value) return "展位号不能为空";
  if (/\s/.test(String(boothNo || ""))) return "展位号不能包含空格";
  const duplicate = eventBooths(db, eventId).find((booth) => (
    Number(booth.id) !== Number(currentBoothId)
    && String(booth.boothNo || "").trim().toLowerCase() === value.toLowerCase()
  ));
  return duplicate ? `展位号 ${value} 已存在，不能重复` : "";
}

function activeOrderUsesBooth(db, boothId) {
  return db.orders.some((order) => (
    order.type === "booth"
    && isActiveOrder(order)
    && (order.boothIds || []).map(Number).includes(Number(boothId))
  ));
}

function canDeleteBooth(db, booth) {
  if (!booth) return false;
  if (booth.locked) return false;
  if (!["available", "disabled"].includes(booth.status)) return false;
  if (booth.orderId) return false;
  return !activeOrderUsesBooth(db, booth.id);
}

function rectInsideBooth(rect, booth) {
  const left = Number(booth.x || 0);
  const top = Number(booth.y || 0);
  const right = left + Number(booth.width || 0);
  const bottom = top + Number(booth.height || 0);
  return rect.x >= left && rect.y >= top && rect.x + rect.width <= right && rect.y + rect.height <= bottom;
}

function scaleBoothsToMap(db, oldWidth, oldHeight, newWidth, newHeight) {
  const sx = Number(newWidth || oldWidth) / Number(oldWidth || 1);
  const sy = Number(newHeight || oldHeight) / Number(oldHeight || 1);
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return;
  const eventId = currentEventId(db);
  eventBooths(db, eventId).forEach((booth) => {
    booth.x = Math.round(Number(booth.x || 0) * sx);
    booth.y = Math.round(Number(booth.y || 0) * sy);
    booth.width = Math.max(1, Math.round(Number(booth.width || 1) * sx));
    booth.height = Math.max(1, Math.round(Number(booth.height || 1) * sy));
    booth.updatedAt = nowIso();
  });
  eventObstacles(db, eventId).forEach((obstacle) => {
    obstacle.x = Math.round(Number(obstacle.x || 0) * sx);
    obstacle.y = Math.round(Number(obstacle.y || 0) * sy);
    obstacle.width = Math.max(1, Math.round(Number(obstacle.width || 1) * sx));
    obstacle.height = Math.max(1, Math.round(Number(obstacle.height || 1) * sy));
    obstacle.area = obstacleAreaSqm(db, obstacle);
    obstacle.updatedAt = nowIso();
  });
  eventActivityAreas(db, eventId).forEach((area) => {
    area.x = Math.round(Number(area.x || 0) * sx);
    area.y = Math.round(Number(area.y || 0) * sy);
    area.width = Math.max(1, Math.round(Number(area.width || 1) * sx));
    area.height = Math.max(1, Math.round(Number(area.height || 1) * sy));
    area.updatedAt = nowIso();
  });
  refreshAllBoothBilling(db);
}

function resizeBoothsByPhysicalSize(db) {
  const scale = Math.max(1, Number(db.map?.scalePxPerMeter || 16));
  eventBooths(db).forEach((booth) => {
    booth.width = Math.max(1, Math.round(Number(booth.widthM || 0) * scale));
    booth.height = Math.max(1, Math.round(Number(booth.depthM || 0) * scale));
    booth.area = Number((Number(booth.widthM || 0) * Number(booth.depthM || 0)).toFixed(2));
    refreshBoothBilling(db, booth);
    booth.updatedAt = nowIso();
  });
}

function generateBoothGrid(db, options) {
  const rows = Number(options.rows || 10);
  const cols = Number(options.cols || 10);
  const startX = Number(options.startX || 48);
  const startY = Number(options.startY || 68);
  const boothWidth = Number(options.boothWidth || 48);
  const boothHeight = Number(options.boothHeight || 32);
  const gapX = Number(options.gapX || 12);
  const gapY = Number(options.gapY || 12);
  const prefix = String(options.prefix || "");
  const startNo = Number(options.startNo || 1);
  const eventId = currentEventId(db);
  if (options.replace) {
    const deleteBoothIds = new Set(eventBooths(db, eventId).map((booth) => booth.id));
    db.booths = db.booths.filter((booth) => String(booth.eventId || eventId) !== String(eventId));
    db.obstacles = db.obstacles.filter((obstacle) => String(obstacleEventId(db, obstacle)) !== String(eventId) && !deleteBoothIds.has(Number(obstacle.boothId)));
    db.activityAreas = db.activityAreas.filter((area) => String(area.eventId || eventId) !== String(eventId));
    if (!db.booths.length) db.nextIds.booth = 1;
  }
  const created = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const seq = startNo + row * cols + col;
      const attr = row % 5 === 4 ? "raw" : "standard";
      const area = attr === "raw" ? 36 : 9;
      const booth = {
        id: id(db, "booth"),
        eventId,
        boothNo: `${prefix}${seq}`,
        x: startX + col * (boothWidth + gapX),
        y: startY + row * (boothHeight + gapY),
        width: boothWidth,
        height: boothHeight,
        area,
        widthM: attr === "raw" ? 6 : 3,
        depthM: attr === "raw" ? 6 : 3,
        hall: db.settings.halls[0] || "1鍙烽",
        zone: zoneName(db.settings.zones[Math.min(db.settings.zones.length - 1, Math.floor(row / Math.max(1, rows / db.settings.zones.length)))]) || "A鍖?",
        attr,
        price: 0,
        status: "available",
        orderId: null,
        reservedAt: null,
        reservedBy: null,
        updatedAt: nowIso()
      };
      refreshBoothBilling(db, booth);
      db.booths.push(booth);
      created.push(booth);
    }
  }
  return created;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function findUserByToken(db, req, url) {
  const auth = req.headers.authorization || "";
  const tokenFromHeader = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const token = tokenFromHeader || url.searchParams.get("token") || "";
  const session = db.sessions[token];
  if (!session) return { user: null, token: null };
  const storedUser = db.users.find((item) => item.id === session.userId && item.active);
  if (!storedUser) return { user: null, token: null };
  const event = eventById(db, session.eventId) || db.settings.event;
  const role = session.role || effectiveEventRole(db, storedUser, event.id);
  if (!role) return { user: null, token: null };
  const user = { ...storedUser, baseRole: storedUser.role, role, eventId: event.id };
  session.eventId = event.id;
  session.role = role;
  return { user, token, session };
}

function canAccessOrder(db, user, order) {
  if (!user || !order) return false;
  if (isAdminLike(user)) return true;
  if (user.role === "sales") return canAccessSalesOwner(db, user, order.salespersonId);
  return user.role === "enterprise" && order.id === user.orderId;
}

function canAccessAttachment(db, user, attachment) {
  if (!attachment || !user) return false;
  if (attachment.id === ensureEventMap(db, currentEventId(db))?.backgroundAttachmentId) return true;
  if (attachment.category === "furniture-image") return true;
  if (isAdminLike(user)) return true;
  if (attachment.uploadedBy === user.id) return true;
  if (user.role === "sales") {
    if (attachment.leadId) {
      return db.customerLeads.some((lead) => Number(lead.id) === Number(attachment.leadId) && canAccessSalesOwner(db, user, lead.ownerSalesId));
    }
    return db.orders.some((order) => canAccessOrder(db, user, order) && attachment.orderId === order.id);
  }
  if (user.role === "enterprise") {
    return attachment.orderId === user.orderId || attachment.companyId === user.companyId;
  }
  return false;
}

function send(res, status, data, headers = {}) {
  const body = data === undefined ? "" : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function looksMojibake(value) {
  return /[�]|[璇鏃浼瀹鎵鍙鍚绋閮灞闄妯鍥鐢璐鍒姘椤缂绾]/.test(String(value || ""));
}

function fallbackErrorMessage(status) {
  if (status === 400) return "请求参数不正确，请检查后重试";
  if (status === 401) return "登录信息不正确，请重新登录";
  if (status === 403) return "无权操作";
  if (status === 404) return "数据不存在";
  if (status === 409) return "当前操作无法完成，请检查数据状态";
  if (status === 410) return "链接已过期";
  if (status === 413) return "文件过大";
  if (status === 502) return "外部同步失败，请稍后重试";
  if (status >= 500) return "服务器错误，请稍后重试";
  return "操作失败，请检查后重试";
}

function sendError(res, status, message) {
  const text = String(message || "").trim();
  send(res, status, { error: looksMojibake(text) ? fallbackErrorMessage(status) : text });
}

function reviewRemarkFromBody(body) {
  return String(body?.reviewRemark || "").trim();
}

function requireRejectedReviewRemark(res, status, body) {
  if (status === "rejected" && !reviewRemarkFromBody(body)) {
    sendError(res, 400, "瀹℃牳涓嶉€氳繃鏃跺繀椤诲～鍐欏師鍥?");
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 40 * 1024 * 1024) {
        reject(new Error("璇锋眰浣撹秴杩?40MB 闄愬埗"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        return resolve(JSON.parse(raw));
      } catch (error) {
        return reject(new Error("JSON 鏍煎紡涓嶆纭?"));
      }
    });
    req.on("error", reject);
  });
}

let apiQueue = Promise.resolve();
function withApiLock(task) {
  const run = apiQueue.then(task, task);
  apiQueue = run.catch(() => {});
  return run;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "expo-sales-mvp/1.0" }, timeout: 12000 }, (response) => {
      let raw = "";
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("鍚屾瓒呮椂")));
    request.on("error", reject);
  });
}

async function syncCountryRegions() {
  const rows = await fetchJson("https://restcountries.com/v3.1/all?fields=name,cca2,translations");
  const forced = new Map([["HK", "涓浗棣欐腐"], ["MO", "涓浗婢抽棬"], ["TW", "涓浗鍙版咕"]]);
  const regions = rows.map((item) => {
    const code = String(item.cca2 || "").toUpperCase();
    const name = forced.get(code)
      || String(item.translations?.zho?.common || item.translations?.zh?.common || item.name?.common || "").trim();
    return { code, name };
  }).filter((item) => item.code && item.name && item.code !== "CN");
  return normalizeCountryRegions(regions).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function requireRole(user, roles) {
  if (!user) return false;
  return roles.some((role) => {
    if (role === "superadmin") return isSuperAdmin(user);
    if (role === "admin") return isAdminLike(user);
    return user.role === role;
  });
}

function orderNo(db) {
  return `ORD${new Date().getFullYear()}${String(db.nextIds.order).padStart(5, "0")}`;
}

function recalcOrder(db, order) {
  return orderWorkflow.recalculateOrderStatus(db, order, isActiveOrder);
}

function ensureProfile(db, order) {
  let profile = db.profiles.find((item) => item.orderId === order.id);
  if (!profile) {
    const company = db.companies.find((item) => item.id === order.companyId);
    profile = {
      id: id(db, "profile"),
      orderId: order.id,
      companyId: order.companyId,
      catalog: {
        companyIntro: "",
        productIntro: "",
        videoAttachmentId: null,
        productImageIds: []
      },
      badges: [],
      fascia: {
        defaultName: company ? company.name : "",
        requestedName: "",
        status: "default",
        reviewRemark: ""
      },
      rentals: [],
      updatedAt: nowIso()
    };
    db.profiles.push(profile);
  }
  return profile;
}

function releaseExpiredOrders(db, actor) {
  const now = Date.now();
  const released = [];
  db.orders.forEach((order) => {
    if (!["reserved", "pending_payment_review"].includes(order.status)) return;
    const lead = activeLeadForOrder(db, order);
    const reserveExpired = order.reserveExpiresAt && new Date(order.reserveExpiresAt).getTime() <= now;
    const voucherDueExpired = Boolean(
      lead
      && salesFlowMode(db) === "contract_first"
      && lead.contractReviewStatus === "approved"
      && lead.voucherReviewStatus !== "approved"
      && lead.voucherReviewStatus !== "pending"
      && lead.voucherDueAt
      && new Date(lead.voucherDueAt).getTime() <= now
    );
    if (!reserveExpired && !voucherDueExpired) return;
    recalcOrder(db, order);
    if (order.status === "sold") return;
    const pendingPayment = db.payments.some((payment) => payment.orderId === order.id && payment.status === "pending");
    if (pendingPayment) return;
    if (leadHasPendingReview(lead)) return;
    if (lead && salesFlowMode(db) === "contract_first" && lead.contractReviewStatus === "approved") {
      if (lead.voucherReviewStatus === "approved") return;
      const due = new Date(lead.voucherDueAt || order.reserveExpiresAt).getTime();
      if (Number.isFinite(due) && due > now) return;
      releaseLeadToPublic(db, lead, "鍚堝悓瀹℃牳閫氳繃鍚庢湭鍦ㄨ瀹氭湡闄愬唴涓婁紶姘村崟", actor);
      if (releaseOrderBooths(db, order, "鍚堝悓瀹℃牳閫氳繃鍚庢湭鍦ㄨ瀹氭湡闄愬唴涓婁紶姘村崟", actor)) released.push(order);
      return;
    }
    if (lead && salesFlowMode(db) === "voucher_direct" && lead.voucherReviewStatus === "approved") return;
    const hasVoucher = db.payments.some((payment) => payment.orderId === order.id);
    const belowDeposit = Number(order.paidApprovedAmount || 0) < Number(order.depositRequired || 0);
    if (!hasVoucher || belowDeposit) {
      const reason = !hasVoucher ? "预留到期未上传水单" : "预留到期未达到首款比例";
      if (releaseOrderBooths(db, order, reason, actor)) released.push(order);
    }
  });
  return released;
}

function boothSnapshotFromBooth(booth) {
  return {
    id: booth.id,
    boothNo: booth.boothNo,
    area: booth.area,
    obstacleArea: booth.obstacleArea || 0,
    billableArea: booth.billableArea || booth.area,
    hall: booth.hall || "",
    zone: booth.zone,
    attr: booth.attr,
    price: booth.price
  };
}

function orderDiscountFromRule(db, subtotal, discountRuleId) {
  const rule = (db.settings.discountRules || []).find((item) => String(item.id) === String(discountRuleId || ""));
  const originalAmount = Math.max(0, Number(subtotal || 0));
  if (!rule) {
    return {
      originalAmount,
      discountRuleId: "",
      discountReason: "",
      discountAmount: 0,
      totalAmount: originalAmount
    };
  }
  const discountAmount = Math.min(originalAmount, Math.max(0, Number(rule.price || 0)));
  return {
    originalAmount,
    discountRuleId: rule.id,
    discountReason: rule.reason,
    discountAmount,
    totalAmount: Math.max(0, originalAmount - discountAmount)
  };
}

function applyOrderDiscount(db, order, subtotal) {
  const discount = orderDiscountFromRule(db, subtotal, order.discountRuleId);
  order.originalAmount = discount.originalAmount;
  order.discountRuleId = discount.discountRuleId;
  order.discountReason = discount.discountReason;
  order.discountAmount = discount.discountAmount;
  order.totalAmount = discount.totalAmount;
  order.depositRequired = Math.ceil(order.totalAmount * Number(db.settings.rules.depositRate || 0));
}

function applyChangeRequest(db, request) {
  const order = db.orders.find((item) => item.id === request.orderId);
  if (!order) return { ok: false, status: 404, error: "璁㈠崟涓嶅瓨鍦?" };
  const data = request.changeData || {};
  if (data.action === "change_booth") {
    if (order.type !== "booth") return { ok: false, status: 409, error: "鏃犲睍浣嶈鍗曚笉鑳芥洿鎹㈠睍浣?" };
    if (isClosedOrderStatus(order.status)) return { ok: false, status: 409, error: "宸茬粨鏉熻鍗曚笉鑳芥洿鎹㈠睍浣?" };
    const boothIds = [...new Set(Array.isArray(data.boothIds) ? data.boothIds.map(Number).filter(Boolean) : [])];
    if (!boothIds.length) return { ok: false, status: 400, error: "璇烽€夋嫨鏂扮殑灞曚綅" };
    const booths = boothIds.map((boothId) => db.booths.find((item) => item.id === boothId && String(item.eventId || order.eventId) === String(order.eventId)));
    if (booths.some((booth) => !booth)) return { ok: false, status: 404, error: "鏂板睍浣嶄笉瀛樺湪" };
    if (booths.some((booth) => booth.status !== "available")) return { ok: false, status: 409, error: "鏂板睍浣嶅凡琚崰鐢紝涓嶈兘閫氳繃璇ュ彉鏇?" };

    order.boothIds.forEach((boothId) => {
      const booth = db.booths.find((item) => item.id === boothId && item.orderId === order.id);
      if (booth) {
        booth.status = "available";
        booth.orderId = null;
        booth.reservedAt = null;
        booth.reservedBy = null;
        booth.updatedAt = nowIso();
      }
    });

    order.boothIds = boothIds;
    order.boothSnapshot = booths.map(boothSnapshotFromBooth);
    applyOrderDiscount(db, order, order.boothSnapshot.reduce((sum, booth) => sum + Number(booth.price || 0), 0));
    order.updatedAt = nowIso();
    booths.forEach((booth) => {
      booth.orderId = order.id;
      booth.reservedBy = order.salespersonId;
      booth.reservedAt = nowIso();
      booth.updatedAt = nowIso();
      booth.status = "reserved";
    });
    recalcOrder(db, order);
    booths.forEach((booth) => {
      booth.status = order.status === "sold" ? "sold" : "reserved";
    });
    return { ok: true, detail: `${order.orderNo} 宸叉洿鎹负 ${order.boothSnapshot.map((booth) => booth.boothNo).join(" / ")}` };
  }

  if (data.action === "cancel_order") {
    if (isClosedOrderStatus(order.status)) return { ok: false, status: 409, error: "璁㈠崟宸茬粡缁撴潫" };
    order.status = "cancelled";
    order.cancelledAt = nowIso();
    order.cancelReason = request.detail || "閫€璁㈠睍浣?";
    order.updatedAt = nowIso();
    order.boothIds.forEach((boothId) => {
      const booth = db.booths.find((item) => item.id === boothId && item.orderId === order.id);
      if (booth) {
        booth.status = "available";
        booth.orderId = null;
        booth.reservedAt = null;
        booth.reservedBy = null;
        booth.updatedAt = nowIso();
      }
    });
    return { ok: true, detail: `${order.orderNo} 宸查€€璁紝灞曚綅宸查噴鏀綻 ` };
  }

  if (data.action === "special_order") {
    if (!isActiveOrder(order)) return { ok: false, status: 409, error: "璁㈠崟宸茬粡缁撴潫锛屼笉鑳借浆涓虹壒娈婅鍗?" };
    if (order.status === "sold" && !order.specialApproved) return { ok: false, status: 409, error: "璁㈠崟宸茬粡鎴愪氦锛屾棤闇€杞负鐗规畩璁㈠崟" };
    if (Number(order.totalAmount || 0) <= 0) return { ok: false, status: 409, error: "璁㈠崟閲戦涓?0锛屼笉鑳界敵璇风壒娈婅鍗?" };
    order.specialApproved = true;
    order.specialApprovedAt = nowIso();
    order.specialRequestId = request.id;
    order.status = "sold";
    order.updatedAt = nowIso();
    if (order.type === "booth") {
      order.boothIds.forEach((boothId) => {
        const booth = db.booths.find((item) => item.id === boothId && item.orderId === order.id);
        if (booth) {
          booth.status = "sold";
          booth.updatedAt = nowIso();
        }
      });
      ensureProfile(db, order);
    }
    markCustomerLeadConverted(db, order.eventId, order.companyId);
    return { ok: true, detail: `${order.orderNo} 宸查€氳繃鐗规畩璁㈠崟鐢宠锛岃鍏ユ垚浜や絾涓嶅鍔犲埌娆鹃噾棰漙 ` };
  }

  return { ok: true, detail: `${order.orderNo} 鍙樻洿宸插鏍搁€氳繃` };
}

function buildBootstrap(db, user) {
  const safeUsers = db.users.map(sanitizeUser);
  const eventId = db.settings.event.id;
  const currentEventCategory = eventCategoryById(db, eventId);
  const allEvents = db.settings.events || [db.settings.event];
  const visibleSettings = {
    ...db.settings,
    event: db.settings.event,
    events: isSuperAdmin(user)
      ? allEvents
      : allEvents.filter((event) => eventCategory(event) === currentEventCategory || event.id === db.settings.event.linkedEventId),
    eventCategories: isSuperAdmin(user)
      ? normalizeEventCategories(db.settings.eventCategories, allEvents)
      : [currentEventCategory]
  };
  const eventOrders = db.orders.filter((order) => String(order.eventId || eventId) === String(eventId));
  const warehouseOrders = isSuperAdmin(user)
    ? db.orders.filter((order) => order.status === "sold")
    : isAdminLike(user)
      ? db.orders.filter((order) => order.status === "sold" && eventCategoryById(db, order.eventId) === currentEventCategory)
      : [];
  const currentMap = ensureEventMap(db, eventId);
  const visibleEventBooths = eventBooths(db, eventId);
  const visibleEventObstacles = eventObstacles(db, eventId);
  const visibleActivityAreas = eventActivityAreas(db, eventId);
  const eventLeads = db.customerLeads.filter((lead) => String(lead.eventId) === String(eventId));
  const visibleLeads = isAdminLike(user)
    ? eventLeads
    : eventLeads.filter((lead) => lead.status === "public" || canAccessSalesOwner(db, user, lead.ownerSalesId));
  const eventLeadByCompany = new Map(eventLeads.map((lead) => [Number(lead.companyId), lead]));
  let orderIds = new Set();
  if (isAdminLike(user)) {
    orderIds = new Set(eventOrders.map((order) => order.id));
  } else if (user.role === "sales") {
    orderIds = new Set(eventOrders.filter((order) => canAccessOrder(db, user, order)).map((order) => order.id));
  } else if (user.role === "enterprise") {
    orderIds = new Set([user.orderId]);
  }
  const companyIds = new Set(
    db.orders.filter((order) => orderIds.has(order.id)).map((order) => order.companyId)
  );
  warehouseOrders.forEach((order) => companyIds.add(order.companyId));
  visibleLeads.forEach((lead) => companyIds.add(lead.companyId));
  const notifications = db.notifications.filter((item) => item.userId === user.id && String(item.eventId || eventId) === String(eventId));
  return {
    me: sanitizeUser(user),
    settings: visibleSettings,
    map: currentMap,
    eventRoles: isSuperAdmin(user) ? db.eventRoles : [],
    customerLeads: visibleLeads.map((lead) => leadForUser(user, lead)),
    users: isAdminLike(user) ? safeUsers : safeUsers.filter((item) => item.role !== "enterprise"),
    booths: user.role === "enterprise" ? db.booths.filter((booth) => orderIds.has(booth.orderId)) : visibleEventBooths,
    obstacles: user.role === "enterprise" ? db.obstacles.filter((obstacle) => {
      const booth = db.booths.find((item) => item.id === obstacle.boothId);
      return String(obstacleEventId(db, obstacle)) === String(eventId) && (obstacle.type === "external" || (booth && orderIds.has(booth.orderId)));
    }) : visibleEventObstacles,
    activityAreas: visibleActivityAreas,
    companies: db.companies
      .filter((company) => companyIds.has(company.id))
      .map((company) => companyForUser(db, user, company, eventLeadByCompany.get(Number(company.id)))),
    orders: isAdminLike(user) ? eventOrders : db.orders.filter((order) => orderIds.has(order.id)),
    warehouseOrders: isAdminLike(user) ? warehouseOrders.map((order) => ({
      ...order,
      eventName: order.eventName || eventById(db, order.eventId)?.name || "",
      eventCategory: eventCategoryById(db, order.eventId)
    })) : [],
    payments: isAdminLike(user) ? db.payments.filter((payment) => orderIds.has(payment.orderId)) : db.payments.filter((payment) => orderIds.has(payment.orderId)),
    profiles: isAdminLike(user) ? db.profiles.filter((profile) => orderIds.has(profile.orderId)) : db.profiles.filter((profile) => orderIds.has(profile.orderId)),
    attachments: isAdminLike(user) ? db.attachments.filter((attachment) => canAccessAttachment(db, user, attachment)) : db.attachments.filter((attachment) => canAccessAttachment(db, user, attachment)),
    changeRequests: isAdminLike(user) ? db.changeRequests.filter((item) => orderIds.has(item.orderId)) : db.changeRequests.filter((item) => orderIds.has(item.orderId)),
    notifications,
    logs: db.logs
      .filter((log) => String(log.eventId || eventId) === String(eventId) && Number(log.userId) === Number(user.id))
      .slice(-300)
      .reverse()
  };
}

function boothEquivalentCount(booths) {
  return boothMath.boothEquivalentCount(booths);
}

function dashboard(db, user) {
  const eventId = db.settings.event.id;
  const eventOrders = db.orders.filter((order) => String(order.eventId || eventId) === String(eventId));
  const eventBooths = db.booths.filter((booth) => String(booth.eventId || eventId) === String(eventId));
  const visibleOrders = isAdminLike(user)
    ? eventOrders
    : eventOrders.filter((order) => order.salespersonId === user.id || order.id === user.orderId);
  const boothIds = new Set(visibleOrders.flatMap((order) => order.boothIds || []));
  const visibleBooths = user.role === "enterprise" ? db.booths.filter((booth) => boothIds.has(booth.id)) : eventBooths;
  const totalAmount = visibleOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const paidAmount = visibleOrders.reduce((sum, order) => sum + Number(order.paidApprovedAmount || 0), 0);
  const departments = db.settings.departments || [];
  const usersById = new Map(db.users.map((item) => [Number(item.id), item]));
  const boothsById = new Map(eventBooths.map((item) => [Number(item.id), item]));
  const orderBoothCount = (order) => boothEquivalentCount((order.boothIds || [])
    .map((boothId) => boothsById.get(Number(boothId)))
    .filter(Boolean));
  const visibleBoothOrders = visibleOrders.filter((order) => order.type === "booth" && isActiveOrder(order));
  const reservedBoothCount = visibleBoothOrders
    .filter((order) => order.status !== "sold" && Number(order.paidApprovedAmount || 0) <= 0)
    .reduce((sum, order) => sum + orderBoothCount(order), 0);
  const departmentRows = new Map();
  visibleOrders.filter((order) => !isClosedOrderStatus(order.status)).forEach((order) => {
    const salesperson = usersById.get(Number(order.salespersonId));
    const departmentId = Number(salesperson?.departmentId || 0);
    const key = departmentId || "none";
    if (!departmentRows.has(key)) {
      const department = departments.find((item) => Number(item.id) === departmentId);
      departmentRows.set(key, {
        departmentId,
        departmentName: department?.name || "鏈垎閰嶉儴闂?",
        salespersonIds: new Set(),
        companyIds: new Set(),
        boothCount: 0,
        reservedBoothCount: 0,
        paidBoothCount: 0,
        firstPaymentBoothCount: 0,
        receivedAmount: 0,
        unpaidAmount: 0
      });
    }
    const row = departmentRows.get(key);
    if (salesperson) row.salespersonIds.add(Number(salesperson.id));
    if (order.companyId) row.companyIds.add(Number(order.companyId));
    const orderBooths = (order.boothIds || []).map((id) => boothsById.get(Number(id))).filter(Boolean);
    const count = boothEquivalentCount(orderBooths);
    row.boothCount += count;
    if (count && order.status !== "sold" && Number(order.paidApprovedAmount || 0) <= 0) row.reservedBoothCount += count;
    if (Number(order.paidApprovedAmount || 0) > 0) row.paidBoothCount += count;
    if (order.status === "sold") row.firstPaymentBoothCount += count;
    row.receivedAmount += Number(order.paidApprovedAmount || 0);
    row.unpaidAmount += Math.max(0, Number(order.totalAmount || 0) - Number(order.paidApprovedAmount || 0));
  });
  const departmentStats = Array.from(departmentRows.values()).map((row) => ({
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    salespersonCount: row.salespersonIds.size,
    companyCount: row.companyIds.size,
    boothCount: Number(row.boothCount.toFixed(2)),
    reservedBoothCount: Number(row.reservedBoothCount.toFixed(2)),
    paidBoothCount: Number(row.paidBoothCount.toFixed(2)),
    firstPaymentBoothCount: Number(row.firstPaymentBoothCount.toFixed(2)),
    paidRate: row.boothCount ? Math.round((row.paidBoothCount / row.boothCount) * 100) : 0,
    receivedAmount: Number(row.receivedAmount.toFixed(2)),
    unpaidAmount: Number(row.unpaidAmount.toFixed(2))
  })).sort((a, b) => a.departmentName.localeCompare(b.departmentName, "zh-CN"));
  return {
    totalBooths: boothEquivalentCount(visibleBooths),
    totalArea: visibleBooths.reduce((sum, booth) => sum + Number(booth.area || 0), 0),
    standardCount: boothEquivalentCount(visibleBooths.filter((booth) => booth.attr === "standard")),
    rawArea: visibleBooths.filter((booth) => booth.attr === "raw").reduce((sum, booth) => sum + Number(booth.area || 0), 0),
    availableCount: boothEquivalentCount(visibleBooths.filter((booth) => booth.status === "available")),
    reservedCount: Number(reservedBoothCount.toFixed(2)),
    soldCount: boothEquivalentCount(visibleBooths.filter((booth) => booth.status === "sold")),
    disabledCount: boothEquivalentCount(visibleBooths.filter((booth) => booth.status === "disabled")),
    totalAmount,
    paidAmount,
    unpaidAmount: Math.max(0, totalAmount - paidAmount),
    orderCount: visibleOrders.length,
    soldOrderCount: visibleOrders.filter((order) => order.status === "sold").length,
    departmentStats
  };
}

function csv(rows) {
  return rows.map((row) => row.map((value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url, body = {}) {
  const db = loadDb();
  const method = req.method || "GET";
  const pathname = url.pathname;
  const { user, token, session } = findUserByToken(db, req, url);

  if (pathname === "/api/public/events" && method === "GET") {
    const currentId = db.settings.event.id;
    const events = (db.settings.events || [db.settings.event]).slice().sort((a, b) => (
      eventCategory(a).localeCompare(eventCategory(b), "zh-CN") || (a.id === currentId ? -1 : b.id === currentId ? 1 : a.name.localeCompare(b.name, "zh-CN"))
    ));
    const categories = normalizeEventCategories(db.settings.eventCategories, events);
    return send(res, 200, { events, categories, currentEventId: currentId });
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    const found = db.users.find((item) => item.username === body.username && item.active);
    if (!found || found.passwordHash !== hashPassword(body.password || "")) {
      return sendError(res, 401, "璐﹀彿鎴栧瘑鐮佷笉姝ｇ‘");
    }
    const requestedCategory = String(body.eventCategory || "").trim();
    if (!body.eventId) return sendError(res, 400, "璇峰厛閫夋嫨灞曚細绫诲埆鍜屽睍浼?");
    const event = eventById(db, body.eventId);
    if (!event) return sendError(res, 404, "灞曚細涓嶅瓨鍦?");
    if (requestedCategory && eventCategory(event) !== requestedCategory) return sendError(res, 400, "灞曚細绫诲埆涓庡睍浼氫笉鍖归厤");
    const role = effectiveEventRole(db, found, event.id);
    if (!role) return sendError(res, 403, "璇ヨ处鍙锋病鏈夋墍閫夊睍浼氱殑鐧诲綍鏉冮檺");
    const newToken = randomToken();
    db.sessions[newToken] = { userId: found.id, eventId: event.id, role, createdAt: nowIso() };
    db.settings.event = event;
    ensureEventMap(db, event.id);
    found.lastLoginAt = nowIso();
    writeLog(db, { ...found, role }, "鐧诲綍绯荤粺", `${found.username} / ${event.name}`, "user", found.id);
    saveDb(db);
    return send(res, 200, { token: newToken, user: sanitizeUser({ ...found, role, eventId: event.id }) });
  }

  if (pathname === "/api/me/password" && method === "PUT") {
    if (!user) return sendError(res, 401, "请先登录");
    if (!["admin", "manager", "sales"].includes(user.role)) return sendError(res, 403, "当前账号不能修改密码");
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!currentPassword || !newPassword) return sendError(res, 400, "请填写原密码和新密码");
    if (newPassword.length < 6) return sendError(res, 400, "新密码至少需要 6 位");
    const targetUser = db.users.find((item) => Number(item.id) === Number(user.id));
    if (!targetUser) return sendError(res, 404, "账号不存在");
    if (targetUser.passwordHash !== hashPassword(currentPassword)) return sendError(res, 401, "原密码不正确");
    targetUser.passwordHash = hashPassword(newPassword);
    writeLog(db, user, "修改自己的密码", targetUser.username, "user", targetUser.id);
    saveDb(db);
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/auth/enterprise-link" && method === "POST") {
    const accessToken = String(body.token || "").trim();
    if (!accessToken) return sendError(res, 400, "閾炬帴鍙傛暟涓嶆纭?");
    const order = db.orders.find((item) => item.enterpriseAccessToken === accessToken);
    if (!order || order.type !== "booth" || order.status !== "sold") return sendError(res, 404, "浼佷笟閾炬帴涓嶅瓨鍦ㄦ垨璁㈠崟灏氭湭鎴愪氦");
    const expiresAt = new Date(order.enterpriseAccessExpiresAt || 0).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return sendError(res, 410, "浼佷笟閾炬帴宸茶繃鏈燂紝璇疯仈绯讳笟鍔″憳閲嶆柊鐢熸垚");
    const event = eventById(db, order.eventId) || db.settings.event;
    const enterpriseUser = ensureEnterpriseUserForOrder(db, order, "");
    const newToken = randomToken();
    db.sessions[newToken] = { userId: enterpriseUser.id, eventId: event.id, role: "enterprise", createdAt: nowIso(), loginBy: "enterprise-link" };
    db.settings.event = event;
    ensureEventMap(db, event.id);
    enterpriseUser.lastLoginAt = nowIso();
    writeLog(db, { ...enterpriseUser, role: "enterprise" }, "浼佷笟鍏嶇櫥褰曢摼鎺ヨ繘鍏?", `${order.orderNo} / ${event.name}`, "order", order.id);
    saveDb(db);
    return send(res, 200, { token: newToken, user: sanitizeUser({ ...enterpriseUser, role: "enterprise", eventId: event.id }), expiresAt: order.enterpriseAccessExpiresAt });
  }

  if (!user) return sendError(res, 401, "璇峰厛鐧诲綍");
  applySessionEvent(db, session);
  const leadsChanged = syncCustomerLeadsForCurrentEvent(db);
  const remindersChanged = syncWorkflowReminders(db);
  const workflowChanged = leadsChanged || remindersChanged;
  if (workflowChanged) saveDb(db);

  if (pathname === "/api/auth/logout" && method === "POST") {
    delete db.sessions[token];
    saveDb(db);
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/bootstrap" && method === "GET") {
    return send(res, 200, buildBootstrap(db, user));
  }

  if (pathname === "/api/dashboard" && method === "GET") {
    return send(res, 200, dashboard(db, user));
  }

  const notificationReadMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (notificationReadMatch && method === "POST") {
    const notification = db.notifications.find((item) => (
      Number(item.id) === Number(notificationReadMatch[1])
      && Number(item.userId) === Number(user.id)
      && String(item.eventId || db.settings.event.id) === String(db.settings.event.id)
    ));
    if (!notification) return sendError(res, 404, "鎻愰啋涓嶅瓨鍦?");
    notification.read = true;
    notification.readAt = nowIso();
    saveDb(db);
    return send(res, 200, { notification });
  }

  if (pathname === "/api/event" && method === "PUT") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const currentEvent = eventById(db, db.settings.event.id) || db.settings.event || {};
    const event = {
      id: String(currentEvent.id || "event-2026").trim(),
      name: String(body.name || "鏈懡鍚嶅睍浼?").trim(),
      startDate: String(body.startDate || "").trim(),
      endDate: String(body.endDate || "").trim(),
      location: String(body.location || "").trim(),
      category: isSuperAdmin(user) ? eventCategory({ category: body.category }) : eventCategory(currentEvent),
      linkedEventId: isSuperAdmin(user) ? String(body.linkedEventId || "").trim() : String(currentEvent.linkedEventId || "").trim()
    };
    if (!event.id || !event.name) return sendError(res, 400, "璇峰～鍐欏睍浼氱紪鍙峰拰鍚嶇О");
    if (isSuperAdmin(user) && !normalizeEventCategories(db.settings.eventCategories, db.settings.events).includes(event.category)) {
      return sendError(res, 400, "璇峰厛鍦ㄥ睍浼氬垪琛ㄤ腑鏂板灞曚細绫诲埆");
    }
    db.settings.event = event;
    db.settings.events = normalizeEvents(db.settings.events, event);
    ensureEventMap(db, event.id);
    writeLog(db, user, "鏇存柊灞曚細淇℃伅", event.name, "event", event.id);
    saveDb(db);
    return send(res, 200, { event: db.settings.event, events: db.settings.events });
  }

  if (pathname === "/api/events" && method === "POST") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "鍙湁瓒呯骇绠＄悊鍛樺彲浠ユ柊澧炲睍浼?");
    const category = eventCategory({ category: body.category });
    if (!normalizeEventCategories(db.settings.eventCategories, db.settings.events).includes(category)) {
      return sendError(res, 400, "璇峰厛鍦ㄥ睍浼氬垪琛ㄤ腑鏂板灞曚細绫诲埆");
    }
    const event = {
      id: String(body.id || `event-${Date.now()}`).trim(),
      name: String(body.name || "鏈懡鍚嶅睍浼?").trim(),
      startDate: String(body.startDate || "").trim(),
      endDate: String(body.endDate || "").trim(),
      location: String(body.location || "").trim(),
      category,
      linkedEventId: String(body.linkedEventId || "").trim()
    };
    if (!event.id || !event.name) return sendError(res, 400, "璇峰～鍐欏睍浼氱紪鍙峰拰鍚嶇О");
    if (eventById(db, event.id)) return sendError(res, 409, "灞曚細缂栧彿宸插瓨鍦?");
    db.settings.event = event;
    db.settings.events = normalizeEvents([...(db.settings.events || []), event], event);
    ensureEventMap(db, event.id);
    if (session) {
      session.eventId = event.id;
      session.role = "admin";
    }
    writeLog(db, user, "鏂板灞曚細", event.name, "event", event.id);
    saveDb(db);
    return send(res, 200, { event: db.settings.event, events: db.settings.events });
  }

  if (pathname === "/api/event-categories" && method === "POST") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "鍙湁瓒呯骇绠＄悊鍛樺彲浠ユ柊澧炲睍浼氱被鍒?");
    const category = eventCategory({ category: body.name || body.category });
    db.settings.eventCategories = normalizeEventCategories([...(db.settings.eventCategories || []), category], db.settings.events);
    writeLog(db, user, "鏂板灞曚細绫诲埆", category, "event");
    saveDb(db);
    return send(res, 200, { categories: db.settings.eventCategories });
  }

  const eventCategoryMatch = pathname.match(/^\/api\/event-categories\/(.+)$/);
  if (eventCategoryMatch && method === "DELETE") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "鍙湁瓒呯骇绠＄悊鍛樺彲浠ュ垹闄ゅ睍浼氱被鍒?");
    const category = eventCategory({ category: decodeURIComponent(eventCategoryMatch[1]) });
    if ((db.settings.events || []).some((event) => eventCategory(event) === category)) {
      return sendError(res, 409, "璇ョ被鍒笅杩樻湁灞曚細锛屼笉鑳藉垹闄?");
    }
    db.settings.eventCategories = normalizeEventCategories(
      (db.settings.eventCategories || []).filter((item) => eventCategory({ category: item }) !== category),
      db.settings.events
    );
    writeLog(db, user, "鍒犻櫎灞曚細绫诲埆", category, "event");
    saveDb(db);
    return send(res, 200, { categories: db.settings.eventCategories });
  }

  if (pathname === "/api/event-roles" && method === "PUT") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "鍙湁瓒呯骇绠＄悊鍛樺彲浠ュ垎閰嶅睍浼氭潈闄?");
    const eventId = String(body.eventId || db.settings.event.id).trim();
    if (!eventById(db, eventId)) return sendError(res, 404, "灞曚細涓嶅瓨鍦?");
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];
    const rows = assignments.map((item) => {
      const targetUser = db.users.find((row) => row.id === Number(item.userId));
      if (!targetUser || targetUser.role === "enterprise" || targetUser.role === "admin") return null;
      const role = item.role === "manager" ? "manager" : item.role === "sales" ? "sales" : "";
      if (!role) return null;
      return { eventId, userId: targetUser.id, role };
    }).filter(Boolean);
    db.eventRoles = db.eventRoles.filter((row) => row.eventId !== eventId).concat(rows);
    writeLog(db, user, "鍒嗛厤灞曚細鏉冮檺", `${eventId}锛?{rows.length} 涓处鍙穈, "event"`, eventId);
    saveDb(db);
    return send(res, 200, { eventRoles: db.eventRoles });
  }

  if (pathname === "/api/events/delete" && method === "POST") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "鍙湁瓒呯骇绠＄悊鍛樺彲浠ユ竻闄ゅ睍浼氭暟鎹?");
    const eventIds = [...new Set((Array.isArray(body.eventIds) ? body.eventIds : []).map((item) => String(item || "").trim()).filter(Boolean))];
    if (!eventIds.length) return sendError(res, 400, "璇烽€夋嫨瑕佹竻闄ょ殑灞曚細");
    const existingIds = new Set((db.settings.events || []).map((event) => event.id));
    const missing = eventIds.filter((eventId) => !existingIds.has(eventId));
    if (missing.length) return sendError(res, 404, `灞曚細涓嶅瓨鍦細${missing.join(" / ")}`);
    const withOrders = eventIds
      .map((eventId) => ({ eventId, count: eventOrderCount(db, eventId), event: eventById(db, eventId) }))
      .filter((item) => item.count > 0);
    if (withOrders.length) {
      return sendError(res, 409, `灞曚細宸叉湁璁㈠崟锛屼笉鑳藉垹闄わ細${withOrders.map((item) => `${item.event?.name || item.eventId}(${item.count})`).join(" / ")}`);
    }
    const result = deleteEventsById(db, eventIds);
    writeLog(db, user, "娓呴櫎灞曚細鏁版嵁", result.deletedEvents.join(" / "), "event", result.deletedEvents.join(","));
    saveDb(db);
    return send(res, 200, result);
  }

  if (pathname === "/api/country-regions/sync" && method === "POST") {
    if (!requireRole(user, ["admin", "sales"])) return sendError(res, 403, "无权创建订单");
    try {
      db.settings.countryRegions = await syncCountryRegions();
      db.settings.countryRegionSync = {
        sourceUrl: "https://restcountries.com/v3.1/all?fields=name,cca2,translations",
        lastSyncedAt: nowIso(),
        lastStatus: "success",
        lastMessage: `宸插悓姝?${db.settings.countryRegions.length} 涓浗瀹舵垨鍦板尯`
      };
      writeLog(db, user, "鍚屾鍥藉鎴栧湴鍖?", db.settings.countryRegionSync.lastMessage);
      saveDb(db);
      return send(res, 200, { countryRegions: db.settings.countryRegions, sync: db.settings.countryRegionSync });
    } catch (error) {
      db.settings.countryRegionSync = {
        sourceUrl: "https://restcountries.com/v3.1/all?fields=name,cca2,translations",
        lastSyncedAt: nowIso(),
        lastStatus: "failed",
        lastMessage: error.message || "鍚屾澶辫触"
      };
      saveDb(db);
      return sendError(res, 502, `鍥藉鎴栧湴鍖哄悓姝ュけ璐ワ細${db.settings.countryRegionSync.lastMessage}`);
    }
  }

  if (pathname === "/api/settings" && method === "PUT") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const incomingRules = body.rules || {};
    const hasEnterpriseLinkDays = incomingRules.enterpriseLinkDays !== undefined;
    db.settings.rules = { ...db.settings.rules, ...incomingRules };
    db.settings.rules.adminContactMaskMode = adminContactMaskMode(db);
    if (hasEnterpriseLinkDays) {
      const maxDays = enterpriseLinkMaxDays(db);
      db.settings.rules.enterpriseLinkDays = clampEnterpriseLinkDays(db, incomingRules.enterpriseLinkDays);
      db.settings.rules.enterpriseLinkDaysCustomized = incomingRules.enterpriseLinkDaysCustomized !== undefined
        ? Boolean(incomingRules.enterpriseLinkDaysCustomized)
        : Number(db.settings.rules.enterpriseLinkDays) < maxDays;
    }
    if (body.workdaySync && body.workdaySync.sourceUrl) {
      db.settings.workdaySync = {
        ...(db.settings.workdaySync || {}),
        sourceUrl: String(body.workdaySync.sourceUrl).trim()
      };
    }
    if (Array.isArray(body.zones)) db.settings.zones = normalizeZones(body.zones);
    if (Array.isArray(body.halls)) db.settings.halls = normalizeHalls(body.halls);
    if (Array.isArray(body.salesTargets)) db.settings.salesTargets = normalizeSalesTargets(body.salesTargets);
    if (Array.isArray(body.departmentTargets)) db.settings.departmentTargets = normalizeDepartmentTargets(body.departmentTargets);
    if (Array.isArray(body.discountRules)) db.settings.discountRules = normalizeDiscountRules(body.discountRules);
    if (Array.isArray(body.reviewRejectTemplates)) {
      db.settings.reviewRejectTemplates = body.reviewRejectTemplates.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20);
    }
    if (Array.isArray(body.furniture)) {
      db.settings.furniture = body.furniture.map((item) => ({
        id: item.id || randomToken(5),
        name: String(item.name || "").trim(),
        size: String(item.size || "").trim(),
        price: Number(item.price || 0),
        image: item.image || "",
        active: item.active !== false
      })).filter((item) => item.name);
    }
    refreshAllBoothBilling(db);
    writeLog(db, user, "更新销售规则", "价格、首款比例或预留规则已更新");
    saveDb(db);
    return send(res, 200, { settings: db.settings });
  }

  if (pathname === "/api/workdays/sync" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const year = Number(body.year || new Date().getFullYear());
    try {
      const calendar = await syncChinaWorkdays(db, year);
      writeLog(db, user, "同步中国大陆工作日", `${year} 年 ${Object.keys(calendar.days).length} 条数据`, "workday", year);
      saveDb(db);
      return send(res, 200, { calendar, sync: db.settings.workdaySync });
    } catch (error) {
      db.settings.workdaySync = {
        ...(db.settings.workdaySync || {}),
        lastSyncedAt: nowIso(),
        lastStatus: "failed",
        lastMessage: error.message || "鍚屾澶辫触"
      };
      writeLog(db, user, "鍚屾涓浗澶ч檰宸ヤ綔鏃ュけ璐?", db.settings.workdaySync.lastMessage, "workday", year);
      saveDb(db);
      return sendError(res, 502, `宸ヤ綔鏃ュ悓姝ュけ璐ワ細${db.settings.workdaySync.lastMessage}`);
    }
  }

  if (pathname === "/api/uploads" && method === "POST") {
    const dataUrl = String(body.dataUrl || "");
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return sendError(res, 400, "鏂囦欢鏁版嵁鏍煎紡涓嶆纭?");
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    const originalName = String(body.fileName || "upload.bin").replace(/[\\/:*?"<>|]/g, "_");
    const category = body.category || "general";
    const leadId = Number(body.leadId || 0);
    const lead = leadId ? db.customerLeads.find((item) => item.id === leadId && String(item.eventId) === String(db.settings.event.id)) : null;
    if (leadId && !lead) return sendError(res, 404, "瀹㈡埛涓嶅瓨鍦?");
    if (lead && !isAdminLike(user) && !canAccessSalesOwner(db, user, lead.ownerSalesId)) {
      return sendError(res, 403, "鏃犳潈涓婁紶璇ュ鎴烽檮浠?");
    }
    if (["customer-contract", "customer-voucher"].includes(category)) {
      if (!lead) return sendError(res, 400, "瀹㈡埛闄勪欢蹇呴』鍏宠仈瀹㈡埛");
      const allowed = ["application/pdf", "image/jpeg", "image/png"].includes(mimeType) || /\.(pdf|jpe?g|png)$/i.test(originalName);
      if (!allowed) return sendError(res, 400, "鍚堝悓鍜屾按鍗曚粎鏀寔 PDF銆丣PG銆丳NG 鏂囦欢");
      if (category === "customer-voucher" && salesFlowMode(db) === "contract_first" && lead.contractReviewStatus !== "approved") {
        return sendError(res, 409, "褰撳墠閿€鍞祦绋嬭姹傚悎鍚屽鏍搁€氳繃鍚庢墠鑳戒笂浼犳按鍗?");
      }
      if (category === "customer-voucher" && salesFlowMode(db) === "contract_first") {
        const due = new Date(lead.voucherDueAt || 0).getTime();
        if (Number.isFinite(due) && due <= Date.now()) return sendError(res, 409, "鍚堝悓閫氳繃鍚庣殑姘村崟涓婁紶鏈熼檺宸茶繃");
      }
    }
    if (category !== "map-background" && isImageFile(mimeType, originalName) && buffer.length > IMAGE_UPLOAD_LIMIT) {
      return sendError(res, 413, "闄ゅ睍浣嶅浘搴曞浘澶栵紝鍥剧墖澶у皬涓嶈兘瓒呰繃 3MB");
    }
    let storedFileName = originalName;
    let storedMimeType = mimeType;
    let storedSize = buffer.length;
    let storedStorageName = "";
    let sourceFileName = null;
    let renderedDimensions = null;
    let fileAlreadyWritten = false;
    if (category === "map-background" && isPdfFile(mimeType, originalName)) {
      const tempPdfName = `${Date.now()}-${randomToken(6)}.pdf`;
      const tempPdfPath = path.join(UPLOAD_DIR, tempPdfName);
      const pngName = `${Date.now()}-${randomToken(6)}.png`;
      const pngPath = path.join(UPLOAD_DIR, pngName);
      fs.writeFileSync(tempPdfPath, buffer);
      try {
        renderedDimensions = renderPdfFirstPageToPng(tempPdfPath, pngPath);
        storedFileName = convertedPdfImageName(originalName);
        storedMimeType = "image/png";
        storedSize = fs.statSync(pngPath).size;
        storedStorageName = pngName;
        sourceFileName = originalName;
        fileAlreadyWritten = true;
      } catch (error) {
        try {
          if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
        } catch (_) {
          // Cleanup failure should not hide the upload error.
        }
        return sendError(res, 422, `PDF 底图转换失败：${error.message || "请转成 PNG 或 JPG 后重新上传"}`);
      } finally {
        try {
          fs.unlinkSync(tempPdfPath);
        } catch (_) {
          // Temporary file may already be gone.
        }
      }
    }
    const ext = path.extname(storedFileName) || `.${storedMimeType.split("/").pop() || "bin"}`;
    const attachment = {
      id: id(db, "attachment"),
      fileName: storedFileName,
      mimeType: storedMimeType,
      size: storedSize,
      category,
      storageName: storedStorageName || `${Date.now()}-${randomToken(6)}${ext}`,
      uploadedBy: user.id,
      orderId: body.orderId || null,
      companyId: body.companyId || null,
      leadId: leadId || null,
      eventId: lead?.eventId || body.eventId || db.settings.event.id,
      createdAt: nowIso()
    };
    if (sourceFileName) attachment.sourceFileName = sourceFileName;
    if (renderedDimensions) {
      attachment.width = renderedDimensions.width;
      attachment.height = renderedDimensions.height;
    }
    if (!fileAlreadyWritten) fs.writeFileSync(path.join(UPLOAD_DIR, attachment.storageName), buffer);
    db.attachments.push(attachment);
    if (lead && category === "customer-contract") {
      lead.contractAttachmentIds = [...new Set([...(lead.contractAttachmentIds || []), attachment.id])];
      lead.contractReviewStatus = "pending";
      lead.contractReviewedBy = null;
      lead.contractReviewedAt = "";
      lead.contractReviewRemark = "";
      eventAdminUsers(db, lead.eventId).forEach((admin) => notify(db, admin.id, "待审核客户合同", `${db.companies.find((item) => item.id === lead.companyId)?.name || "客户"} 上传了合同`));
    }
    if (lead && category === "customer-voucher") {
      lead.voucherAttachmentIds = [...new Set([...(lead.voucherAttachmentIds || []), attachment.id])];
      lead.voucherReviewStatus = "pending";
      lead.voucherReviewedBy = null;
      lead.voucherReviewedAt = "";
      lead.voucherReviewRemark = "";
      eventAdminUsers(db, lead.eventId).forEach((admin) => notify(db, admin.id, "待审核客户水单", `${db.companies.find((item) => item.id === lead.companyId)?.name || "客户"} 上传了水单`));
    }
    writeLog(db, user, "涓婁紶闄勪欢", originalName, "attachment", attachment.id);
    saveDb(db);
    return send(res, 200, { attachment });
  }

  if (pathname.startsWith("/api/files/") && method === "GET") {
    const attachmentId = Number(pathname.split("/").pop());
    const attachment = db.attachments.find((item) => item.id === attachmentId);
    if (!canAccessAttachment(db, user, attachment)) return sendError(res, 403, "鏃犳潈璁块棶闄勪欢");
    const filePath = path.join(UPLOAD_DIR, attachment.storageName);
    if (!fs.existsSync(filePath)) return sendError(res, 404, "鏂囦欢涓嶅瓨鍦?");
    res.writeHead(200, {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`
    });
    fs.createReadStream(filePath).pipe(res);
    return undefined;
  }

  if (pathname === "/api/map/background" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const attachment = db.attachments.find((item) => item.id === Number(body.attachmentId));
    if (!attachment) return sendError(res, 404, "闄勪欢涓嶅瓨鍦?");
    const map = ensureEventMap(db, db.settings.event.id);
    const drawnBooths = eventBooths(db, db.settings.event.id);
    const hasDrawnBooths = drawnBooths.length > 0;
    map.backgroundAttachmentId = attachment.id;
    map.backgroundName = attachment.sourceFileName || attachment.fileName;
    map.backgroundNaturalWidth = body.width ? Number(body.width) : map.backgroundNaturalWidth || null;
    map.backgroundNaturalHeight = body.height ? Number(body.height) : map.backgroundNaturalHeight || null;
    if (!hasDrawnBooths) {
      if (body.width) map.width = Number(body.width);
      if (body.height) map.height = Number(body.height);
    }
    map.scalePxPerMeter = 1;
    map.scaleResetAt = nowIso();
    writeLog(db, user, "更新展位底图", hasDrawnBooths ? `${attachment.fileName}，已保留 ${drawnBooths.length} 个展位并重置比例尺` : attachment.fileName);
    saveDb(db);
    return send(res, 200, { map });
  }

  if (pathname === "/api/map/settings" && method === "PUT") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const map = ensureEventMap(db, db.settings.event.id);
    const oldWidth = Number(map.width || 1);
    const oldHeight = Number(map.height || 1);
    if (body.width) map.width = Number(body.width);
    if (body.height) map.height = Number(body.height);
    if (body.scalePxPerMeter) map.scalePxPerMeter = Math.max(1, Number(body.scalePxPerMeter));
    if (body.scaleBooths && oldWidth > 0 && oldHeight > 0) {
      scaleBoothsToMap(db, oldWidth, oldHeight, map.width, map.height);
    }
    if (body.resizeBoothsByScale) {
      resizeBoothsByPhysicalSize(db);
    }
    writeLog(db, user, "更新展位图比例尺", `1 米 = ${map.scalePxPerMeter} 像素`);
    saveDb(db);
    return send(res, 200, { map });
  }

  if (pathname === "/api/map/snapshot" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const eventId = db.settings.event.id;
    const incomingBooths = Array.isArray(body.booths) ? body.booths : [];
    const incomingObstacles = Array.isArray(body.obstacles) ? body.obstacles : [];
    const incomingActivityAreas = Array.isArray(body.activityAreas) ? body.activityAreas : [];
    const incomingBoothNos = new Set();
    for (const item of incomingBooths) {
      const boothNo = String(item.boothNo || "").trim();
      const noError = !boothNo ? "展位号不能为空" : /\s/.test(String(item.boothNo || "")) ? "展位号不能包含空格" : "";
      if (noError) return sendError(res, 400, noError);
      const key = boothNo.toLowerCase();
      if (incomingBoothNos.has(key)) return sendError(res, 409, `展位号 ${boothNo} 已存在，不能重复`);
      incomingBoothNos.add(key);
    }
    const snapshotById = new Map(incomingBooths.map((booth) => [Number(booth.id), booth]));
    const protectedBooths = eventBooths(db, eventId).filter((booth) => !canDeleteBooth(db, booth));
    const changedProtected = protectedBooths.filter((booth) => {
      const next = snapshotById.get(Number(booth.id));
      if (!next) return true;
      const keys = ["boothNo", "x", "y", "width", "height", "area", "widthM", "depthM", "hall", "zone", "attr", "status", "orderId", "reservedAt", "reservedBy"];
      return keys.some((key) => String(next[key] ?? "") !== String(booth[key] ?? ""));
    });
    if (changedProtected.length) return sendError(res, 409, `鏈夊凡棰勭暀/鎴愪氦/閿佸畾灞曚綅锛屼笉鑳介€氳繃鎾ら攢瑕嗙洊锛?{changedProtected.map((booth) => booth.boothNo).join(" / ")}`);
    const boothIds = new Set();
    const restoredBooths = incomingBooths.map((item) => {
      const booth = {
        id: Number(item.id || id(db, "booth")),
        eventId,
        boothNo: String(item.boothNo || "").trim() || `B${db.nextIds.booth}`,
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        width: Number(item.width || 60),
        height: Number(item.height || 40),
        area: Number(item.area || 9),
        widthM: Number(item.widthM || 3),
        depthM: Number(item.depthM || 3),
        hall: String(item.hall || db.settings.halls[0] || "1鍙烽").trim(),
        zone: String(item.zone || zoneName(db.settings.zones[0]) || "A鍖?").trim(),
        attr: item.attr === "raw" ? "raw" : "standard",
        price: Number(item.price || 0),
        status: ["available", "reserved", "pending_payment_review", "sold", "disabled"].includes(item.status) ? item.status : "available",
        orderId: item.orderId || null,
        reservedAt: item.reservedAt || null,
        reservedBy: item.reservedBy || null,
        locked: Boolean(item.locked),
        updatedAt: nowIso()
      };
      boothIds.add(booth.id);
      refreshBoothBilling(db, booth);
      return booth;
    });
    const restoredObstacles = incomingObstacles.map((item) => ({
      id: Number(item.id || id(db, "obstacle")),
      eventId,
      type: item.type === "internal" ? "internal" : "external",
      shape: item.shape === "circle" ? "circle" : "rect",
      boothId: item.type === "internal" && boothIds.has(Number(item.boothId)) ? Number(item.boothId) : null,
      label: String(item.label || (item.type === "internal" ? "灞曚綅鍐呴殰纰嶇墿" : "灞曚綅澶栭殰纰嶇墿")).trim(),
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      width: Number(item.width || 0),
      height: Number(item.height || 0),
      widthM: Number(item.widthM || 0),
      depthM: Number(item.depthM || 0),
      area: Number(item.area || 0),
      createdAt: item.createdAt || nowIso(),
      updatedAt: nowIso()
    })).filter((item) => item.width > 0 && item.height > 0);
    const restoredActivityAreas = incomingActivityAreas.map((item) => ({
      id: Number(item.id || id(db, "activityArea")),
      eventId,
      name: String(item.name || "活动区").trim() || "活动区",
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      width: Number(item.width || 0),
      height: Number(item.height || 0),
      createdAt: item.createdAt || nowIso(),
      updatedAt: nowIso()
    })).filter((item) => item.width > 0 && item.height > 0);
    db.booths = db.booths.filter((booth) => String(booth.eventId || eventId) !== String(eventId)).concat(restoredBooths);
    db.obstacles = db.obstacles.filter((obstacle) => String(obstacleEventId(db, obstacle)) !== String(eventId)).concat(restoredObstacles);
    db.activityAreas = db.activityAreas.filter((area) => String(area.eventId || eventId) !== String(eventId)).concat(restoredActivityAreas);
    refreshAllBoothBilling(db);
    db.nextIds.booth = Math.max(Number(db.nextIds.booth || 1), ...db.booths.map((booth) => Number(booth.id || 0) + 1), 1);
    db.nextIds.obstacle = Math.max(Number(db.nextIds.obstacle || 1), ...db.obstacles.map((obstacle) => Number(obstacle.id || 0) + 1), 1);
    db.nextIds.activityArea = Math.max(Number(db.nextIds.activityArea || 1), ...db.activityAreas.map((area) => Number(area.id || 0) + 1), 1);
    writeLog(db, user, "鎭㈠灞曚綅鍥惧揩鐓?", `${restoredBooths.length} 涓睍浣?/ ${restoredObstacles.length} 涓殰纰嶇墿 / ${restoredActivityAreas.length} 个活动区`);
    saveDb(db);
    return send(res, 200, { booths: restoredBooths, obstacles: restoredObstacles, activityAreas: restoredActivityAreas });
  }

  if (pathname === "/api/booths" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const eventId = db.settings.event.id;
    const boothNo = String(body.boothNo || `B${db.nextIds.booth}`).trim();
    const noError = boothNoValidationError(db, boothNo, eventId);
    if (noError) return sendError(res, noError.includes("重复") ? 409 : 400, noError);
    const booth = {
      id: id(db, "booth"),
      eventId,
      boothNo,
      x: Number(body.x || 0),
      y: Number(body.y || 0),
      width: Number(body.width || 60),
      height: Number(body.height || 40),
      area: Number(body.area || 9),
      widthM: Number(body.widthM || 3),
      depthM: Number(body.depthM || 3),
      hall: body.hall || db.settings.halls[0] || "1鍙烽",
      zone: body.zone || zoneName(db.settings.zones[0]) || "A鍖?",
      attr: body.attr || "standard",
      price: 0,
      status: "available",
      orderId: null,
      reservedAt: null,
      reservedBy: null,
      locked: false,
      updatedAt: nowIso()
    };
    refreshBoothBilling(db, booth);
    db.booths.push(booth);
    writeLog(db, user, "缁樺埗灞曚綅", booth.boothNo, "booth", booth.id);
    saveDb(db);
    return send(res, 200, { booth });
  }

  const boothMatch = pathname.match(/^\/api\/booths\/(\d+)$/);
  if (boothMatch && method === "PUT") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const booth = db.booths.find((item) => item.id === Number(boothMatch[1]) && String(item.eventId || db.settings.event.id) === String(db.settings.event.id));
    if (!booth) return sendError(res, 404, "灞曚綅涓嶅瓨鍦?");
    if (booth.status === "sold") return sendError(res, 409, "宸叉垚浜ゅ睍浣嶄笉鍙洿鎺ョ紪杈?");
    if (booth.locked && body.locked !== false) return sendError(res, 409, "灞曚綅宸查攣瀹氾紝璇峰厛瑙ｉ攣鍐嶇紪杈?");
    if (body.boothNo !== undefined) {
      const boothNo = String(body.boothNo || "").trim();
      const noError = boothNoValidationError(db, boothNo, db.settings.event.id, booth.id);
      if (noError) return sendError(res, noError.includes("重复") ? 409 : 400, noError);
      body.boothNo = boothNo;
    }
    ["boothNo", "hall", "zone", "attr", "status"].forEach((key) => {
      if (body[key] !== undefined) booth[key] = body[key];
    });
    ["x", "y", "width", "height", "area", "widthM", "depthM"].forEach((key) => {
      if (body[key] !== undefined) booth[key] = Number(body[key]);
    });
    if (body.locked !== undefined) booth.locked = Boolean(body.locked);
    refreshBoothBilling(db, booth);
    booth.updatedAt = nowIso();
    writeLog(db, user, "缂栬緫灞曚綅", booth.boothNo, "booth", booth.id);
    saveDb(db);
    return send(res, 200, { booth });
  }

  if (boothMatch && method === "DELETE") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const boothId = Number(boothMatch[1]);
    const booth = db.booths.find((item) => item.id === boothId && String(item.eventId || db.settings.event.id) === String(db.settings.event.id));
    if (!booth) return sendError(res, 404, "灞曚綅涓嶅瓨鍦?");
    if (!canDeleteBooth(db, booth)) return sendError(res, 409, "鍙兘鍒犻櫎绌洪棽鎴栧仠鐢ㄤ笖鏈璁㈠崟鍗犵敤鐨勫睍浣?");
    db.booths = db.booths.filter((item) => item.id !== boothId);
    db.obstacles = db.obstacles.filter((obstacle) => Number(obstacle.boothId) !== boothId);
    writeLog(db, user, "鍒犻櫎灞曚綅", booth.boothNo, "booth", booth.id);
    saveDb(db);
    return send(res, 200, { deletedCount: 1 });
  }

  if (pathname === "/api/booths/batch" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
    const patch = body.patch || {};
    const positions = new Map((Array.isArray(body.positions) ? body.positions : [])
      .map((item) => [Number(item.id), item]));
    const changed = [];
    ids.forEach((boothId) => {
      const booth = db.booths.find((item) => item.id === boothId && item.status !== "sold" && !item.locked && String(item.eventId || db.settings.event.id) === String(db.settings.event.id));
      if (!booth) return;
      ["hall", "zone", "attr", "status"].forEach((key) => {
        if (patch[key] !== undefined) booth[key] = patch[key];
      });
      if (patch.area !== undefined) booth.area = Number(patch.area);
      ["x", "y"].forEach((key) => {
        if (patch[key] !== undefined) booth[key] = Number(patch[key]);
      });
      const position = positions.get(boothId);
      if (position) {
        ["x", "y"].forEach((key) => {
          if (position[key] !== undefined && Number.isFinite(Number(position[key]))) {
            booth[key] = Number(position[key]);
          }
        });
      }
      refreshBoothBilling(db, booth);
      booth.updatedAt = nowIso();
      changed.push(booth);
    });
    writeLog(db, user, "批量更新展位", `${changed.length} 个展位`);
    saveDb(db);
    return send(res, 200, { booths: changed });
  }

  if (pathname === "/api/booths/delete" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [])];
    if (!ids.length) return sendError(res, 400, "璇烽€夋嫨瑕佸垹闄ょ殑灞曚綅");
    const booths = ids.map((boothId) => db.booths.find((item) => item.id === boothId && String(item.eventId || db.settings.event.id) === String(db.settings.event.id))).filter(Boolean);
    if (booths.length !== ids.length) return sendError(res, 404, "閮ㄥ垎灞曚綅涓嶅瓨鍦?");
    const blocked = booths.filter((booth) => !canDeleteBooth(db, booth));
    if (blocked.length) {
      return sendError(res, 409, `瀛樺湪涓嶅彲鍒犻櫎灞曚綅锛?{blocked.map((booth) => booth.boothNo).join(" / ")}`);
    }
    const deleteIds = new Set(ids);
    db.booths = db.booths.filter((booth) => !deleteIds.has(booth.id));
    db.obstacles = db.obstacles.filter((obstacle) => !deleteIds.has(Number(obstacle.boothId)));
    writeLog(db, user, "鎵归噺鍒犻櫎灞曚綅", `${booths.length} 涓睍浣嶏細${booths.map((booth) => booth.boothNo).join(" / ")}`);
    saveDb(db);
    return send(res, 200, { deletedCount: booths.length });
  }

  if (pathname === "/api/obstacles" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const type = body.type === "internal" ? "internal" : "external";
    const shape = body.shape === "circle" ? "circle" : "rect";
    const rect = {
      x: Number(body.x || 0),
      y: Number(body.y || 0),
      width: Number(body.width || 0),
      height: Number(body.height || 0)
    };
    if (rect.width < 4 || rect.height < 4) return sendError(res, 400, "闅滅鐗╁昂瀵稿お灏?");
    let boothId = null;
    if (type === "internal") {
      const explicitBooth = body.boothId ? db.booths.find((booth) => booth.id === Number(body.boothId) && String(booth.eventId || db.settings.event.id) === String(db.settings.event.id)) : null;
      const booth = explicitBooth || eventBooths(db).find((item) => rectInsideBooth(rect, item));
      if (!booth || !rectInsideBooth(rect, booth)) return sendError(res, 400, "灞曚綅鍐呴殰纰嶇墿蹇呴』瀹屾暣缁樺埗鍦ㄦ煇涓睍浣嶅唴閮?");
      boothId = booth.id;
      if (!["available", "disabled"].includes(booth.status)) return sendError(res, 409, "鍙兘缁欑┖闂叉垨鍋滅敤灞曚綅鏂板灞曚綅鍐呴殰纰嶇墿");
    }
    const scale = Math.max(1, Number(db.map.scalePxPerMeter || 16));
    const widthM = Number((rect.width / scale).toFixed(3));
    const depthM = Number((rect.height / scale).toFixed(3));
    const obstacle = {
      id: id(db, "obstacle"),
      eventId: db.settings.event.id,
      type,
      shape,
      boothId,
      label: String(body.label || (type === "internal" ? "灞曚綅鍐呴殰纰嶇墿" : "灞曚綅澶栭殰纰嶇墿")).trim(),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      widthM,
      depthM,
      area: obstacleAreaFromSize(widthM, depthM, shape),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.obstacles.push(obstacle);
    if (boothId) refreshBoothBilling(db, db.booths.find((booth) => booth.id === boothId));
    writeLog(db, user, "缁樺埗闅滅鐗?", `${obstacle.label}${boothId ? `锛岀粦瀹氬睍浣?${db.booths.find((booth) => booth.id === boothId)?.boothNo || ""}` : ""}`, "obstacle", obstacle.id);
    saveDb(db);
    return send(res, 200, { obstacle });
  }

  const obstacleMatch = pathname.match(/^\/api\/obstacles\/(\d+)$/);
  if (obstacleMatch && method === "PUT") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const obstacleId = Number(obstacleMatch[1]);
    const obstacle = db.obstacles.find((item) => item.id === obstacleId && String(obstacleEventId(db, item)) === String(db.settings.event.id));
    if (!obstacle) return sendError(res, 404, "闅滅鐗╀笉瀛樺湪");
    const scale = Math.max(1, Number(db.map.scalePxPerMeter || 16));
    const currentWidthM = obstacle.widthM !== undefined ? Number(obstacle.widthM || 0) : Number(obstacle.width || 0) / scale;
    const currentDepthM = obstacle.depthM !== undefined ? Number(obstacle.depthM || 0) : Number(obstacle.height || 0) / scale;
    const nextShape = body.shape === "circle" ? "circle" : (body.shape === "rect" ? "rect" : obstacleShape(obstacle));
    const hasShapeChange = nextShape !== obstacleShape(obstacle);
    const hasSizeChange = body.widthM !== undefined || body.depthM !== undefined || body.width !== undefined || body.height !== undefined;
    const widthM = body.widthM !== undefined ? Number(body.widthM) : (body.width !== undefined ? Number(body.width || 0) / scale : currentWidthM);
    const depthM = body.depthM !== undefined ? Number(body.depthM) : (body.height !== undefined ? Number(body.height || 0) / scale : currentDepthM);
    if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) return sendError(res, 400, "璇峰～鍐欏ぇ浜?0 鐨勯殰纰嶇墿闀垮拰瀹?");
    const next = {
      x: body.x !== undefined ? Number(body.x) : Number(obstacle.x || 0),
      y: body.y !== undefined ? Number(body.y) : Number(obstacle.y || 0),
      width: hasSizeChange ? Math.round(widthM * scale) : Math.round(Number(obstacle.width || 0)),
      height: hasSizeChange ? Math.round(depthM * scale) : Math.round(Number(obstacle.height || 0))
    };
    if (next.width < 4 || next.height < 4) return sendError(res, 400, "闅滅鐗╁昂瀵稿お灏?");
    const booth = obstacle.boothId ? db.booths.find((item) => item.id === Number(obstacle.boothId)) : null;
    if (obstacle.type === "internal") {
      if (!booth || !rectInsideBooth(next, booth)) return sendError(res, 400, "灞曚綅鍐呴殰纰嶇墿蹇呴』瀹屾暣淇濈暀鍦ㄧ粦瀹氬睍浣嶅唴閮?");
      if (!["available", "disabled"].includes(booth.status)) return sendError(res, 409, "鍙兘璋冩暣绌洪棽鎴栧仠鐢ㄥ睍浣嶅唴鐨勯殰纰嶇墿");
    }
    obstacle.x = Math.round(next.x);
    obstacle.y = Math.round(next.y);
    obstacle.width = Math.round(next.width);
    obstacle.height = Math.round(next.height);
    obstacle.shape = nextShape;
    if (hasSizeChange || hasShapeChange) {
      obstacle.widthM = Number(widthM.toFixed(3));
      obstacle.depthM = Number(depthM.toFixed(3));
      obstacle.area = obstacleAreaFromSize(obstacle.widthM, obstacle.depthM, obstacle.shape);
    }
    obstacle.updatedAt = nowIso();
    if (booth) refreshBoothBilling(db, booth);
    writeLog(db, user, "缂栬緫闅滅鐗?", `${obstacle.label || obstacle.id} ${obstacle.width}x${obstacle.height}px`, "obstacle", obstacle.id);
    saveDb(db);
    return send(res, 200, { obstacle });
  }

  if (obstacleMatch && method === "DELETE") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const obstacleId = Number(obstacleMatch[1]);
    const obstacle = db.obstacles.find((item) => item.id === obstacleId && String(obstacleEventId(db, item)) === String(db.settings.event.id));
    if (!obstacle) return sendError(res, 404, "闅滅鐗╀笉瀛樺湪");
    db.obstacles = db.obstacles.filter((item) => item.id !== obstacleId);
    if (obstacle.boothId) refreshBoothBilling(db, db.booths.find((booth) => booth.id === Number(obstacle.boothId)));
    writeLog(db, user, "鍒犻櫎闅滅鐗?", obstacle.label || String(obstacle.id), "obstacle", obstacle.id);
    saveDb(db);
    return send(res, 200, { deletedCount: 1 });
  }

  if (pathname === "/api/activity-areas" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const rect = {
      x: Number(body.x || 0),
      y: Number(body.y || 0),
      width: Number(body.width || 0),
      height: Number(body.height || 0)
    };
    if (rect.width < 4 || rect.height < 4) return sendError(res, 400, "活动区尺寸太小");
    const area = {
      id: id(db, "activityArea"),
      eventId: db.settings.event.id,
      name: String(body.name || "活动区").trim() || "活动区",
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.activityAreas.push(area);
    writeLog(db, user, "绘制活动区", area.name, "activityArea", area.id);
    saveDb(db);
    return send(res, 200, { activityArea: area });
  }

  const activityAreaMatch = pathname.match(/^\/api\/activity-areas\/(\d+)$/);
  if (activityAreaMatch && method === "PUT") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const areaId = Number(activityAreaMatch[1]);
    const area = db.activityAreas.find((item) => Number(item.id) === areaId && String(item.eventId || db.settings.event.id) === String(db.settings.event.id));
    if (!area) return sendError(res, 404, "活动区不存在");
    if (body.name !== undefined) area.name = String(body.name || "活动区").trim() || "活动区";
    if ((body.width !== undefined && Number(body.width) < 4) || (body.height !== undefined && Number(body.height) < 4)) {
      return sendError(res, 400, "活动区尺寸太小");
    }
    ["x", "y", "width", "height"].forEach((key) => {
      if (body[key] !== undefined) area[key] = Number(body[key]);
    });
    area.updatedAt = nowIso();
    writeLog(db, user, "编辑活动区", area.name, "activityArea", area.id);
    saveDb(db);
    return send(res, 200, { activityArea: area });
  }

  if (activityAreaMatch && method === "DELETE") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const areaId = Number(activityAreaMatch[1]);
    const area = db.activityAreas.find((item) => Number(item.id) === areaId && String(item.eventId || db.settings.event.id) === String(db.settings.event.id));
    if (!area) return sendError(res, 404, "活动区不存在");
    db.activityAreas = db.activityAreas.filter((item) => Number(item.id) !== areaId);
    writeLog(db, user, "删除活动区", area.name, "activityArea", area.id);
    saveDb(db);
    return send(res, 200, { deletedCount: 1 });
  }

  if (pathname === "/api/booths/generate-grid" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const created = generateBoothGrid(db, body);
    writeLog(db, user, "批量生成展位", `${created.length} 个展位`);
    saveDb(db);
    return send(res, 200, { booths: created });
  }

  if (pathname === "/api/booths/clear" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const eventId = db.settings.event.id;
    if (db.orders.some((order) => String(order.eventId || eventId) === String(eventId) && isActiveOrder(order))) {
      return sendError(res, 409, "瀛樺湪鏈粨鏉熻鍗曟椂涓嶈兘娓呯┖灞曚綅鍥?");
    }
    const currentBooths = eventBooths(db, eventId);
    const currentBoothIds = new Set(currentBooths.map((booth) => booth.id));
    const count = currentBooths.length;
    db.booths = db.booths.filter((booth) => String(booth.eventId || eventId) !== String(eventId));
    db.obstacles = db.obstacles.filter((obstacle) => String(obstacleEventId(db, obstacle)) !== String(eventId) && !currentBoothIds.has(Number(obstacle.boothId)));
    db.activityAreas = db.activityAreas.filter((area) => String(area.eventId || eventId) !== String(eventId));
    if (!db.booths.length) db.nextIds.booth = 1;
    writeLog(db, user, "清空展位图", `清除 ${count} 个展位，管理员重新绘制`);
    saveDb(db);
    return send(res, 200, { clearedCount: count });
  }

  if (pathname === "/api/users" && method === "POST") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "只有超级管理员可以管理账号");
    if (!body.username || !body.password || !body.displayName) {
      return sendError(res, 400, "请填写账号、姓名和密码");
    }
    if (db.users.some((item) => item.username === body.username)) return sendError(res, 409, "账号已存在");
    const role = ["admin", "manager", "sales"].includes(body.role) ? body.role : "sales";
    const departmentId = role === "admin" ? null : Number(body.departmentId || 0) || null;
    if (role !== "admin" && !departmentId) return sendError(res, 400, "请选择账号归属部门");
    if (departmentId && !db.settings.departments.some((item) => Number(item.id) === departmentId)) return sendError(res, 404, "部门不存在");
    const newUser = {
      id: id(db, "user"),
      username: body.username,
      passwordHash: hashPassword(body.password),
      displayName: body.displayName,
      role,
      departmentId,
      active: body.active !== false,
      companyId: null,
      orderId: null,
      createdAt: nowIso(),
      lastLoginAt: null
    };
    db.users.push(newUser);
    writeLog(db, user, "鍒涘缓璐﹀彿", `${newUser.displayName} (${newUser.role})`, "user", newUser.id);
    saveDb(db);
    return send(res, 200, { user: sanitizeUser(newUser) });
  }

  const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && method === "DELETE") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "只有超级管理员可以删除账号");
    const targetUserId = Number(userMatch[1]);
    const targetUser = db.users.find((item) => Number(item.id) === targetUserId);
    if (!targetUser) return sendError(res, 404, "账号不存在");
    if (Number(user.id) === targetUserId) return sendError(res, 409, "不能删除当前登录账号");
    if (targetUser.role === "admin" && db.users.filter((item) => item.role === "admin").length <= 1) {
      return sendError(res, 409, "至少需要保留一个超级管理员账号");
    }
    const orderCount = userOrderCount(db, targetUserId);
    if (orderCount > 0) return sendError(res, 409, `该账号已有订单，不能删除：${orderCount} 个`);
    db.users = db.users.filter((item) => Number(item.id) !== targetUserId);
    db.eventRoles = (db.eventRoles || []).filter((row) => Number(row.userId) !== targetUserId);
    db.settings.salesTargets = (db.settings.salesTargets || []).filter((item) => Number(item.userId) !== targetUserId);
    db.customerLeads.forEach((lead) => {
      if (Number(lead.ownerSalesId) === targetUserId) lead.ownerSalesId = null;
      if (Number(lead.previousOwnerSalesId) === targetUserId) lead.previousOwnerSalesId = null;
    });
    Object.keys(db.sessions || {}).forEach((token) => {
      if (Number(db.sessions[token]?.userId) === targetUserId) delete db.sessions[token];
    });
    writeLog(db, user, "鍒犻櫎璐﹀彿", `${targetUser.displayName || targetUser.username} (${targetUser.username})`, "user", targetUser.id);
    saveDb(db);
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/departments" && method === "POST") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "只有超级管理员可以管理部门");
    const name = String(body.name || "").trim();
    if (!name) return sendError(res, 400, "请填写部门名称");
    if ((db.settings.departments || []).some((item) => item.name === name)) return sendError(res, 409, "部门已存在");
    const department = { id: id(db, "department"), name };
    db.settings.departments.push(department);
    writeLog(db, user, "鏂板閮ㄩ棬", name, "department", department.id);
    saveDb(db);
    return send(res, 200, { department });
  }

  const departmentMatch = pathname.match(/^\/api\/departments\/(\d+)$/);
  if (departmentMatch && method === "PUT") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "只有超级管理员可以管理部门");
    const department = db.settings.departments.find((item) => Number(item.id) === Number(departmentMatch[1]));
    if (!department) return sendError(res, 404, "部门不存在");
    const name = String(body.name || "").trim();
    if (!name) return sendError(res, 400, "请填写部门名称");
    if (db.settings.departments.some((item) => Number(item.id) !== Number(department.id) && item.name === name)) return sendError(res, 409, "部门已存在");
    department.name = name;
    writeLog(db, user, "淇敼閮ㄩ棬", name, "department", department.id);
    saveDb(db);
    return send(res, 200, { department });
  }

  if (departmentMatch && method === "DELETE") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "只有超级管理员可以管理部门");
    const departmentId = Number(departmentMatch[1]);
    const department = db.settings.departments.find((item) => Number(item.id) === departmentId);
    if (!department) return sendError(res, 404, "部门不存在");
    db.settings.departments = db.settings.departments.filter((item) => Number(item.id) !== departmentId);
    db.settings.departmentTargets = (db.settings.departmentTargets || []).filter((item) => Number(item.departmentId) !== departmentId);
    db.users.forEach((item) => {
      if (Number(item.departmentId || 0) === departmentId) item.departmentId = null;
    });
    writeLog(db, user, "鍒犻櫎閮ㄩ棬", department.name, "department", department.id);
    saveDb(db);
    return send(res, 200, { ok: true });
  }

  const userDepartmentMatch = pathname.match(/^\/api\/users\/(\d+)\/department$/);
  if (userDepartmentMatch && method === "PUT") {
    if (!requireRole(user, ["superadmin"])) return sendError(res, 403, "只有超级管理员可以分配部门");
    const targetUser = db.users.find((item) => Number(item.id) === Number(userDepartmentMatch[1]));
    if (!targetUser) return sendError(res, 404, "账号不存在");
    if (targetUser.role === "admin" || targetUser.role === "enterprise") return sendError(res, 400, "超级管理员和企业账号不分配部门");
    const departmentId = Number(body.departmentId || 0) || null;
    if (departmentId && !db.settings.departments.some((item) => Number(item.id) === departmentId)) return sendError(res, 404, "部门不存在");
    targetUser.departmentId = departmentId;
    writeLog(db, user, "鍒嗛厤璐﹀彿閮ㄩ棬", `${targetUser.displayName} -> ${departmentId || "鏈垎閰?"}`, "user", targetUser.id);
    saveDb(db);
    return send(res, 200, { user: sanitizeUser(targetUser) });
  }

  if (pathname === "/api/companies" && method === "POST") {
    if (!requireRole(user, ["admin", "sales"])) return sendError(res, 403, "无权新增客户");
    const name = String(body.name || "").trim();
    if (!name) return sendError(res, 400, "企业名称必填");
    const eventId = db.settings.event.id;
    const ownerSalesId = user.role === "sales" ? user.id : (Number(body.ownerSalesId) || user.id);
    const capacity = ensureProtectionCapacity(db, eventId, ownerSalesId);
    if (!capacity.ok) return sendError(res, 409, capacity.error);
    const taxKey = companyTaxKey(body.taxNo);
    let company = db.companies.find((item) => taxKey && companyTaxKey(item.taxNo) === taxKey)
      || db.companies.find((item) => companyNameKey(item.name) === companyNameKey(name));
    if (company && activeCurrentOrderForCompany(db, eventId, company.id)) {
      return sendError(res, 409, "该企业当前展会已经参展或存在有效订单");
    }
    if (company) {
      const existingLead = db.customerLeads.find((lead) => String(lead.eventId) === String(eventId) && Number(lead.companyId) === Number(company.id) && lead.status !== "converted");
      if (existingLead) return sendError(res, 409, existingLead.status === "public" ? "该企业已在客户公海中，请从公海认领" : "该企业已在客户列表中");
      company.shortName = String(body.shortName || company.shortName || "").trim();
      company.contactName = body.contactName || company.contactName || "";
      company.phone = body.phone || company.phone || "";
      company.email = body.email || company.email || "";
      company.address = body.address || company.address || "";
      company.taxNo = body.taxNo || company.taxNo || "";
      company.locationType = body.locationType === "overseas" ? "overseas" : (company.locationType || "domestic");
      company.countryRegion = body.countryRegion || company.countryRegion || "";
      company.province = body.province || company.province || "";
      company.city = body.city || company.city || "";
      company.ownerSalesId = ownerSalesId;
      company.notes = body.notes || company.notes || "";
    } else {
      company = {
        id: id(db, "company"),
        name,
        shortName: String(body.shortName || "").trim(),
        contactName: body.contactName || "",
        phone: body.phone || "",
        email: body.email || "",
        address: body.address || "",
        taxNo: body.taxNo || "",
        locationType: body.locationType === "overseas" ? "overseas" : "domestic",
        countryRegion: body.countryRegion || "",
        province: body.province || "",
        city: body.city || "",
        ownerSalesId,
        notes: body.notes || "",
        createdAt: nowIso()
      };
      db.companies.push(company);
    }
    const lead = {
      id: id(db, "customerLead"),
      eventId,
      companyId: company.id,
      customerType: "new",
      status: "protected",
      ownerSalesId,
      protectedUntil: addDays(nowIso(), Number(db.settings.rules.newCustomerProtectDays ?? 30)),
      sourceOrderId: null,
      sourceEventName: "",
      sourceAmount: 0,
      contractAttachmentIds: [],
      voucherAttachmentIds: [],
      contractReviewStatus: "none",
      contractReviewedBy: null,
      contractReviewedAt: "",
      contractReviewRemark: "",
      voucherReviewStatus: "none",
      voucherReviewedBy: null,
      voucherReviewedAt: "",
      voucherReviewRemark: "",
      voucherDueAt: "",
      publicReason: "",
      createdAt: nowIso(),
      claimedAt: "",
      releasedAt: "",
      convertedAt: ""
    };
    saveLeadContactVersion(db, lead, ownerSalesId, company);
    db.customerLeads.push(lead);
    writeLog(db, user, "鏂板鏂板鎴?", company.name, "company", company.id);
    saveDb(db);
    return send(res, 200, { company, lead });
  }

  const companyUpdateMatch = pathname.match(/^\/api\/companies\/(\d+)$/);
  if (companyUpdateMatch && method === "PUT") {
    if (!requireRole(user, ["admin", "sales"])) return sendError(res, 403, "无权操作");
    const eventId = db.settings.event.id;
    const company = db.companies.find((item) => Number(item.id) === Number(companyUpdateMatch[1]));
    if (!company) return sendError(res, 404, "企业不存在");
    const lead = db.customerLeads.find((item) => (
      String(item.eventId) === String(eventId)
      && Number(item.companyId) === Number(company.id)
      && item.customerType === "new"
      && item.status === "protected"
    ));
    if (!lead) return sendError(res, 409, "只有未生成订单的新客户可以修改资料");
    if (activeCurrentOrderForCompany(db, eventId, company.id)) {
      return sendError(res, 409, "该企业已经生成有效订单，不能在新客户资料中修改");
    }
    if (user.role === "sales" && !canAccessSalesOwner(db, user, lead.ownerSalesId)) {
      return sendError(res, 403, "无权修改该客户资料");
    }

    const submittedName = String(body.name || "").trim();
    const submittedShortName = String(body.shortName || "").trim();
    if (user.role === "sales") {
      if (submittedName && companyNameKey(submittedName) !== companyNameKey(company.name)) {
        return sendError(res, 403, "业务员不能修改企业名称");
      }
      if (submittedShortName && submittedShortName !== String(company.shortName || "").trim()) {
        return sendError(res, 403, "业务员不能修改企业简称");
      }
    }
    const name = user.role === "sales" ? String(company.name || "").trim() : submittedName;
    const shortName = user.role === "sales" ? String(company.shortName || "").trim() : submittedShortName;
    if (!name) return sendError(res, 400, "企业名称必填");
    if (isAdminLike(user)) {
      const nameConflict = db.companies.find((item) => Number(item.id) !== Number(company.id) && companyNameKey(item.name) === companyNameKey(name));
      if (nameConflict) return sendError(res, 409, "企业名称已存在");
    }
    const taxNo = String(body.taxNo || "").trim();
    const taxKey = companyTaxKey(taxNo);
    if (taxKey && db.companies.some((item) => Number(item.id) !== Number(company.id) && companyTaxKey(item.taxNo) === taxKey)) {
      return sendError(res, 409, "税号已存在");
    }

    const visibleBefore = companyForUser(db, user, company, lead);
    const contactMasked = Boolean(visibleBefore.contactMasked);
    const nextContactName = String(body.contactName || "").trim();
    const nextPhone = String(body.phone || "").trim();
    const shouldApplyContactToMaster = isAdminLike(user)
      ? !contactMasked
      : (!contactMasked || nextContactName || nextPhone);

    company.name = name;
    company.shortName = shortName;
    company.email = String(body.email || "").trim();
    company.address = String(body.address || "").trim();
    company.taxNo = taxNo;
    company.locationType = body.locationType === "overseas" ? "overseas" : "domestic";
    company.countryRegion = company.locationType === "overseas" ? String(body.countryRegion || "").trim() : "";
    company.province = company.locationType === "overseas" ? "" : String(body.province || "").trim();
    company.city = company.locationType === "overseas" ? "" : String(body.city || "").trim();
    company.updatedAt = nowIso();
    if (shouldApplyContactToMaster) {
      company.contactName = nextContactName;
      company.phone = nextPhone;
    }
    const contactOwnerId = user.role === "sales" ? user.id : lead.ownerSalesId;
    const existingContactVersion = leadContactVersionForOwner(db, lead, contactOwnerId);
    const shouldSaveContactVersion = user.role === "sales"
      ? (!contactMasked || nextContactName || nextPhone || existingContactVersion)
      : !contactMasked;
    if (shouldSaveContactVersion) {
      saveLeadContactVersion(db, lead, contactOwnerId, {
        contactName: nextContactName,
        phone: nextPhone
      });
    }
    writeLog(db, user, "淇敼鏂板鎴疯祫鏂?", company.name, "company", company.id);
    saveDb(db);
    return send(res, 200, { company, lead });
  }

  const customerLeadClaimMatch = pathname.match(/^\/api\/customer-leads\/(\d+)\/claim$/);
  if (customerLeadClaimMatch && method === "POST") {
    if (!requireRole(user, ["admin", "sales"])) return sendError(res, 403, "无权认领客户");
    const lead = db.customerLeads.find((item) => item.id === Number(customerLeadClaimMatch[1]) && String(item.eventId) === String(db.settings.event.id));
    if (!lead) return sendError(res, 404, "客户不存在");
    if (lead.status !== "public") return sendError(res, 409, "该客户当前不在公海中");
    const ownerSalesId = user.role === "sales" ? user.id : (Number(body.ownerSalesId) || user.id);
    const capacity = ensureProtectionCapacity(db, db.settings.event.id, ownerSalesId);
    if (!capacity.ok) return sendError(res, 409, capacity.error);
    const company = db.companies.find((item) => item.id === lead.companyId);
    rememberLeadContactOwner(db, lead, lead.ownerSalesId || lead.previousOwnerSalesId);
    lead.status = "protected";
    lead.customerType = "new";
    lead.ownerSalesId = ownerSalesId;
    lead.protectedUntil = addDays(nowIso(), Number(db.settings.rules.newCustomerProtectDays ?? 30));
    lead.claimedAt = nowIso();
    lead.publicReason = "";
    if (company) company.ownerSalesId = ownerSalesId;
    writeLog(db, user, "璁ら鍏捣瀹㈡埛", company?.name || String(lead.companyId), "customerLead", lead.id);
    saveDb(db);
    return send(res, 200, { lead });
  }

  const customerLeadReleaseMatch = pathname.match(/^\/api\/customer-leads\/(\d+)\/release$/);
  if (customerLeadReleaseMatch && method === "POST") {
    if (!requireRole(user, ["admin", "sales"])) return sendError(res, 403, "无权下保客户");
    const lead = db.customerLeads.find((item) => item.id === Number(customerLeadReleaseMatch[1]) && String(item.eventId) === String(db.settings.event.id));
    if (!lead) return sendError(res, 404, "客户不存在");
    if (lead.status !== "protected") return sendError(res, 409, "只有保护中的客户可以下保");
    if (user.role === "sales" && !canAccessSalesOwner(db, user, lead.ownerSalesId)) return sendError(res, 403, "无权下保该客户");
    if (activeCurrentOrderForCompany(db, db.settings.event.id, lead.companyId)) {
      return sendError(res, 409, "该客户已有有效订单，请先在参展企业列表中走退订或订单变更流程");
    }
    rememberLeadContactOwner(db, lead, lead.ownerSalesId);
    lead.status = "public";
    lead.releasedAt = nowIso();
    lead.protectedUntil = "";
    lead.publicReason = "涓诲姩涓嬩繚";
    writeLog(db, user, "瀹㈡埛涓嬩繚", String(lead.companyId), "customerLead", lead.id);
    saveDb(db);
    return send(res, 200, { lead });
  }

  const customerLeadFileReviewMatch = pathname.match(/^\/api\/customer-leads\/(\d+)\/(contract|voucher)\/review$/);
  if (customerLeadFileReviewMatch && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const lead = db.customerLeads.find((item) => item.id === Number(customerLeadFileReviewMatch[1]) && String(item.eventId) === String(db.settings.event.id));
    if (!lead) return sendError(res, 404, "瀹㈡埛涓嶅瓨鍦?");
    const type = customerLeadFileReviewMatch[2];
    const status = body.status === "approved" ? "approved" : "rejected";
    if (!requireRejectedReviewRemark(res, status, body)) return;
    if (type === "contract") {
      if (!(lead.contractAttachmentIds || []).length) return sendError(res, 400, "璇ュ鎴峰皻鏈笂浼犲悎鍚?");
      lead.contractReviewStatus = status;
      lead.contractReviewedBy = user.id;
      lead.contractReviewedAt = nowIso();
      lead.contractReviewRemark = reviewRemarkFromBody(body);
      if (status === "approved") {
        lead.voucherDueAt = addDeadlineDays(db, nowIso(), contractApprovedVoucherWorkdays(db));
        extendActiveOrderReserve(db, lead, lead.voucherDueAt);
      } else {
        lead.voucherDueAt = "";
        releaseLeadAndActiveOrder(db, lead, "鍚堝悓瀹℃牳椹冲洖", user);
      }
    } else {
      if (!(lead.voucherAttachmentIds || []).length) return sendError(res, 400, "璇ュ鎴峰皻鏈笂浼犳按鍗?");
      lead.voucherReviewStatus = status;
      lead.voucherReviewedBy = user.id;
      lead.voucherReviewedAt = nowIso();
      lead.voucherReviewRemark = reviewRemarkFromBody(body);
      if (status === "approved") {
        markCustomerLeadConverted(db, lead.eventId, lead.companyId, lead.id);
      } else {
        releaseLeadAndActiveOrder(db, lead, "姘村崟瀹℃牳椹冲洖", user);
      }
    }
    const company = db.companies.find((item) => item.id === lead.companyId);
    writeLog(db, user, type === "contract" ? "瀹℃牳瀹㈡埛鍚堝悓" : "瀹℃牳瀹㈡埛姘村崟", `${company?.name || lead.companyId} ${status}`, "customerLead", lead.id);
    if (lead.ownerSalesId) {
      notify(db, lead.ownerSalesId, type === "contract" ? "瀹㈡埛鍚堝悓瀹℃牳缁撴灉" : "瀹㈡埛姘村崟瀹℃牳缁撴灉", `${company?.name || "瀹㈡埛"} ${status === "approved" ? "宸查€氳繃" : "宸查┏鍥?"}`);
    }
    saveDb(db);
    return send(res, 200, { lead });
  }

  if (pathname === "/api/orders" && method === "POST") {
    if (!requireRole(user, ["admin", "sales"])) return sendError(res, 403, "鏃犳潈闄?");
    let companyId = Number(body.companyId || 0);
    const incomingCompanyName = String(body.company?.name || "").trim();
    const incomingTaxKey = companyTaxKey(body.company?.taxNo);
    if (!companyId && !incomingCompanyName) return sendError(res, 400, "企业名称必填");
    if (!companyId && incomingTaxKey) {
      const existingCompany = db.companies.find((company) => companyTaxKey(company.taxNo) === incomingTaxKey);
      if (existingCompany) companyId = existingCompany.id;
    }
    if (!companyId && incomingCompanyName) {
      const existingCompany = db.companies.find((company) => companyNameKey(company.name) === companyNameKey(incomingCompanyName));
      if (existingCompany) companyId = existingCompany.id;
    }
    if (!companyId && body.company) {
      const company = {
        id: id(db, "company"),
        name: incomingCompanyName,
        shortName: String(body.company.shortName || "").trim(),
        contactName: body.company.contactName || "",
        phone: body.company.phone || "",
        email: body.company.email || "",
        address: body.company.address || "",
        taxNo: body.company.taxNo || "",
        locationType: body.company.locationType === "overseas" ? "overseas" : "domestic",
        countryRegion: body.company.countryRegion || "",
        province: body.company.province || "",
        city: body.company.city || "",
        ownerSalesId: user.role === "sales" ? user.id : Number(body.salespersonId || user.id),
        notes: body.company.notes || "",
        createdAt: nowIso()
      };
      db.companies.push(company);
      companyId = company.id;
    }
    const company = db.companies.find((item) => item.id === companyId);
    if (!company) return sendError(res, 400, "请先选择或创建企业");
    if (body.company?.shortName !== undefined) company.shortName = String(body.company.shortName || company.shortName || "").trim();
    if (!companyNameKey(company.name)) return sendError(res, 400, "企业名称必填");
    const duplicatedOrder = db.orders.find((order) => {
      if (order.eventId !== db.settings.event.id) return false;
      if (isClosedOrderStatus(order.status)) return false;
      const existingCompany = db.companies.find((item) => item.id === order.companyId);
      return sameCompanyIdentity(existingCompany, company);
    });
    if (duplicatedOrder) return sendError(res, 409, `当前展会中企业“${company.name}”已存在有效订单 ${duplicatedOrder.orderNo}`);
    const salespersonId = user.role === "sales" ? user.id : Number(body.salespersonId || company.ownerSalesId || user.id);
    const type = body.type === "custom" ? "custom" : "booth";
    let boothIds = [];
    let totalAmount = Number(body.totalAmount || 0);
    let originalAmount = totalAmount;
    let boothSnapshot = [];
    if (type === "booth") {
      boothIds = [...new Set(Array.isArray(body.boothIds) ? body.boothIds.map(Number).filter(Boolean) : [])];
      if (!boothIds.length) return sendError(res, 400, "请选择展位");
      const booths = boothIds.map((boothId) => db.booths.find((item) => item.id === boothId && String(item.eventId || db.settings.event.id) === String(db.settings.event.id)));
      if (booths.some((booth) => !booth)) return sendError(res, 404, "部分展位不存在");
      if (booths.some((booth) => booth.status !== "available")) return sendError(res, 409, "所选展位已被占用");
      boothSnapshot = booths.map(boothSnapshotFromBooth);
      totalAmount = boothSnapshot.reduce((sum, booth) => sum + Number(booth.price || 0), 0);
      originalAmount = totalAmount;
    }
    if (type === "custom" && totalAmount <= 0) return sendError(res, 400, "无展位订单金额必须大于 0");
    const discount = orderDiscountFromRule(db, totalAmount, body.discountRuleId);
    if (body.discountRuleId && !discount.discountRuleId) return sendError(res, 400, "优惠规则不存在");
    totalAmount = discount.totalAmount;
    originalAmount = discount.originalAmount;
    if (totalAmount <= 0) return sendError(res, 400, "优惠后订单金额必须大于 0");
    const order = {
      id: id(db, "order"),
      eventId: db.settings.event.id,
      eventName: db.settings.event.name,
      orderNo: orderNo(db),
      type,
      title: body.title || (type === "booth" ? "灞曚綅璁㈠崟" : "鏃犲睍浣嶈嚜瀹氫箟璁㈠崟"),
      companyId,
      salespersonId,
      boothIds,
      boothSnapshot,
      originalAmount,
      discountRuleId: discount.discountRuleId,
      discountReason: discount.discountReason,
      discountAmount: discount.discountAmount,
      totalAmount,
      paidApprovedAmount: 0,
      depositRequired: Math.ceil(totalAmount * Number(db.settings.rules.depositRate || 0)),
      status: "reserved",
      details: body.details || "",
      attachments: body.attachments || [],
      contractAttachments: body.contractAttachments || [],
      invoiceAttachments: body.invoiceAttachments || [],
      createdAt: nowIso(),
      reserveExpiresAt: addDeadlineDays(db, nowIso(), db.settings.rules.reserveWorkdays),
      enterpriseUserId: null,
      enterpriseAccountIssuedAt: null
    };
    db.orders.push(order);
    if (type === "booth") {
      order.boothIds.forEach((boothId) => {
        const booth = db.booths.find((item) => item.id === boothId);
        booth.status = "reserved";
        booth.orderId = order.id;
        booth.reservedAt = nowIso();
        booth.reservedBy = salespersonId;
      });
    }
    writeLog(db, user, "鍒涘缓璁㈠崟骞堕鐣?", `${order.orderNo} ${company.name}`, "order", order.id);
    notify(db, salespersonId, "璁㈠崟宸插垱寤?", `${order.orderNo} 宸查鐣欙紝闇€鍦?${db.settings.rules.reserveWorkdays} 涓?{deadlineDayModeText(db)}鍐呬笂浼犳按鍗曞苟杈惧埌棣栨姣斾緥`);
    saveDb(db);
    return send(res, 200, { order });
  }

  const orderPaymentMatch = pathname.match(/^\/api\/orders\/(\d+)\/payments$/);
  if (orderPaymentMatch && method === "POST") {
    const order = db.orders.find((item) => item.id === Number(orderPaymentMatch[1]));
    if (!canAccessOrder(db, user, order) || user.role === "enterprise") return sendError(res, 403, "鏃犳潈闄?");
    const leadForOrder = db.customerLeads.find((lead) => String(lead.eventId) === String(order.eventId) && Number(lead.companyId) === Number(order.companyId));
    if (leadForOrder && salesFlowMode(db) === "contract_first" && leadForOrder.contractReviewStatus !== "approved") {
      return sendError(res, 409, "褰撳墠閿€鍞祦绋嬭姹傚悎鍚屽鏍搁€氳繃鍚庢墠鑳戒笂浼犳按鍗?");
    }
    if (leadForOrder && salesFlowMode(db) === "contract_first") {
      const due = new Date(leadForOrder.voucherDueAt || 0).getTime();
      if (Number.isFinite(due) && due <= Date.now()) return sendError(res, 409, "鍚堝悓閫氳繃鍚庣殑姘村崟涓婁紶鏈熼檺宸茶繃");
    }
    const amount = Number(body.amount || 0);
    if (amount <= 0) return sendError(res, 400, "鏀舵閲戦蹇呴』澶т簬 0");
    const payment = {
      id: id(db, "payment"),
      orderId: order.id,
      amount,
      paidAt: body.paidAt || nowIso().slice(0, 10),
      payer: body.payer || "",
      voucherAttachmentId: body.voucherAttachmentId || null,
      status: "pending",
      remark: body.remark || "",
      createdBy: user.id,
      reviewedBy: null,
      reviewedAt: null,
      reviewRemark: "",
      createdAt: nowIso()
    };
    db.payments.push(payment);
    recalcOrder(db, order);
    writeLog(db, user, "鎻愪氦姘村崟瀹℃牳", `${order.orderNo} 閲戦 ${amount}`, "payment", payment.id);
    eventAdminUsers(db, order.eventId).forEach((admin) => notify(db, admin.id, "待审核水单", `${order.orderNo} 提交了 ${amount} 元水单`));
    saveDb(db);
    return send(res, 200, { payment, order });
  }

  const paymentReviewMatch = pathname.match(/^\/api\/payments\/(\d+)\/review$/);
  if (paymentReviewMatch && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const payment = db.payments.find((item) => item.id === Number(paymentReviewMatch[1]));
    if (!payment) return sendError(res, 404, "姘村崟涓嶅瓨鍦?");
    const order = db.orders.find((item) => item.id === payment.orderId);
    const nextStatus = body.status === "approved" ? "approved" : "rejected";
    if (!requireRejectedReviewRemark(res, nextStatus, body)) return;
    payment.status = nextStatus;
    payment.reviewedBy = user.id;
    payment.reviewedAt = nowIso();
    payment.reviewRemark = reviewRemarkFromBody(body);
    recalcOrder(db, order);
    if (payment.status === "approved") {
      markCustomerLeadConverted(db, order.eventId, order.companyId);
    } else {
      const lead = activeLeadForOrder(db, order);
      if (lead) releaseLeadToPublic(db, lead, "姘村崟瀹℃牳椹冲洖", user);
      releaseOrderBooths(db, order, "姘村崟瀹℃牳椹冲洖", user);
    }
    writeLog(db, user, payment.status === "approved" ? "瀹℃牳閫氳繃姘村崟" : "椹冲洖姘村崟", `${order.orderNo} ${payment.amount}`, "payment", payment.id);
    notify(db, order.salespersonId, "姘村崟瀹℃牳缁撴灉", `${order.orderNo} ${payment.status === "approved" ? "瀹℃牳閫氳繃" : "宸查┏鍥?"}`);
    saveDb(db);
    return send(res, 200, { payment, order });
  }

  const enterpriseAccountMatch = pathname.match(/^\/api\/orders\/(\d+)\/enterprise-account$/);
  if (enterpriseAccountMatch && method === "POST") {
    const order = db.orders.find((item) => item.id === Number(enterpriseAccountMatch[1]));
    if (!canAccessOrder(db, user, order) || user.role === "enterprise") return sendError(res, 403, "鏃犳潈闄?");
    if (order.type !== "booth" || order.status !== "sold") return sendError(res, 409, "鍙湁鎴愪氦鐨勫睍浣嶈鍗曞彲浠ョ敓鎴愪紒涓氳处鍙?");
    const password = simpleEnterprisePassword();
    const enterpriseUser = ensureEnterpriseUserForOrder(db, order, password);
    writeLog(db, user, "鐢熸垚浼佷笟璐﹀彿", `${order.orderNo} ${enterpriseUser.username}`, "user", enterpriseUser.id);
    saveDb(db);
    return send(res, 200, { username: enterpriseUser.username, password });
  }

  const enterpriseLinkMatch = pathname.match(/^\/api\/orders\/(\d+)\/enterprise-link$/);
  if (enterpriseLinkMatch && method === "POST") {
    const order = db.orders.find((item) => item.id === Number(enterpriseLinkMatch[1]));
    if (!canAccessOrder(db, user, order) || user.role === "enterprise") return sendError(res, 403, "鏃犳潈闄?");
    if (order.type !== "booth" || order.status !== "sold") return sendError(res, 409, "鍙湁鎴愪氦鐨勫睍浣嶈鍗曞彲浠ョ敓鎴愪紒涓氬厤鐧诲綍閾炬帴");
    const eventLinkDefaultDays = enterpriseLinkMaxDays(db);
    const days = clampEnterpriseLinkDays(db, body.days || db.settings.rules.enterpriseLinkDays || eventLinkDefaultDays);
    const enterpriseUser = ensureEnterpriseUserForOrder(db, order);
    order.enterpriseAccessToken = randomToken(24);
    order.enterpriseAccessExpiresAt = new Date(Date.now() + days * 86400000).toISOString();
    order.enterpriseLinkIssuedAt = nowIso();
    order.enterpriseLinkIssuedBy = user.id;
    const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const host = req.headers.host || `localhost:${PORT}`;
    const link = `${protocol}://${host}/?enterpriseToken=${encodeURIComponent(order.enterpriseAccessToken)}`;
    writeLog(db, user, "鐢熸垚浼佷笟鍏嶇櫥褰曢摼鎺?", `${order.orderNo} ${days} 澶╂湁鏁坄, "user"`, enterpriseUser.id);
    saveDb(db);
    return send(res, 200, { link, expiresAt: order.enterpriseAccessExpiresAt, username: enterpriseUser.username });
  }

  const changeRequestMatch = pathname.match(/^\/api\/orders\/(\d+)\/change-requests$/);
  if (changeRequestMatch && method === "POST") {
    const order = db.orders.find((item) => item.id === Number(changeRequestMatch[1]));
    if (!canAccessOrder(db, user, order) || user.role === "enterprise") return sendError(res, 403, "鏃犳潈闄?");
    const request = {
      id: id(db, "changeRequest"),
      orderId: order.id,
      type: body.type || "璁㈠崟鍙樻洿",
      detail: body.detail || "",
      changeData: {
        action: body.action || "manual",
        boothIds: [...new Set(Array.isArray(body.boothIds) ? body.boothIds.map(Number).filter(Boolean) : [])],
        oldBoothIds: Array.isArray(order.boothIds) ? order.boothIds.slice() : []
      },
      status: "pending",
      createdBy: user.id,
      createdAt: nowIso(),
      reviewedBy: null,
      reviewedAt: null,
      reviewRemark: ""
    };
    if (request.changeData.action === "change_booth") {
      if (order.type !== "booth") return sendError(res, 409, "鏃犲睍浣嶈鍗曚笉鑳芥洿鎹㈠睍浣?");
      if (!request.changeData.boothIds.length) return sendError(res, 400, "璇烽€夋嫨鏂扮殑灞曚綅");
      const booths = request.changeData.boothIds.map((boothId) => db.booths.find((item) => item.id === boothId && String(item.eventId || order.eventId) === String(order.eventId)));
      if (booths.some((booth) => !booth)) return sendError(res, 404, "鏂板睍浣嶄笉瀛樺湪");
      if (booths.some((booth) => booth.status !== "available")) return sendError(res, 409, "鏂板睍浣嶅凡琚崰鐢?");
      request.detail = request.detail || `鏇存崲灞曚綅锛?{order.boothSnapshot.map((booth) => booth.boothNo).join(" / ")} -> ${booths.map((booth) => booth.boothNo).join(" / ")}`;
    }
    if (request.changeData.action === "cancel_order") {
      if (isClosedOrderStatus(order.status)) return sendError(res, 409, "璁㈠崟宸茬粡缁撴潫");
      request.detail = request.detail || `閫€璁㈠睍浣嶏細${order.boothSnapshot.map((booth) => booth.boothNo).join(" / ") || order.orderNo}`;
    }
    if (request.changeData.action === "special_order") {
      if (user.role !== "sales") return sendError(res, 403, "鍙湁涓氬姟鍛樺彲浠ユ彁浜ょ壒娈婅鍗曠敵璇?");
      if (!isActiveOrder(order) || order.status === "sold") return sendError(res, 409, "璁㈠崟宸茬粡鎴愪氦鎴栫粨鏉燂紝涓嶈兘鐢宠鐗规畩璁㈠崟");
      if (order.specialApproved) return sendError(res, 409, "璇ヨ鍗曞凡缁忔槸鐗规畩璁㈠崟");
      if (Number(order.totalAmount || 0) <= 0) return sendError(res, 409, "璁㈠崟閲戦涓?0锛屼笉鑳界敵璇风壒娈婅鍗?");
      const exists = db.changeRequests.some((item) => (
        item.orderId === order.id
        && item.status === "pending"
        && item.changeData?.action === "special_order"
      ));
      if (exists) return sendError(res, 409, "璇ヨ鍗曞凡鏈夊緟瀹℃牳鐗规畩璁㈠崟鐢宠");
      request.type = "鐗规畩璁㈠崟鐢宠";
      request.detail = request.detail || "瀹㈡埛浠樻杩涘害杈冩參锛岀敵璇风壒娈婃垚浜?";
    }
    db.changeRequests.push(request);
    writeLog(db, user, "鎻愪氦璁㈠崟鍙樻洿鐢宠", `${order.orderNo} ${request.type}`, "order", order.id);
    eventAdminUsers(db, order.eventId).forEach((admin) => notify(db, admin.id, "寰呭鏍歌鍗曞彉鏇?", `${order.orderNo} ${request.type}`));
    saveDb(db);
    return send(res, 200, { request });
  }

  const changeReviewMatch = pathname.match(/^\/api\/change-requests\/(\d+)\/review$/);
  if (changeReviewMatch && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const request = db.changeRequests.find((item) => item.id === Number(changeReviewMatch[1]));
    if (!request) return sendError(res, 404, "鐢宠涓嶅瓨鍦?");
    if (request.status !== "pending") return sendError(res, 409, "鐢宠宸茬粡澶勭悊");
    const nextStatus = body.status === "approved" ? "approved" : "rejected";
    if (!requireRejectedReviewRemark(res, nextStatus, body)) return;
    if (nextStatus === "approved") {
      const result = applyChangeRequest(db, request);
      if (!result.ok) return sendError(res, result.status || 409, result.error || "鍙樻洿鏃犳硶鎵ц");
      request.appliedDetail = result.detail;
    }
    request.status = nextStatus;
    request.reviewedBy = user.id;
    request.reviewedAt = nowIso();
    request.reviewRemark = reviewRemarkFromBody(body);
    if (nextStatus === "approved" && request.changeData?.action === "special_order") {
      const order = db.orders.find((item) => item.id === request.orderId);
      if (order) order.specialApprovedBy = user.id;
    }
    writeLog(db, user, "瀹℃牳璁㈠崟鍙樻洿鐢宠", `${request.type} ${request.status}`, "changeRequest", request.id);
    const order = db.orders.find((item) => item.id === request.orderId);
    if (order) notify(db, order.salespersonId, "璁㈠崟鍙樻洿瀹℃牳缁撴灉", `${order.orderNo} ${request.type} ${request.status === "approved" ? "宸查€氳繃" : "宸查┏鍥?"}`);
    saveDb(db);
    return send(res, 200, { request });
  }

  if (pathname === "/api/jobs/release" && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const jobLeadsChanged = syncCustomerLeadsForCurrentEvent(db);
    const released = releaseExpiredOrders(db, user);
    saveDb(db);
    return send(res, 200, { releasedCount: released.length, released, leadsChanged: leadsChanged || jobLeadsChanged });
  }

  if (pathname === "/api/exhibitor/profile" && method === "PUT") {
    if (!requireRole(user, ["enterprise"])) return sendError(res, 403, "浼佷笟璐﹀彿鎵嶅彲鎻愪氦灞曞姟璧勬枡");
    const order = db.orders.find((item) => item.id === user.orderId && item.status === "sold");
    if (!order) return sendError(res, 409, "璁㈠崟灏氭湭鎴愪氦鎴栦笉瀛樺湪");
    const profile = ensureProfile(db, order);
    profile.catalog = { ...profile.catalog, ...(body.catalog || {}) };
    profile.updatedAt = nowIso();
    writeLog(db, user, "鏇存柊浼佷笟浼氬垔璧勬枡", order.orderNo, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  if (pathname === "/api/exhibitor/badges" && method === "POST") {
    if (!requireRole(user, ["enterprise"])) return sendError(res, 403, "鏃犳潈闄?");
    const order = db.orders.find((item) => item.id === user.orderId && item.status === "sold");
    if (!order) return sendError(res, 409, "璁㈠崟灏氭湭鎴愪氦鎴栦笉瀛樺湪");
    const profile = ensureProfile(db, order);
    profile.badges.push({
      id: randomToken(6),
      name: body.name || "",
      phone: body.phone || "",
      title: body.title || "",
      idNo: body.idNo || "",
      createdAt: nowIso()
    });
    profile.updatedAt = nowIso();
    writeLog(db, user, "鎻愪氦鍙傚睍璇佷俊鎭?", `${body.name || ""}`, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  const badgeDeleteMatch = pathname.match(/^\/api\/exhibitor\/badges\/([a-f0-9]+)$/);
  if (badgeDeleteMatch && method === "DELETE") {
    if (!requireRole(user, ["enterprise"])) return sendError(res, 403, "鏃犳潈闄?");
    const profile = db.profiles.find((item) => item.orderId === user.orderId);
    if (!profile) return sendError(res, 404, "璧勬枡涓嶅瓨鍦?");
    const badge = profile.badges.find((item) => item.id === badgeDeleteMatch[1]);
    if (!badge) return sendError(res, 404, "鍙傚睍璇佷笉瀛樺湪");
    profile.badges = profile.badges.filter((item) => item.id !== badgeDeleteMatch[1]);
    profile.updatedAt = nowIso();
    writeLog(db, user, "鍒犻櫎鍙傚睍璇佷俊鎭?", `${badge.name || ""}`, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  if (pathname === "/api/exhibitor/fascia" && method === "POST") {
    if (!requireRole(user, ["enterprise"])) return sendError(res, 403, "鏃犳潈闄?");
    const order = db.orders.find((item) => item.id === user.orderId && item.status === "sold");
    if (!order) return sendError(res, 409, "璁㈠崟灏氭湭鎴愪氦鎴栦笉瀛樺湪");
    const profile = ensureProfile(db, order);
    profile.fascia.requestedName = body.requestedName || "";
    profile.fascia.status = profile.fascia.requestedName ? "pending" : "default";
    profile.fascia.reviewRemark = "";
    profile.updatedAt = nowIso();
    writeLog(db, user, "鎻愪氦妤ｆ澘淇敼", profile.fascia.requestedName, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  if (pathname === "/api/exhibitor/rentals" && method === "POST") {
    if (!requireRole(user, ["enterprise"])) return sendError(res, 403, "鏃犳潈闄?");
    const order = db.orders.find((item) => item.id === user.orderId && item.status === "sold");
    if (!order) return sendError(res, 409, "璁㈠崟灏氭湭鎴愪氦鎴栦笉瀛樺湪");
    const furniture = db.settings.furniture.find((item) => item.id === body.furnitureId);
    if (!furniture) return sendError(res, 404, "灞曞叿涓嶅瓨鍦?");
    const profile = ensureProfile(db, order);
    profile.rentals.push({
      id: randomToken(6),
      furnitureId: furniture.id,
      furnitureName: furniture.name,
      qty: Math.max(1, Number(body.qty || 1)),
      status: "pending",
      reviewRemark: "",
      createdAt: nowIso()
    });
    profile.updatedAt = nowIso();
    writeLog(db, user, "鎻愪氦灞曞叿澧炵", `${furniture.name} x ${body.qty || 1}`, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  const rentalDeleteMatch = pathname.match(/^\/api\/exhibitor\/rentals\/([a-f0-9]+)$/);
  if (rentalDeleteMatch && method === "DELETE") {
    if (!requireRole(user, ["enterprise"])) return sendError(res, 403, "鏃犳潈闄?");
    const profile = db.profiles.find((item) => item.orderId === user.orderId);
    if (!profile) return sendError(res, 404, "璧勬枡涓嶅瓨鍦?");
    const rental = profile.rentals.find((item) => item.id === rentalDeleteMatch[1]);
    if (!rental) return sendError(res, 404, "灞曞叿澧炵鐢宠涓嶅瓨鍦?");
    profile.rentals = profile.rentals.filter((item) => item.id !== rentalDeleteMatch[1]);
    profile.updatedAt = nowIso();
    writeLog(db, user, "鍒犻櫎灞曞叿澧炵", `${rental.furnitureName} x ${rental.qty}`, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  const fasciaReviewMatch = pathname.match(/^\/api\/exhibitor\/fascia\/(\d+)\/review$/);
  if (fasciaReviewMatch && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const profile = db.profiles.find((item) => item.id === Number(fasciaReviewMatch[1]));
    if (!profile) return sendError(res, 404, "璧勬枡涓嶅瓨鍦?");
    const nextStatus = body.status === "approved" ? "approved" : "rejected";
    if (!requireRejectedReviewRemark(res, nextStatus, body)) return;
    profile.fascia.status = nextStatus;
    profile.fascia.reviewRemark = reviewRemarkFromBody(body);
    profile.fascia.reviewedBy = user.id;
    profile.fascia.reviewedAt = nowIso();
    profile.updatedAt = nowIso();
    writeLog(db, user, "瀹℃牳妤ｆ澘淇敼", profile.fascia.status, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  const rentalReviewMatch = pathname.match(/^\/api\/exhibitor\/rentals\/(\d+)\/([a-f0-9]+)\/review$/);
  if (rentalReviewMatch && method === "POST") {
    if (!requireRole(user, ["admin"])) return sendError(res, 403, "鏃犳潈闄?");
    const profile = db.profiles.find((item) => item.id === Number(rentalReviewMatch[1]));
    if (!profile) return sendError(res, 404, "璧勬枡涓嶅瓨鍦?");
    const rental = profile.rentals.find((item) => item.id === rentalReviewMatch[2]);
    if (!rental) return sendError(res, 404, "灞曞叿鐢宠涓嶅瓨鍦?");
    const nextStatus = body.status === "approved" ? "approved" : "rejected";
    if (!requireRejectedReviewRemark(res, nextStatus, body)) return;
    rental.status = nextStatus;
    rental.reviewRemark = reviewRemarkFromBody(body);
    rental.reviewedBy = user.id;
    rental.reviewedAt = nowIso();
    profile.updatedAt = nowIso();
    writeLog(db, user, "瀹℃牳灞曞叿澧炵", `${rental.furnitureName} ${rental.status}`, "profile", profile.id);
    saveDb(db);
    return send(res, 200, { profile });
  }

  if (pathname === "/api/export/orders" && method === "GET") {
    const eventId = db.settings.event.id;
    const orders = isAdminLike(user)
      ? db.orders.filter((order) => String(order.eventId || eventId) === String(eventId))
      : db.orders.filter((order) => canAccessOrder(db, user, order));
    const rows = [["订单号", "类型", "企业", "业务员", "展馆", "展位", "总金额", "已审核收款", "首款要求", "状态", "预留到期"]];
    orders.forEach((order) => {
      const company = db.companies.find((item) => item.id === order.companyId);
      const sales = db.users.find((item) => item.id === order.salespersonId);
      rows.push([
        order.orderNo,
        order.type === "booth" ? "展位订单" : "无展位订单",
        company ? company.name : "",
        sales ? sales.displayName : "",
        [...new Set(order.boothSnapshot.map((booth) => booth.hall).filter(Boolean))].join(" / "),
        order.boothSnapshot.map((booth) => booth.boothNo).join(" / "),
        order.totalAmount,
        order.paidApprovedAmount,
        order.depositRequired,
        order.status,
        order.reserveExpiresAt || ""
      ]);
    });
    const bodyCsv = "\ufeff" + csv(rows);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=orders.csv"
    });
    res.end(bodyCsv);
    return undefined;
  }

  if (pathname === "/api/export/exhibitor" && method === "GET") {
    const eventId = db.settings.event.id;
    const profiles = isAdminLike(user) ? db.profiles.filter((profile) => {
      const order = db.orders.find((item) => item.id === profile.orderId);
      return order && String(order.eventId || eventId) === String(eventId);
    }) : db.profiles.filter((profile) => {
      const order = db.orders.find((item) => item.id === profile.orderId);
      return canAccessOrder(db, user, order);
    });
    const rows = [["订单号", "企业", "企业介绍", "产品介绍", "参展证人数", "楣板状态", "楣板修改", "展具申请数"]];
    profiles.forEach((profile) => {
      const order = db.orders.find((item) => item.id === profile.orderId);
      const company = db.companies.find((item) => item.id === profile.companyId);
      rows.push([
        order ? order.orderNo : "",
        company ? company.name : "",
        profile.catalog.companyIntro,
        profile.catalog.productIntro,
        profile.badges.length,
        profile.fascia.status,
        profile.fascia.requestedName,
        profile.rentals.length
      ]);
    });
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=exhibitor.csv"
    });
    res.end("\ufeff" + csv(rows));
    return undefined;
  }

  if (pathname === "/api/export/attachments" && method === "GET") {
    const rows = [["附件ID", "文件名", "类型", "大小", "分类", "受保护下载路径"]];
    db.attachments.filter((attachment) => canAccessAttachment(db, user, attachment)).forEach((attachment) => {
      rows.push([
        attachment.id,
        attachment.fileName,
        attachment.mimeType,
        attachment.size,
        attachment.category,
        `/api/files/${attachment.id}`
      ]);
    });
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=attachments.csv"
    });
    res.end("\ufeff" + csv(rows));
    return undefined;
  }

  return sendError(res, 404, "鎺ュ彛涓嶅瓨鍦?");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const method = req.method || "GET";
      const needsBody = !["GET", "HEAD"].includes(method);
      const body = needsBody ? await readBody(req) : {};
      await withApiLock(() => handleApi(req, res, url, body));
      return;
    }
    let requestPath = decodeURIComponent(url.pathname);
    if (requestPath === "/") requestPath = "/index.html";
    const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));
    if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return serveFile(res, path.join(PUBLIC_DIR, "index.html"));
    }
    return serveFile(res, filePath);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, error.message || "鏈嶅姟鍣ㄩ敊璇?");
  }
});

async function runWorkflowMaintenance() {
  await withApiLock(() => {
    const db = loadDb();
    const leadsChanged = syncCustomerLeadsForCurrentEvent(db);
    const remindersChanged = syncWorkflowReminders(db);
    if (leadsChanged || remindersChanged) saveDb(db);
  });
}

server.listen(PORT, () => {
  console.log(`Expo Sales MVP running at http://localhost:${PORT}`);
  console.log("Demo accounts: admin/admin123, sales01/sales123");
  runWorkflowMaintenance().catch((error) => console.error("workflow maintenance failed", error));
  setInterval(() => {
    runWorkflowMaintenance().catch((error) => console.error("workflow maintenance failed", error));
  }, 10 * 60 * 1000);
});
