const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.GLOBAL_CHECK_PORT || 3217);
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = path.join(ROOT, "data", "global-system-check.sqlite");
const SERVER_LOG = path.join(ROOT, "data", "global-system-check-server.log");
const NODE = process.execPath;
const PYTHON = process.env.PYTHON_BIN || path.join(
  process.env.USERPROFILE || "",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe"
);

const results = [];
const createdUploadNames = [];
let serverProcess = null;

function note(status, name, detail = "") {
  results.push({ status, name, detail });
  const marker = status === "PASS" ? "ok" : status === "WARN" ? "warn" : "fail";
  console.log(`[${marker}] ${name}${detail ? ` - ${detail}` : ""}`);
}

function pass(name, detail = "") {
  note("PASS", name, detail);
}

function warn(name, detail = "") {
  note("WARN", name, detail);
}

function fail(name, detail = "") {
  note("FAIL", name, detail);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanTestDb() {
  [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`, SERVER_LOG].forEach((file) => {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  });
}

function startServer() {
  cleanTestDb();
  const out = fs.openSync(SERVER_LOG, "a");
  const env = {
    ...process.env,
    PORT: String(PORT),
    DB_DRIVER: "sqlite",
    SQLITE_FILE: TEST_DB,
    PYTHON_BIN: PYTHON,
    PYTHONIOENCODING: "utf-8",
  };
  serverProcess = spawn(NODE, ["server.js"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`server exited with code ${code}`);
    }
  });
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/public/events`);
      if (res.ok) return;
    } catch (_) {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`server did not start; see ${SERVER_LOG}`);
}

async function rawRequest(method, urlPath, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  return { status: res.status, ok: res.ok, headers: res.headers, data, text };
}

async function api(method, urlPath, body, token, expectedStatus = 200, name = `${method} ${urlPath}`) {
  const res = await rawRequest(method, urlPath, body, token);
  if (res.status !== expectedStatus) {
    throw new Error(`${name}: expected ${expectedStatus}, got ${res.status}: ${res.text.slice(0, 300)}`);
  }
  return res.data;
}

async function expectStatus(method, urlPath, body, token, expectedStatus, expectedText, name) {
  const res = await rawRequest(method, urlPath, body, token);
  assert(res.status === expectedStatus, `${name}: expected ${expectedStatus}, got ${res.status}: ${res.text.slice(0, 300)}`);
  if (expectedText) assert(String(res.text).includes(expectedText), `${name}: response missing "${expectedText}": ${res.text.slice(0, 300)}`);
  pass(name, `${res.status}${expectedText ? ` ${expectedText}` : ""}`);
  return res.data;
}

async function step(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail || "");
  } catch (error) {
    fail(name, error.message);
  }
}

async function login(username, password, eventId, eventCategory) {
  const data = await api("POST", "/api/auth/login", { username, password, eventId, eventCategory }, null, 200, `login ${username}`);
  assert(data.token, `login ${username} did not return token`);
  return data;
}

async function bootstrap(token) {
  return api("GET", "/api/bootstrap", undefined, token);
}

async function upload(token, body) {
  const data = await api("POST", "/api/uploads", body, token);
  if (data.attachment?.storageName) createdUploadNames.push(data.attachment.storageName);
  return data;
}

function smallPdfDataUrl() {
  return `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n% test pdf\n").toString("base64")}`;
}

function smallPngDataUrl() {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/azT3ioAAAAASUVORK5CYII=",
    "base64"
  );
  return `data:image/png;base64,${png.toString("base64")}`;
}

function readState() {
  const code = `
import json, sqlite3
conn = sqlite3.connect(${JSON.stringify(TEST_DB)})
row = conn.execute("select state_value from app_state where state_key=?", ("main",)).fetchone()
conn.close()
print(row[0] if row else "{}")
`;
  const result = spawnSyncCompat(PYTHON, ["-c", code], { cwd: ROOT });
  return JSON.parse(result.stdout || "{}");
}

function spawnSyncCompat(command, args, options) {
  const { spawnSync } = require("child_process");
  const result = spawnSync(command, args, { ...options, encoding: "utf8", maxBuffer: 1024 * 1024 * 40 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result;
}

function cleanupUploads() {
  const uploadDir = path.join(ROOT, "storage", "uploads");
  for (const name of createdUploadNames) {
    const full = path.join(uploadDir, name);
    if (full.startsWith(uploadDir) && fs.existsSync(full)) fs.rmSync(full, { force: true });
  }
}

async function main() {
  startServer();
  await waitForServer();

  let adminToken;
  let salesToken;
  let enterpriseToken;
  let admin;
  let salesUser;
  let eventId;
  let eventCategory;
  let departmentId;
  let boothA;
  let boothB;
  let boothC;
  let mainCompany;
  let mainLead;
  let mainOrder;
  let mainPayment;
  let enterpriseCredentials;
  let profileId;
  let rentalId;

  await step("public events are exposed", async () => {
    const data = await api("GET", "/api/public/events");
    assert(data.events?.length >= 1, "no public events");
    return `${data.events[0].id}`;
  });

  await expectStatus("GET", "/api/bootstrap", undefined, null, 401, "请先登录", "unauthenticated API is blocked");
  await expectStatus("POST", "/api/auth/login", { username: "admin", password: "bad", eventId: "event-2026", eventCategory: "默认类别" }, null, 401, "账号或密码不正确", "wrong password is rejected");
  await expectStatus("POST", "/api/auth/login", { username: "admin", password: "admin123" }, null, 400, "请先选择展会类别和展会", "login requires event selection");

  await step("admin login", async () => {
    admin = await login("admin", "admin123", "event-2026", "默认类别");
    adminToken = admin.token;
    return admin.user.displayName;
  });

  await step("create event category and event", async () => {
    const suffix = Date.now();
    eventCategory = `全局体检类别${suffix}`;
    eventId = `qa-${suffix}`;
    await api("POST", "/api/event-categories", { name: eventCategory }, adminToken);
    const event = await api("POST", "/api/events", {
      id: eventId,
      name: `全局体检展会${suffix}`,
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      location: "广州测试展馆",
      category: eventCategory,
    }, adminToken);
    assert(event.event.id === eventId, "event id mismatch");
    return eventId;
  });

  await expectStatus("POST", "/api/events", {
    id: eventId,
    name: "重复展会",
    category: eventCategory,
  }, adminToken, 409, "展会编号已存在", "duplicate event id is rejected");

  await step("create department and sales account", async () => {
    const dept = await api("POST", "/api/departments", { name: "全局体检销售部" }, adminToken);
    departmentId = dept.department.id;
    await expectStatus("POST", "/api/users", {
      username: "qa_missing_dept",
      password: "x",
      displayName: "缺部门",
      role: "sales",
    }, adminToken, 400, "请选择账号归属部门", "sales account requires department");
    const user = await api("POST", "/api/users", {
      username: `qa_sales_${Date.now()}`,
      password: "sales123",
      displayName: "体检业务员",
      role: "sales",
      departmentId,
    }, adminToken);
    salesUser = user.user;
    await expectStatus("POST", "/api/users", {
      username: salesUser.username,
      password: "sales123",
      displayName: "重复账号",
      role: "sales",
      departmentId,
    }, adminToken, 409, "账号已存在", "duplicate account is rejected");
    await api("PUT", "/api/event-roles", { eventId, assignments: [{ userId: salesUser.id, role: "sales" }] }, adminToken);
    return `${salesUser.username}/${departmentId}`;
  });

  await expectStatus("POST", "/api/auth/login", {
    username: salesUser.username,
    password: "sales123",
    eventId,
    eventCategory: "错误类别",
  }, null, 400, "展会类别与展会不匹配", "login category mismatch is rejected");

  await step("sales login", async () => {
    const sales = await login(salesUser.username, "sales123", eventId, eventCategory);
    salesToken = sales.token;
    return sales.user.displayName;
  });

  await step("configure rules, targets, halls, zones, furniture", async () => {
    await api("PUT", "/api/settings", {
      rules: {
        customerTargetMode: "sales",
        salesFlowMode: "contract_first",
        deadlineDayMode: "natural",
        reserveWorkdays: 7,
        contractApprovedVoucherWorkdays: 7,
        newCustomerProtectDays: 30,
        depositRate: 0.3,
      },
      halls: ["1号馆"],
      zones: ["A区", "B区"],
      salesTargets: [{ userId: salesUser.id, taskCount: 10, protectionLimit: 10 }],
      furniture: [
        { id: "table", name: "咨询桌", size: "1200x600mm", price: 160, active: true },
        { id: "power", name: "电源插座", size: "500W", price: 220, active: true },
      ],
    }, adminToken);
    return "contract_first + target limit 10";
  });

  await step("create booths", async () => {
    const a = await api("POST", "/api/booths", { boothNo: "A001", x: 20, y: 20, width: 60, height: 40, widthM: 3, depthM: 3, hall: "1号馆", zone: "A区", attr: "standard" }, adminToken);
    const b = await api("POST", "/api/booths", { boothNo: "A002", x: 90, y: 20, width: 60, height: 40, widthM: 3, depthM: 3, hall: "1号馆", zone: "A区", attr: "standard" }, adminToken);
    const c = await api("POST", "/api/booths", { boothNo: "A003", x: 160, y: 20, width: 60, height: 40, widthM: 3, depthM: 3, hall: "1号馆", zone: "B区", attr: "standard" }, adminToken);
    boothA = a.booth;
    boothB = b.booth;
    boothC = c.booth;
    assert(boothA.price > 0, "booth price was not calculated");
    return `${boothA.boothNo}, ${boothB.boothNo}, ${boothC.boothNo}`;
  });

  await expectStatus("POST", "/api/companies", { name: "" }, salesToken, 400, "企业名称必填", "company name is required");

  await step("customer protection limit rejects overflow", async () => {
    await api("PUT", "/api/settings", {
      rules: { customerTargetMode: "sales" },
      salesTargets: [{ userId: salesUser.id, taskCount: 10, protectionLimit: 1 }],
    }, adminToken);
    await api("POST", "/api/companies", { name: "客保上限企业一", contactName: "张三", phone: "13800000001" }, salesToken);
    await expectStatus("POST", "/api/companies", { name: "客保上限企业二", contactName: "李四", phone: "13800000002" }, salesToken, 409, "客户保护名额已满", "customer protection overflow is rejected");
    await api("PUT", "/api/settings", {
      salesTargets: [{ userId: salesUser.id, taskCount: 10, protectionLimit: 10 }],
    }, adminToken);
  });

  await step("create main protected customer", async () => {
    const data = await api("POST", "/api/companies", {
      name: "主流程测试企业",
      shortName: "主流程",
      contactName: "王五",
      phone: "13800000003",
      email: "main@example.com",
      address: "测试地址",
      taxNo: "TAX-MAIN-001",
      province: "广东省",
      city: "广州市",
    }, salesToken);
    mainCompany = data.company;
    mainLead = data.lead;
    assert(mainLead.status === "protected", "lead not protected");
    return `company ${mainCompany.id}, lead ${mainLead.id}`;
  });

  await expectStatus("POST", "/api/companies", { name: mainCompany.name }, salesToken, 409, "该企业已在客户列表中", "duplicate protected customer is rejected");
  await expectStatus("PUT", `/api/companies/${mainCompany.id}`, { name: "业务员改名", shortName: mainCompany.shortName }, salesToken, 403, "业务员不能修改企业名称", "sales cannot rename protected company");
  await expectStatus("POST", "/api/orders", { companyId: mainCompany.id, type: "booth", boothIds: [] }, salesToken, 400, "请选择展位", "booth order requires booth");
  await expectStatus("POST", "/api/orders", { companyId: mainCompany.id, type: "booth", boothIds: [99999] }, salesToken, 404, "部分展位不存在", "invalid booth id is rejected");
  await expectStatus("POST", "/api/orders", { company: { name: "无展位零元企业" }, type: "custom", totalAmount: 0 }, salesToken, 400, "无展位订单金额必须大于 0", "custom order requires positive amount");

  await step("create booth order", async () => {
    const data = await api("POST", "/api/orders", { companyId: mainCompany.id, type: "booth", boothIds: [boothA.id], title: "展位订单", details: "全链路测试订单" }, salesToken);
    mainOrder = data.order;
    assert(mainOrder.status === "reserved", "order not reserved");
    assert(mainOrder.boothSnapshot[0].hall === "1号馆", "booth snapshot missing hall");
    return `${mainOrder.orderNo}`;
  });

  await expectStatus("POST", "/api/orders", { companyId: mainCompany.id, type: "booth", boothIds: [boothB.id] }, salesToken, 409, "已存在有效订单", "duplicate active order is rejected");
  await expectStatus("POST", "/api/orders", { company: { name: "占用展位企业" }, type: "booth", boothIds: [boothA.id] }, salesToken, 409, "所选展位已被占用", "occupied booth is rejected");
  await expectStatus("POST", `/api/customer-leads/${mainLead.id}/release`, {}, salesToken, 409, "该客户已有有效订单", "protected customer with active order cannot be released manually");
  await expectStatus("POST", `/api/orders/${mainOrder.id}/enterprise-account`, {}, salesToken, 409, "只有成交的展位订单可以生成企业账号", "enterprise account before sold is rejected");
  await expectStatus("POST", `/api/orders/${mainOrder.id}/payments`, { amount: 1000 }, salesToken, 409, "当前销售流程要求合同审核通过后才能上传水单", "contract-first payment is blocked before contract approval");

  await expectStatus("POST", "/api/uploads", {
    dataUrl: "data:text/plain;base64,SGVsbG8=",
    fileName: "bad.txt",
    category: "customer-contract",
    leadId: mainLead.id,
  }, salesToken, 400, "合同和水单仅支持", "bad contract file type is rejected");

  await expectStatus("POST", "/api/uploads", {
    dataUrl: smallPdfDataUrl(),
    fileName: "voucher-before-contract.pdf",
    category: "customer-voucher",
    leadId: mainLead.id,
  }, salesToken, 409, "当前销售流程要求合同审核通过后才能上传水单", "voucher upload is blocked before contract approval");

  await step("upload and approve customer contract", async () => {
    await upload(salesToken, {
      dataUrl: smallPdfDataUrl(),
      fileName: "合同.pdf",
      category: "customer-contract",
      leadId: mainLead.id,
    });
    await expectStatus("POST", `/api/customer-leads/${mainLead.id}/contract/review`, { status: "rejected" }, adminToken, 400, "审核不通过时必须填写原因", "contract rejection requires reason");
    const data = await api("POST", `/api/customer-leads/${mainLead.id}/contract/review`, { status: "approved" }, adminToken);
    assert(data.lead.contractReviewStatus === "approved", "contract not approved");
    assert(data.lead.voucherDueAt, "voucher due date not set");
    mainLead = data.lead;
    return "contract approved";
  });

  await step("upload and approve customer voucher", async () => {
    await upload(salesToken, {
      dataUrl: smallPdfDataUrl(),
      fileName: "水单.pdf",
      category: "customer-voucher",
      leadId: mainLead.id,
    });
    const data = await api("POST", `/api/customer-leads/${mainLead.id}/voucher/review`, { status: "approved" }, adminToken);
    assert(data.lead.voucherReviewStatus === "approved", "voucher not approved");
    return "customer voucher approved";
  });

  await expectStatus("POST", `/api/orders/${mainOrder.id}/payments`, { amount: 0 }, salesToken, 400, "收款金额必须大于 0", "payment amount must be positive");
  await expectStatus("POST", "/api/payments/99999/review", { status: "approved" }, adminToken, 404, "水单不存在", "unknown payment review is rejected");

  await step("submit and approve order payment to sold", async () => {
    const created = await api("POST", `/api/orders/${mainOrder.id}/payments`, { amount: mainOrder.totalAmount, payer: "主流程测试企业", remark: "全款" }, salesToken);
    mainPayment = created.payment;
    await expectStatus("POST", `/api/payments/${mainPayment.id}/review`, { status: "rejected" }, adminToken, 400, "审核不通过时必须填写原因", "payment rejection requires reason");
    const reviewed = await api("POST", `/api/payments/${mainPayment.id}/review`, { status: "approved" }, adminToken);
    assert(reviewed.order.status === "sold", `order not sold: ${reviewed.order.status}`);
    mainOrder = reviewed.order;
    return `${mainOrder.orderNo} sold`;
  });

  await step("generate enterprise account and link", async () => {
    enterpriseCredentials = await api("POST", `/api/orders/${mainOrder.id}/enterprise-account`, {}, salesToken);
    assert(enterpriseCredentials.username && enterpriseCredentials.password, "enterprise credentials missing");
    const link = await api("POST", `/api/orders/${mainOrder.id}/enterprise-link`, { days: 99 }, salesToken);
    assert(link.link && link.expiresAt, "enterprise link missing");
    return enterpriseCredentials.username;
  });

  await expectStatus("PUT", "/api/exhibitor/profile", { catalog: { companyIntro: "x" } }, salesToken, 403, "企业账号才可提交展务资料", "non-enterprise cannot submit exhibitor profile");

  await step("enterprise login and fill exhibitor profile", async () => {
    const enterprise = await login(enterpriseCredentials.username, enterpriseCredentials.password, eventId, eventCategory);
    enterpriseToken = enterprise.token;
    const profileUpdate = await api("PUT", "/api/exhibitor/profile", {
      catalog: {
        companyIntro: "主流程测试企业介绍",
        productIntro: "测试产品介绍",
      },
    }, enterpriseToken);
    profileId = profileUpdate.profile.id;
    await api("POST", "/api/exhibitor/badges", { name: "参展人一", phone: "13900000001", title: "经理", idNo: "ID001" }, enterpriseToken);
    const fascia = await api("POST", "/api/exhibitor/fascia", { requestedName: "主流程测试楣板" }, enterpriseToken);
    profileId = fascia.profile.id;
    await expectStatus("POST", "/api/exhibitor/rentals", { furnitureId: "missing", qty: 1 }, enterpriseToken, 404, "展具不存在", "unknown rental furniture is rejected");
    const rental = await api("POST", "/api/exhibitor/rentals", { furnitureId: "table", qty: 2 }, enterpriseToken);
    const rentals = rental.profile.rentals || [];
    rentalId = rentals[rentals.length - 1].id;
    assert(rentalId, "rental id missing");
    return `profile ${profileId}, rental ${rentalId}`;
  });

  await step("admin reviews exhibitor fascia and rental", async () => {
    await expectStatus("POST", `/api/exhibitor/fascia/${profileId}/review`, { status: "rejected" }, adminToken, 400, "审核不通过时必须填写原因", "fascia rejection requires reason");
    const fascia = await api("POST", `/api/exhibitor/fascia/${profileId}/review`, { status: "approved" }, adminToken);
    assert(fascia.profile.fascia.status === "approved", "fascia not approved");
    await expectStatus("POST", `/api/exhibitor/rentals/${profileId}/000000/review`, { status: "approved" }, adminToken, 404, "展具申请不存在", "unknown rental review is rejected");
    const rental = await api("POST", `/api/exhibitor/rentals/${profileId}/${rentalId}/review`, { status: "approved" }, adminToken);
    const item = rental.profile.rentals.find((row) => row.id === rentalId);
    assert(item?.status === "approved", "rental not approved");
    return "fascia/rental approved";
  });

  await step("order change request flow", async () => {
    const change = await api("POST", `/api/orders/${mainOrder.id}/change-requests`, { action: "change_booth", boothIds: [boothB.id] }, salesToken);
    assert(change.request.status === "pending", "change request not pending");
    await expectStatus("POST", `/api/change-requests/${change.request.id}/review`, { status: "rejected" }, adminToken, 400, "审核不通过时必须填写原因", "change rejection requires reason");
    const reviewed = await api("POST", `/api/change-requests/${change.request.id}/review`, { status: "approved" }, adminToken);
    assert(reviewed.request.status === "approved", "change not approved");
    await expectStatus("POST", `/api/change-requests/${change.request.id}/review`, { status: "approved" }, adminToken, 409, "申请已经处理", "processed change cannot be reviewed twice");
    return reviewed.request.appliedDetail || "changed";
  });

  await expectStatus("POST", `/api/orders/${mainOrder.id}/change-requests`, { action: "change_booth", boothIds: [boothB.id] }, salesToken, 409, "新展位已被占用", "change to occupied booth is rejected");

  await step("release job frees expired booth order", async () => {
    await api("PUT", "/api/settings", { rules: { reserveWorkdays: 0, salesFlowMode: "voucher_direct", newCustomerProtectDays: 30 } }, adminToken);
    const company = await api("POST", "/api/companies", { name: "到期释放订单企业", contactName: "到期", phone: "13800000004" }, salesToken);
    const order = await api("POST", "/api/orders", { companyId: company.company.id, type: "booth", boothIds: [boothC.id] }, salesToken);
    const released = await api("POST", "/api/jobs/release", {}, adminToken);
    assert(released.releasedCount >= 1, "no expired order released");
    const data = await bootstrap(adminToken);
    const found = data.orders.find((row) => row.id === order.order.id);
    const booth = data.booths.find((row) => row.id === boothC.id);
    assert(found.status === "released", `order status is ${found.status}`);
    assert(booth.status === "available", `booth status is ${booth.status}`);
    return `${found.orderNo} released`;
  });

  await step("release job moves expired protected customer to public pool", async () => {
    await api("PUT", "/api/settings", { rules: { newCustomerProtectDays: 0 }, salesTargets: [{ userId: salesUser.id, taskCount: 10, protectionLimit: 10 }] }, adminToken);
    const company = await api("POST", "/api/companies", { name: "到期下保企业", contactName: "下保", phone: "13800000005" }, salesToken);
    const released = await api("POST", "/api/jobs/release", {}, adminToken);
    assert(released.leadsChanged === true, "leadsChanged was not true");
    const data = await bootstrap(adminToken);
    const lead = data.customerLeads.find((row) => row.id === company.lead.id);
    assert(lead.status === "public", `lead status is ${lead.status}`);
    assert(lead.publicReason === "新客户保护到期", `unexpected reason ${lead.publicReason}`);
    return `lead ${lead.id} public`;
  });

  await step("public pool claim flow", async () => {
    const data = await bootstrap(adminToken);
    const publicLead = data.customerLeads.find((row) => row.status === "public" && row.publicReason === "新客户保护到期");
    assert(publicLead, "no public lead to claim");
    await api("PUT", "/api/settings", { rules: { newCustomerProtectDays: 30 }, salesTargets: [{ userId: salesUser.id, taskCount: 10, protectionLimit: 10 }] }, adminToken);
    const claimed = await api("POST", `/api/customer-leads/${publicLead.id}/claim`, {}, salesToken);
    assert(claimed.lead.status === "protected", "lead not claimed");
    return `claimed ${publicLead.id}`;
  });

  await step("export endpoints respond", async () => {
    const orders = await rawRequest("GET", "/api/export/orders", undefined, adminToken);
    assert(orders.status === 200 && orders.text.includes("订单号"), "orders export failed");
    const exhibitor = await rawRequest("GET", "/api/export/exhibitor", undefined, adminToken);
    assert(
      exhibitor.status === 200 && exhibitor.text.includes("企业介绍") && exhibitor.text.includes("展具申请数"),
      `exhibitor export failed: ${exhibitor.status} ${exhibitor.text.slice(0, 120)}`
    );
    const attachments = await rawRequest("GET", "/api/export/attachments", undefined, adminToken);
    assert(
      attachments.status === 200 && attachments.text.includes("附件ID") && attachments.text.includes("受保护下载路径"),
      `attachments export failed: ${attachments.status} ${attachments.text.slice(0, 120)}`
    );
    return "orders/exhibitor/attachments";
  });

  const state = readState();
  const sold = state.orders.filter((order) => order.status === "sold").length;
  const released = state.orders.filter((order) => order.status === "released").length;
  if (!sold || !released) warn("final state sanity", `sold=${sold}, released=${released}`);
  else pass("final state sanity", `sold=${sold}, released=${released}, users=${state.users.length}`);
}

main()
  .catch((error) => {
    fail("global system check crashed", error.stack || error.message);
  })
  .finally(async () => {
    cleanupUploads();
    if (serverProcess) {
      serverProcess.kill();
      await sleep(500);
    }
    const passCount = results.filter((item) => item.status === "PASS").length;
    const warnCount = results.filter((item) => item.status === "WARN").length;
    const failCount = results.filter((item) => item.status === "FAIL").length;
    console.log("");
    console.log(`SUMMARY pass=${passCount} warn=${warnCount} fail=${failCount}`);
    if (failCount) {
      console.log("FAILED ITEMS:");
      results.filter((item) => item.status === "FAIL").forEach((item) => {
        console.log(`- ${item.name}: ${item.detail}`);
      });
      process.exitCode = 1;
    }
  });
