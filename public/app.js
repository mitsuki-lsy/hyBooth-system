const App = (() => {
  const state = {
    token: localStorage.getItem("expoToken") || "",
    data: null,
    loginEvents: [],
    loginCategories: [],
    loginEventCategory: "",
    view: "dashboard",
    openMenuGroups: new Set(["customer-data", "event-related"]),
    error: "",
    message: "",
    selectedBoothIds: new Set(),
    pendingBoothIds: [],
    selectedBoothId: null,
    mapZoom: "fit",
    fitMapZoom: 1,
    boothPickerOpen: false,
    boothPickerSearch: "",
    boothPickerFocusId: null,
    paymentModalOrderId: null,
    changePickerOpen: false,
    changePickerOrderId: null,
    changePickerSearch: "",
    changePickerBoothIds: [],
    changePickerFocusId: null,
    customerModalOpen: false,
    customerAttendLeadId: null,
    companyDetailId: null,
    companyEditId: null,
    globalSearchQuery: "",
    globalSearchOpen: false,
    attachmentPreviewId: null,
    eventRoleModal: null,
    eventCreateModalOpen: false,
    warehouseCategory: "",
    settingsTab: "workflow",
    approvalHistoryFilter: {
      flow: "",
      result: "",
      keyword: ""
    },
    exhibitorFilter: "",
    newCustomerFilter: "",
    oldCustomerFilter: "",
    mapUndoStack: [],
    mapRedoStack: [],
    boothSizePreviewHistoryId: null,
    obstacleSizePreviewHistoryId: null,
    activityAreaSizePreviewHistoryId: null,
    mapDragSnapshot: null,
    mapObstacleDragSnapshot: null,
    mapActivityAreaDragSnapshot: null,
    customerDraft: {
      name: "",
      shortName: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      taxNo: "",
      locationType: "domestic",
      countryRegion: "",
      province: "广东省",
      city: "广州市",
      ownerSalesId: ""
    },
    approvalTab: "payments",
    salesMapOnlyAvailable: false,
    salesMapZone: "",
    salesMapAttr: "",
    salesMapStatus: "",
    salesMapSearch: "",
    salesMapFocusId: null,
    orderDraft: {
      type: "booth",
      salespersonId: "",
      title: "展位订单",
      companyName: "",
      companyShortName: "",
      companyContact: "",
      companyPhone: "",
      companyEmail: "",
      companyAddress: "",
      companyTax: "",
      companyLocationType: "domestic",
      companyCountryRegion: "",
      companyProvince: "广东省",
      companyCity: "广州市",
      companyId: "",
      customAmount: "0",
      customDetail: "",
      hasDiscount: "no",
      discountRuleId: "",
      details: ""
    },
    drawPresetWidthM: "3",
    drawPresetDepthM: "3",
    drawPresetHall: "",
    drawPresetZone: "",
    drawBoothNoPrefix: "",
    drawBoothNoChars: "4",
    drawBoothNoStart: "1001",
    drawBoothNoSkipEnabled: "no",
    drawBoothNoStep: "1",
    drawBoothNoResetActive: false,
    drawPresetCollapsed: true,
    drawing: null,
    selecting: null,
    obstacleDrawing: null,
    obstacleDragging: null,
    obstacleMode: "",
    obstacleShape: "rect",
    selectedObstacleId: null,
    suppressObstacleClick: false,
    activityAreaMode: false,
    activityAreaDrawing: null,
    selectedActivityAreaId: null,
    dragging: null,
    drawMode: false,
    countdownTimer: null
  };

  const root = () => document.getElementById("app");
  const byId = (id) => document.getElementById(id);
  const defaultZoneColors = ["#2f80ed", "#27ae60", "#f2994a", "#9b51e0", "#eb5757", "#00a3a3", "#6f42c1", "#0f766e"];
  const imageUploadLimit = 3 * 1024 * 1024;
  const closedOrderStatuses = new Set(["released", "cancelled"]);
  const finalReviewStatuses = new Set(["approved", "rejected"]);
  const contractVoucherAccept = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";
  const mainlandCityMap = {
    "北京市": ["北京市"],
    "天津市": ["天津市"],
    "河北省": ["石家庄市", "唐山市", "秦皇岛市", "邯郸市", "保定市", "张家口市", "承德市", "廊坊市", "沧州市"],
    "山西省": ["太原市", "大同市", "阳泉市", "长治市", "晋城市", "晋中市", "运城市", "临汾市", "吕梁市"],
    "内蒙古自治区": ["呼和浩特市", "包头市", "乌海市", "赤峰市", "通辽市", "鄂尔多斯市", "呼伦贝尔市"],
    "辽宁省": ["沈阳市", "大连市", "鞍山市", "抚顺市", "本溪市", "丹东市", "锦州市", "营口市"],
    "吉林省": ["长春市", "吉林市", "四平市", "辽源市", "通化市", "白山市", "松原市"],
    "黑龙江省": ["哈尔滨市", "齐齐哈尔市", "牡丹江市", "佳木斯市", "大庆市", "鸡西市", "双鸭山市"],
    "上海市": ["上海市"],
    "江苏省": ["南京市", "无锡市", "徐州市", "常州市", "苏州市", "南通市", "连云港市", "淮安市", "盐城市", "扬州市", "镇江市", "泰州市", "宿迁市"],
    "浙江省": ["杭州市", "宁波市", "温州市", "嘉兴市", "湖州市", "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市"],
    "安徽省": ["合肥市", "芜湖市", "蚌埠市", "淮南市", "马鞍山市", "安庆市", "黄山市", "阜阳市", "宿州市"],
    "福建省": ["福州市", "厦门市", "莆田市", "三明市", "泉州市", "漳州市", "南平市", "龙岩市", "宁德市"],
    "江西省": ["南昌市", "景德镇市", "萍乡市", "九江市", "新余市", "鹰潭市", "赣州市", "宜春市", "上饶市"],
    "山东省": ["济南市", "青岛市", "淄博市", "枣庄市", "东营市", "烟台市", "潍坊市", "济宁市", "泰安市", "威海市", "临沂市"],
    "河南省": ["郑州市", "开封市", "洛阳市", "平顶山市", "安阳市", "新乡市", "焦作市", "许昌市", "南阳市", "商丘市"],
    "湖北省": ["武汉市", "黄石市", "十堰市", "宜昌市", "襄阳市", "鄂州市", "荆门市", "孝感市", "荆州市", "黄冈市"],
    "湖南省": ["长沙市", "株洲市", "湘潭市", "衡阳市", "邵阳市", "岳阳市", "常德市", "张家界市", "益阳市", "郴州市"],
    "广东省": ["广州市", "深圳市", "珠海市", "汕头市", "佛山市", "韶关市", "湛江市", "肇庆市", "江门市", "茂名市", "惠州市", "东莞市", "中山市"],
    "广西壮族自治区": ["南宁市", "柳州市", "桂林市", "梧州市", "北海市", "防城港市", "钦州市", "贵港市", "玉林市"],
    "海南省": ["海口市", "三亚市", "三沙市", "儋州市"],
    "重庆市": ["重庆市"],
    "四川省": ["成都市", "自贡市", "攀枝花市", "泸州市", "德阳市", "绵阳市", "广元市", "遂宁市", "乐山市", "南充市", "宜宾市"],
    "贵州省": ["贵阳市", "六盘水市", "遵义市", "安顺市", "毕节市", "铜仁市"],
    "云南省": ["昆明市", "曲靖市", "玉溪市", "保山市", "昭通市", "丽江市", "普洱市", "临沧市"],
    "西藏自治区": ["拉萨市", "日喀则市", "昌都市", "林芝市", "山南市", "那曲市"],
    "陕西省": ["西安市", "铜川市", "宝鸡市", "咸阳市", "渭南市", "延安市", "汉中市", "榆林市"],
    "甘肃省": ["兰州市", "嘉峪关市", "金昌市", "白银市", "天水市", "武威市", "张掖市", "酒泉市"],
    "青海省": ["西宁市", "海东市"],
    "宁夏回族自治区": ["银川市", "石嘴山市", "吴忠市", "固原市", "中卫市"],
    "新疆维吾尔自治区": ["乌鲁木齐市", "克拉玛依市", "吐鲁番市", "哈密市"]
  };

  function h(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function isClosedOrderStatus(status) {
    return closedOrderStatuses.has(String(status || ""));
  }

  function isActiveOrder(order) {
    return order && !isClosedOrderStatus(order.status);
  }

  function isFinalReviewStatus(status) {
    return finalReviewStatuses.has(String(status || ""));
  }

  function money(value) {
    return `￥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
  }

  function date(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  }

  function countdownText(value) {
    if (!value) return "-";
    const diff = new Date(value).getTime() - Date.now();
    if (!Number.isFinite(diff)) return "-";
    if (diff <= 0) return "已到期";
    const seconds = Math.floor(diff / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return `${days}天 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function updateCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach((item) => {
      item.textContent = countdownText(item.dataset.countdown);
    });
  }

  function setupCountdowns() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    updateCountdowns();
    if (document.querySelector("[data-countdown]")) {
      state.countdownTimer = setInterval(updateCountdowns, 1000);
    } else {
      state.countdownTimer = null;
    }
  }

  function statusText(status) {
    return {
      available: "空闲",
      reserved: "已预留",
      pending_payment_review: "待审款",
      sold: "已首款成交",
      released: "已释放",
      cancelled: "已取消",
      disabled: "停用",
      pending: "待审核",
      approved: "已通过",
      rejected: "已驳回",
      none: "未上传",
      default: "默认"
    }[status] || status || "";
  }

  function orderSpecialApproved(order) {
    return Boolean(order?.specialApproved);
  }

  function orderDisplayStatusText(order) {
    if (orderSpecialApproved(order)) return "特殊成交";
    return statusText(order?.status);
  }

  function orderStatusBadge(order) {
    const className = orderSpecialApproved(order) ? "special-sold" : order?.status || "";
    return `<span class="status ${h(className)}">${h(orderDisplayStatusText(order))}</span>`;
  }

  function attrText(attr) {
    return attr === "raw" ? "光地" : "标摊";
  }

  function roleText(role) {
    return { admin: "超级管理员", manager: "管理员", sales: "业务员", enterprise: "企业账号" }[role] || role;
  }

  function isAdminLikeRole(role) {
    return role === "admin" || role === "manager";
  }

  function isSuperAdminRole(role) {
    return role === "admin";
  }

  function typeText(type) {
    return type === "custom" ? "无展位订单" : "展位订单";
  }

  function statusBadge(status) {
    return `<span class="status ${h(status)}">${h(statusText(status))}</span>`;
  }

  function fileUrl(id) {
    return `/api/files/${id}?token=${encodeURIComponent(state.token)}`;
  }

  function attachmentById(id) {
    return (state.data?.attachments || []).find((item) => Number(item.id) === Number(id)) || null;
  }

  function formatFileSize(size) {
    const bytes = Number(size || 0);
    if (!bytes) return "未知大小";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function attachmentPreviewButton(id, label = "预览") {
    const attachment = attachmentById(id);
    if (!attachment) return `<span class="hint">无附件</span>`;
    return `
      <button type="button" class="tiny secondary" onclick="App.openAttachmentPreview(${Number(id)})">${h(label)}</button>
      <a class="attachment-link" target="_blank" href="${fileUrl(id)}">下载</a>
      <div class="hint">${h(attachment.fileName || "")} · ${formatFileSize(attachment.size)} · ${h(date(attachment.createdAt))}</div>
    `;
  }

  function attachmentPreviewModal() {
    if (!state.attachmentPreviewId) return "";
    const attachment = attachmentById(state.attachmentPreviewId);
    if (!attachment) return "";
    const mime = String(attachment.mimeType || "");
    const url = fileUrl(attachment.id);
    const isImage = mime.startsWith("image/");
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(attachment.fileName || "");
    const isVideo = mime.startsWith("video/");
    const body = isImage
      ? `<img class="attachment-preview-media" src="${url}" alt="${h(attachment.fileName)}">`
      : isPdf
        ? `<iframe class="attachment-preview-frame" src="${url}" title="${h(attachment.fileName)}"></iframe>`
        : isVideo
          ? `<video class="attachment-preview-media" src="${url}" controls preload="metadata"></video>`
          : `<div class="empty">该文件类型暂不支持内嵌预览，可以点击下载查看。</div>`;
    return `
      <div class="modal-backdrop">
        <section class="modal large">
          <header class="modal-header">
            <h2>附件预览</h2>
            <button class="secondary" onclick="App.closeAttachmentPreview()">关闭</button>
          </header>
          <div class="attachment-meta">
            <strong>${h(attachment.fileName || "-")}</strong>
            <span>${h(mime || "未知类型")}</span>
            <span>${formatFileSize(attachment.size)}</span>
            <span>${h(date(attachment.createdAt))}</span>
            ${isVideo ? `<span>${mime.startsWith("video/") ? "浏览器可尝试播放" : "可能不可播放"}</span>` : ""}
          </div>
          ${body}
          <div class="split-actions" style="margin-top:14px">
            <a class="button-link" target="_blank" href="${url}">新窗口打开</a>
          </div>
        </section>
      </div>
    `;
  }

  function mapScale() {
    return Math.max(1, Number(byId("map-scale")?.value || state.data?.map?.scalePxPerMeter || 16));
  }

  function meterToPx(value) {
    return Math.max(1, Math.round(Number(value || 0) * mapScale()));
  }

  function pxToMeter(value, digits = 2) {
    return Number((Number(value || 0) / mapScale()).toFixed(digits));
  }

  function formatDecimal(value, digits = 3) {
    return Number(value || 0).toFixed(digits).replace(/\.?0+$/, "");
  }

  function fixedDecimal(value, digits = 3) {
    return Number(value || 0).toFixed(digits);
  }

  function preciseCoord(value, digits = 3) {
    return Number(Number(value || 0).toFixed(digits));
  }

  function obstacleWidthM(obstacle) {
    return Number(obstacle?.widthM !== undefined ? obstacle.widthM : pxToMeter(obstacle?.width, 3));
  }

  function obstacleDepthM(obstacle) {
    return Number(obstacle?.depthM !== undefined ? obstacle.depthM : pxToMeter(obstacle?.height, 3));
  }

  function obstacleShape(obstacle) {
    return obstacle?.shape === "circle" ? "circle" : "rect";
  }

  function obstacleShapeText(shape) {
    return shape === "circle" ? "圆形" : "矩形";
  }

  function obstacleAreaFromSize(widthM, depthM, shape = "rect") {
    const width = Math.max(0, Number(widthM || 0));
    const depth = Math.max(0, Number(depthM || 0));
    const area = shape === "circle" ? Math.PI * (width / 2) * (depth / 2) : width * depth;
    return Number(area.toFixed(3));
  }

  function obstaclePhysicalArea(obstacle) {
    const area = Number(obstacle?.area || 0);
    if (area > 0) return Number(area.toFixed(3));
    return obstacleAreaFromSize(obstacleWidthM(obstacle), obstacleDepthM(obstacle), obstacleShape(obstacle));
  }

  function effectiveMapZoom() {
    if (state.mapZoom === "fit") return Math.max(0.05, Number(state.fitMapZoom || 1));
    return Math.max(0.05, Number(state.mapZoom || 1));
  }

  function cloneMapSnapshot() {
    return {
      booths: JSON.parse(JSON.stringify(state.data?.booths || [])),
      obstacles: JSON.parse(JSON.stringify(state.data?.obstacles || [])),
      activityAreas: JSON.parse(JSON.stringify(state.data?.activityAreas || []))
    };
  }

  function rememberMapState() {
    if (!state.data) return;
    state.mapUndoStack.push(cloneMapSnapshot());
    if (state.mapUndoStack.length > 30) state.mapUndoStack.shift();
    state.mapRedoStack = [];
  }

  async function restoreMapSnapshot(snapshot, success) {
    if (!snapshot) return null;
    const scroll = captureMapScroll();
    const result = await run(() => api("/api/map/snapshot", {
      method: "POST",
      body: snapshot
    }), success);
    if (result) {
      state.selectedBoothId = null;
      state.selectedBoothIds.clear();
      state.selectedObstacleId = null;
      state.selectedActivityAreaId = null;
      render();
      restoreMapScroll(scroll);
    }
    return result;
  }

  function normalizeColor(value, index = 0) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : defaultZoneColors[index % defaultZoneColors.length];
  }

  function normalizeZone(zone, index = 0) {
    if (typeof zone === "string") {
      return { name: zone.trim(), color: normalizeColor("", index) };
    }
    return {
      name: String(zone?.name || "").trim(),
      color: normalizeColor(zone?.color, index)
    };
  }

  function zoneList() {
    const zones = (state.data?.settings?.zones || []).map(normalizeZone).filter((zone) => zone.name);
    return zones.length ? zones : [{ name: "A区", color: defaultZoneColors[0] }];
  }

  function hallList() {
    const halls = (state.data?.settings?.halls || []).map((hall) => String(typeof hall === "string" ? hall : hall?.name || "").trim()).filter(Boolean);
    return halls.length ? halls : ["1号馆"];
  }

  function firstHallName() {
    return hallList()[0] || "1号馆";
  }

  function currentDrawPresetHall() {
    const halls = hallList();
    if (!halls.includes(state.drawPresetHall)) state.drawPresetHall = halls[0] || "";
    return state.drawPresetHall || firstHallName();
  }

  function discountRules() {
    return (state.data?.settings?.discountRules || []).filter((rule) => rule.reason && Number(rule.price || 0) > 0);
  }

  function selectedDiscountRule() {
    if (state.orderDraft.hasDiscount !== "yes") return null;
    return discountRules().find((rule) => String(rule.id) === String(state.orderDraft.discountRuleId)) || null;
  }

  function discountAmountForRule(subtotal, ruleId) {
    const rule = discountRules().find((item) => String(item.id) === String(ruleId));
    return rule ? Math.min(Number(subtotal || 0), Number(rule.price || 0)) : 0;
  }

  function discountAmountFor(subtotal) {
    const rule = selectedDiscountRule();
    return rule ? discountAmountForRule(subtotal, rule.id) : 0;
  }

  function boothSelectionAmount(booths, discountRuleId = null) {
    const subtotal = booths.reduce((sum, booth) => sum + Number(booth.price || 0), 0);
    const discountAmount = discountRuleId
      ? discountAmountForRule(subtotal, discountRuleId)
      : discountAmountFor(subtotal);
    const total = Math.max(0, subtotal - discountAmount);
    const deposit = Math.ceil(total * Number(state.data?.settings?.rules?.depositRate || 0));
    return { subtotal, discountAmount, total, deposit };
  }

  function boothSelectionAmountText(booths, discountRuleId = null) {
    const amount = boothSelectionAmount(booths, discountRuleId);
    const parts = [
      `已选 ${booths.length} 个展位`,
      `小计 ${money(amount.subtotal)}`
    ];
    if (amount.discountAmount > 0) parts.push(`优惠 ${money(amount.discountAmount)}`);
    parts.push(`订单金额 ${money(amount.total)}`);
    parts.push(`首款 ${money(amount.deposit)}`);
    return parts.join("；");
  }

  function countryRegions() {
    const regions = state.data?.settings?.countryRegions || [];
    return regions.length ? regions : [
      { code: "HK", name: "中国香港" },
      { code: "MO", name: "中国澳门" },
      { code: "TW", name: "中国台湾" },
      { code: "US", name: "美国" },
      { code: "JP", name: "日本" },
      { code: "SG", name: "新加坡" }
    ];
  }

  function provinceOptions(selected) {
    return Object.keys(mainlandCityMap).map((province) => `<option value="${h(province)}" ${selected === province ? "selected" : ""}>${h(province)}</option>`).join("");
  }

  function cityOptions(province, selected) {
    const cities = mainlandCityMap[province] || mainlandCityMap["广东省"];
    return cities.map((city) => `<option value="${h(city)}" ${selected === city ? "selected" : ""}>${h(city)}</option>`).join("");
  }

  function countryRegionOptions(selected) {
    return countryRegions().map((region) => `<option value="${h(region.name)}" ${selected === region.name ? "selected" : ""}>${h(region.name)}</option>`).join("");
  }

  function companyLocationText(company) {
    if (!company) return "";
    if (company.locationType === "overseas") return company.countryRegion || "境外";
    return [company.province, company.city].filter(Boolean).join(" ") || "境内";
  }

  function companyShortNameText(company) {
    return company?.shortName || "-";
  }

  function companyNameCell(company) {
    const id = Number(company?.id || 0);
    return `<button type="button" class="company-name-link" onclick="App.openCompanyDetail(${id})">${h(company?.name || "-")}</button>`;
  }

  function companyDetailModal() {
    if (!state.companyDetailId || !state.data) return "";
    const company = getCompany(state.companyDetailId);
    if (!company.id) return "";
    const lead = companyLead(company.id);
    const orders = companyOrders(company.id);
    return `
      <div class="modal-backdrop">
        <section class="modal large">
          <header class="modal-header">
            <h2>${h(company.name || "企业详情")}</h2>
            <button class="secondary" onclick="App.closeCompanyDetail()">关闭</button>
          </header>
          ${companyDetailSummary(company, lead, orders)}
          ${lead ? `<div class="detail-actions">${companyDetailActions(company, lead)}</div>` : ""}
          <div class="detail-section">
            <div class="section-title-row"><h2>客户资料</h2><span class="count-pill">${h(customerLeadTypeText(lead))}</span></div>
            ${companyInfoGrid(company, lead)}
          </div>
          <div class="detail-section">
            <div class="section-title-row"><h2>订单流程</h2><span class="count-pill">${orders.length} 个订单</span></div>
            ${orders.map((order) => companyOrderDetail(company, order)).join("") || `<div class="empty">暂无订单</div>`}
          </div>
          ${companyAttachmentSection(company, lead, orders)}
          ${companyProfileSection(orders)}
          ${companyAuditSection(company, lead, orders)}
        </section>
      </div>
    `;
  }

  function companyDetailActions(company, lead) {
    const order = activeOrderForCompany(company.id);
    const releaseAction = customerReleaseAction(lead);
    return `
      <div class="detail-action-title">客户操作</div>
      <div class="inline-actions">
        ${order ? `<span class="status reserved">已创建订单</span>` : `<button class="tiny" onclick="App.customerAttend(${company.id}, ${lead.id})">参展</button>`}
        ${companyEditToggle(company, lead)}
        ${releaseAction}
        ${leadUploadButtons(lead)}
      </div>
    `;
  }

  function companyLead(companyId) {
    return (state.data.customerLeads || []).find((item) => (
      Number(item.companyId) === Number(companyId)
      && String(item.eventId || state.data.settings.event.id) === String(state.data.settings.event.id)
    )) || null;
  }

  function companyOrders(companyId) {
    return (state.data.orders || [])
      .filter((order) => Number(order.companyId) === Number(companyId))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function companyOrderDetail(company, order) {
    const profile = state.data.profiles.find((item) => Number(item.orderId) === Number(order.id));
    const payments = (state.data.payments || []).filter((item) => Number(item.orderId) === Number(order.id));
    return `
      <div class="detail-order-card">
        <div class="detail-order-head">
          <div>
            <strong>${h(order.orderNo)}</strong>
            <div class="hint">${h(typeText(order.type))} · ${h(orderBoothNos(order) || order.title || "-")}</div>
          </div>
          <div>${orderStatusBadge(order)}</div>
        </div>
        ${orderTimelineHtml(order, companyLead(company.id), profile)}
        <div class="detail-order-meta">
          <span>订单金额：${money(order.totalAmount)}</span>
          <span>已收款：${money(order.paidApprovedAmount || 0)}</span>
          <span>业务员：${h(getUser(order.salespersonId).displayName || "-")}</span>
          <span>展务：${profileProgressText(profile)}</span>
          <span>水单：${h(payments.length ? payments.map((payment) => `${money(payment.amount)} ${statusText(payment.status)}`).join(" / ") : "暂无")}</span>
        </div>
        <div class="detail-actions">${orderActionButtons(order)}</div>
      </div>
    `;
  }

  function customerLeadTypeText(lead) {
    if (!lead) return "客户档案";
    const type = lead.customerType === "old" ? "老客户" : "新客户";
    const status = { protected: "保护中", public: "公海", converted: "已参展" }[lead.status] || "保护中";
    return `${type} · ${status}`;
  }

  function canAccessLeadOwner(lead) {
    if (!lead || !state.data?.me) return false;
    const role = state.data.me.role;
    if (isAdminLikeRole(role)) return true;
    if (role !== "sales") return false;
    if (Number(lead.ownerSalesId) === Number(state.data.me.id)) return true;
    if (customerTargetMode() !== "department") return false;
    const owner = getUser(lead.ownerSalesId);
    return Number(owner.departmentId || 0) && Number(owner.departmentId) === Number(state.data.me.departmentId || 0);
  }

  function canEditCompanyInfo(company, lead) {
    if (!company?.id || !lead) return false;
    if (lead.customerType !== "new" || lead.status !== "protected") return false;
    if (activeOrderForCompany(company.id)) return false;
    return canAccessLeadOwner(lead);
  }

  function companyEditToggle(company, lead) {
    if (!canEditCompanyInfo(company, lead)) return "";
    const editing = state.companyEditId === Number(company.id);
    return editing
      ? `<button class="tiny secondary" onclick="App.cancelCompanyEdit()">取消编辑</button>`
      : `<button class="tiny secondary" onclick="App.startCompanyEdit(${Number(company.id)})">编辑资料</button>`;
  }

  function companyEditForm(company) {
    const locationType = company.locationType === "overseas" ? "overseas" : "domestic";
    const province = company.province || Object.keys(mainlandCityMap)[0] || "";
    const city = company.city || (mainlandCityMap[province] || [])[0] || "";
    const identityReadonly = isAdminLikeRole(state.data.me.role) ? "" : "readonly";
    return `
      <div class="company-edit-form">
        <div class="grid two">
          <label>${requiredLabel("企业名称")}<input id="edit-company-name" value="${h(company.name || "")}" ${identityReadonly} required></label>
          <label>企业简称<input id="edit-company-short-name" value="${h(company.shortName || "")}" ${identityReadonly}></label>
          <label>联系人<input id="edit-company-contact" value="${h(company.contactName || "")}" placeholder="${company.contactMasked ? "联系方式已脱敏" : ""}"></label>
          <label>手机<input id="edit-company-phone" value="${h(company.phone || "")}" placeholder="${company.contactMasked ? "联系方式已脱敏" : ""}"></label>
          <label>邮箱<input id="edit-company-email" value="${h(company.email || "")}"></label>
          <label>税号<input id="edit-company-tax" value="${h(company.taxNo || "")}"></label>
          <label>企业所在地<select id="edit-company-location-type" onchange="App.refreshCompanyEditLocation()">
            <option value="domestic" ${locationType !== "overseas" ? "selected" : ""}>境内</option>
            <option value="overseas" ${locationType === "overseas" ? "selected" : ""}>境外</option>
          </select></label>
          <label data-edit-location="overseas" style="${locationType === "overseas" ? "" : "display:none"}">国家或地区<select id="edit-company-country-region">${countryRegionOptions(company.countryRegion || "中国香港")}</select></label>
          <label data-edit-location="domestic" style="${locationType === "overseas" ? "display:none" : ""}">省<select id="edit-company-province" onchange="App.refreshCompanyEditCities()">${provinceOptions(province)}</select></label>
          <label data-edit-location="domestic" style="${locationType === "overseas" ? "display:none" : ""}">市<select id="edit-company-city">${cityOptions(province, city)}</select></label>
          <label class="span-2">地址<input id="edit-company-address" value="${h(company.address || "")}"></label>
        </div>
        ${identityReadonly ? `<div class="hint">企业名称和企业简称仅管理员可修改。</div>` : ""}
        ${company.contactMasked ? `<div class="hint">联系人和手机号已按联系方式脱敏规则隐藏。</div>` : ""}
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.saveCompanyEdit(${Number(company.id)})">保存资料</button>
          <button class="secondary" onclick="App.cancelCompanyEdit()">取消</button>
        </div>
      </div>
    `;
  }

  function companyInfoGrid(company, lead) {
    if (state.companyEditId === Number(company.id)) return companyEditForm(company);
    const owner = getUser(company.ownerSalesId || lead?.ownerSalesId);
    return `
      <div class="detail-grid">
        ${company.contactMasked ? `<div class="span-2"><span>联系方式保护</span><strong>联系人和手机号已按脱敏规则隐藏</strong></div>` : ""}
        <div><span>企业简称</span><strong>${h(companyShortNameText(company))}</strong></div>
        <div><span>企业所在地</span><strong>${h(companyLocationText(company) || "-")}</strong></div>
        <div><span>联系人</span><strong>${h(company.contactName || "-")}</strong></div>
        <div><span>联系电话</span><strong>${h(company.phone || "-")}</strong></div>
        <div><span>邮箱</span><strong>${h(company.email || "-")}</strong></div>
        <div><span>保护业务员</span><strong>${h(owner.displayName || "-")}</strong></div>
        <div><span>所属部门</span><strong>${h(departmentName(owner.departmentId))}</strong></div>
        <div><span>保护到期</span><strong>${lead?.protectedUntil ? h(date(lead.protectedUntil)) : "-"}</strong></div>
        <div><span>地址</span><strong>${h(company.address || "-")}</strong></div>
        <div><span>税号</span><strong>${h(company.taxNo || "-")}</strong></div>
      </div>
    `;
  }

  function companyDetailSummary(company, lead, orders) {
    const activeOrder = activeOrderForCompany(company.id);
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const paidAmount = orders.reduce((sum, order) => sum + Number(order.paidApprovedAmount || 0), 0);
    const booths = orders.map(orderBoothNos).filter(Boolean).join(" / ") || "-";
    const completedProfiles = orders.filter((order) => profileComplete(state.data.profiles.find((item) => Number(item.orderId) === Number(order.id)))).length;
    const status = activeOrder ? statusText(activeOrder.status) : customerLeadTypeText(lead);
    return `
      <div class="customer-summary-grid">
        <div class="customer-summary-card"><span>客户状态</span><strong>${h(status)}</strong><small>${h(customerLeadTypeText(lead))}</small></div>
        <div class="customer-summary-card"><span>订单金额</span><strong>${money(totalAmount)}</strong><small>已收 ${money(paidAmount)}</small></div>
        <div class="customer-summary-card"><span>关联展位</span><strong>${h(booths)}</strong><small>${orders.length} 个订单</small></div>
        <div class="customer-summary-card"><span>企业展务</span><strong>${completedProfiles}/${orders.length || 0}</strong><small>已提交资料订单</small></div>
      </div>
    `;
  }

  function companyAttachmentSection(company, lead, orders) {
    const rows = [];
    if (lead) {
      const contractAttachment = leadLatestAttachment(lead, "contract");
      const voucherAttachment = leadLatestAttachment(lead, "voucher");
      rows.push({
        name: "客户合同",
        status: statusText(leadFileStatus(lead, "contract")),
        time: lead.contractReviewedAt || lead.updatedAt || lead.createdAt,
        preview: contractAttachment ? attachmentPreviewButton(contractAttachment.id, "预览合同") : "暂无附件"
      });
      rows.push({
        name: "客户水单",
        status: statusText(leadFileStatus(lead, "voucher")),
        time: lead.voucherReviewedAt || lead.updatedAt || lead.createdAt,
        preview: voucherAttachment ? attachmentPreviewButton(voucherAttachment.id, "预览水单") : "暂无附件"
      });
    }
    orders.forEach((order) => {
      (state.data.payments || [])
        .filter((payment) => Number(payment.orderId) === Number(order.id))
        .forEach((payment) => {
          rows.push({
            name: `订单水单 · ${order.orderNo}`,
            status: `${money(payment.amount)} ${statusText(payment.status)}`,
            time: payment.reviewedAt || payment.createdAt,
            preview: payment.voucherAttachmentId ? attachmentPreviewButton(payment.voucherAttachmentId, "预览水单") : "暂无附件"
          });
        });
    });
    if (!rows.length) return "";
    return `
      <div class="detail-section">
        <div class="section-title-row"><h2>附件与收款</h2><span class="count-pill">${rows.length} 条记录</span></div>
        <div class="detail-list">
          ${rows.map((row) => `
            <div class="detail-list-row">
              <div><strong>${h(row.name)}</strong><span>${h(row.status)} · ${h(date(row.time))}</span></div>
              <div>${row.preview}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function companyProfileSection(orders) {
    const profiles = orders.map((order) => ({
      order,
      profile: state.data.profiles.find((item) => Number(item.orderId) === Number(order.id))
    })).filter((item) => item.profile);
    if (!profiles.length) return "";
    return `
      <div class="detail-section">
        <div class="section-title-row"><h2>企业展务</h2><span class="count-pill">${profiles.length} 个后台</span></div>
        <div class="profile-mini-grid">
          ${profiles.map(({ order, profile }) => `
            <div class="profile-mini-card">
              <strong>${h(order.orderNo)}</strong>
              <span>会刊：${profile.catalog?.companyIntro || profile.catalog?.productIntro || Number(profile.catalog?.videoAttachmentId || 0) ? "已填写" : "未填写"}</span>
              <span>参展证：${(profile.badges || []).length} 人</span>
              <span>楣板：${h(profile.fascia?.requestedName || profile.fascia?.defaultName || "-")} · ${h(statusText(profile.fascia?.status || "default"))}</span>
              <span>展具增租：${(profile.rentals || []).length} 项</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function companyAuditSection(company, lead, orders) {
    const orderIds = new Set(orders.map((order) => Number(order.id)));
    const rows = approvalHistoryRows().filter((row) => {
      const target = String(row.target || "");
      if (target.includes(company.name || "")) return true;
      return orders.some((order) => target.includes(order.orderNo || ""));
    });
    (state.data.logs || []).forEach((log) => {
      const targetType = String(log.targetType || "");
      const targetId = Number(log.targetId || 0);
      const related = (targetType === "company" && targetId === Number(company.id))
        || (targetType === "customerLead" && lead && targetId === Number(lead.id))
        || (targetType === "order" && orderIds.has(targetId))
        || String(log.detail || "").includes(company.name || "");
      if (related) {
        rows.push({
          at: log.at,
          flow: log.action || "操作日志",
          target: company.name || "-",
          submitter: log.userName || "-",
          result: "log",
          reviewer: log.userName || "-",
          remark: log.detail || ""
        });
      }
    });
    const deduped = rows
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .filter((row, index, list) => index === list.findIndex((item) => `${item.at}-${item.flow}-${item.target}-${item.remark}` === `${row.at}-${row.flow}-${row.target}-${row.remark}`))
      .slice(0, 12);
    return `
      <div class="detail-section">
        <div class="section-title-row"><h2>审核与操作记录</h2><span class="count-pill">${deduped.length} 条</span></div>
        ${deduped.length ? `
          <div class="audit-mini-list">
            ${deduped.map((row) => `
              <div class="audit-mini-row">
                <div><strong>${h(row.flow)}</strong><span>${h(date(row.at))} · ${h(row.submitter || "-")}</span></div>
                <span class="status ${h(row.result)}">${h(row.result === "log" ? "记录" : statusText(row.result))}</span>
                <p>${h(row.remark || "-")}</p>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty">暂无审核或操作记录</div>`}
      </div>
    `;
  }

  function timelineStep(label, stateText, done, active = false) {
    return `
      <div class="timeline-step ${done ? "done" : ""} ${active ? "active" : ""}">
        <i></i>
        <strong>${h(label)}</strong>
        <span>${h(stateText || "-")}</span>
      </div>
    `;
  }

  function orderTimelineHtml(order, lead, profile) {
    const contractStatus = leadFileStatus(lead, "contract");
    const voucherStatus = leadFileStatus(lead, "voucher");
    const paymentPending = hasPendingOrderPayment(order);
    const paymentApproved = Number(order.paidApprovedAmount || 0) > 0;
    const contractRequired = salesFlowMode() === "contract_first";
    const profileReady = profileComplete(profile);
    const contractDone = !contractRequired || contractStatus === "approved";
    const voucherDone = voucherStatus === "approved" || paymentApproved;
    const soldDone = order.status === "sold";
    return `
      <div class="order-timeline">
        ${timelineStep("录入客户", getCompany(order.companyId).name || "已录入", true)}
        ${timelineStep("预留展位", order.reserveExpiresAt ? `预留到 ${date(order.reserveExpiresAt)}` : statusText(order.status), order.type !== "booth" || isActiveOrder(order))}
        ${timelineStep("合同", contractRequired ? statusText(contractStatus) : "可后补", contractDone, contractRequired && contractStatus === "pending")}
        ${timelineStep("水单", paymentPending ? "审核中" : statusText(voucherStatus), voucherDone, paymentPending || voucherStatus === "pending")}
        ${timelineStep("成交", soldDone ? "已成交" : "未成交", soldDone)}
        ${timelineStep("企业展务", profileReady ? "资料已提交" : "资料待补", profileReady)}
      </div>
    `;
  }

  function profileComplete(profile) {
    if (!profile) return false;
    const catalog = profile.catalog || {};
    return Boolean(catalog.companyIntro || catalog.productIntro || Number(catalog.videoAttachmentId || 0) || (catalog.productImageIds || []).length || (profile.badges || []).length || profile.fascia?.requestedName || (profile.rentals || []).length);
  }

  function profileProgressText(profile) {
    if (!profile) return "未生成";
    const items = [
      profile.catalog?.companyIntro || profile.catalog?.productIntro ? "会刊" : "",
      (profile.badges || []).length ? `证件${profile.badges.length}人` : "",
      profile.fascia?.status && profile.fascia.status !== "default" ? "楣板" : "",
      (profile.rentals || []).length ? `展具${profile.rentals.length}项` : ""
    ].filter(Boolean);
    return items.join(" / ") || "待提交";
  }

  function companyNameKey(value) {
    return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  }

  function comparableTextKey(value) {
    return companyNameKey(value).replace(/[\s\-_/\\.,，。·()（）【】\[\]]+/g, "");
  }

  function comparableCompanyKey(value) {
    return comparableTextKey(value).replace(/(有限责任公司|股份有限公司|集团有限公司|有限公司|集团|公司)$/g, "");
  }

  function comparablePhoneKey(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function comparableTaxKey(value) {
    return String(value || "").trim().replace(/[\s\-_/\\]+/g, "").toUpperCase();
  }

  function textLooksSimilar(input, candidate) {
    const a = comparableCompanyKey(input);
    const b = comparableCompanyKey(candidate);
    if (a.length < 2 || b.length < 2) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const minRun = Math.min(3, Math.max(2, Math.min(a.length, b.length)));
    for (let length = Math.min(a.length, b.length); length >= minRun; length -= 1) {
      for (let index = 0; index + length <= a.length; index += 1) {
        const part = a.slice(index, index + length);
        if (part && b.includes(part)) return true;
      }
    }
    return false;
  }

  function similarCompanyMatches(payload, excludeCompanyId = null) {
    const draft = {
      name: String(payload?.name || "").trim(),
      shortName: String(payload?.shortName || "").trim(),
      contactName: String(payload?.contactName || "").trim(),
      phone: String(payload?.phone || "").trim(),
      taxNo: String(payload?.taxNo || "").trim()
    };
    if (![draft.name, draft.shortName, draft.contactName, draft.phone, draft.taxNo].some(Boolean)) return [];
    return (state.data?.companies || [])
      .filter((company) => Number(company.id) !== Number(excludeCompanyId || 0))
      .map((company) => {
        const reasons = [];
        if (textLooksSimilar(draft.name, company.name)) reasons.push("企业名称相似");
        const draftShortName = comparableTextKey(draft.shortName);
        const companyShortName = comparableTextKey(company.shortName);
        if (draftShortName && companyShortName && (draftShortName === companyShortName || textLooksSimilar(draft.shortName, company.shortName))) reasons.push("简称相似");
        if (draft.contactName && comparableTextKey(draft.contactName) === comparableTextKey(company.contactName)) reasons.push("联系人相同");
        if (draft.phone && comparablePhoneKey(draft.phone) && comparablePhoneKey(draft.phone) === comparablePhoneKey(company.phone)) reasons.push("手机号相同");
        if (draft.taxNo && comparableTaxKey(draft.taxNo) && comparableTaxKey(draft.taxNo) === comparableTaxKey(company.taxNo)) reasons.push("税号相同");
        return { company, reasons };
      })
      .filter((item) => item.reasons.length)
      .sort((a, b) => b.reasons.length - a.reasons.length)
      .slice(0, 6);
  }

  function similarCompanyWarningHtml(payload, excludeCompanyId = null) {
    const matches = similarCompanyMatches(payload, excludeCompanyId);
    if (!matches.length) return "";
    return `
      <div class="similar-company-alert">
        <strong>发现相似企业</strong>
        <p>请确认是否为同一客户，避免重复录入或重复保护。</p>
        <div class="similar-company-list">
          ${matches.map(({ company, reasons }) => `
            <div class="similar-company-row">
              <button type="button" class="company-name-link" onclick="App.openCompanyDetail(${Number(company.id)})">${h(company.name || "-")}</button>
              <span>${h(companyShortNameText(company))} · ${h(company.contactName || "-")} · ${h(company.phone || "-")}</span>
              <div>${reasons.map((reason) => `<em>${h(reason)}</em>`).join("")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function eventNameById(eventId) {
    return (state.data?.settings?.events || []).find((event) => event.id === eventId)?.name || state.data?.settings?.event?.name || "";
  }

  function eventCategoryName(event) {
    return String(event?.category || "默认类别").trim() || "默认类别";
  }

  function eventCategoryById(eventId) {
    const event = (state.data?.settings?.events || []).find((item) => String(item.id) === String(eventId));
    return eventCategoryName(event || state.data?.settings?.event || {});
  }

  function eventCategoryList() {
    const categories = state.data?.settings?.eventCategories || (state.data?.settings?.events || []).map(eventCategoryName);
    const seen = new Set();
    return categories
      .map((item) => String(item || "").trim())
      .filter((item) => item && !seen.has(item) && seen.add(item))
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function eventCategoryOptions(selected) {
    const current = String(selected || "").trim();
    const categories = eventCategoryList();
    if (current && !categories.includes(current)) categories.push(current);
    return categories
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .map((category) => `<option value="${h(category)}" ${category === current ? "selected" : ""}>${h(category)}</option>`)
      .join("");
  }

  function eventOrderCount(eventId) {
    return (state.data?.orders || []).filter((order) => String(order.eventId) === String(eventId)).length;
  }

  function userOrderCount(userId) {
    const idValue = Number(userId);
    const user = (state.data?.users || []).find((item) => Number(item.id) === idValue);
    return (state.data?.orders || []).filter((order) => (
      Number(order.salespersonId) === idValue
      || Number(order.enterpriseUserId) === idValue
    )).length + (user?.orderId ? 1 : 0);
  }

  function settingsTab() {
    const tabs = ["workflow", "targets", "pricing", "venue", "workdays", "furniture"];
    return tabs.includes(state.settingsTab) ? state.settingsTab : "workflow";
  }

  function settingsTabClass(tab) {
    return settingsTab() === tab ? "" : "hidden";
  }

  function settingsTabNav() {
    const tabs = [
      ["workflow", "销售流程"],
      ["targets", "客户保护/任务"],
      ["pricing", "价格与优惠"],
      ["venue", "展馆展区"],
      ["workdays", "工作日同步"],
      ["furniture", "展具管理"]
    ];
    return `
      <section class="section compact-section">
        <div class="subnav">
          ${tabs.map(([key, label]) => `<button class="${settingsTab() === key ? "active" : ""}" onclick="App.setSettingsTab('${key}')">${h(label)}</button>`).join("")}
        </div>
      </section>
    `;
  }

  function zoneColor(zoneName) {
    const zones = zoneList();
    const found = zones.find((zone) => zone.name === zoneName);
    return found ? found.color : defaultZoneColors[0];
  }

  function firstZoneName() {
    return zoneList()[0]?.name || "A区";
  }

  function currentDrawPresetZone() {
    const zones = zoneList().map((zone) => zone.name);
    if (!zones.includes(state.drawPresetZone)) state.drawPresetZone = zones[0] || "";
    return state.drawPresetZone || firstZoneName();
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizedDrawBoothNoConfig() {
    const prefix = String(state.drawBoothNoPrefix || "").trim();
    const rawChars = Math.floor(Number(state.drawBoothNoChars || 0) || 4);
    const maxTotalChars = Math.max(prefix.length + 1, 12);
    let totalChars = Math.max(prefix.length + 1, rawChars);
    let startNo = Math.max(0, Number(state.drawBoothNoStart || 0) || 1);
    let correctedFromNumber = false;
    if (totalChars > maxTotalChars) {
      startNo = totalChars;
      totalChars = Math.max(prefix.length + String(startNo).length, prefix.length + 1, 4);
      correctedFromNumber = true;
    }
    totalChars = Math.min(totalChars, maxTotalChars);
    const numericWidth = Math.max(1, totalChars - prefix.length);
    return { prefix, totalChars, numericWidth, startNo, correctedFromNumber };
  }

  function nextBoothNo() {
    const { prefix, numericWidth, startNo } = normalizedDrawBoothNoConfig();
    const step = state.drawBoothNoSkipEnabled === "yes" ? Math.max(1, Number(state.drawBoothNoStep || 0) || 1) : 1;
    const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
    const formatNo = (number) => `${prefix}${String(number).padStart(numericWidth, "0")}`;
    const existingNos = new Set((state.data?.booths || []).map((booth) => String(booth.boothNo || "").trim()));
    if (state.drawBoothNoResetActive) {
      let candidate = startNo;
      for (let index = 0; index < 10000; index += 1) {
        const boothNo = formatNo(candidate);
        if (!existingNos.has(boothNo)) return boothNo;
        candidate += step;
      }
      return formatNo(candidate);
    }
    const numbers = (state.data?.booths || [])
      .map((booth) => String(booth.boothNo || "").trim())
      .map((value) => value.match(pattern))
      .filter(Boolean)
      .map((match) => Number(match[1]))
      .filter((number) => Number.isFinite(number));
    const next = numbers.length ? Math.max(startNo - step, ...numbers) + step : startNo;
    return formatNo(next);
  }

  function findBoothByNo(value) {
    const keyword = String(value || "").trim().toLowerCase();
    if (!keyword) return null;
    return state.data.booths.find((booth) => String(booth.boothNo).trim().toLowerCase() === keyword) || null;
  }

  function boothNoValidationError(value, currentBoothId = null) {
    const boothNo = String(value || "").trim();
    if (!boothNo) return "展位号不能为空";
    if (/\s/.test(String(value || ""))) return "展位号不能包含空格";
    const duplicate = (state.data?.booths || []).find((booth) => (
      Number(booth.id) !== Number(currentBoothId)
      && String(booth.boothNo || "").trim().toLowerCase() === boothNo.toLowerCase()
    ));
    return duplicate ? `展位号 ${boothNo} 已存在，不能重复` : "";
  }

  function scrollModalMapToBooth(mapId, booth) {
    const mapBox = byId(mapId);
    if (!mapBox || !booth) return;
    const zoom = effectiveMapZoom();
    const centerX = (Number(booth.x || 0) + Number(booth.width || 0) / 2) * zoom;
    const centerY = (Number(booth.y || 0) + Number(booth.height || 0) / 2) * zoom;
    mapBox.scrollTo({
      left: Math.max(0, centerX - mapBox.clientWidth / 2),
      top: Math.max(0, centerY - mapBox.clientHeight / 2),
      behavior: "smooth"
    });
  }

  function captureMapScroll(mapId = "admin-map-frame") {
    const box = byId(mapId);
    if (!box) return null;
    const zoom = effectiveMapZoom();
    return {
      mapId,
      left: box.scrollLeft,
      top: box.scrollTop,
      centerX: (box.scrollLeft + box.clientWidth / 2) / zoom,
      centerY: (box.scrollTop + box.clientHeight / 2) / zoom
    };
  }

  function captureMapScrolls() {
    return ["admin-map-frame", "sales-map-frame", "booth-picker-map", "change-booth-map"]
      .map((mapId) => captureMapScroll(mapId))
      .filter(Boolean);
  }

  function restoreMapScroll(snapshot) {
    if (!snapshot) return;
    const snapshots = Array.isArray(snapshot) ? snapshot : [snapshot];
    setTimeout(() => {
      applyFitMapZoom();
      snapshots.forEach((item) => {
        const box = byId(item.mapId);
        if (!box) return;
        const zoom = effectiveMapZoom();
        const left = Number.isFinite(item.centerX) ? item.centerX * zoom - box.clientWidth / 2 : item.left;
        const top = Number.isFinite(item.centerY) ? item.centerY * zoom - box.clientHeight / 2 : item.top;
        box.scrollLeft = Math.max(0, Math.min(left, box.scrollWidth - box.clientWidth));
        box.scrollTop = Math.max(0, Math.min(top, box.scrollHeight - box.clientHeight));
      });
      updateDrawPresetPosition();
    }, 0);
  }

  async function api(path, options = {}) {
    const headers = options.headers || {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      let message = response.statusText;
      if (contentType.includes("application/json")) {
        const body = await response.json();
        message = body.error || message;
      }
      throw new Error(cleanErrorMessage(message, response.status));
    }
    if (contentType.includes("application/json")) return response.json();
    return response;
  }

  function looksMojibake(value) {
    return /[�]|[璇鏃浼瀹鎵鍙鍚绋閮灞闄妯鍥鐢璐鍒姘椤缂绾]/.test(String(value || ""));
  }

  function cleanErrorMessage(message, status = 0) {
    const text = String(message || "").trim();
    if (!looksMojibake(text)) return text;
    if (status === 400) return "请求参数不正确，请检查后重试";
    if (status === 401) return "登录信息不正确，请重新登录";
    if (status === 403) return "无权操作";
    if (status === 404) return "数据不存在";
    if (status === 409) return "当前操作无法完成，请检查数据状态";
    if (status >= 500) return "服务器错误，请稍后重试";
    return "操作失败，请检查后重试";
  }

  async function refresh() {
    state.data = await api("/api/bootstrap");
    state.data.activityAreas = Array.isArray(state.data.activityAreas) ? state.data.activityAreas : [];
  }

  async function loadLoginEvents() {
    try {
      const result = await api("/api/public/events");
      state.loginEvents = result.events || [];
      state.loginCategories = result.categories || [...new Set(state.loginEvents.map(eventCategoryName))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    } catch (_) {
      state.loginEvents = [];
      state.loginCategories = [];
    }
  }

  async function run(action, success, options = {}) {
    state.error = "";
    state.message = "";
    try {
      const result = await action();
      if (options.refresh !== false) await refresh();
      if (typeof options.apply === "function") options.apply(result);
      state.message = success || "操作成功";
      render();
      return result;
    } catch (error) {
      state.error = error.message || "操作失败";
      state.error = cleanErrorMessage(state.error || "操作失败");
      render();
      return null;
    }
  }

  function flashHtml() {
    return `${state.error ? `<div class="error">${h(state.error)}</div>` : ""}${state.message ? `<div class="success-message">${h(state.message)}</div>` : ""}`;
  }

  function menu() {
    const role = state.data.me.role;
    if (role === "enterprise") {
      return [
        ["enterprise", "企业后台"]
      ];
    }
    const common = [
      ["dashboard", "数据看板"],
      {
        key: "customer-data",
        label: "客户数据",
        children: [
          ["old-customers", "老客户列表"],
          ["new-customers", "新客户列表"],
          ["customer-pool", "客户公海"],
          ["exhibitor-list", "参展企业列表"]
        ]
      },
      {
        key: "event-related",
        label: "展会相关",
        children: [
          ["exports", "导出汇总"]
        ]
      },
      ["sales-map", "销售展位图"],
      ["exhibitor", "企业展务"]
    ];
    common.push(["accounts", "账号管理"]);
    if (isAdminLikeRole(role)) {
      const eventChildren = [
        ["event-info", "展会信息"],
        ...(isSuperAdminRole(role) ? [["events-list", "展会列表"]] : []),
        ["settings", "销售规则管理"],
        ["exports", "导出汇总"]
      ];
      const adminMenu = [
        ["dashboard", "数据看板"],
        {
          key: "customer-data",
          label: "客户数据",
          children: [
            ["old-customers", "老客户列表"],
            ["new-customers", "新客户列表"],
            ["customer-pool", "客户公海"],
            ["exhibitor-list", "参展企业列表"],
            ["data-warehouse", "数据总仓"]
          ]
        },
        {
          key: "event-related",
          label: "展会相关",
          children: eventChildren
        },
        ["map", "展位图管理"],
        ["sales-map", "销售展位图"],
        ["approvals", "审核"],
        ["exhibitor", "企业展务模块"]
      ];
      adminMenu.push(["accounts", "账号管理"]);
      return adminMenu;
    }
    return common;
  }

  function flatMenuItems(items = menu()) {
    return items.flatMap((item) => Array.isArray(item) ? [item] : item.children || []);
  }

  function normalizeView(view) {
    if (view === "order-entry") return "new-customers";
    if (view === "orders") return "exhibitor-list";
    if (view === "events-list" && !isSuperAdminRole(state.data?.me?.role)) return "dashboard";
    if (view === "data-warehouse" && !isAdminLikeRole(state.data?.me?.role)) return "dashboard";
    return view;
  }

  function menuGroupForView(view) {
    const normalized = normalizeView(view);
    return menu().find((item) => !Array.isArray(item) && (item.children || []).some(([key]) => key === normalized));
  }

  function title() {
    state.view = normalizeView(state.view);
    const item = flatMenuItems().find(([key]) => key === state.view);
    return item ? item[1] : "展位销售管理系统";
  }

  function renderNavItem(item) {
    if (Array.isArray(item)) {
      const [key, label] = item;
      return `<button class="${state.view === key ? "active" : ""}" onclick="App.setView('${key}')">${h(label)}</button>`;
    }
    const active = (item.children || []).some(([key]) => key === state.view);
    const open = state.openMenuGroups.has(item.key) || active;
    return `
      <div class="nav-group ${active ? "active" : ""}">
        <button class="nav-parent ${open ? "open" : ""}" onclick="App.toggleMenuGroup('${item.key}')">
          <span>${h(item.label)}</span>
          <span class="nav-arrow">${open ? "v" : ">"}</span>
        </button>
        ${open ? `<div class="nav-children">
          ${(item.children || []).map(([key, label]) => `
            <button class="${state.view === key ? "active" : ""}" onclick="App.setView('${key}')">${h(label)}</button>
          `).join("")}
        </div>` : ""}
      </div>
    `;
  }

  function renderLogin() {
    const events = state.loginEvents.length ? state.loginEvents : [{ id: "", name: "默认展会" }];
    const categories = state.loginCategories.length ? state.loginCategories : [...new Set(events.map(eventCategoryName))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    if (state.loginEventCategory && !categories.includes(state.loginEventCategory)) state.loginEventCategory = "";
    const categoryOptions = [`<option value="">请选择展会类别</option>`]
      .concat(categories.map((category) => `<option value="${h(category)}" ${state.loginEventCategory === category ? "selected" : ""}>${h(category)}</option>`))
      .join("");
    const filteredEvents = state.loginEventCategory
      ? events.filter((event) => eventCategoryName(event) === state.loginEventCategory)
      : [];
    const eventOptions = state.loginEventCategory
      ? (filteredEvents.map((event) => `<option value="${h(event.id)}">${h(event.name || event.id)}</option>`).join("") || `<option value="">该类别暂无展会</option>`)
      : `<option value="">请选择展会类别</option>`;
    root().innerHTML = `
      <div class="login-page">
        <section class="login-hero">
          <h1>展位销售管理系统 MVP</h1>
          <p>覆盖展位图绘制、业务员预留、收款水单审核、成交判定、企业展务填报、会刊/证件/楣板/展具汇总和经营看板。当前版本使用本地数据文件和本地附件目录，方便先跑通业务闭环。</p>
        </section>
        <section class="login-panel">
          <form class="login-card" autocomplete="off" onsubmit="App.login(event)">
            <h2>登录系统</h2>
            ${state.error ? `<div class="error">${h(state.error)}</div>` : ""}
            <div class="grid">
              <label>展会类别<select id="login-event-category" onchange="App.setLoginEventCategory(this.value)">${categoryOptions}</select></label>
              <label>登录展会<select id="login-event" ${state.loginEventCategory ? "" : "disabled"}>${eventOptions}</select></label>
              <label>账号<input id="login-username" autocomplete="off"></label>
              <label>密码<input id="login-password" type="password" autocomplete="new-password"></label>
              <button type="submit">登录</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function renderShell() {
    const me = state.data.me;
    state.view = normalizeView(state.view);
    const nav = menu().map(renderNavItem).join("");
    root().innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <strong>展位销售 MVP</strong>
            <span>${h(state.data.settings.event.name)} · ${h(roleText(me.role))}</span>
          </div>
          <nav class="nav">${nav}</nav>
          <div class="sidebar-footer">
            <div>${h(me.displayName)}</div>
            <div>${h(me.username)}</div>
          </div>
        </aside>
        <main class="main">
          <header class="topbar">
            <h1>${h(title())}</h1>
            ${globalSearchBox()}
            <div class="topbar-actions">
              <span>${unreadNoticeText()}</span>
              <button class="secondary" onclick="App.logout()">退出</button>
            </div>
          </header>
          <div class="content">
            ${flashHtml()}
            ${viewHtml()}
            ${companyDetailModal()}
            ${attachmentPreviewModal()}
            ${state.paymentModalOrderId ? paymentModal() : ""}
            ${state.changePickerOpen ? changeBoothModal() : ""}
            ${eventRoleModal()}
            ${eventCreateModal()}
          </div>
        </main>
      </div>
    `;
  }

  function unreadNoticeText() {
    const count = (state.data.notifications || []).filter((item) => !item.read).length;
    return count ? `${count} 条站内提醒` : "无未读提醒";
  }

  function globalSearchBox() {
    if (!state.data || state.data.me.role === "enterprise") return "";
    const query = state.globalSearchQuery || "";
    const results = globalSearchResults(query);
    const isOpen = state.globalSearchOpen && query.trim();
    return `
      <div class="global-search">
        <input
          id="global-search-input"
          value="${h(query)}"
          placeholder="搜索企业 / 订单 / 展位"
          onfocus="App.openGlobalSearch()"
          oninput="App.setGlobalSearch(this.value)"
        >
        ${query ? `<button type="button" class="global-search-clear" onclick="App.clearGlobalSearch()">×</button>` : ""}
        ${isOpen ? `
          <div class="global-search-panel">
            ${results.length ? results.map(globalSearchResultRow).join("") : `<div class="global-search-empty">没有匹配结果</div>`}
          </div>
        ` : ""}
      </div>
    `;
  }

  function globalSearchResultRow(result) {
    return `
      <button type="button" class="global-search-result" onmousedown="App.openGlobalSearchResult('${result.type}', ${Number(result.id)}); return false;">
        <span class="global-search-type">${h(result.typeLabel)}</span>
        <span class="global-search-main">${h(result.title)}</span>
        <span class="global-search-sub">${h(result.subtitle)}</span>
      </button>
    `;
  }

  function globalSearchResults(query) {
    const keyword = companyNameKey(query);
    if (!keyword) return [];
    const results = [];
    const match = (...values) => values.some((value) => companyNameKey(value).includes(keyword));
    const push = (item) => {
      if (results.length < 12) results.push(item);
    };

    (state.data.companies || []).forEach((company) => {
      if (!match(company.name, company.shortName, company.contactName, company.phone, company.taxNo)) return;
      const lead = companyLead(company.id);
      const orders = companyOrders(company.id);
      push({
        type: "company",
        typeLabel: "企业",
        id: company.id,
        title: company.name || "-",
        subtitle: `${companyShortNameText(company)} · ${customerLeadTypeText(lead)} · ${orders.length} 个订单`
      });
    });

    (state.data.orders || []).forEach((order) => {
      const company = getCompany(order.companyId);
      const boothNos = orderBoothNos(order);
      if (!match(order.orderNo, order.title, company.name, company.shortName, boothNos)) return;
      push({
        type: "order",
        typeLabel: "订单",
        id: order.id,
        title: order.orderNo || "-",
        subtitle: `${company.name || "-"} · ${typeText(order.type)} · ${boothNos || order.title || "-"} · ${orderDisplayStatusText(order)}`
      });
    });

    (state.data.booths || []).forEach((booth) => {
      if (!match(booth.boothNo, booth.hall, booth.zone, attrText(booth.attr), statusText(booth.status))) return;
      push({
        type: "booth",
        typeLabel: "展位",
        id: booth.id,
        title: booth.boothNo || "-",
        subtitle: `${booth.hall || "-"} · ${booth.zone || "-"} · ${attrText(booth.attr)} · ${statusText(booth.status)}`
      });
    });

    return results;
  }

  function viewHtml() {
    if (state.data.me.role === "enterprise") return viewEnterprise();
    return {
      dashboard: viewDashboard,
      "event-info": viewEventInfo,
      "events-list": viewEventsList,
      "new-customers": viewNewCustomers,
      "customer-pool": viewCustomerPool,
      "old-customers": viewOldCustomers,
      "data-warehouse": viewDataWarehouse,
      map: viewMap,
      "sales-map": viewSalesBoothMap,
      settings: viewSettings,
      approvals: viewApprovals,
      "exhibitor-list": viewExhibitorList,
      exhibitor: viewExhibitorOps,
      accounts: viewAccounts,
      exports: viewExports
    }[state.view]?.() || viewDashboard();
  }

  function getCompany(id) {
    return state.data.companies.find((item) => item.id === id) || {};
  }

  function getUser(id) {
    return state.data.users.find((item) => item.id === id) || {};
  }

  function departmentList() {
    return state.data?.settings?.departments || [];
  }

  function departmentName(id) {
    return departmentList().find((item) => Number(item.id) === Number(id))?.name || "未分配";
  }

  function departmentOptions(selectedId = "") {
    const selected = Number(selectedId || 0);
    return `<option value="">未分配</option>${departmentList().map((department) => (
      `<option value="${department.id}" ${Number(department.id) === selected ? "selected" : ""}>${h(department.name)}</option>`
    )).join("")}`;
  }

  function customerTargetMode() {
    return state.data?.settings?.rules?.customerTargetMode === "department" ? "department" : "sales";
  }

  function enterpriseLinkDaysValue(rules = state.data?.settings?.rules || {}) {
    const maxDays = eventCountdownDaysValue(state.data?.settings?.event);
    if (!rules.enterpriseLinkDaysCustomized) return maxDays;
    return clampEnterpriseLinkDaysValue(rules.enterpriseLinkDays, maxDays);
  }

  function clampEnterpriseLinkDaysValue(value, maxDays = eventCountdownDaysValue(state.data?.settings?.event)) {
    const rawDays = Number(value || maxDays);
    return Math.min(maxDays, Math.max(1, Number.isFinite(rawDays) ? rawDays : maxDays));
  }

  function salesTargetForUser(userId) {
    return (state.data?.settings?.salesTargets || []).find((item) => Number(item.userId) === Number(userId)) || {};
  }

  function departmentTargetFor(departmentId) {
    return (state.data?.settings?.departmentTargets || []).find((item) => Number(item.departmentId) === Number(departmentId)) || {};
  }

  function requiredLabel(text) {
    return `<span class="required-label">${h(text)}</span>`;
  }

  function orderBoothNos(order) {
    return (order.boothSnapshot || []).map((item) => item.boothNo).join(" / ");
  }

  function metrics() {
    const role = state.data.me.role;
    const orders = isAdminLikeRole(role) ? state.data.orders : state.data.orders.filter((order) => order.salespersonId === state.data.me.id);
    const booths = role === "enterprise"
      ? state.data.booths.filter((booth) => orders.some((order) => (order.boothIds || []).includes(booth.id)))
      : state.data.booths;
    const boothOrders = activeBoothOrders(orders);
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const paidAmount = orders.reduce((sum, order) => sum + Number(order.paidApprovedAmount || 0), 0);
    const reservedBooths = boothCountFromOrders(unpaidBoothOrders(boothOrders));
    const paidBooths = boothCountFromOrders(boothOrders.filter((order) => Number(order.paidApprovedAmount || 0) > 0));
    const bookedBooths = Number((reservedBooths + paidBooths).toFixed(2));
    const soldBooths = boothCountFromOrders(boothOrders.filter((order) => order.status === "sold"));
    return {
      totalBooths: boothEquivalentCount(booths),
      totalArea: booths.reduce((sum, booth) => sum + Number(booth.area || 0), 0),
      standardCount: boothEquivalentCount(booths.filter((booth) => booth.attr === "standard")),
      rawArea: booths.filter((booth) => booth.attr === "raw").reduce((sum, booth) => sum + Number(booth.area || 0), 0),
      availableCount: boothEquivalentCount(booths.filter((booth) => booth.status === "available")),
      reservedCount: reservedBooths,
      soldCount: boothEquivalentCount(booths.filter((booth) => booth.status === "sold")),
      disabledCount: boothEquivalentCount(booths.filter((booth) => booth.status === "disabled")),
      bookedBooths,
      reservedBooths,
      paidBooths,
      unpaidBookedBooths: reservedBooths,
      soldBooths,
      totalAmount,
      paidAmount,
      unpaidAmount: Math.max(0, totalAmount - paidAmount),
      orderCount: orders.length,
      soldOrderCount: orders.filter((order) => order.status === "sold").length
    };
  }

  function boothEquivalentCount(booths) {
    return Number(booths.reduce((sum, booth) => {
      return sum + Number(booth.area || 0) / 9;
    }, 0).toFixed(2));
  }

  function activeBoothOrders(orders) {
    return orders.filter((order) => order.type === "booth" && isActiveOrder(order));
  }

  function unpaidBoothOrders(orders) {
    return orders.filter((order) => order.status !== "sold" && Number(order.paidApprovedAmount || 0) <= 0);
  }

  function boothCountFromOrders(orders) {
    return Number(orders.reduce((sum, order) => sum + orderBoothEquivalentCount(order), 0).toFixed(2));
  }

  function orderBoothEquivalentCount(order) {
    const booths = (order.boothSnapshot || []).map((snapshot) => {
      const live = state.data.booths.find((booth) => booth.id === snapshot.id);
      return live || snapshot;
    });
    return boothEquivalentCount(booths);
  }

  function hoursUntil(value) {
    const due = new Date(value || 0).getTime();
    if (!Number.isFinite(due)) return Infinity;
    return (due - Date.now()) / 3600000;
  }

  function isDueSoon(value, hours = 48) {
    const left = hoursUntil(value);
    return Number.isFinite(left) && left > 0 && left <= hours;
  }

  function orderWorkflowKind(order) {
    const lead = orderLead(order);
    const contractStatus = leadFileStatus(lead, "contract");
    const voucherStatus = leadFileStatus(lead, "voucher");
    if (!isActiveOrder(order)) return "closed";
    if (order.status === "sold") return "sold";
    if (salesFlowMode() === "contract_first") {
      if (contractStatus === "pending") return "contract-pending";
      if (contractStatus !== "approved") return "contract-missing";
      if (voucherStatus === "pending" || hasPendingOrderPayment(order)) return "voucher-pending";
      if (voucherStatus !== "approved" && !hasActiveOrderPayment(order)) return "voucher-missing";
    } else {
      if (voucherStatus === "pending" || hasPendingOrderPayment(order)) return "voucher-pending";
      if (voucherStatus !== "approved" && !hasActiveOrderPayment(order)) return "voucher-missing";
    }
    if (Number(order.paidApprovedAmount || 0) > 0) return "paid";
    return "reserved";
  }

  function exhibitorFilterLabel(filter) {
    return {
      "my": "我的客户",
      "pending-contract": "未上传合同",
      "contract-pending": "合同审核中",
      "pending-voucher": "未上传水单",
      "payment-review": "水单审核中",
      "sold": "已成交",
      "paid": "到款展位",
      "unpaid": "未收款",
      "soon-release": "即将释放",
      "profile-missing": "企业资料未交",
      "fascia-review": "楣板待审",
      "rental-review": "展具待审"
    }[filter] || "";
  }

  function filterOrdersByDrill(rows, filter) {
    if (!filter) return rows;
    return rows.filter((order) => {
      const profile = state.data.profiles.find((item) => Number(item.orderId) === Number(order.id));
      const kind = orderWorkflowKind(order);
      if (filter === "my") return Number(order.salespersonId) === Number(state.data.me.id);
      if (filter === "pending-contract") return kind === "contract-missing";
      if (filter === "contract-pending") return kind === "contract-pending";
      if (filter === "pending-voucher") return kind === "voucher-missing";
      if (filter === "payment-review") return kind === "voucher-pending" || hasPendingOrderPayment(order);
      if (filter === "sold") return order.status === "sold";
      if (filter === "paid") return Number(order.paidApprovedAmount || 0) > 0;
      if (filter === "unpaid") return Number(order.paidApprovedAmount || 0) <= 0;
      if (filter === "soon-release") return isDueSoon(order.reserveExpiresAt, 48) && order.status !== "sold";
      if (filter === "profile-missing") return order.status === "sold" && !profileComplete(profile);
      if (filter === "fascia-review") return profile?.fascia?.status === "pending";
      if (filter === "rental-review") return (profile?.rentals || []).some((rental) => rental.status === "pending");
      return true;
    });
  }

  function exhibitorAdvancedFilterBar(value, count) {
    const options = [
      ["", "全部参展企业"],
      ["my", "我的客户"],
      ["soon-release", "即将释放"],
      ["pending-contract", "未传合同"],
      ["contract-pending", "合同审核中"],
      ["pending-voucher", "未传水单"],
      ["payment-review", "水单审核中"],
      ["sold", "已成交"],
      ["profile-missing", "资料未提交"]
    ];
    return `
      <div class="advanced-filter-bar">
        <label>高级筛选
          <select onchange="App.setExhibitorFilter(this.value)">
            ${options.map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${value ? `<button class="secondary" onclick="App.clearExhibitorFilter()">清除筛选</button>` : ""}
        <span class="count-pill">${count} 条结果</span>
      </div>
    `;
  }

  function todoItems() {
    const role = state.data.me.role;
    const orders = state.data.orders || [];
    const boothOrders = orders.filter((order) => order.type === "booth" && isActiveOrder(order));
    const ownBoothOrders = isAdminLikeRole(role) ? boothOrders : boothOrders.filter((order) => Number(order.salespersonId) === Number(state.data.me.id));
    const pendingContract = ownBoothOrders.filter((order) => orderWorkflowKind(order) === "contract-missing");
    const pendingVoucher = ownBoothOrders.filter((order) => orderWorkflowKind(order) === "voucher-missing");
    const soonRelease = ownBoothOrders.filter((order) => order.status !== "sold" && isDueSoon(order.reserveExpiresAt, 48));
    const profileMissing = orders.filter((order) => order.type === "booth" && order.status === "sold" && !profileComplete(state.data.profiles.find((profile) => Number(profile.orderId) === Number(order.id))));
    const pendingReviewCount = (state.data.customerLeads || []).filter((lead) => lead.contractReviewStatus === "pending" || lead.voucherReviewStatus === "pending").length
      + (state.data.payments || []).filter((payment) => payment.status === "pending").length
      + (state.data.changeRequests || []).filter((request) => request.status === "pending").length;
    const fasciaPending = (state.data.profiles || []).filter((profile) => profile.fascia?.status === "pending").length;
    const rentalPending = (state.data.profiles || []).reduce((sum, profile) => sum + (profile.rentals || []).filter((rental) => rental.status === "pending").length, 0);
    const items = [];
    if (role === "sales") {
      items.push({ key: "pending-contract", title: "待上传合同", count: pendingContract.length, tone: "warning" });
      items.push({ key: "pending-voucher", title: "待上传水单", count: pendingVoucher.length, tone: "warning" });
      items.push({ key: "soon-release", title: "即将释放", count: soonRelease.length, tone: "danger" });
    }
    if (isAdminLikeRole(role)) {
      items.push({ key: "approval", title: "待审核", count: pendingReviewCount, tone: "warning" });
      items.push({ key: "fascia-review", title: "楣板待审", count: fasciaPending, tone: "warning" });
      items.push({ key: "rental-review", title: "展具待审", count: rentalPending, tone: "warning" });
    }
    if (role !== "enterprise") {
      items.push({ key: "profile-missing", title: "企业资料未交", count: profileMissing.length, tone: "normal" });
    }
    if (role === "enterprise") {
      const profile = state.data.profiles.find((item) => Number(item.orderId) === Number(state.data.me.orderId));
      items.push({ key: "enterprise-profile", title: "会刊/证件待补", count: profileComplete(profile) ? 0 : 1, tone: "warning" });
    }
    return items;
  }

  function todoWorkbenchHtml() {
    const items = todoItems();
    return `
      <section class="section todo-workbench">
        <div class="section-title-row">
          <h2>待办工作台</h2>
          <span class="count-pill">${items.reduce((sum, item) => sum + Number(item.count || 0), 0)} 项待办</span>
        </div>
        <div class="todo-grid">
          ${items.map((item) => `
            <button type="button" class="todo-card ${h(item.tone)}" onclick="App.openTodoTarget('${h(item.key)}')">
              <span>${h(item.title)}</span>
              <strong>${formatCount(item.count)}</strong>
              <small>${Number(item.count || 0) ? "点击处理" : "暂无待办"}</small>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function formatCount(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, "");
  }

  function percentValue(value, total) {
    const ratio = Number(total || 0) > 0 ? Number(value || 0) / Number(total || 0) : 0;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  function percentText(value, total) {
    return `${percentValue(value, total)}%`;
  }

  function localDate(value, endOfDay = false) {
    if (!value) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  }

  function eventDateText(value) {
    const parsed = localDate(value);
    return parsed ? parsed.toLocaleDateString("zh-CN") : "";
  }

  function eventDateRangeText(event) {
    const start = eventDateText(event?.startDate);
    const end = eventDateText(event?.endDate);
    if (start && end) return `${start} 至 ${end}`;
    return start || end || "未设置展会时间";
  }

  function eventCountdownText(event) {
    const start = localDate(event?.startDate);
    if (!start) return "未设置";
    const now = new Date();
    const diff = start.getTime() - now.getTime();
    if (diff > 0) return `${Math.ceil(diff / 86400000)}天`;
    const end = localDate(event?.endDate, true);
    if (end && now.getTime() <= end.getTime()) return "展会进行中";
    return "已结束";
  }

  function eventCountdownDaysValue(event = state.data?.settings?.event) {
    const start = localDate(event?.startDate);
    if (!start) return Math.max(1, Number(state.data?.settings?.rules?.reserveWorkdays || 7));
    const diff = start.getTime() - Date.now();
    return diff > 0 ? Math.max(1, Math.ceil(diff / 86400000)) : 1;
  }

  function boothStatsFor(booths) {
    const standard = booths.filter((booth) => booth.attr === "standard");
    const raw = booths.filter((booth) => booth.attr === "raw");
    const sold = booths.filter((booth) => booth.status === "sold");
    const standardSold = standard.filter((booth) => booth.status === "sold");
    const rawSold = raw.filter((booth) => booth.status === "sold");
    const planned = boothEquivalentCount(booths);
    const soldCount = boothEquivalentCount(sold);
    return {
      planned,
      standardPlanned: boothEquivalentCount(standard),
      standardSold: boothEquivalentCount(standardSold),
      rawPlanned: boothEquivalentCount(raw),
      rawSold: boothEquivalentCount(rawSold),
      soldCount,
      completion: percentValue(soldCount, planned)
    };
  }

  function boothGroupStats(field, emptyLabel, configuredNames = []) {
    const configured = configuredNames.map((name) => String(name || "").trim()).filter(Boolean);
    const configuredSet = new Set(configured);
    const groups = new Map(configured.map((name) => [name, []]));
    (state.data.booths || []).forEach((booth) => {
      const rawName = String(booth[field] || "").trim();
      const name = rawName && (!configuredSet.size || configuredSet.has(rawName)) ? rawName : emptyLabel;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(booth);
    });
    return [...groups.entries()]
      .map(([name, booths]) => ({ name, ...boothStatsFor(booths) }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
  }

  function dashboardStatsTable(title, nameLabel, rows) {
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>${h(title)}</h2>
          <span class="count-pill">${rows.length} 项</span>
        </div>
        <div class="table-wrap">
          <table class="dashboard-stat-table">
            <thead><tr><th>${h(nameLabel)}</th><th>规划展位</th><th>标摊规划</th><th>标摊已售</th><th>特装/光地规划</th><th>特装/光地已售</th><th>完成比</th></tr></thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td><strong>${h(row.name)}</strong></td>
                  <td>${formatCount(row.planned)}个</td>
                  <td>${formatCount(row.standardPlanned)}个</td>
                  <td>${formatCount(row.standardSold)}个</td>
                  <td>${formatCount(row.rawPlanned)}个</td>
                  <td>${formatCount(row.rawSold)}个</td>
                  <td>
                    <div class="completion-cell">
                      <strong>${row.completion}%</strong>
                      <div class="mini-progress"><i style="width:${row.completion}%"></i></div>
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="7" class="empty">暂无展位数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function viewDashboard() {
    const m = metrics();
    const event = state.data.settings.event || {};
    const hallStats = boothGroupStats("hall", "未设置展馆", hallList());
    const zoneStats = boothGroupStats("zone", "未设置展区", zoneList().map((zone) => zone.name));
    const salesUsers = isAdminLikeRole(state.data.me.role)
      ? state.data.users.filter((user) => user.role === "sales")
      : [state.data.me];
    const bySales = salesUsers.map((sales) => {
      const orders = state.data.orders.filter((order) => order.salespersonId === sales.id);
      const boothOrders = activeBoothOrders(orders);
      const amount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
      const paid = orders.reduce((sum, order) => sum + Number(order.paidApprovedAmount || 0), 0);
      const reservedBooths = boothCountFromOrders(unpaidBoothOrders(boothOrders));
      const paidBooths = boothCountFromOrders(boothOrders.filter((order) => Number(order.paidApprovedAmount || 0) > 0));
      const bookedBooths = Number((reservedBooths + paidBooths).toFixed(2));
      const soldBooths = boothCountFromOrders(boothOrders.filter((order) => order.status === "sold"));
      return {
        sales,
        orders,
        amount,
        paid,
        enterpriseCount: orders.length,
        bookedBooths,
        reservedBooths,
        paidBooths,
        soldBooths,
        paidRate: percentValue(paidBooths, bookedBooths),
        collectionRate: percentValue(paid, amount)
      };
    });
    const departmentBuckets = new Map();
    departmentList().forEach((department) => {
      departmentBuckets.set(Number(department.id), {
        id: Number(department.id),
        name: department.name,
        salesUsers: []
      });
    });
    salesUsers.forEach((sales) => {
      const departmentId = Number(sales.departmentId || 0);
      if (!departmentBuckets.has(departmentId)) {
        departmentBuckets.set(departmentId, {
          id: departmentId,
          name: departmentId ? departmentName(departmentId) : "未分配部门",
          salesUsers: []
        });
      }
      departmentBuckets.get(departmentId).salesUsers.push(sales);
    });
    const byDepartment = [...departmentBuckets.values()]
      .filter((bucket) => isAdminLikeRole(state.data.me.role) || bucket.salesUsers.some((sales) => Number(sales.id) === Number(state.data.me.id)))
      .map((bucket) => {
        const salesIds = new Set(bucket.salesUsers.map((sales) => Number(sales.id)));
        const orders = state.data.orders.filter((order) => salesIds.has(Number(order.salespersonId)));
        const boothOrders = activeBoothOrders(orders);
        const amount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const paid = orders.reduce((sum, order) => sum + Number(order.paidApprovedAmount || 0), 0);
        const reservedBooths = boothCountFromOrders(unpaidBoothOrders(boothOrders));
        const paidBooths = boothCountFromOrders(boothOrders.filter((order) => Number(order.paidApprovedAmount || 0) > 0));
        const bookedBooths = Number((reservedBooths + paidBooths).toFixed(2));
        const soldBooths = boothCountFromOrders(boothOrders.filter((order) => order.status === "sold"));
        return {
          ...bucket,
          orders,
          amount,
          paid,
          enterpriseCount: orders.length,
          bookedBooths,
          reservedBooths,
          paidBooths,
          soldBooths,
          paidRate: percentValue(paidBooths, bookedBooths),
          collectionRate: percentValue(paid, amount)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
    const reservedRate = percentValue(m.reservedBooths, m.totalBooths);
    const paidBoothRate = percentValue(m.paidBooths, m.totalBooths);
    const collectionRate = percentValue(m.paidAmount, m.totalAmount);
    const availableRate = percentValue(m.availableCount, m.totalBooths);
    const soldRate = percentValue(m.soldCount, m.totalBooths);
    const reservedEnd = availableRate + reservedRate;
    const soldEnd = reservedEnd + soldRate;
    return `
      <section class="dashboard-event-summary">
        <div>
          <span>当前展会</span>
          <h2>${h(event.name || "未设置展会名称")}</h2>
          <p>${h(eventDateRangeText(event))}${event.location ? ` · ${h(event.location)}` : ""}</p>
        </div>
        <div class="event-countdown">
          <span>展会倒计时</span>
          <strong>${h(eventCountdownText(event))}</strong>
        </div>
      </section>
      ${todoWorkbenchHtml()}
      <div class="cards">
        ${metric("展位总量", `${formatCount(m.totalBooths)}个`)}
        ${metric("已预定展位", `${formatCount(m.reservedBooths)}个`, `占总展位 ${percentText(m.reservedBooths, m.totalBooths)}`, "App.openDashboardDrill('unpaid')")}
        ${metric("到款展位", `${formatCount(m.paidBooths)}个`, `占总展位 ${percentText(m.paidBooths, m.totalBooths)}`, "App.openDashboardDrill('paid')")}
        ${metric("已收款", money(m.paidAmount), `回款率 ${percentText(m.paidAmount, m.totalAmount)}`, "App.openDashboardDrill('paid')")}
        ${metric("合计面积", `${formatCount(m.totalArea)}㎡`)}
        ${metric("标摊数量", `${m.standardCount}个`)}
        ${metric("光地面积", `${formatCount(m.rawArea)}㎡`)}
        ${metric("未收款金额", money(m.unpaidAmount), "", "App.openDashboardDrill('unpaid')")}
      </div>
      <section class="dashboard-hero">
        <div class="sales-overview">
          <div class="section-title-row">
            <h2>销售情况</h2>
            <span class="count-pill">${formatCount(m.reservedBooths)} 个展位已预定</span>
          </div>
          <div class="sales-kpis">
            <div class="sales-kpi">
              <span>预定展位</span>
              <strong>${formatCount(m.reservedBooths)}个</strong>
              <small>占总展位 ${percentText(m.reservedBooths, m.totalBooths)}</small>
            </div>
            <div class="sales-kpi">
              <span>到款展位</span>
              <strong>${formatCount(m.paidBooths)}个</strong>
              <small>未到款 ${formatCount(m.unpaidBookedBooths)}个</small>
            </div>
            <div class="sales-kpi">
              <span>首款成交展位</span>
              <strong>${formatCount(m.soldBooths)}个</strong>
              <small>首款达标 ${percentText(m.soldBooths, m.bookedBooths)}</small>
            </div>
          </div>
          <div class="progress-stack">
            ${progressLine("展位预定率", reservedRate, `${formatCount(m.reservedBooths)} / ${formatCount(m.totalBooths)}个`)}
            ${progressLine("到款展位率", paidBoothRate, `${formatCount(m.paidBooths)} / ${formatCount(m.totalBooths)}个`)}
            ${progressLine("金额回款率", collectionRate, `${money(m.paidAmount)} / ${money(m.totalAmount)}`)}
          </div>
        </div>
        <div class="chart-panel">
          ${donutChart("到款展位占比", paidBoothRate, `${paidBoothRate}%`, `${formatCount(m.paidBooths)} / ${formatCount(m.totalBooths)}个`, "#18a058")}
          ${donutChart("金额回款率", collectionRate, `${collectionRate}%`, `${money(m.paidAmount)} / ${money(m.totalAmount)}`, "#2364aa")}
          <div class="status-chart-card">
            <div class="status-pie" style="background: conic-gradient(#18a058 0 ${availableRate}%, #e6a23c ${availableRate}% ${reservedEnd}%, #5c6ac4 ${reservedEnd}% ${soldEnd}%, #d9e1ec ${soldEnd}% 100%);"></div>
            <div>
              <h3>展位状态</h3>
              <div class="legend vertical">
                <span><i style="background:#18a058"></i>空闲 ${formatCount(m.availableCount)}个</span>
                <span><i style="background:#e6a23c"></i>预定 ${formatCount(m.reservedCount)}个</span>
                <span><i style="background:#5c6ac4"></i>首款成交 ${formatCount(m.soldCount)}个</span>
                <span><i style="background:#d9e1ec"></i>停用 ${formatCount(m.disabledCount)}个</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div class="dashboard-grid dashboard-stats-grid">
        ${dashboardStatsTable("展馆统计", "展馆", hallStats)}
        ${dashboardStatsTable("展区统计", "展区", zoneStats)}
      </div>
      <section class="section">
        <div class="section-title-row">
          <h2>部门销售统计</h2>
          <span class="count-pill">${byDepartment.length} 个部门</span>
        </div>
        <div class="table-wrap">
          <table class="dashboard-compact-table">
            <thead><tr><th>部门</th><th>业务员</th><th>企业数</th><th>预定展位</th><th>到款展位</th><th>首款成交</th><th>到款率</th><th>已收金额</th><th>未收金额</th></tr></thead>
            <tbody>
              ${byDepartment.map((row) => `
                <tr>
                  <td><strong>${h(row.name)}</strong></td>
                  <td>${row.salesUsers.length}人</td>
                  <td>${row.enterpriseCount}</td>
                  <td>${formatCount(row.reservedBooths)}个</td>
                  <td>${formatCount(row.paidBooths)}个</td>
                  <td>${formatCount(row.soldBooths)}个</td>
                  <td>
                    <div class="mini-progress fluid"><i style="width:${row.paidRate}%"></i></div>
                    <span class="hint">${row.paidRate}% · 回款 ${row.collectionRate}%</span>
                  </td>
                  <td>${money(row.paid)}</td>
                  <td>${money(Math.max(0, row.amount - row.paid))}</td>
                </tr>
              `).join("") || `<tr><td colspan="9" class="empty">暂无部门销售数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <div class="dashboard-grid">
        <section class="section">
          <h2>业务员销售明细</h2>
          <div class="table-wrap">
            <table class="dashboard-compact-table dashboard-sales-table">
              <thead><tr><th>业务员</th><th>企业数</th><th>预定展位</th><th>到款展位</th><th>到款率</th><th>已收金额</th><th>未收金额</th></tr></thead>
              <tbody>
                ${bySales.map((row) => `
                  <tr>
                    <td><strong>${h(row.sales.displayName)}</strong></td>
                    <td>${row.enterpriseCount}</td>
                    <td>${formatCount(row.reservedBooths)}个</td>
                    <td>${formatCount(row.paidBooths)}个</td>
                    <td>
                      <div class="mini-progress"><i style="width:${row.paidRate}%"></i></div>
                      <span class="hint">${row.paidRate}% · 回款 ${row.collectionRate}%</span>
                    </td>
                    <td>${money(row.paid)}</td>
                    <td>${money(Math.max(0, row.amount - row.paid))}</td>
                  </tr>
                `).join("") || `<tr><td colspan="7" class="empty">暂无业务数据</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
        <section class="section">
          <h2>站内提醒</h2>
          <div class="compact-list">
            ${(state.data.notifications || []).slice(-8).reverse().map((item) => `
              <div class="compact-item">
                <strong>${h(item.title)}</strong>
                <div class="hint">${h(item.content)} · ${date(item.createdAt)}</div>
                <div class="inline-actions">
                  ${item.title?.includes("待审核") ? `<button class="tiny secondary" onclick="App.setView('approvals')">去审核</button>` : ""}
                  ${!item.read ? `<button class="tiny secondary" onclick="App.markNotificationRead(${item.id})">已读</button>` : `<span class="status approved">已读</span>`}
                </div>
              </div>
            `).join("") || `<div class="empty">暂无提醒</div>`}
          </div>
        </section>
      </div>
    `;
  }

  function viewEventInfo() {
    const event = state.data.settings.event || {};
    const events = state.data.settings.events || [];
    const superAdmin = isSuperAdminRole(state.data.me.role);
    const linkedOptions = [`<option value="">不关联历史展会</option>`]
      .concat(events.filter((item) => item.id !== event.id).map((item) => `<option value="${h(item.id)}" ${event.linkedEventId === item.id ? "selected" : ""}>${h(item.name)}</option>`))
      .join("");
    const readonly = !isAdminLikeRole(state.data.me.role);
    return `
      <section class="section">
        <h2>展会信息</h2>
        <div class="grid two">
          <label>${requiredLabel("展会编号")}<input id="event-id" value="${h(event.id || "")}" disabled></label>
          <label>${requiredLabel("展会名称")}<input id="event-name" value="${h(event.name || "")}" ${readonly ? "disabled" : ""}></label>
          <label>开始时间<input id="event-start" type="date" value="${h(event.startDate || "")}" ${readonly ? "disabled" : ""}></label>
          <label>结束时间<input id="event-end" type="date" value="${h(event.endDate || "")}" ${readonly ? "disabled" : ""}></label>
          <label>展会地点<input id="event-location" value="${h(event.location || "")}" ${readonly ? "disabled" : ""}></label>
          ${superAdmin
            ? `<label>${requiredLabel("展会类别")}<select id="event-category">${eventCategoryOptions(eventCategoryName(event))}</select></label>`
            : `<label>展会类别<input value="${h(eventCategoryName(event))}" disabled></label>`}
          ${superAdmin
            ? `<label>是否关联展会<select id="event-linked">${linkedOptions}</select></label>`
            : `<label>关联展会<input value="${h(event.linkedEventId ? eventNameById(event.linkedEventId) : "无")}" disabled></label>`}
        </div>
        <p class="hint">关联历史展会和展会类别由超级管理员维护；相同展会类别会共用同一个数据总仓。</p>
        ${readonly ? "" : `<div class="split-actions" style="margin-top:14px">
          <button onclick="App.saveEventInfo()">保存所属项目展会信息</button>
        </div>`}
      </section>
    `;
  }

  function eventRoleFor(eventId, userId) {
    return (state.data.eventRoles || []).find((row) => (
      String(row.eventId) === String(eventId)
      && Number(row.userId) === Number(userId)
    ))?.role || "";
  }

  function eventRoleIds(eventId, role) {
    return (state.data.eventRoles || [])
      .filter((row) => String(row.eventId) === String(eventId) && row.role === role)
      .map((row) => Number(row.userId));
  }

  function eventRoleLabel(role) {
    return role === "manager" ? "管理员" : "业务员";
  }

  function eventRoleActionButtons(index, event) {
    const managerCount = eventRoleIds(event.id, "manager").length;
    const salesCount = eventRoleIds(event.id, "sales").length;
    const orders = eventOrderCount(event.id);
    const actionHtml = "";
    return `
      <div class="event-role-actions">
        <button class="tiny secondary" onclick="App.openEventRoleModal(${index}, 'manager')">管理员 ${managerCount}</button>
        <button class="tiny secondary" onclick="App.openEventRoleModal(${index}, 'sales')">业务员 ${salesCount}</button>
      </div>
    `.replace("</div>", `${actionHtml}</div>`);
  }

  function eventRoleAssignmentsAfterUpdate(eventId, role, selectedIds) {
    const managerIds = role === "manager" ? new Set(selectedIds) : new Set(eventRoleIds(eventId, "manager"));
    const salesIds = role === "sales" ? new Set(selectedIds) : new Set(eventRoleIds(eventId, "sales"));
    const assignments = [...managerIds].map((userId) => ({ userId, role: "manager" }));
    [...salesIds].filter((userId) => !managerIds.has(userId)).forEach((userId) => {
      assignments.push({ userId, role: "sales" });
    });
    return assignments;
  }

  function eventRoleModal() {
    if (!state.eventRoleModal) return "";
    const { eventId, role } = state.eventRoleModal;
    const event = (state.data.settings.events || []).find((item) => String(item.id) === String(eventId));
    if (!event) return "";
    const users = state.data.users.filter((user) => !["enterprise", "admin"].includes(user.role));
    const selectedIds = new Set(eventRoleIds(event.id, role));
    const label = eventRoleLabel(role);
    return `
      <div class="modal-backdrop">
        <section class="modal small">
          <header class="modal-header">
            <h2>设置${h(label)}</h2>
            <button class="secondary" onclick="App.closeEventRoleModal()">关闭</button>
          </header>
          <p class="hint">${h(event.name || event.id)} · 勾选要成为本展会${h(label)}的账号</p>
          <div class="event-role-picker-list">
            ${users.map((user) => `
              <label class="event-role-check">
                <input type="checkbox" class="event-role-user-check" value="${user.id}" ${selectedIds.has(Number(user.id)) ? "checked" : ""}>
                <span>
                  <strong>${h(user.displayName || user.username)}</strong>
                  <small>${h(user.username)} · ${h(roleText(user.role))}</small>
                </span>
              </label>
            `).join("") || `<div class="empty">暂无可分配账号，请先到账号管理创建账号</div>`}
          </div>
          <div class="split-actions" style="margin-top:14px">
            <button onclick="App.saveEventRoleModal()">保存${h(label)}</button>
            <button class="secondary" onclick="App.closeEventRoleModal()">取消</button>
          </div>
        </section>
      </div>
    `;
  }

  function eventCreateModal() {
    if (!state.eventCreateModalOpen) return "";
    const events = state.data.settings.events || [];
    const linkedOptions = [`<option value="">不关联历史展会</option>`]
      .concat(events.map((event) => `<option value="${h(event.id)}">${h(event.name || event.id)}</option>`))
      .join("");
    return `
      <div class="modal-backdrop">
        <section class="modal small">
          <header class="modal-header">
            <h2>新增展会</h2>
            <button class="secondary" onclick="App.closeEventCreateModal()">关闭</button>
          </header>
          <form onsubmit="App.createEvent(event)">
            <div class="grid two">
              <label>${requiredLabel("展会编号")}<input id="create-event-id" required placeholder="例如 event-2027"></label>
              <label>${requiredLabel("展会名称")}<input id="create-event-name" required placeholder="请输入展会名称"></label>
              <label>开始时间<input id="create-event-start" type="date"></label>
              <label>结束时间<input id="create-event-end" type="date"></label>
              <label>展会地点<input id="create-event-location" placeholder="请输入展会地点"></label>
              <label>${requiredLabel("展会类别")}<select id="create-event-category" required>${eventCategoryOptions(eventCategoryName(state.data.settings.event))}</select></label>
              <label>是否关联展会<select id="create-event-linked">${linkedOptions}</select></label>
            </div>
            <p class="hint">新增后系统会切换到该展会；选择关联展会后，历史成交客户会按业务员进入本届老客户列表。</p>
            <div class="split-actions" style="margin-top:14px">
              <button type="submit">确认新增</button>
              <button type="button" class="secondary" onclick="App.closeEventCreateModal()">取消</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function eventAssignedNames(eventId, role) {
    const names = (state.data.eventRoles || [])
      .filter((row) => String(row.eventId) === String(eventId) && row.role === role)
      .map((row) => getUser(row.userId).displayName || getUser(row.userId).username)
      .filter(Boolean);
    return names.length ? names.join(" / ") : "-";
  }

  function viewEventsList() {
    const events = state.data.settings.events || [];
    const superAdmin = isSuperAdminRole(state.data.me.role);
    const categories = eventCategoryList();
    if (!superAdmin) return `<section class="section"><h2>展会列表</h2><div class="empty">仅超级管理员可查看展会列表。</div></section>`;
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>展会类别</h2>
          <span class="count-pill">${categories.length} 个类别</span>
        </div>
        <div class="grid two compact-grid">
          <label>新增展会类别<input id="new-event-category" placeholder="例如 春季展"></label>
          <div class="field-actions"><button onclick="App.addEventCategory()">新增类别</button></div>
        </div>
        <div class="tag-list" style="margin-top:12px">
          ${categories.map((category) => {
            const eventCount = events.filter((event) => eventCategoryName(event) === category).length;
            return `
              <span class="count-pill">
                ${h(category)}
                ${eventCount ? `<small>${eventCount}</small>` : `<button class="tiny danger" onclick="App.deleteEventCategory(${h(JSON.stringify(category))})">删除</button>`}
              </span>
            `;
          }).join("")}
        </div>
      </section>
      <section class="section">
        <div class="section-title-row">
          <h2>展会列表</h2>
          <div class="event-role-actions">
            <span class="count-pill">${events.length} 个展会</span>
            ${superAdmin ? `<button class="secondary" onclick="App.openEventCreateModal()">新增展会</button>` : ""}
          </div>
        </div>
        <p class="hint">展会编号用于隔离展位、订单、客户公海、老客户和数据总仓；只有选择关联展会后，历史成交客户才会进入新展会老客户列表。</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>展会编号</th><th>展会名称</th><th>展会类别</th><th>展会时间</th><th>地点</th><th>关联展会</th><th>管理员账号</th><th>业务员账号</th><th>账号权限</th><th>操作</th></tr></thead>
            <tbody>
              ${events.map((event, index) => `
                <tr>
                  <td><strong>${h(event.id)}</strong></td>
                  <td>${h(event.name || "-")}</td>
                  <td>${h(eventCategoryName(event))}</td>
                  <td>${h(event.startDate || "-")} 至 ${h(event.endDate || "-")}</td>
                  <td>${h(event.location || "-")}</td>
                  <td>${event.linkedEventId ? h(eventNameById(event.linkedEventId)) : "-"}</td>
                  <td>${h(eventAssignedNames(event.id, "manager"))}</td>
                  <td>${h(eventAssignedNames(event.id, "sales"))}</td>
                  <td>
                    ${superAdmin ? `
                      ${eventRoleActionButtons(index, event)}
                    ` : `<span class="hint">仅超级管理员可调整</span>`}
                  </td>
                  <td>
                    ${eventOrderCount(event.id) === 0
                      ? `<button class="tiny danger" onclick="App.deleteEvent(${index})">删除</button>`
                      : `<span class="hint">${eventOrderCount(event.id)} 个订单</span>`}
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="10" class="empty">暂无展会</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function leadRows(type, status) {
    return (state.data.customerLeads || [])
      .filter((lead) => (!type || lead.customerType === type) && (!status || lead.status === status))
      .sort((a, b) => new Date(a.protectedUntil || a.createdAt || 0) - new Date(b.protectedUntil || b.createdAt || 0));
  }

  function leadCountdownHtml(lead) {
    if (lead.status === "public") return `<span class="status released">已进入公海</span>`;
    if (lead.status === "converted") return `<span class="status sold">已参展</span>`;
    return `<span data-countdown="${h(lead.protectedUntil)}">${h(countdownText(lead.protectedUntil))}</span>`;
  }

  function leadOwnerText(lead) {
    const ownerId = lead?.status === "public" ? (lead.ownerSalesId || lead.previousOwnerSalesId) : lead?.ownerSalesId;
    return getUser(ownerId)?.displayName || "-";
  }

  function customerContactText(company) {
    if (company?.contactMasked) return "联系方式已隐藏";
    return company?.contactName || "-";
  }

  function activeOrderForCompany(companyId) {
    return state.data.orders.find((order) => (
      Number(order.companyId) === Number(companyId)
      && isActiveOrder(order)
    ));
  }

  function customerAdvancedOptions() {
    return [
      ["", "全部客户"],
      ["my", "我的客户"],
      ["soon-release", "即将释放"],
      ["pending-contract", "未传合同"],
      ["contract-pending", "合同审核中"],
      ["pending-voucher", "未传水单"],
      ["sold", "已成交"],
      ["profile-missing", "资料未提交"]
    ];
  }

  function leadMatchesAdvancedFilter(lead, filter) {
    if (!filter) return true;
    const order = activeOrderForCompany(lead.companyId);
    const profile = order ? state.data.profiles.find((item) => Number(item.orderId) === Number(order.id)) : null;
    const kind = order ? orderWorkflowKind(order) : "";
    if (filter === "my") {
      return Number(lead.ownerSalesId) === Number(state.data.me.id) || (order && Number(order.salespersonId) === Number(state.data.me.id));
    }
    if (filter === "soon-release") {
      return isDueSoon(lead.protectedUntil, 48) || (order && order.status !== "sold" && isDueSoon(order.reserveExpiresAt, 48));
    }
    if (filter === "pending-contract") {
      return kind === "contract-missing" || (!order && salesFlowMode() === "contract_first" && leadFileStatus(lead, "contract") === "none");
    }
    if (filter === "contract-pending") return leadFileStatus(lead, "contract") === "pending";
    if (filter === "pending-voucher") {
      return kind === "voucher-missing" || (!order && salesFlowMode() !== "contract_first" && leadFileStatus(lead, "voucher") === "none");
    }
    if (filter === "sold") return order?.status === "sold" || lead.status === "converted";
    if (filter === "profile-missing") return order?.status === "sold" && !profileComplete(profile);
    return true;
  }

  function customerAdvancedFilterBar(value, stateKey, count) {
    return `
      <div class="advanced-filter-bar">
        <label>高级筛选
          <select onchange="App.setCustomerFilter('${stateKey}', this.value)">
            ${customerAdvancedOptions().map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${value ? `<button class="secondary" onclick="App.setCustomerFilter('${stateKey}', '')">清除筛选</button>` : ""}
        <span class="count-pill">${count} 条结果</span>
      </div>
    `;
  }

  function customerReleaseAction(lead) {
    if (!lead || lead.customerType !== "new") return "";
    const order = activeOrderForCompany(lead.companyId);
    if (order) return `<button class="tiny secondary" disabled title="该客户已有有效订单，请先走退订/变更流程">已有订单</button>`;
    return `<button class="tiny secondary" onclick="App.releaseCustomerLead(${lead.id})">下保</button>`;
  }

  function customerCreateOrderAction(lead, company) {
    const order = activeOrderForCompany(lead.companyId);
    if (order) return `<span class="status reserved">已创建订单</span>`;
    return `<button class="tiny" onclick="App.customerAttend(${Number(company.id)}, ${Number(lead.id)})">创建订单</button>`;
  }

  function newCustomerActions(lead, company) {
    const order = activeOrderForCompany(lead.companyId);
    if (order) return `<span class="status reserved">已创建订单</span>`;
    return `<div class="inline-actions">${customerCreateOrderAction(lead, company)}${customerReleaseAction(lead)}</div>`;
  }

  function leadDepositMet(lead) {
    return state.data.orders.some((order) => (
      String(order.eventId) === String(lead.eventId)
      && Number(order.companyId) === Number(lead.companyId)
      && isActiveOrder(order)
      && Number(order.paidApprovedAmount || 0) >= Number(order.depositRequired || 0)
      && Number(order.depositRequired || 0) > 0
    ));
  }

  function protectedLeadUsageBySales(userId) {
    return (state.data.customerLeads || []).filter((lead) => (
      lead.status === "protected"
      && Number(lead.ownerSalesId) === Number(userId)
      && !leadDepositMet(lead)
    )).length;
  }

  function protectedLeadUsageByDepartment(departmentId) {
    const userIds = new Set(state.data.users
      .filter((user) => Number(user.departmentId || 0) === Number(departmentId))
      .map((user) => Number(user.id)));
    return (state.data.customerLeads || []).filter((lead) => (
      lead.status === "protected"
      && userIds.has(Number(lead.ownerSalesId))
      && !leadDepositMet(lead)
    )).length;
  }

  function customerQuotaRows() {
    if (customerTargetMode() === "department") {
      const rows = departmentList().map((department) => {
        const target = departmentTargetFor(department.id);
        const used = protectedLeadUsageByDepartment(department.id);
        return {
          key: `department-${department.id}`,
          name: department.name,
          taskCount: Number(target.taskCount || 0),
          limit: Number(target.protectionLimit || 0),
          used
        };
      });
      if (state.data.me.role === "sales") {
        return rows.filter((row) => row.key === `department-${state.data.me.departmentId || 0}`);
      }
      return rows;
    }
    const rows = state.data.users.filter((user) => user.role === "sales").map((user) => {
      const target = salesTargetForUser(user.id);
      const used = protectedLeadUsageBySales(user.id);
      return {
        key: `sales-${user.id}`,
        name: user.displayName || user.username,
        taskCount: Number(target.taskCount || 0),
        limit: Number(target.protectionLimit || 0),
        used
      };
    });
    return state.data.me.role === "sales" ? rows.filter((row) => row.key === `sales-${state.data.me.id}`) : rows;
  }

  function customerQuotaSummaryHtml() {
    const rows = customerQuotaRows();
    if (!rows.length) return `<div class="empty">暂无客保额度配置，请先到销售规则中设置。</div>`;
    return `
      <div class="quota-grid">
        ${rows.map((row) => {
          const remaining = Math.max(0, Number(row.limit || 0) - Number(row.used || 0));
          return `
            <div class="quota-card">
              <strong>${h(row.name)}</strong>
              <span>任务 ${formatCount(row.taskCount)} · 客保 ${formatCount(row.limit)} · 已用 ${formatCount(row.used)} · 剩余 ${formatCount(remaining)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function salesFlowMode() {
    return state.data?.settings?.rules?.salesFlowMode === "contract_first" ? "contract_first" : "voucher_direct";
  }

  function leadFileStatus(lead, type) {
    return type === "contract" ? (lead?.contractReviewStatus || "none") : (lead?.voucherReviewStatus || "none");
  }

  function leadLatestAttachment(lead, type) {
    const ids = type === "contract" ? (lead?.contractAttachmentIds || []) : (lead?.voucherAttachmentIds || []);
    const latestId = ids[ids.length - 1];
    return state.data.attachments.find((item) => Number(item.id) === Number(latestId)) || null;
  }

  function leadCanUploadVoucher(lead) {
    if (salesFlowMode() !== "contract_first") return true;
    if (!lead || leadFileStatus(lead, "contract") !== "approved") return false;
    const due = new Date(lead.voucherDueAt || 0).getTime();
    return !lead.voucherDueAt || !Number.isFinite(due) || due > Date.now();
  }

  function leadUploadButtons(lead) {
    const contractAttachment = leadLatestAttachment(lead, "contract");
    const voucherAttachment = leadLatestAttachment(lead, "voucher");
    const voucherButton = leadCanUploadVoucher(lead)
      ? `<label class="tiny secondary file-upload-button">水单<input id="lead-voucher-${lead.id}" type="file" accept="${contractVoucherAccept}" onchange="App.uploadLeadAttachment(${lead.id}, 'voucher')"></label>`
      : `<button class="tiny secondary" disabled title="合同审核通过后才能上传水单">水单</button>`;
    return `
      <label class="tiny secondary file-upload-button">合同<input id="lead-contract-${lead.id}" type="file" accept="${contractVoucherAccept}" onchange="App.uploadLeadAttachment(${lead.id}, 'contract')"></label>
      ${voucherButton}
      <div class="hint">合同：${h(statusText(leadFileStatus(lead, "contract")))} · 水单：${h(statusText(leadFileStatus(lead, "voucher")))}${lead.voucherDueAt ? ` · 水单期限：${h(date(lead.voucherDueAt))}` : ""}</div>
      <div class="attachment-preview-list">
        ${contractAttachment ? attachmentPreviewButton(contractAttachment.id, "预览合同") : ""}
        ${voucherAttachment ? attachmentPreviewButton(voucherAttachment.id, "预览水单") : ""}
      </div>
    `;
  }

  function customerDraftPayload() {
    return {
      name: byId("cust-name")?.value.trim() || "",
      shortName: byId("cust-short-name")?.value.trim() || "",
      contactName: byId("cust-contact")?.value.trim() || "",
      phone: byId("cust-phone")?.value.trim() || "",
      email: byId("cust-email")?.value.trim() || "",
      address: byId("cust-address")?.value.trim() || "",
      taxNo: byId("cust-tax")?.value.trim() || "",
      locationType: byId("cust-location-type")?.value || "domestic",
      countryRegion: byId("cust-location-type")?.value === "overseas" ? byId("cust-country-region")?.value || "" : "",
      province: byId("cust-location-type")?.value === "overseas" ? "" : byId("cust-province")?.value || "广东省",
      city: byId("cust-location-type")?.value === "overseas" ? "" : byId("cust-city")?.value || "广州市",
      ownerSalesId: byId("cust-owner")?.value || ""
    };
  }

  function customerModal() {
    if (!state.customerModalOpen) return "";
    const draft = state.customerDraft;
    const similarityInput = `oninput="App.refreshCompanySimilarity('cust')"`;
    const salesOptions = state.data.users
      .filter((user) => user.role === "sales")
      .map((user) => `<option value="${user.id}" ${String(draft.ownerSalesId) === String(user.id) ? "selected" : ""}>${h(user.displayName)}</option>`)
      .join("");
    return `
      <div class="modal-backdrop">
        <section class="modal">
          <header class="modal-header">
            <h2>新增客户</h2>
            <button class="secondary" onclick="App.closeCustomerModal()">关闭</button>
          </header>
          <div class="grid two">
            <label>${requiredLabel("企业名称")}<input id="cust-name" value="${h(draft.name)}" ${similarityInput} required></label>
            <label>企业简称<input id="cust-short-name" value="${h(draft.shortName || "")}" ${similarityInput}></label>
            <label>联系人<input id="cust-contact" value="${h(draft.contactName)}" ${similarityInput}></label>
            <label>手机号<input id="cust-phone" value="${h(draft.phone)}" ${similarityInput}></label>
            <label>邮箱<input id="cust-email" value="${h(draft.email)}"></label>
            ${isAdminLikeRole(state.data.me.role) ? `<label>保护业务员<select id="cust-owner">${salesOptions}</select></label>` : ""}
            <label>企业所在地<select id="cust-location-type" onchange="App.customerLocationTypeChanged()">
              <option value="domestic" ${draft.locationType !== "overseas" ? "selected" : ""}>境内</option>
              <option value="overseas" ${draft.locationType === "overseas" ? "selected" : ""}>境外</option>
            </select></label>
            ${draft.locationType === "overseas" ? `
              <label>国家或地区<select id="cust-country-region">${countryRegionOptions(draft.countryRegion || "中国香港")}</select></label>
            ` : `
              <label>省<select id="cust-province" onchange="App.customerProvinceChanged()">${provinceOptions(draft.province || "广东省")}</select></label>
              <label>市<select id="cust-city">${cityOptions(draft.province || "广东省", draft.city || "广州市")}</select></label>
            `}
            <label>地址<input id="cust-address" value="${h(draft.address)}"></label>
            <label>税号<input id="cust-tax" value="${h(draft.taxNo)}" ${similarityInput}></label>
          </div>
          <div id="cust-similar-hints">${similarCompanyWarningHtml(draft)}</div>
          <div class="split-actions" style="margin-top:14px">
            <button onclick="App.saveNewCustomer()">保存客户</button>
          </div>
        </section>
      </div>
    `;
  }

  function customerLeadRow(lead, options = {}) {
    const company = getCompany(lead.companyId);
    return `
      <tr>
        <td>${companyNameCell(company)}</td>
        <td>${h(companyShortNameText(company))}</td>
        <td><span class="customer-info-chip">${h(customerContactText(company))}</span></td>
        <td>${h(leadOwnerText(lead))}</td>
        <td>${leadCountdownHtml(lead)}</td>
        ${options.extra ? `<td>${options.extra(lead, company)}</td>` : ""}
        ${options.action ? `<td>${options.action(lead, company)}</td>` : ""}
      </tr>
    `;
  }

  function viewNewCustomers() {
    const rows = leadRows("new", "protected").filter((lead) => leadMatchesAdvancedFilter(lead, state.newCustomerFilter));
    const action = (lead, company) => newCustomerActions(lead, company);
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>新客户列表</h2>
          <span class="count-pill">${rows.length} 家</span>
        </div>
        ${customerQuotaSummaryHtml()}
        <div class="split-actions" style="margin-bottom:14px"><button onclick="App.openCustomerModal()">新增客户</button></div>
        ${customerAdvancedFilterBar(state.newCustomerFilter, "newCustomerFilter", rows.length)}
        <div class="table-wrap">
          <table class="customer-table">
            <thead><tr><th>企业名称</th><th>企业简称</th><th>客户信息</th><th>保护人</th><th>保护倒计时</th><th>操作</th></tr></thead>
            <tbody>${rows.map((lead) => customerLeadRow(lead, { action })).join("") || `<tr><td colspan="6" class="empty">暂无新客户</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      ${customerModal()}
      ${state.boothPickerOpen ? boothPickerModal() : ""}
    `;
  }

  function viewCustomerPool() {
    const rows = leadRows("", "public");
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>客户公海</h2>
          <span class="count-pill">${rows.length} 家</span>
        </div>
        <p class="hint">保护到期的新客户和老客户会进入公海；认领后重新进入新客户列表并占用客户保护名额。</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>企业名称</th><th>企业简称</th><th>客户信息</th><th>原保护人</th><th>状态</th><th>原因</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.map((lead) => customerLeadRow(lead, {
                extra: () => h(lead.publicReason || "-"),
                action: (item) => `<button class="tiny" onclick="App.claimCustomerLead(${item.id})">认领</button>`
              })).join("") || `<tr><td colspan="7" class="empty">暂无公海客户</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function linkedOldCustomerOrders() {
    const event = state.data.settings.event || {};
    const linkedEventId = event.linkedEventId || "";
    if (!linkedEventId) return [];
    const currentNames = new Set(state.data.orders
      .filter((order) => order.eventId === event.id && isActiveOrder(order))
      .map((order) => companyNameKey(getCompany(order.companyId).name))
      .filter(Boolean));
    const seen = new Set();
    return state.data.orders
      .filter((order) => order.status === "sold" && order.eventId === linkedEventId)
      .filter((order) => isAdminLikeRole(state.data.me.role) || order.salespersonId === state.data.me.id)
      .filter((order) => {
        const key = companyNameKey(getCompany(order.companyId).name);
        if (!key || currentNames.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function viewOldCustomers() {
    const rows = leadRows("old", "protected").filter((lead) => leadMatchesAdvancedFilter(lead, state.oldCustomerFilter));
    const event = state.data.settings.event || {};
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>老客户列表</h2>
          <span class="count-pill">${rows.length} 家</span>
        </div>
        ${event.linkedEventId ? `<p class="hint">当前关联历史展会：${h(eventNameById(event.linkedEventId))}</p>` : `<div class="empty">当前展会尚未关联历史展会，请管理员先到“展会信息”设置。</div>`}
        ${customerAdvancedFilterBar(state.oldCustomerFilter, "oldCustomerFilter", rows.length)}
        <div class="table-wrap">
          <table class="customer-table">
            <thead><tr><th>企业名称</th><th>企业简称</th><th>客户信息</th><th>保护人</th><th>保护倒计时</th><th>历史成交</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.map((lead) => customerLeadRow(lead, {
                extra: (item) => `${h(item.sourceEventName || "-")}<div class="hint">${money(item.sourceAmount || 0)}</div>`,
                action: (item, company) => customerCreateOrderAction(item, company)
              })).join("") || `<tr><td colspan="7" class="empty">暂无老客户数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      ${state.boothPickerOpen ? boothPickerModal() : ""}
    `;
  }

  function viewDataWarehouse() {
    if (!isAdminLikeRole(state.data.me.role)) {
      return `<section class="section"><h2>数据总仓</h2><div class="empty">仅管理员和超级管理员可查看数据总仓。</div></section>`;
    }
    const allRows = state.data.warehouseOrders || [];
    const categories = [...new Set(allRows.map((order) => order.eventCategory || eventCategoryById(order.eventId)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN"));
    const selectedCategory = isSuperAdminRole(state.data.me.role) && categories.includes(state.warehouseCategory) ? state.warehouseCategory : "";
    const rows = selectedCategory ? allRows.filter((order) => (order.eventCategory || eventCategoryById(order.eventId)) === selectedCategory) : allRows;
    const currentCategoryText = selectedCategory || (isSuperAdminRole(state.data.me.role) ? "全部类别" : eventCategoryName(state.data.settings.event));
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>数据总仓</h2>
          <div class="event-role-actions">
            ${isSuperAdminRole(state.data.me.role) ? `<label class="inline-label">展会类别<select onchange="App.setWarehouseCategory(this.value)">
              <option value="">全部类别</option>
              ${categories.map((category) => `<option value="${h(category)}" ${selectedCategory === category ? "selected" : ""}>${h(category)}</option>`).join("")}
            </select></label>` : ""}
            <span class="count-pill">${h(currentCategoryText)} · ${rows.length} 条成交客户</span>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>企业</th><th>所在地</th><th>联系人</th><th>邮箱</th><th>地址/税号</th><th>展会类别</th><th>参加展会</th><th>成交金额</th></tr></thead>
            <tbody>
              ${rows.map((order) => {
                const company = getCompany(order.companyId);
                return `
                  <tr>
                    <td><strong>${h(company.name || "-")}</strong></td>
                    <td>${h(companyLocationText(company))}</td>
                    <td>${h(company.contactName || "-")}<div class="hint">${h(company.phone || "")}</div></td>
                    <td>${h(company.email || "-")}</td>
                    <td>${h(company.address || "-")}<div class="hint">${h(company.taxNo || "")}</div></td>
                    <td>${h(order.eventCategory || eventCategoryById(order.eventId))}</td>
                    <td>${h(order.eventName || eventNameById(order.eventId))}</td>
                    <td>${money(order.totalAmount)}</td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="8" class="empty">暂无成交客户数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function metric(label, value, subtext = "", action = "") {
    const attrs = action ? ` role="button" tabindex="0" onclick="${action}" onkeydown="if(event.key==='Enter'){${action}}"` : "";
    return `<div class="metric ${action ? "clickable" : ""}"${attrs}><span>${h(label)}</span><strong>${h(value)}</strong>${subtext ? `<small>${h(subtext)}</small>` : ""}</div>`;
  }

  function progressLine(label, percent, value) {
    return `
      <div class="progress-line">
        <div><strong>${h(label)}</strong><span>${h(value)}</span></div>
        <div class="progress-track"><i style="width:${percent}%"></i></div>
      </div>
    `;
  }

  function donutChart(label, percent, center, caption, color) {
    return `
      <div class="donut-card">
        <div class="donut" style="--value:${percent}%;--color:${color};"><strong>${h(center)}</strong></div>
        <h3>${h(label)}</h3>
        <span>${h(caption)}</span>
      </div>
    `;
  }

  function viewMap() {
    const role = state.data.me.role;
    const isAdmin = isAdminLikeRole(role);
    const selectedBooth = state.data.booths.find((item) => item.id === state.selectedBoothId) || null;
    const selectedObstacle = (state.data.obstacles || []).find((item) => item.id === state.selectedObstacleId) || null;
    const selectedActivityArea = (state.data.activityAreas || []).find((item) => item.id === state.selectedActivityAreaId) || null;
    const selectedIds = [...state.selectedBoothIds];
    const selectedBooths = selectedIds.map((id) => state.data.booths.find((item) => item.id === id)).filter(Boolean);
    const adminEditorTitle = selectedObstacle ? "障碍物属性" : selectedActivityArea ? "活动区属性" : "展位编辑";
    const adminEditor = selectedObstacle
      ? adminObstaclePanel()
      : selectedActivityArea
        ? adminActivityAreaPanel()
        : adminBoothEditor(selectedBooth, selectedIds);
    return `
      <section class="section map-toolbar-section">
        <div class="toolbar">
          ${isAdmin ? adminMapToolbar() : salesMapToolbar(selectedBooths)}
          ${mapZoomToolbar()}
        </div>
      </section>
      <div class="map-layout">
        <section id="admin-map-frame" class="map-frame" onscroll="App.updateDrawPresetPosition()">
          ${isAdmin && state.drawMode ? drawPresetPanel() : ""}
          ${mapSvg()}
        </section>
        <aside class="side-panel">
          <section class="section">
            <h2>${isAdmin ? adminEditorTitle : "已选展位"}</h2>
            ${isAdmin ? adminEditor : selectedBoothSummary(selectedBooths)}
          </section>
          <section class="section">
            <h2>图例</h2>
            <div class="legend">
              <span><i style="background: var(--available)"></i>空闲</span>
              <span><i style="background: var(--reserved)"></i>预留</span>
              <span><i style="background: var(--sold)"></i>首款成交</span>
              <span><i style="background: var(--disabled)"></i>停用</span>
              <span><i style="background: rgba(194, 65, 65, 0.74)"></i>展位内障碍物</span>
              <span><i style="background: rgba(71, 85, 105, 0.66)"></i>展位外障碍物</span>
              <span><i style="background: rgba(14, 165, 233, 0.32)"></i>活动区</span>
            </div>
            <p class="hint">管理员开启绘制模式后可拖拽绘制展位；切换障碍物或活动区模式后拖拽绘制对应区域。展位内障碍物会扣减计价面积和展位价格。</p>
          </section>
        </aside>
      </div>
    `;
  }

  function viewSalesBoothMap() {
    const zones = zoneList();
    const booths = filteredSalesMapBooths();
    const matchedBooths = salesMapMatchedBooths();
    const availableCount = state.data.booths.filter((booth) => booth.status === "available").length;
    const reservedCount = state.data.booths.filter((booth) => booth.status === "reserved").length;
    const soldCount = state.data.booths.filter((booth) => booth.status === "sold").length;
    const countText = state.salesMapStatus ? `${matchedBooths.length} 个匹配 / ${booths.length} 个显示` : `${booths.length} / ${state.data.booths.length} 个展位`;
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>销售展位图</h2>
          <span class="count-pill">${countText}</span>
        </div>
        <div class="sales-map-summary">
          <div><strong>${availableCount}</strong><span>可选展位</span></div>
          <div><strong>${reservedCount}</strong><span>已预留</span></div>
          <div><strong>${soldCount}</strong><span>首款成交</span></div>
        </div>
        <div class="toolbar sales-map-toolbar">
          <label>展区<select onchange="App.setSalesMapFilter('zone', this.value)">
            <option value="">全部展区</option>
            ${zones.map((zone) => `<option value="${h(zone.name)}" ${state.salesMapZone === zone.name ? "selected" : ""}>${h(zone.name)}</option>`).join("")}
          </select></label>
          <label>展位类型<select onchange="App.setSalesMapFilter('attr', this.value)">
            <option value="">全部类型</option>
            <option value="standard" ${state.salesMapAttr === "standard" ? "selected" : ""}>标摊</option>
            <option value="raw" ${state.salesMapAttr === "raw" ? "selected" : ""}>光地</option>
          </select></label>
          <label>展位状态<select onchange="App.setSalesMapFilter('status', this.value)">
            <option value="">全部状态</option>
            ${["available", "reserved", "pending_payment_review", "sold", "disabled"].map((status) => `<option value="${status}" ${state.salesMapStatus === status ? "selected" : ""}>${statusText(status)}</option>`).join("")}
          </select></label>
          <button class="${state.salesMapOnlyAvailable ? "success" : "secondary"}" onclick="App.toggleSalesMapAvailable()">可选展位</button>
          <div class="search-control">
            <label>展位号<input id="sales-map-search" value="${h(state.salesMapSearch)}" oninput="App.setSalesMapSearch(this.value)" placeholder="输入展位号"></label>
            <button class="secondary" onclick="App.searchSalesMapBooth()">搜索</button>
          </div>
          ${mapZoomToolbar()}
          <button onclick="App.exportSalesMap()">导出展位图 JPG</button>
        </div>
      </section>
      <section id="sales-map-frame" class="map-frame sales-map-frame">
        ${salesBoothMapSvg(booths)}
      </section>
      <section class="section">
        <h2>展区颜色</h2>
        <div class="zone-legend">
          ${zones.map((zone) => `<span><i style="background:${h(zone.color)}"></i>${h(zone.name)}</span>`).join("")}
        </div>
        <p class="hint">鼠标放到展位上可查看展位号、类型、展区、价格、状态；已预留展位会显示预留倒计时。</p>
      </section>
    `;
  }

  function filteredSalesMapBooths() {
    return state.data.booths.filter((booth) => {
      if (state.salesMapZone && booth.zone !== state.salesMapZone) return false;
      if (state.salesMapAttr && booth.attr !== state.salesMapAttr) return false;
      return true;
    });
  }

  function salesMapMatchedBooths() {
    return filteredSalesMapBooths().filter((booth) => !state.salesMapStatus || booth.status === state.salesMapStatus);
  }

  function salesMapBoothDimmed(booth) {
    if (state.salesMapStatus && booth.status !== state.salesMapStatus) return true;
    if (state.salesMapOnlyAvailable && booth.status !== "available") return true;
    return false;
  }

  function salesBoothMapSvg(booths) {
    const map = state.data.map;
    const bg = map.backgroundAttachmentId ? `<image href="${fileUrl(map.backgroundAttachmentId)}" x="0" y="0" width="${map.width}" height="${map.height}" preserveAspectRatio="xMidYMid meet"></image>` : `<rect x="0" y="0" width="${map.width}" height="${map.height}" fill="#eef3f9"></rect>`;
    const zoom = effectiveMapZoom();
    const displayWidth = Math.round(map.width * zoom);
    const displayHeight = Math.round(map.height * zoom);
    const boothIds = new Set(booths.map((booth) => booth.id));
    const items = state.data.booths.map((booth) => {
      if (!boothIds.has(booth.id)) return "";
      const focused = state.salesMapFocusId === booth.id;
      const available = booth.status === "available";
      const grayed = salesMapBoothDimmed(booth);
      const fill = grayed ? "#c9d1dc" : zoneColor(booth.zone);
      const textVisible = booth.width >= 32 && booth.height >= 22;
      return `
        <g data-booth-id="${booth.id}" class="sales-booth-group">
          <title>${h(salesBoothTooltip(booth))}</title>
          <rect class="sales-booth-rect ${available ? "available" : "unavailable"} ${focused ? "focused" : ""}" fill="${h(fill)}" x="${booth.x}" y="${booth.y}" width="${booth.width}" height="${booth.height}" rx="2"></rect>
          ${textVisible ? `<text class="booth-text" x="${booth.x + booth.width / 2}" y="${booth.y + booth.height / 2}">${h(boothMapLabel(booth))}</text>` : ""}
        </g>
      `;
    }).join("");
    return `
      <svg class="booth-svg" style="width:${displayWidth}px;height:${displayHeight}px" viewBox="0 0 ${map.width} ${map.height}">
        ${bg}
        <text x="28" y="34" fill="#536176" font-size="18">销售展位图 · ${booths.length} 个展位</text>
        ${items}
        ${activityAreaSvgElements(false)}
        ${obstacleSvgElements(false)}
      </svg>
    `;
  }

  function activityAreaSvgElements(interactive = true) {
    return (state.data.activityAreas || []).map((area) => {
      const selected = state.selectedActivityAreaId === area.id;
      const textVisible = area.width >= 36 && area.height >= 20;
      const title = [
        `活动区：${area.name || "活动区"}`,
        `尺寸：${Math.round(area.width)} x ${Math.round(area.height)} 像素`
      ].join("\n");
      return `
        <g data-activity-area-id="${area.id}" class="activity-area-group ${interactive ? "" : "readonly"}" ${interactive ? `onclick="App.activityAreaClick(event, ${area.id})"` : ""}>
          <title>${h(title)}</title>
          <rect class="activity-area-rect ${selected ? "selected" : ""}" x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" rx="2"></rect>
          ${textVisible ? `<text class="activity-area-text" x="${Number(area.x) + Number(area.width) / 2}" y="${Number(area.y) + Number(area.height) / 2}">${h(area.name || "活动区")}</text>` : ""}
        </g>
      `;
    }).join("");
  }

  function obstacleSvgElements(interactive = true) {
    return (state.data.obstacles || []).map((obstacle) => {
      const selected = state.selectedObstacleId === obstacle.id;
      const textVisible = obstacle.width >= 36 && obstacle.height >= 20;
      const booth = obstacle.boothId ? state.data.booths.find((item) => item.id === obstacle.boothId) : null;
      const shape = obstacleShape(obstacle);
      const shapeClass = `obstacle-rect obstacle-shape ${h(obstacle.type)} ${selected ? "selected" : ""}`;
      const shapeElement = shape === "circle"
        ? `<ellipse class="${shapeClass}" cx="${Number(obstacle.x) + Number(obstacle.width) / 2}" cy="${Number(obstacle.y) + Number(obstacle.height) / 2}" rx="${Number(obstacle.width) / 2}" ry="${Number(obstacle.height) / 2}"></ellipse>`
        : `<rect class="${shapeClass}" x="${obstacle.x}" y="${obstacle.y}" width="${obstacle.width}" height="${obstacle.height}" rx="2"></rect>`;
      const title = [
        obstacle.type === "internal" ? "展位内障碍物" : "展位外障碍物",
        `形状：${obstacleShapeText(shape)}`,
        booth ? `绑定展位：${booth.boothNo}` : "",
        `面积：${obstacleAreaText(obstacle)}`
      ].filter(Boolean).join("\n");
      return `
        <g data-obstacle-id="${obstacle.id}" class="obstacle-group" ${interactive ? `onclick="App.obstacleClick(event, ${obstacle.id})"` : ""}>
          <title>${h(title)}</title>
          ${shapeElement}
          ${textVisible ? `<text class="obstacle-text" x="${Number(obstacle.x) + Number(obstacle.width) / 2}" y="${Number(obstacle.y) + Number(obstacle.height) / 2}">障碍</text>` : ""}
        </g>
      `;
    }).join("");
  }

  function salesBoothTooltip(booth) {
    const order = activeOrderForBooth(booth);
    const lines = [
      `展位号：${booth.boothNo}`,
      `所在展馆：${booth.hall || "-"}`,
      `展位类型：${attrText(booth.attr)}`,
      `展区名称：${booth.zone || "-"}`,
      `计价面积：${Number(booth.billableArea || booth.area || 0)}㎡`,
      `障碍面积：${Number(booth.obstacleArea || 0)}㎡`,
      `展位价格：${money(booth.price)}`,
      `展位状态：${order ? orderDisplayStatusText(order) : statusText(booth.status)}`
    ];
    const countdown = reserveCountdown(booth);
    if (countdown) lines.push(`预留倒计时：${countdown}`);
    return lines.join("\n");
  }

  function reserveCountdown(booth) {
    if (!["reserved", "pending_payment_review"].includes(booth.status)) return "";
    const order = activeOrderForBooth(booth);
    if (!order?.reserveExpiresAt) return "";
    const diff = new Date(order.reserveExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(diff)) return "";
    if (diff <= 0) return "已到期";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}天${hours}小时`;
    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${Math.max(1, minutes)}分钟`;
  }

  function activeOrderForBooth(booth) {
    return state.data.orders.find((item) => {
      if (item.id === booth.orderId) return true;
      return (item.boothIds || []).includes(booth.id) && isActiveOrder(item);
    }) || null;
  }

  function orderDepositMet(order) {
    return Number(order?.depositRequired || 0) > 0
      && Number(order?.paidApprovedAmount || 0) >= Number(order.depositRequired || 0);
  }

  function boothMapLabel(booth) {
    const order = activeOrderForBooth(booth);
    if (!orderDepositMet(order)) return booth.boothNo;
    const company = getCompany(order.companyId);
    return company.shortName || company.name || booth.boothNo;
  }

  function adminMapToolbar() {
    return `
      <label>底图上传<input id="bg-file" type="file" accept="image/*,application/pdf"></label>
      <button onclick="App.uploadBackground()">上传底图</button>
      <button class="secondary" onclick="App.fitBackgroundToImage()">按原图比例校正</button>
      <label>比例尺 像素/米<input id="map-scale" type="number" value="${mapScale()}" min="1"></label>
      <button class="secondary" onclick="App.saveMapScale()">保存比例尺</button>
      <button class="${state.drawMode ? "success" : "secondary"}" onclick="App.toggleDraw()">${state.drawMode ? "绘制模式中" : "开启绘制"}</button>
      <button class="${state.activityAreaMode ? "success" : "secondary"}" onclick="App.toggleActivityAreaMode()">${state.activityAreaMode ? "活动区绘制中" : "绘制活动区"}</button>
      <button class="secondary" ${state.mapUndoStack.length ? "" : "disabled"} onclick="App.undoMapEdit()">撤销</button>
      <button class="secondary" ${state.mapRedoStack.length ? "" : "disabled"} onclick="App.redoMapEdit()">重做</button>
      <button class="secondary" ${state.mapUndoStack.length ? "" : "disabled"} onclick="App.undoMapEdit()">误删恢复</button>
      <label>障碍形状<select id="obstacle-shape-mode" onchange="App.setObstacleShape(this.value)">
        <option value="rect" ${state.obstacleShape !== "circle" ? "selected" : ""}>矩形</option>
        <option value="circle" ${state.obstacleShape === "circle" ? "selected" : ""}>圆形</option>
      </select></label>
      <button class="${state.obstacleMode === "internal" ? "success" : "secondary"}" onclick="App.toggleObstacleMode('internal')">展位内障碍物</button>
      <button class="${state.obstacleMode === "external" ? "success" : "secondary"}" onclick="App.toggleObstacleMode('external')">展位外障碍物</button>
      <button class="danger" onclick="App.clearAllBooths()">清空展位图</button>
    `;
  }

  function mapZoomToolbar() {
    return `
      <label>底图缩放<select id="map-zoom" onchange="App.setMapZoom(this.value)">
        <option value="fit" ${state.mapZoom === "fit" ? "selected" : ""}>适应窗口${state.mapZoom === "fit" ? ` · ${Math.round(effectiveMapZoom() * 100)}%` : ""}</option>
        ${[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((zoom) => `<option value="${zoom}" ${Number(state.mapZoom) === zoom ? "selected" : ""}>${Math.round(zoom * 100)}%</option>`).join("")}
      </select></label>
    `;
  }

  function salesMapToolbar(selectedBooths) {
    return `
      <div class="notice">${boothSelectionAmountText(selectedBooths)}</div>
      <button ${selectedBooths.length ? "" : "disabled"} onclick="App.useSelectedBooths()">用已选展位创建订单</button>
      <button class="secondary" onclick="App.clearBoothSelection()">清空选择</button>
    `;
  }

  function drawPresetPanel() {
    const presetHall = currentDrawPresetHall();
    const presetZone = currentDrawPresetZone();
    const hallOptions = hallList().map((hall) => `<option value="${h(hall)}" ${presetHall === hall ? "selected" : ""}>${h(hall)}</option>`).join("");
    const zoneOptions = zoneList().map((zone) => `<option value="${h(zone.name)}" ${presetZone === zone.name ? "selected" : ""}>${h(zone.name)}</option>`).join("");
    if (state.drawPresetCollapsed) {
      return `
        <div class="draw-preset-panel collapsed">
          <button class="draw-preset-toggle" onclick="App.toggleDrawPresetPanel()">绘制设置</button>
          <span>${h(presetHall)} · ${h(presetZone)}</span>
          <span id="draw-preset-pixels">${meterToPx(state.drawPresetWidthM)} x ${meterToPx(state.drawPresetDepthM)} 像素</span>
          <span id="draw-preset-next">下一个：${h(nextBoothNo())}</span>
        </div>
      `;
    }
    return `
      <div class="draw-preset-panel">
        <div class="draw-preset-header">
          <strong>新展位设置</strong>
          <button class="tiny secondary" onclick="App.toggleDrawPresetPanel()">收起</button>
        </div>
        <label>长m<input id="draw-preset-width" type="number" step="0.001" min="0.001" value="${h(state.drawPresetWidthM)}" oninput="App.updateDrawPreset()"></label>
        <label>宽m<input id="draw-preset-depth" type="number" step="0.001" min="0.001" value="${h(state.drawPresetDepthM)}" oninput="App.updateDrawPreset()"></label>
        <label>默认展馆<select id="draw-preset-hall" onchange="App.updateDrawPreset()">${hallOptions}</select></label>
        <label>默认展区<select id="draw-preset-zone" onchange="App.updateDrawPreset()">${zoneOptions}</select></label>
        <label>展位号前缀<input id="draw-booth-prefix" value="${h(state.drawBoothNoPrefix)}" oninput="App.updateDrawPreset()"></label>
        <label>展位号总位数<input id="draw-booth-chars" type="number" min="1" max="12" value="${h(state.drawBoothNoChars)}" oninput="App.updateDrawPreset()"></label>
        <label>起始展位号<input id="draw-booth-start" type="number" min="0" value="${h(state.drawBoothNoStart)}" oninput="App.updateDrawPreset()"></label>
        <label>是否跳号<select id="draw-booth-skip-enabled" onchange="App.updateDrawPreset()">
          <option value="no" ${state.drawBoothNoSkipEnabled !== "yes" ? "selected" : ""}>否</option>
          <option value="yes" ${state.drawBoothNoSkipEnabled === "yes" ? "selected" : ""}>是</option>
        </select></label>
        ${state.drawBoothNoSkipEnabled === "yes" ? `<label>跳号数字<input id="draw-booth-step" type="number" min="1" value="${h(state.drawBoothNoStep)}" oninput="App.updateDrawPreset()"></label>` : ""}
        <span id="draw-preset-pixels">${meterToPx(state.drawPresetWidthM)} x ${meterToPx(state.drawPresetDepthM)} 像素</span>
        <span id="draw-preset-next">下一个：${h(nextBoothNo())}</span>
        <div class="draw-preset-actions">
          <button class="tiny secondary" onclick="App.resetDrawBoothNumber()">重置编号</button>
        </div>
        ${state.drawBoothNoResetActive ? `<small class="draw-reset-hint">编号已重置：从当前起始号开始，遇到已存在编号会自动跳过。</small>` : ""}
        <small>例：1A + 4 + 1，跳号 4：1A01、1A05、1A09</small>
      </div>
    `;
  }

  function mapSvg() {
    const map = state.data.map;
    const bg = map.backgroundAttachmentId ? `<image href="${fileUrl(map.backgroundAttachmentId)}" x="0" y="0" width="${map.width}" height="${map.height}" preserveAspectRatio="xMidYMid meet"></image>` : `<rect x="0" y="0" width="${map.width}" height="${map.height}" fill="#eef3f9"></rect>`;
    const booths = state.data.booths.map((booth) => {
      const selected = state.selectedBoothIds.has(booth.id) || state.selectedBoothId === booth.id;
      const base = state.selectedBoothIds.has(booth.id) && state.selectedBoothId === booth.id;
      const textVisible = booth.width >= 32 && booth.height >= 22;
      return `
        <g data-booth-id="${booth.id}" onclick="App.boothClick(event, ${booth.id})">
          <rect class="booth-rect ${h(booth.status)} ${selected ? "selected" : ""} ${base ? "base" : ""} ${booth.locked ? "locked" : ""}" x="${booth.x}" y="${booth.y}" width="${booth.width}" height="${booth.height}" rx="2"></rect>
          ${textVisible ? `<text class="booth-text" x="${booth.x + booth.width / 2}" y="${booth.y + booth.height / 2}">${h(boothMapLabel(booth))}</text>` : ""}
          ${booth.locked ? `<text class="booth-lock-text" x="${booth.x + Number(booth.width || 0) - 8}" y="${booth.y + 12}">锁</text>` : ""}
        </g>
      `;
    }).join("");
    const zoom = effectiveMapZoom();
    const displayWidth = Math.round(map.width * zoom);
    const displayHeight = Math.round(map.height * zoom);
    return `
      <svg id="boothSvg" class="booth-svg" style="width:${displayWidth}px;height:${displayHeight}px" viewBox="0 0 ${map.width} ${map.height}" onmousedown="App.mapDown(event)" onmousemove="App.mapMove(event)" onmouseup="App.mapUp(event)" onmouseleave="App.mapUp(event)">
        ${bg}
        <text x="28" y="34" fill="#536176" font-size="18">展位图 · ${state.data.booths.length} 个展位</text>
        ${booths}
        ${activityAreaSvgElements(true)}
        ${obstacleSvgElements(true)}
      </svg>
    `;
  }

  function adminBoothEditor(booth, selectedIds) {
    const halls = hallList().map((hall) => `<option value="${h(hall)}" ${booth?.hall === hall ? "selected" : ""}>${h(hall)}</option>`).join("");
    const zones = zoneList().map((zone) => `<option value="${h(zone.name)}" ${booth?.zone === zone.name ? "selected" : ""}>${h(zone.name)}</option>`).join("");
    const selectedBooths = selectedIds.map((id) => state.data.booths.find((item) => item.id === id)).filter(Boolean);
    const baseBooth = selectedBooths.find((item) => item.id === state.selectedBoothId) || selectedBooths[0] || null;
    const obstacleArea = booth ? boothObstacleAreaFor(booth) : 0;
    const billableArea = booth ? boothBillableAreaFor(booth) : 0;
    const boothPrice = booth ? boothPriceFor(booth) : 0;
    const selectedHint = selectedIds.length ? `<div class="notice">当前批量选中 ${selectedIds.length} 个展位；对齐基点：${baseBooth ? h(baseBooth.boothNo) : "未设置"}。点击已选展位可切换基点。</div>` : "";
    return `
      ${booth ? `
        <div class="grid two">
          <label>展位号<input id="booth-no" value="${h(booth.boothNo)}"></label>
          <label>所在展馆<select id="booth-hall">${halls}</select></label>
          <label>展区<select id="booth-zone">${zones}</select></label>
          <label>属性<select id="booth-attr"><option value="standard" ${booth.attr === "standard" ? "selected" : ""}>标摊</option><option value="raw" ${booth.attr === "raw" ? "selected" : ""}>光地</option></select></label>
          <label>状态<select id="booth-status">
            ${["available", "reserved", "disabled"].map((status) => `<option value="${status}" ${booth.status === status ? "selected" : ""}>${statusText(status)}</option>`).join("")}
          </select></label>
          <label>长m<input id="booth-width-m" type="number" step="0.1" value="${booth.widthM}" oninput="App.previewBoothSize()"></label>
          <label>宽m<input id="booth-depth-m" type="number" step="0.1" value="${booth.depthM}" oninput="App.previewBoothSize()"></label>
          <label>面积㎡<input id="booth-area" type="number" value="${booth.area}" readonly></label>
          <label>障碍面积㎡<input id="booth-obstacle-area" value="${fixedDecimal(obstacleArea, 3)}" disabled></label>
          <label>计价面积㎡<input id="booth-billable-area" value="${fixedDecimal(billableArea, 3)}" disabled></label>
          <label>展位价格<input id="booth-price" value="${money(boothPrice)}" disabled></label>
          <label>图上像素<input id="booth-pixel-size" value="${Math.round(booth.width)} x ${Math.round(booth.height)}" disabled></label>
        </div>
        <div class="split-actions" style="margin-top:12px">
          <button onclick="App.saveBooth()">保存展位</button>
          <button class="secondary" onclick="App.toggleBoothLock(${booth.id})">${booth.locked ? "解锁展位" : "锁定展位"}</button>
          <button class="secondary" onclick="App.toggleSelected(${booth.id})">加入/移出批量</button>
          <button class="danger" onclick="App.deleteBooth(${booth.id})">删除展位</button>
        </div>
      ` : `<div class="empty">点击一个展位进行编辑，或开启绘制模式拖拽创建。</div>`}
      ${selectedHint}
      <div class="grid four">
        <label>批量展馆<select id="batch-hall">${hallList().map((hall) => `<option value="${h(hall)}">${h(hall)}</option>`).join("")}</select></label>
        <label>批量展区<select id="batch-zone">${zoneList().map((zone) => `<option value="${h(zone.name)}">${h(zone.name)}</option>`).join("")}</select></label>
        <label>批量属性<select id="batch-attr"><option value="standard">标摊</option><option value="raw">光地</option></select></label>
        <label>批量状态<select id="batch-status"><option value="">不修改状态</option><option value="available">空闲</option><option value="disabled">停用</option></select></label>
      </div>
      <div class="split-actions">
        <button class="secondary" onclick="App.batchUpdateBooths()">批量更新</button>
        <span class="axis-align-control">
          <label>沿 X 轴<select id="booth-align-x-mode">
            <option value="align:start">上对齐</option>
            <option value="align:end">下对齐</option>
            <option value="attach:start">上对齐并贴合</option>
            <option value="attach:end">下对齐并贴合</option>
          </select></label>
          <button class="secondary" onclick="App.applyBoothAlignment('x')">执行</button>
        </span>
        <span class="axis-align-control">
          <label>沿 Y 轴<select id="booth-align-y-mode">
            <option value="align:start">左对齐</option>
            <option value="align:end">右对齐</option>
            <option value="attach:start">左对齐并贴合</option>
            <option value="attach:end">右对齐并贴合</option>
          </select></label>
          <button class="secondary" onclick="App.applyBoothAlignment('y')">执行</button>
        </span>
        <button class="secondary" onclick="App.copySelectedBooths()">批量复制</button>
        <button class="danger" onclick="App.deleteSelectedBooths()">删除选中展位</button>
        <button class="secondary" onclick="App.clearBoothSelection()">清空批量</button>
      </div>
    `;
  }

  function adminObstaclePanel() {
    const obstacle = (state.data.obstacles || []).find((item) => item.id === state.selectedObstacleId);
    const internalCount = (state.data.obstacles || []).filter((item) => item.type === "internal").length;
    const externalCount = (state.data.obstacles || []).filter((item) => item.type === "external").length;
    if (!obstacle) {
      return `
        <div class="compact-list">
          <div class="compact-item">
            <strong>展位内障碍物</strong>
            <div class="hint">已绘制 ${internalCount} 个。绘制时必须完全落在某个展位内部，会扣减该展位计价面积和价格。</div>
          </div>
          <div class="compact-item">
            <strong>展位外障碍物</strong>
            <div class="hint">已绘制 ${externalCount} 个。仅用于地图标识，不影响展位价格。</div>
          </div>
        </div>
      `;
    }
    const booth = obstacle.boothId ? state.data.booths.find((item) => item.id === obstacle.boothId) : null;
    const widthM = obstacleWidthM(obstacle);
    const depthM = obstacleDepthM(obstacle);
    const shape = obstacleShape(obstacle);
    const area = obstacleAreaFromSize(widthM, depthM, shape);
    return `
      <div class="compact-list">
        <div class="compact-item">
          <strong>${obstacle.type === "internal" ? "展位内障碍物" : "展位外障碍物"}</strong>
          <div class="hint">${booth ? `绑定展位 ${h(booth.boothNo)} · ` : ""}${obstacleShapeText(shape)} · ${obstacleAreaText(obstacle)} · ${Math.round(obstacle.width)} x ${Math.round(obstacle.height)} 像素</div>
        </div>
      </div>
      <div class="grid two" style="margin-top:12px">
        <label>障碍物形状<select id="obstacle-shape" onchange="App.changeObstacleShape()">
          <option value="rect" ${shape === "rect" ? "selected" : ""}>矩形</option>
          <option value="circle" ${shape === "circle" ? "selected" : ""}>圆形</option>
        </select></label>
        <label>障碍物长m<input id="obstacle-width-m" type="number" step="0.001" value="${fixedDecimal(widthM, 3)}" oninput="App.previewObstacleSize()"></label>
        <label>障碍物宽m<input id="obstacle-depth-m" type="number" step="0.001" value="${fixedDecimal(depthM, 3)}" oninput="App.previewObstacleSize()"></label>
        <label>面积㎡<input id="obstacle-area" type="number" value="${fixedDecimal(area, 3)}" readonly></label>
        <label>图上像素<input id="obstacle-pixel-size" value="${Math.round(obstacle.width)} x ${Math.round(obstacle.height)}" disabled></label>
      </div>
      <div class="split-actions" style="margin-top:12px">
        <button onclick="App.saveObstacle()">保存障碍物尺寸</button>
        <button class="danger" onclick="App.deleteObstacle(${obstacle.id})">删除障碍物</button>
        <button class="secondary" onclick="App.clearObstacleSelection()">取消选择</button>
      </div>
      <p class="hint">尺寸会按当前比例尺换算成图上像素；展位内障碍物保存后会重新扣减该展位计价面积。</p>
    `;
  }

  function adminActivityAreaPanel() {
    const areas = state.data.activityAreas || [];
    const area = areas.find((item) => item.id === state.selectedActivityAreaId);
    if (!area) {
      return `
        <div class="compact-list">
          <div class="compact-item">
            <strong>已绘制 ${areas.length} 个活动区</strong>
            <div class="hint">点击“绘制活动区”后，在展位图上像绘制展位一样拖拽即可创建；活动区不会加入展位选择，也不会影响展位计价。</div>
          </div>
        </div>
      `;
    }
    const widthM = pxToMeter(area.width, 3);
    const depthM = pxToMeter(area.height, 3);
    return `
      <div class="compact-list">
        <div class="compact-item">
          <strong>${h(area.name || "活动区")}</strong>
          <div class="hint">${fixedDecimal(widthM, 3)}m x ${fixedDecimal(depthM, 3)}m · ${Math.round(area.width)} x ${Math.round(area.height)} 像素</div>
        </div>
      </div>
      <div class="grid two" style="margin-top:12px">
        <label>活动区名称<input id="activity-area-name" value="${h(area.name || "活动区")}"></label>
        <label>活动区长m<input id="activity-area-width-m" type="number" step="0.001" value="${fixedDecimal(widthM, 3)}" oninput="App.previewActivityAreaSize()"></label>
        <label>活动区宽m<input id="activity-area-depth-m" type="number" step="0.001" value="${fixedDecimal(depthM, 3)}" oninput="App.previewActivityAreaSize()"></label>
        <label>图上像素<input id="activity-area-pixel-size" value="${Math.round(area.width)} x ${Math.round(area.height)}" disabled></label>
      </div>
      <div class="split-actions" style="margin-top:12px">
        <button onclick="App.saveActivityArea()">保存活动区</button>
        <button class="danger" onclick="App.deleteActivityArea(${area.id})">删除活动区</button>
        <button class="secondary" onclick="App.clearActivityAreaSelection()">取消选择</button>
      </div>
    `;
  }

  function selectedBoothSummary(booths) {
    if (!booths.length) return `<div class="empty">点击绿色空闲展位加入选择。</div>`;
    return `
      <div class="compact-list">
        ${booths.map((booth) => `
          <div class="compact-item">
            <strong>${h(booth.boothNo)}</strong>
            <div class="hint">${h(booth.hall || "-")} · ${h(booth.zone)} · ${attrText(booth.attr)} · ${booth.area}㎡ · ${money(booth.price)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function viewSettings() {
    const rules = state.data.settings.rules;
    const sync = state.data.settings.workdaySync || {};
    const furniture = state.data.settings.furniture || [];
    const zones = zoneList();
    const halls = hallList();
    const discounts = discountRules();
    const salesTargets = state.data.settings.salesTargets || [];
    const departmentTargets = state.data.settings.departmentTargets || [];
    const salesUsers = state.data.users.filter((user) => user.role === "sales");
    const departments = departmentList();
    const mode = customerTargetMode();
    const salesTarget = (userId) => salesTargets.find((item) => Number(item.userId) === Number(userId)) || {};
    const departmentTarget = (departmentId) => departmentTargets.find((item) => Number(item.departmentId) === Number(departmentId)) || {};
    const deadlineDayMode = rules.deadlineDayMode === "natural" ? "natural" : "workday";
    const deadlineDayModeText = deadlineDayMode === "natural" ? "自然日" : "工作日";
    return `
      ${settingsTabNav()}
      <section class="section ${settingsTabClass("workflow")}">
        <h2>销售规则</h2>
        <div class="grid four">
          <label>标摊单价/9㎡<input id="rule-standard" type="number" value="${rules.standardPrice}"></label>
          <label>光地单价/㎡<input id="rule-raw" type="number" value="${rules.rawPrice}"></label>
          <label>首款比例<input id="rule-deposit" type="number" step="0.01" value="${rules.depositRate}"></label>
          <label>期限计算方式<select id="rule-deadline-day-mode" onchange="App.salesFlowRuleChanged()">
            <option value="workday" ${deadlineDayMode === "workday" ? "selected" : ""}>工作日</option>
            <option value="natural" ${deadlineDayMode === "natural" ? "selected" : ""}>自然日</option>
          </select></label>
          <label>预留有效天数（${deadlineDayModeText}）<input id="rule-workdays" type="number" value="${rules.reserveWorkdays ?? 7}"></label>
        </div>
        <div class="grid two compact-grid" style="margin-top:14px">
          <label>释放前提醒天数<input id="rule-notice" type="number" value="${rules.noticeDaysBeforeRelease}"></label>
          <label>新客户保护天数<input id="rule-new-customer-days" type="number" value="${rules.newCustomerProtectDays ?? 30}"></label>
          <label>老客户保护天数<input id="rule-old-customer-days" type="number" value="${rules.oldCustomerProtectDays ?? 30}"></label>
          <label>管理员联系方式脱敏<select id="rule-admin-contact-mask-mode" onchange="App.salesFlowRuleChanged()">
            <option value="off" ${(rules.adminContactMaskMode || "off") !== "department" ? "selected" : ""}>关闭：管理员可查看全部联系方式</option>
            <option value="department" ${rules.adminContactMaskMode === "department" ? "selected" : ""}>开启：管理员仅查看本部门联系方式</option>
          </select></label>
        </div>
        <div class="grid two compact-grid" style="margin-top:14px">
          <label>销售流程<select id="rule-sales-flow" onchange="App.salesFlowRuleChanged()">
            <option value="voucher_direct" ${rules.salesFlowMode !== "contract_first" ? "selected" : ""}>直接上传水单，合同可后补</option>
            <option value="contract_first" ${rules.salesFlowMode === "contract_first" ? "selected" : ""}>合同审核通过后才能上传水单</option>
          </select></label>
          ${rules.salesFlowMode === "contract_first" ? `<label>合同通过后上传水单期限（${deadlineDayModeText}）<input id="rule-contract-voucher-workdays" type="number" min="0" value="${rules.contractApprovedVoucherWorkdays ?? rules.reserveWorkdays ?? 7}"></label>` : ""}
        </div>
        <p class="hint">直接水单模式以到账为优先，业务员可先上传水单；合同先审模式会要求合同审核通过后，在设定期限内上传水单。两个期限都从实际操作时刻开始计算。</p>
        <div class="grid two compact-grid" style="margin-top:14px">
          <label>企业免登录链接有效天数<input id="rule-enterprise-link-days" type="number" min="1" max="${eventCountdownDaysValue()}" value="${enterpriseLinkDaysValue(rules)}" onchange="App.salesFlowRuleChanged()"></label>
          <div class="hint">默认与展会倒计时一致，当前最多 ${eventCountdownDaysValue()} 天；管理员可单独缩短，但不能超过展会倒计时。</div>
          <label>审核驳回原因模板<textarea id="review-reject-templates" placeholder="每行一个模板">${h((state.data.settings.reviewRejectTemplates || []).join("\n"))}</textarea></label>
        </div>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.saveSettings()">保存规则</button>
          <button class="secondary" onclick="App.runReleaseJob()">立即执行释放检查</button>
        </div>
      </section>
      <section class="section ${settingsTabClass("targets")}">
        <div class="section-title-row">
          <h2>客户保护与销售任务</h2>
          <span class="count-pill">${mode === "department" ? `${departments.length} 个部门` : `${salesUsers.length} 个业务员`}</span>
        </div>
        <div class="grid two compact-grid" style="margin-bottom:14px">
          <label>设置单位<select id="rule-customer-target-mode" onchange="App.salesFlowRuleChanged()">
            <option value="sales" ${mode === "sales" ? "selected" : ""}>按业务员</option>
            <option value="department" ${mode === "department" ? "selected" : ""}>按部门</option>
          </select></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${mode === "department" ? "部门" : "业务员"}</th><th>销售任务数</th><th>客户保护数量</th></tr></thead>
            <tbody>
              ${mode === "department" ? departments.map((department) => {
                const target = departmentTarget(department.id);
                return `
                  <tr>
                    <td><strong>${h(department.name)}</strong><div class="hint">部门共用任务与客保额度</div></td>
                    <td><input id="department-task-${department.id}" type="number" min="0" value="${Number(target.taskCount || 0)}"></td>
                    <td><input id="department-protect-${department.id}" type="number" min="0" value="${Number(target.protectionLimit || 0)}"></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="3" class="empty">暂无部门，请先到账号管理新增部门</td></tr>` : salesUsers.map((user) => {
                const target = salesTarget(user.id);
                return `
                  <tr>
                    <td><strong>${h(user.displayName)}</strong><div class="hint">${h(user.username)} · ${h(departmentName(user.departmentId))}</div></td>
                    <td><input id="sales-task-${user.id}" type="number" min="0" value="${Number(target.taskCount || 0)}"></td>
                    <td><input id="sales-protect-${user.id}" type="number" min="0" value="${Number(target.protectionLimit || 0)}"></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="3" class="empty">暂无业务员账号</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="hint">${mode === "department" ? "部门模式下，同一部门共同承担销售任务并共用客户保护名额。" : "业务员模式下，每个业务员单独承担销售任务并单独使用客户保护名额。"}已达到首款线的客户不占用名额。</p>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.saveSalesTargets()">保存客户保护与销售任务</button>
        </div>
      </section>
      <section class="section ${settingsTabClass("pricing")}">
        <div class="section-title-row">
          <h2>优惠规则</h2>
          <span class="count-pill">${discounts.length} 条</span>
        </div>
        <div class="grid two">
          <label>${requiredLabel("优惠事由")}<input id="discount-reason" placeholder="例如 早鸟优惠" required></label>
          <label>${requiredLabel("优惠价格")}<input id="discount-price" type="number" value="0" required></label>
        </div>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.addDiscountRule()">新增优惠</button>
          <button class="secondary" onclick="App.saveDiscountRules()">保存优惠规则</button>
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>优惠事由</th><th>优惠价格</th><th>操作</th></tr></thead>
            <tbody>
              ${discounts.map((rule, index) => `
                <tr>
                  <td><input id="discount-rule-reason-${index}" value="${h(rule.reason)}"></td>
                  <td><input id="discount-rule-price-${index}" type="number" value="${Number(rule.price || 0)}"></td>
                  <td><button class="danger" onclick="App.deleteDiscountRule(${index})">删除</button></td>
                </tr>
              `).join("") || `<tr><td colspan="3" class="empty">暂无优惠规则</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <section class="section ${settingsTabClass("venue")}">
        <div class="section-title-row">
          <h2>展馆管理</h2>
          <span class="count-pill">${halls.length} 个展馆</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>展馆名称</th><th>操作</th></tr></thead>
            <tbody>
              ${halls.map((hall, index) => `
                <tr>
                  <td><input id="hall-name-${index}" value="${h(hall)}" placeholder="例如 1号馆"></td>
                  <td><button class="danger" onclick="App.deleteHall(${index})">删除</button></td>
                </tr>
              `).join("") || `<tr><td colspan="2" class="empty">暂无展馆，请新增</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.addHall()">新增展馆</button>
          <button class="secondary" onclick="App.saveHallTable()">保存展馆</button>
        </div>
        <p class="hint">展馆会出现在展位图管理的“所在展馆”下拉框中，便于按馆区管理展位。</p>
      </section>
      <section class="section ${settingsTabClass("venue")}">
        <div class="section-title-row">
          <h2>展区管理</h2>
          <span class="count-pill">${zones.length} 个展区</span>
        </div>
        <div class="table-wrap zone-table">
          <table>
            <thead><tr><th>展区名称</th><th>RGB 颜色</th><th>预览</th><th>操作</th></tr></thead>
            <tbody>
              ${zones.map((zone, index) => `
                <tr>
                  <td><input id="zone-name-${index}" value="${h(zone.name)}" placeholder="例如 A区"></td>
                  <td><input class="color-input" id="zone-color-${index}" type="color" value="${h(zone.color)}"></td>
                  <td><span class="zone-swatch" style="background:${h(zone.color)}"></span>${h(zone.color.toUpperCase())}</td>
                  <td><button class="danger" onclick="App.deleteZone(${index})">删除</button></td>
                </tr>
              `).join("") || `<tr><td colspan="4" class="empty">暂无展区，请新增</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.addZone()">新增展区</button>
          <button class="secondary" onclick="App.saveZoneTable()">保存展区</button>
        </div>
        <p class="hint">展区颜色会体现在销售展位图上；已绘制展位仍按展区名称匹配颜色。</p>
      </section>
      <section class="section ${settingsTabClass("workdays")}">
        <h2>中国大陆工作日同步</h2>
        <div class="grid two">
          <label>同步年份<input id="sync-year" type="number" value="${new Date().getFullYear()}"></label>
          <label>同步接口<input id="sync-source" value="${h(sync.sourceUrl || "https://timor.tech/api/holiday/year/{year}/")}"></label>
        </div>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.syncWorkdays()">联网同步工作日</button>
          <span class="hint">${h(sync.lastStatus || "not_synced")} · ${h(sync.lastMessage || "尚未同步")} ${sync.lastSyncedAt ? "· " + date(sync.lastSyncedAt) : ""}</span>
        </div>
      </section>
      <section class="section ${settingsTabClass("furniture")}">
        <h2>展具管理</h2>
        <div class="grid four">
          <label>${requiredLabel("展具名称")}<input id="furniture-name" placeholder="例如 洽谈桌" required></label>
          <label>尺寸<input id="furniture-size" placeholder="例如 1200x600mm"></label>
          <label>价格<input id="furniture-price" type="number" value="0"></label>
          <label>状态<select id="furniture-active"><option value="true">启用</option><option value="false">停用</option></select></label>
        </div>
        <div class="split-actions" style="margin-top:14px">
          <button onclick="App.addFurniture()">新增展具</button>
          <button class="secondary" onclick="App.saveFurnitureTable()">保存展具表</button>
        </div>
        <div class="table-wrap furniture-table">
          <table>
            <thead><tr><th>缩略图</th><th>名称</th><th>尺寸</th><th class="price-col">价格</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              ${furniture.map((item, index) => `
                <tr>
                  <td>
                    <div class="furniture-thumb-wrap">
                      ${furnitureThumbHtml(item)}
                      <label class="tiny secondary file-upload-button">上传缩略图<input id="furn-image-${index}" type="file" accept="image/*" onchange="App.uploadFurnitureImage(${index})"></label>
                    </div>
                  </td>
                  <td><input id="furn-name-${index}" value="${h(item.name)}"></td>
                  <td><input id="furn-size-${index}" value="${h(item.size)}"></td>
                  <td class="price-col"><input class="price-input" id="furn-price-${index}" type="number" value="${Number(item.price || 0)}"></td>
                  <td><select id="furn-active-${index}"><option value="true" ${item.active !== false ? "selected" : ""}>启用</option><option value="false" ${item.active === false ? "selected" : ""}>停用</option></select></td>
                  <td><button class="danger" onclick="App.deleteFurniture(${index})">删除</button></td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="empty">暂无展具，请新增</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="hint">企业端会看到已启用的展具；展具增租仍只做选择和审核，不进入应收统计。</p>
      </section>
    `;
  }

  function imageSrc(value) {
    if (!value) return "";
    const raw = String(value);
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
    return fileUrl(raw);
  }

  function furnitureThumbHtml(item) {
    const src = imageSrc(item.image);
    if (!src) return `<span class="furniture-thumb placeholder">无图</span>`;
    return `<img class="furniture-thumb" src="${h(src)}" alt="${h(item.name || "展具缩略图")}">`;
  }

  function boothPickerModal() {
    const keyword = state.boothPickerSearch.trim().toLowerCase();
    const booths = state.data.booths.filter((booth) => !keyword || String(booth.boothNo).toLowerCase().includes(keyword));
    const selectedBooths = state.pendingBoothIds.map((id) => state.data.booths.find((item) => item.id === id)).filter(Boolean);
    return `
      <div class="modal-backdrop">
        <section class="modal large">
          <header class="modal-header">
            <h2>选择展位</h2>
            <button class="secondary" onclick="App.closeBoothPicker()">关闭</button>
          </header>
          <div class="toolbar">
            <div class="search-control">
              <label>展位号搜索<input id="booth-search" value="${h(state.boothPickerSearch)}" oninput="App.setBoothSearch(this.value)" placeholder="输入展位号"></label>
              <button class="secondary" onclick="App.searchBoothPicker()">搜索</button>
            </div>
            ${mapZoomToolbar()}
            <div class="notice">${boothSelectionAmountText(selectedBooths)}</div>
          </div>
          <div id="booth-picker-map" class="modal-map">
            ${pickerMapSvg(booths)}
          </div>
          <div class="compact-list">
            ${selectedBooths.map((booth) => `<div class="compact-item"><strong>${h(booth.boothNo)}</strong><div class="hint">${h(booth.hall || "-")} · ${h(booth.zone)} · ${attrText(booth.attr)} · ${booth.widthM}m x ${booth.depthM}m · ${money(booth.price)}</div></div>`).join("") || `<div class="empty">点击绿色空闲展位进行选择</div>`}
          </div>
          <div class="split-actions">
            <button onclick="App.confirmBoothPicker()">${state.customerAttendLeadId ? "确定展位并创建订单" : "确定展位"}</button>
            <button class="secondary" onclick="App.clearPickerSelection()">清空选择</button>
          </div>
        </section>
      </div>
    `;
  }

  function pickerMapSvg(booths) {
    const map = state.data.map;
    const bg = map.backgroundAttachmentId ? `<image href="${fileUrl(map.backgroundAttachmentId)}" x="0" y="0" width="${map.width}" height="${map.height}" preserveAspectRatio="xMidYMid meet"></image>` : `<rect x="0" y="0" width="${map.width}" height="${map.height}" fill="#eef3f9"></rect>`;
    const zoom = effectiveMapZoom();
    const displayWidth = Math.round(map.width * zoom);
    const displayHeight = Math.round(map.height * zoom);
    const boothIds = new Set(booths.map((booth) => booth.id));
    const items = state.data.booths.map((booth) => {
      if (!boothIds.has(booth.id)) return "";
      const selected = state.pendingBoothIds.includes(booth.id);
      const focused = state.boothPickerFocusId === booth.id;
      const selectable = booth.status === "available";
      const textVisible = booth.width >= 32 && booth.height >= 22;
      return `
        <g data-booth-id="${booth.id}" onclick="App.pickerBoothClick(event, ${booth.id})">
          <rect class="booth-rect ${h(booth.status)} ${selected ? "selected" : ""} ${focused ? "focused" : ""} ${selectable ? "" : "unselectable"}" x="${booth.x}" y="${booth.y}" width="${booth.width}" height="${booth.height}" rx="2"></rect>
          ${textVisible ? `<text class="booth-text" x="${booth.x + booth.width / 2}" y="${booth.y + booth.height / 2}">${h(booth.boothNo)}</text>` : ""}
        </g>
      `;
    }).join("");
    return `
      <svg class="booth-svg" style="width:${displayWidth}px;height:${displayHeight}px" viewBox="0 0 ${map.width} ${map.height}">
        ${bg}
        <text x="28" y="34" fill="#536176" font-size="18">展位图 · ${booths.length} 个匹配展位</text>
        ${items}
        ${obstacleSvgElements(false)}
      </svg>
    `;
  }

  function orderLead(order) {
    return state.data.customerLeads.find((item) => Number(item.companyId) === Number(order.companyId) && String(item.eventId) === String(order.eventId));
  }

  function canUploadPaymentForOrder(order) {
    if (state.data.me.role === "enterprise" || !isActiveOrder(order)) return false;
    if (orderFullyPaid(order)) return false;
    if (hasPendingOrderPayment(order)) return false;
    const lead = orderLead(order);
    if (leadFileStatus(lead, "voucher") === "pending") return false;
    return !lead || leadCanUploadVoucher(lead);
  }

  function orderFullyPaid(order) {
    return Number(order.totalAmount || 0) > 0 && Number(order.paidApprovedAmount || 0) >= Number(order.totalAmount || 0);
  }

  function orderPartialPaidText(order) {
    const paid = Number(order.paidApprovedAmount || 0);
    const total = Number(order.totalAmount || 0);
    if (paid <= 0 || total <= 0 || paid >= total) return "";
    return `已到款 ${percentText(paid, total)}`;
  }

  function hasPendingOrderPayment(order) {
    return state.data.payments.some((payment) => payment.orderId === order.id && payment.status === "pending");
  }

  function hasActiveOrderPayment(order) {
    return state.data.payments.some((payment) => payment.orderId === order.id && payment.status !== "rejected");
  }

  function workflowBadge(text, tone = "pending") {
    return `<span class="status ${h(tone)}">${h(text)}</span>`;
  }

  function deadlineCountdownHtml(dateLabel, countdownLabel, value) {
    if (!value) return "";
    return `
      <div class="hint">${h(dateLabel)} ${date(value)}</div>
      <div class="countdown-cell">${h(countdownLabel)} <strong data-countdown="${h(value)}">${h(countdownText(value))}</strong></div>
    `;
  }

  function workflowWithCountdown(text, tone, dateLabel, countdownLabel, value) {
    return `
      ${workflowBadge(text, tone)}
      ${deadlineCountdownHtml(dateLabel, countdownLabel, value)}
    `;
  }

  function orderReserveCountdown(order) {
    const lead = orderLead(order);
    const contractStatus = leadFileStatus(lead, "contract");
    const voucherStatus = leadFileStatus(lead, "voucher");
    const pendingPayment = hasPendingOrderPayment(order);
    const activePayment = hasActiveOrderPayment(order);
    const voucherDueAt = lead?.voucherDueAt || "";
    const paymentDueAt = voucherDueAt || order.reserveExpiresAt;
    const paymentDateLabel = voucherDueAt ? "水单期限" : "预留到期";
    const paymentCountdownLabel = voucherDueAt ? "水单倒计时" : "预留倒计时";
    const partialPaidText = orderPartialPaidText(order);

    if (orderFullyPaid(order)) return workflowBadge("已全款", "sold");
    if (orderSpecialApproved(order)) return workflowBadge(partialPaidText ? `特殊成交 · ${partialPaidText}` : "特殊成交 · 未到款", "sold");
    if (order.status === "sold") return workflowBadge(partialPaidText || "已首款成交", "sold");
    if (salesFlowMode() === "contract_first") {
      if (contractStatus === "pending") {
        return workflowWithCountdown("合同审批中", "pending", "预留到期", "预留倒计时", order.reserveExpiresAt);
      }
      if (contractStatus !== "approved") {
        return workflowWithCountdown("未上传合同", "reserved", "预留到期", "预留倒计时", order.reserveExpiresAt);
      }
      if (voucherStatus === "pending" || pendingPayment) {
        return workflowWithCountdown("水单审核中", "pending", paymentDateLabel, paymentCountdownLabel, paymentDueAt);
      }
      if (voucherStatus !== "approved" && !activePayment) {
        return workflowWithCountdown("未上传水单", "reserved", paymentDateLabel, paymentCountdownLabel, paymentDueAt);
      }
    } else {
      if (voucherStatus === "pending" || pendingPayment) {
        return workflowWithCountdown("水单审核中", "pending", "预留到期", "预留倒计时", order.reserveExpiresAt);
      }
      if (voucherStatus !== "approved" && !activePayment) {
        return workflowWithCountdown("未上传水单", "reserved", "预留到期", "预留倒计时", order.reserveExpiresAt);
      }
    }
    if (partialPaidText) return workflowWithCountdown(partialPaidText, "sold", paymentDateLabel, paymentCountdownLabel, paymentDueAt);
    if (!["reserved", "pending_payment_review"].includes(order.status)) return statusBadge(order.status);
    return `
      ${statusBadge(order.status)}
      ${deadlineCountdownHtml("预留到期", "预留倒计时", order.reserveExpiresAt)}
    `;
  }

  function orderActionButtons(order) {
    const canOperate = state.data.me.role !== "enterprise" && isActiveOrder(order);
    const canIssue = canOperate && order.type === "booth" && order.status === "sold";
    return `
      <div class="action-buttons">
        ${orderPrimaryUploadAction(order, canOperate)}
        ${specialOrderActionButton(order, canOperate)}
        ${canOperate && order.type === "booth" ? `<button class="tiny secondary" onclick="App.openChangeBoothPicker(${order.id})">更换展位</button>` : ""}
        ${canOperate && order.type === "booth" ? `<button class="tiny danger" onclick="App.requestCancelOrder(${order.id})">退订展位</button>` : ""}
        ${canIssue ? `<button class="tiny secondary" onclick="App.issueEnterpriseAccount(${order.id})">企业账号</button>` : ""}
        ${canIssue ? `<button class="tiny secondary" onclick="App.issueEnterpriseLink(${order.id})">免登录链接</button>` : ""}
      </div>
      ${pendingChangeSummary(order.id)}
    `;
  }

  function orderPrimaryUploadAction(order, canOperate) {
    if (!canOperate || orderFullyPaid(order)) return "";
    const lead = orderLead(order);
    if (salesFlowMode() === "contract_first") {
      const contractStatus = leadFileStatus(lead, "contract");
      if (contractStatus !== "approved") {
        if (contractStatus === "pending") return `<button class="tiny secondary" disabled title="合同审批中">合同审批中</button>`;
        if (!lead) return `<button class="tiny secondary" disabled title="未找到客户保护记录">上传合同</button>`;
        const inputId = `order-lead-contract-${lead.id}-${order.id}`;
        return `<label class="tiny secondary file-upload-button">上传合同<input id="${inputId}" type="file" accept="${contractVoucherAccept}" onchange="App.uploadLeadAttachment(${lead.id}, 'contract', '${inputId}')"></label>`;
      }
    }
    const canUploadPayment = canUploadPaymentForOrder(order);
    const paymentBlockReason = canUploadPayment ? "" : uploadPaymentBlockReason(order);
    return `<button class="tiny" ${canUploadPayment ? `onclick="App.openPaymentModal(${order.id})"` : `disabled title="${h(paymentBlockReason)}"`}>上传水单</button>`;
  }

  function pendingSpecialOrderRequest(orderId) {
    return (state.data.changeRequests || []).find((request) => (
      Number(request.orderId) === Number(orderId)
      && request.status === "pending"
      && request.changeData?.action === "special_order"
    ));
  }

  function canRequestSpecialOrder(order, canOperate = true) {
    return Boolean(
      canOperate
      && state.data.me.role === "sales"
      && order
      && isActiveOrder(order)
      && order.status !== "sold"
      && !orderSpecialApproved(order)
      && !orderFullyPaid(order)
      && Number(order.totalAmount || 0) > 0
      && !pendingSpecialOrderRequest(order.id)
    );
  }

  function specialOrderActionButton(order, canOperate) {
    if (pendingSpecialOrderRequest(order.id)) return `<button class="tiny secondary" disabled title="特殊订单申请审核中">特殊审核中</button>`;
    if (!canRequestSpecialOrder(order, canOperate)) return "";
    return `<button class="tiny secondary" onclick="App.requestSpecialOrder(${order.id})">特殊订单</button>`;
  }

  function uploadPaymentBlockReason(order) {
    const lead = orderLead(order);
    const contractStatus = leadFileStatus(lead, "contract");
    const voucherStatus = leadFileStatus(lead, "voucher");
    if (hasPendingOrderPayment(order) || voucherStatus === "pending") return "水单正在审核中";
    if (salesFlowMode() === "contract_first") {
      if (contractStatus === "pending") return "合同审批中，审核通过后才能上传水单";
      if (contractStatus !== "approved") return "请先上传合同并等待审核通过";
      if (!leadCanUploadVoucher(lead)) return "水单上传期限已过";
    }
    return "当前订单暂不能上传水单";
  }

  function paymentSummary(orderId) {
    const payments = state.data.payments.filter((item) => item.orderId === orderId);
    if (!payments.length) return "暂无水单";
    return payments.map((item) => `${money(item.amount)} ${statusText(item.status)}`).join(" / ");
  }

  function pendingChangeSummary(orderId) {
    const changes = state.data.changeRequests.filter((item) => item.orderId === orderId && item.status === "pending");
    if (!changes.length) return "";
    return `<div class="hint">待审核变更：${h(changes.map((item) => item.type).join(" / "))}</div>`;
  }

  function paymentModal() {
    const order = state.data.orders.find((item) => item.id === state.paymentModalOrderId);
    if (!order) return "";
    return `
      <div class="modal-backdrop">
        <section class="modal small">
          <header class="modal-header">
            <h2>上传水单</h2>
            <button class="secondary" onclick="App.closePaymentModal()">关闭</button>
          </header>
          <div class="notice">${h(order.orderNo)} · ${h(getCompany(order.companyId).name || "")} · 当前已收 ${money(order.paidApprovedAmount)}</div>
          <div class="grid two" style="margin-top:14px">
            <label>收款金额<input id="payment-amount" type="number" min="1" placeholder="请输入本次收款金额"></label>
            <label>水单文件<input id="payment-file" type="file" accept="image/*,.pdf"></label>
          </div>
          <div class="split-actions" style="margin-top:14px">
            <button onclick="App.submitPayment(${order.id})">提交管理员审核</button>
            ${specialOrderActionButton(order, state.data.me.role === "sales" && isActiveOrder(order))}
            <button class="secondary" onclick="App.closePaymentModal()">取消</button>
          </div>
        </section>
      </div>
    `;
  }

  function changeBoothModal() {
    const order = state.data.orders.find((item) => item.id === state.changePickerOrderId);
    if (!order) return "";
    const booths = state.data.booths;
    const availableCount = booths.filter((booth) => booth.status === "available").length;
    const selectedBooths = state.changePickerBoothIds.map((id) => state.data.booths.find((item) => item.id === id)).filter(Boolean);
    return `
      <div class="modal-backdrop">
        <section class="modal large">
          <header class="modal-header">
            <h2>更换展位</h2>
            <button class="secondary" onclick="App.closeChangeBoothPicker()">关闭</button>
          </header>
          <div class="toolbar">
            <div class="search-control">
              <label>展位号搜索<input id="change-booth-search" value="${h(state.changePickerSearch)}" oninput="App.setChangeBoothSearch(this.value)" placeholder="输入展位号"></label>
              <button class="secondary" onclick="App.searchChangeBooth()">搜索</button>
            </div>
            ${mapZoomToolbar()}
            <div class="notice">原展位：${h(orderBoothNos(order) || "-")}；新展位：${selectedBooths.map((booth) => h(booth.boothNo)).join(" / ") || "未选择"}；空闲 ${availableCount} 个；${boothSelectionAmountText(selectedBooths, order.discountRuleId)}</div>
          </div>
          <div id="change-booth-map" class="modal-map">
            ${changePickerMapSvg(booths)}
          </div>
          <div class="compact-list">
            ${selectedBooths.map((booth) => `<div class="compact-item"><strong>${h(booth.boothNo)}</strong><div class="hint">${h(booth.hall || "-")} · ${h(booth.zone)} · ${attrText(booth.attr)} · ${booth.widthM}m x ${booth.depthM}m · ${money(booth.price)}</div></div>`).join("") || `<div class="empty">点击绿色空闲展位，提交后进入订单变更审核</div>`}
          </div>
          <div class="split-actions">
            <button onclick="App.submitChangeBooth()">提交更换申请</button>
            <button class="secondary" onclick="App.closeChangeBoothPicker()">取消</button>
          </div>
        </section>
      </div>
    `;
  }

  function changePickerMapSvg(booths) {
    const map = state.data.map;
    const bg = map.backgroundAttachmentId ? `<image href="${fileUrl(map.backgroundAttachmentId)}" x="0" y="0" width="${map.width}" height="${map.height}" preserveAspectRatio="xMidYMid meet"></image>` : `<rect x="0" y="0" width="${map.width}" height="${map.height}" fill="#eef3f9"></rect>`;
    const zoom = effectiveMapZoom();
    const displayWidth = Math.round(map.width * zoom);
    const displayHeight = Math.round(map.height * zoom);
    const boothIds = new Set(booths.map((booth) => booth.id));
    const items = state.data.booths.map((booth) => {
      if (!boothIds.has(booth.id)) return "";
      const selected = state.changePickerBoothIds.includes(booth.id);
      const focused = state.changePickerFocusId === booth.id;
      const selectable = booth.status === "available";
      const textVisible = booth.width >= 32 && booth.height >= 22;
      return `
        <g data-booth-id="${booth.id}" onclick="App.changeBoothClick(event, ${booth.id})">
          <rect class="booth-rect ${h(booth.status)} ${selected ? "selected" : ""} ${focused ? "focused" : ""} ${selectable ? "" : "unselectable"}" x="${booth.x}" y="${booth.y}" width="${booth.width}" height="${booth.height}" rx="2"></rect>
          ${textVisible ? `<text class="booth-text" x="${booth.x + booth.width / 2}" y="${booth.y + booth.height / 2}">${h(booth.boothNo)}</text>` : ""}
        </g>
      `;
    }).join("");
    return `
      <svg class="booth-svg" style="width:${displayWidth}px;height:${displayHeight}px" viewBox="0 0 ${map.width} ${map.height}">
        ${bg}
        <text x="28" y="34" fill="#536176" font-size="18">更换展位图 · 绿色可选，其它状态不可选</text>
        ${items}
        ${obstacleSvgElements(false)}
      </svg>
    `;
  }

  function viewApprovals() {
    const allHistoryRows = approvalHistoryRows();
    const historyRows = filterApprovalHistoryRows(allHistoryRows);
    const sections = [
      {
        key: "customerContracts",
        label: "客户合同审核",
        rows: state.data.customerLeads.filter((lead) => lead.contractReviewStatus === "pending" && (lead.contractAttachmentIds || []).length),
        renderRow: (lead) => customerFileApprovalRow(lead, "contract"),
        empty: "暂无待审核客户合同"
      },
      {
        key: "customerVouchers",
        label: "客户水单审核",
        rows: state.data.customerLeads.filter((lead) => lead.voucherReviewStatus === "pending" && (lead.voucherAttachmentIds || []).length),
        renderRow: (lead) => customerFileApprovalRow(lead, "voucher"),
        empty: "暂无待审核客户水单"
      },
      {
        key: "payments",
        label: "销售订单水单审核",
        rows: state.data.payments.filter((item) => item.status === "pending"),
        renderRow: paymentApprovalRow,
        empty: "暂无待审核水单"
      },
      {
        key: "fascia",
        label: "楣板审核",
        rows: state.data.profiles.filter((profile) => profile.fascia.status === "pending"),
        renderRow: fasciaApprovalRow,
        empty: "暂无楣板修改申请"
      },
      {
        key: "rentals",
        label: "展具增租审核",
        rows: state.data.profiles.flatMap((profile) => profile.rentals.filter((rental) => rental.status === "pending").map((rental) => ({ profile, rental }))),
        renderRow: rentalApprovalRow,
        empty: "暂无展具增租申请"
      },
      {
        key: "changes",
        label: "订单变更审核",
        rows: state.data.changeRequests.filter((item) => item.status === "pending"),
        renderRow: changeApprovalRow,
        empty: "暂无订单变更申请"
      },
      {
        key: "history",
        label: "已审核历史",
        rows: historyRows,
        renderRow: approvalHistoryRow,
        empty: "暂无已审核记录"
      }
    ];
    const active = sections.find((item) => item.key === state.approvalTab) || sections[0];
    return `
      <section class="section">
        <div class="subnav">
          ${sections.map((item) => `
            <button class="${state.approvalTab === item.key ? "active" : ""}" onclick="App.setApprovalTab('${item.key}')">
              ${h(item.label)}<span>${item.rows.length}</span>
            </button>
          `).join("")}
        </div>
      </section>
      ${approvalSection(active.label, active.rows, active.renderRow, active.empty, active.key === "history" ? approvalHistoryFiltersHtml(allHistoryRows) : "")}
    `;
  }

  function approvalSection(label, rows, renderRow, empty, extra = "") {
    return `
      <section class="section">
        <h2>${h(label)}</h2>
        ${extra}
        <div class="table-wrap">
          <table>
            <tbody>${rows.map(renderRow).join("") || `<tr><td class="empty">${h(empty)}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function approvalHistoryRows() {
    const rows = [];
    (state.data.customerLeads || []).forEach((lead) => {
      const company = getCompany(lead.companyId);
      const owner = getUser(lead.ownerSalesId);
      if (isFinalReviewStatus(lead.contractReviewStatus)) {
        rows.push({
          at: lead.contractReviewedAt || lead.updatedAt || lead.createdAt,
          flow: "客户合同审核",
          target: company.name || "-",
          submitter: owner.displayName || owner.username || "-",
          result: lead.contractReviewStatus,
          reviewer: getUser(lead.contractReviewedBy).displayName || "-",
          remark: lead.contractReviewRemark || ""
        });
      }
      if (isFinalReviewStatus(lead.voucherReviewStatus)) {
        rows.push({
          at: lead.voucherReviewedAt || lead.updatedAt || lead.createdAt,
          flow: "客户水单审核",
          target: company.name || "-",
          submitter: owner.displayName || owner.username || "-",
          result: lead.voucherReviewStatus,
          reviewer: getUser(lead.voucherReviewedBy).displayName || "-",
          remark: lead.voucherReviewRemark || ""
        });
      }
    });
    (state.data.payments || []).filter((payment) => isFinalReviewStatus(payment.status)).forEach((payment) => {
      const order = state.data.orders.find((item) => item.id === payment.orderId) || {};
      const company = getCompany(order.companyId);
      rows.push({
        at: payment.reviewedAt || payment.createdAt,
        flow: "销售订单水单审核",
        target: `${order.orderNo || "-"} · ${company.name || "-"}`,
        submitter: getUser(order.salespersonId).displayName || "-",
        result: payment.status,
        reviewer: getUser(payment.reviewedBy).displayName || "-",
        remark: `${money(payment.amount)} ${payment.reviewRemark || ""}`.trim()
      });
    });
    (state.data.profiles || []).forEach((profile) => {
      const order = state.data.orders.find((item) => item.id === profile.orderId) || {};
      const company = getCompany(profile.companyId);
      if (isFinalReviewStatus(profile.fascia?.status)) {
        rows.push({
          at: profile.fascia.reviewedAt || profile.updatedAt,
          flow: "楣板审核",
          target: `${company.name || "-"} · ${profile.fascia.requestedName || "-"}`,
          submitter: getUser(order.salespersonId).displayName || "-",
          result: profile.fascia.status,
          reviewer: getUser(profile.fascia.reviewedBy).displayName || "-",
          remark: profile.fascia.reviewRemark || ""
        });
      }
      (profile.rentals || []).filter((rental) => isFinalReviewStatus(rental.status)).forEach((rental) => {
        rows.push({
          at: rental.reviewedAt || profile.updatedAt || rental.createdAt,
          flow: "展具增租审核",
          target: `${company.name || "-"} · ${rental.furnitureName} x ${rental.qty}`,
          submitter: getUser(order.salespersonId).displayName || "-",
          result: rental.status,
          reviewer: getUser(rental.reviewedBy).displayName || "-",
          remark: rental.reviewRemark || ""
        });
      });
    });
    (state.data.changeRequests || []).filter((request) => isFinalReviewStatus(request.status)).forEach((request) => {
      const order = state.data.orders.find((item) => item.id === request.orderId) || {};
      rows.push({
        at: request.reviewedAt || request.createdAt,
        flow: "订单变更审核",
        target: `${order.orderNo || "-"} · ${request.type || "-"}`,
        submitter: getUser(request.createdBy).displayName || "-",
        result: request.status,
        reviewer: getUser(request.reviewedBy).displayName || "-",
        remark: request.reviewRemark || request.appliedDetail || request.detail || ""
      });
    });
    return rows.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }

  function filterApprovalHistoryRows(rows) {
    const filters = state.approvalHistoryFilter || {};
    const keyword = String(filters.keyword || "").trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.flow && row.flow !== filters.flow) return false;
      if (filters.result && row.result !== filters.result) return false;
      if (keyword) {
        const haystack = [row.flow, row.target, row.submitter, row.reviewer, row.remark, statusText(row.result)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  function approvalHistoryFiltersHtml(rows) {
    const filters = state.approvalHistoryFilter || {};
    const flows = [...new Set(rows.map((row) => row.flow).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return `
      <div class="filter-bar">
        <label>流程<select onchange="App.setApprovalHistoryFilter('flow', this.value)">
          <option value="">全部流程</option>
          ${flows.map((flow) => `<option value="${h(flow)}" ${filters.flow === flow ? "selected" : ""}>${h(flow)}</option>`).join("")}
        </select></label>
        <label>结果<select onchange="App.setApprovalHistoryFilter('result', this.value)">
          <option value="">全部结果</option>
          <option value="approved" ${filters.result === "approved" ? "selected" : ""}>已通过</option>
          <option value="rejected" ${filters.result === "rejected" ? "selected" : ""}>已驳回</option>
        </select></label>
        <label>关键词<input value="${h(filters.keyword || "")}" placeholder="企业/订单/审核人/备注" oninput="App.setApprovalHistoryFilter('keyword', this.value)"></label>
      </div>
    `;
  }

  function approvalHistoryRow(row) {
    return `
      <tr>
        <td><strong>${h(row.flow)}</strong><div class="hint">${date(row.at)}</div></td>
        <td>${h(row.target)}<div class="hint">提交人：${h(row.submitter || "-")}</div></td>
        <td>${statusBadge(row.result)}</td>
        <td>${h(row.reviewer || "-")}</td>
        <td>${h(row.remark || "-")}</td>
      </tr>
    `;
  }

  function paymentApprovalRow(payment) {
    const order = state.data.orders.find((item) => item.id === payment.orderId) || {};
    const company = getCompany(order.companyId);
    const link = payment.voucherAttachmentId ? attachmentPreviewButton(payment.voucherAttachmentId, "预览水单") : "无附件";
    return `
      <tr>
        <td><strong>${h(order.orderNo)}</strong><div class="hint">${h(company.name)}</div></td>
        <td>${money(payment.amount)}<div class="hint">${h(payment.payer)} · ${h(payment.paidAt)}</div></td>
        <td>${link}</td>
        <td class="split-actions">
          <button class="success" onclick="App.reviewPayment(${payment.id}, 'approved')">通过</button>
          <button class="danger" onclick="App.reviewPayment(${payment.id}, 'rejected')">驳回</button>
        </td>
      </tr>
    `;
  }

  function customerFileApprovalRow(lead, type) {
    const company = getCompany(lead.companyId);
    const owner = getUser(lead.ownerSalesId);
    const attachment = leadLatestAttachment(lead, type);
    const label = type === "contract" ? "合同" : "水单";
    const link = attachment ? attachmentPreviewButton(attachment.id, `预览${label}`) : "无附件";
    const flowHint = type === "voucher" && salesFlowMode() === "contract_first"
      ? `<div class="hint">合同状态：${h(statusText(leadFileStatus(lead, "contract")))}</div>`
      : "";
    return `
      <tr>
        <td><strong>${h(company.name || "-")}</strong><div class="hint">${h(owner.displayName || "-")}</div></td>
        <td>${link}<div class="hint">${h(attachment?.fileName || "")}</div>${flowHint}</td>
        <td class="split-actions">
          <button class="success" onclick="App.reviewCustomerFile(${lead.id}, '${type}', 'approved')">通过</button>
          <button class="danger" onclick="App.reviewCustomerFile(${lead.id}, '${type}', 'rejected')">驳回</button>
        </td>
      </tr>
    `;
  }

  function fasciaApprovalRow(profile) {
    const order = state.data.orders.find((item) => item.id === profile.orderId) || {};
    const company = getCompany(profile.companyId);
    return `
      <tr>
        <td><strong>${h(company.name)}</strong><div class="hint">${h(order.orderNo)}</div></td>
        <td>默认：${h(profile.fascia.defaultName)}<div class="hint">申请：${h(profile.fascia.requestedName)}</div></td>
        <td class="split-actions">
          <button class="success" onclick="App.reviewFascia(${profile.id}, 'approved')">通过</button>
          <button class="danger" onclick="App.reviewFascia(${profile.id}, 'rejected')">驳回</button>
        </td>
      </tr>
    `;
  }

  function rentalApprovalRow(row) {
    const order = state.data.orders.find((item) => item.id === row.profile.orderId) || {};
    const company = getCompany(row.profile.companyId);
    return `
      <tr>
        <td><strong>${h(company.name)}</strong><div class="hint">${h(order.orderNo)}</div></td>
        <td>${h(row.rental.furnitureName)} x ${row.rental.qty}</td>
        <td class="split-actions">
          <button class="success" onclick="App.reviewRental(${row.profile.id}, '${row.rental.id}', 'approved')">通过</button>
          <button class="danger" onclick="App.reviewRental(${row.profile.id}, '${row.rental.id}', 'rejected')">驳回</button>
        </td>
      </tr>
    `;
  }

  function changeApprovalRow(request) {
    const order = state.data.orders.find((item) => item.id === request.orderId) || {};
    const creator = getUser(request.createdBy);
    const data = request.changeData || {};
    const targetBooths = (data.boothIds || []).map((id) => state.data.booths.find((booth) => booth.id === id)).filter(Boolean);
    return `
      <tr>
        <td><strong>${h(order.orderNo)}</strong><div class="hint">${h(request.type)} · ${h(creator.displayName || "")}</div></td>
        <td>${h(request.detail)}${targetBooths.length ? `<div class="hint">目标展位：${h(targetBooths.map((booth) => booth.boothNo).join(" / "))}</div>` : ""}</td>
        <td class="split-actions">
          <button class="success" onclick="App.reviewChange(${request.id}, 'approved')">通过</button>
          <button class="danger" onclick="App.reviewChange(${request.id}, 'rejected')">驳回</button>
        </td>
      </tr>
    `;
  }

  function viewExhibitorList() {
    const allRows = state.data.orders
      .filter((order) => order.type === "booth" && isActiveOrder(order))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rows = filterOrdersByDrill(allRows, state.exhibitorFilter);
    const filterLabel = exhibitorFilterLabel(state.exhibitorFilter);
    return `
      <section class="section">
        <div class="section-title-row">
          <h2>参展企业列表</h2>
          <div class="event-role-actions">
            ${filterLabel ? `<span class="count-pill">筛选：${h(filterLabel)}</span>` : ""}
            <span class="count-pill">${rows.length} 家参展企业</span>
          </div>
        </div>
        ${exhibitorAdvancedFilterBar(state.exhibitorFilter, rows.length)}
        <div class="table-wrap">
          <table>
            <thead><tr><th>企业名称</th><th>企业简称</th><th>展位</th><th>面积</th><th>业务员</th><th>已收款</th><th>预留展位倒计时</th><th>展务资料</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.map((order) => {
                const company = getCompany(order.companyId);
                const sales = getUser(order.salespersonId);
                const profile = state.data.profiles.find((item) => item.orderId === order.id);
                const area = (order.boothSnapshot || []).reduce((sum, booth) => sum + Number(booth.area || 0), 0);
                const catalogReady = profile?.catalog?.companyIntro || profile?.catalog?.productIntro ? "已填" : "未填";
                return `
                  <tr>
                    <td>${companyNameCell(company)}</td>
                    <td>${h(companyShortNameText(company))}</td>
                    <td>${h(orderBoothNos(order) || "-")}</td>
                    <td>${Number(area.toFixed(2))}㎡</td>
                    <td>${h(sales.displayName || "-")}</td>
                    <td>${money(order.paidApprovedAmount || 0)}</td>
                    <td>${orderReserveCountdown(order)}</td>
                    <td>
                      <span class="hint">会刊：${catalogReady}</span>
                      <div class="hint">参展证：${profile ? profile.badges.length : 0} 人 · 展具：${profile ? profile.rentals.length : 0} 项</div>
                    </td>
                    <td>${orderActionButtons(order)}</td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="9" class="empty">暂无参展企业</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function viewExhibitorOps() {
    const soldBoothOrders = state.data.orders.filter((order) => order.type === "booth" && order.status === "sold");
    return `
      <section class="section">
        <h2>企业展务汇总</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>订单</th><th>企业</th><th>账号</th><th>会刊</th><th>参展证</th><th>楣板</th><th>展具</th><th>操作</th></tr></thead>
            <tbody>
              ${soldBoothOrders.map((order) => {
                const company = getCompany(order.companyId);
                const profile = state.data.profiles.find((item) => item.orderId === order.id);
                const user = state.data.users.find((item) => item.id === order.enterpriseUserId);
                return `
                  <tr>
                    <td><strong>${h(order.orderNo)}</strong><div class="hint">${h(orderBoothNos(order))}</div></td>
                    <td>${h(company.name)}</td>
                    <td>${user ? h(user.username) : "未生成"}</td>
                    <td>${profile?.catalog.companyIntro ? "已填" : "未填"}</td>
                    <td>${profile ? profile.badges.length : 0} 人</td>
                    <td>${profile ? statusBadge(profile.fascia.status) : "-"}</td>
                    <td>${profile ? profile.rentals.length : 0} 项</td>
                    <td>
                      <div class="action-buttons">
                        ${!user ? `<button onclick="App.issueEnterpriseAccount(${order.id})">生成账号</button>` : `<button class="secondary" onclick="App.issueEnterpriseAccount(${order.id})">重置密码</button>`}
                        <button class="secondary" onclick="App.issueEnterpriseLink(${order.id})">免登录链接</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="8" class="empty">暂无首款成交展位订单</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function selfPasswordSection() {
    return `
      <section class="section">
        <h2>修改我的密码</h2>
        <div class="grid three">
          <label>${requiredLabel("原密码")}<input id="self-current-password" type="password" autocomplete="current-password"></label>
          <label>${requiredLabel("新密码")}<input id="self-new-password" type="password" autocomplete="new-password"></label>
          <label>${requiredLabel("确认新密码")}<input id="self-confirm-password" type="password" autocomplete="new-password"></label>
        </div>
        <div class="split-actions" style="margin-top:14px"><button onclick="App.changeMyPassword()">保存新密码</button></div>
      </section>
    `;
  }

  function viewAccounts() {
    const users = state.data.users.slice().sort((a, b) => a.id - b.id);
    const departments = departmentList();
    if (!isSuperAdminRole(state.data.me.role)) return selfPasswordSection();
    return `
      ${selfPasswordSection()}
      <section class="section">
        <div class="section-title-row">
          <h2>部门管理</h2>
          <span class="count-pill">${departments.length} 个部门</span>
        </div>
        <div class="grid two compact-grid">
          <label>${requiredLabel("新增部门")}<input id="new-department-name" placeholder="例如 华南销售部" required></label>
          <div class="field-actions"><button onclick="App.addDepartment()">新增部门</button></div>
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>ID</th><th>部门名称</th><th>成员数</th><th>操作</th></tr></thead>
            <tbody>
              ${departments.map((department) => {
                const memberCount = users.filter((user) => Number(user.departmentId || 0) === Number(department.id)).length;
                return `
                  <tr>
                    <td>${department.id}</td>
                    <td><input id="department-name-${department.id}" value="${h(department.name)}"></td>
                    <td>${memberCount}</td>
                    <td>
                      <button class="tiny secondary" onclick="App.updateDepartment(${department.id})">保存</button>
                      <button class="tiny danger" onclick="App.deleteDepartment(${department.id})">删除</button>
                    </td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="4" class="empty">暂无部门</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <section class="section">
        <h2>创建业务员账号</h2>
        <div class="grid four">
          <label>${requiredLabel("姓名")}<input id="new-display" required></label>
          <label>${requiredLabel("账号")}<input id="new-username" required></label>
          <label>${requiredLabel("密码")}<input id="new-password" type="password" value="sales123" required></label>
          <label>${requiredLabel("角色")}<select id="new-role" required><option value="sales">业务员</option><option value="manager">管理员</option><option value="admin">超级管理员</option></select></label>
          <label>${requiredLabel("归属部门")}<select id="new-department" required>${departmentOptions()}</select></label>
        </div>
        <div class="split-actions" style="margin-top:14px"><button onclick="App.createUser()">创建账号</button></div>
      </section>
      <section class="section">
        <h2>账号列表</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>姓名</th><th>账号</th><th>角色</th><th>部门</th><th>状态</th><th>最后登录</th><th>操作</th></tr></thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  <td>${user.id}</td>
                  <td>${h(user.displayName)}</td>
                  <td>${h(user.username)}</td>
                  <td>${roleText(user.role)}</td>
                  <td>${["manager", "sales"].includes(user.role) ? `<select onchange="App.assignUserDepartment(${user.id}, this.value)">${departmentOptions(user.departmentId)}</select>` : "-"}</td>
                  <td>${user.active ? "启用" : "停用"}</td>
                  <td>${date(user.lastLoginAt)}</td>
                  <td>
                    ${userOrderCount(user.id) === 0 && Number(user.id) !== Number(state.data.me.id)
                      ? `<button class="tiny danger" onclick="App.deleteUser(${user.id})">删除</button>`
                      : `<span class="hint">${Number(user.id) === Number(state.data.me.id) ? "当前账号" : `${userOrderCount(user.id)} 个订单`}</span>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="section">
        <h2>操作日志</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>详情</th></tr></thead>
            <tbody>
              ${(state.data.logs || []).slice(0, 120).map((log) => `
                <tr><td>${date(log.at)}</td><td>${h(log.userName)}</td><td>${h(log.action)}</td><td>${h(log.detail)}</td></tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function viewExports() {
    return `
      <section class="section">
        <h2>导出汇总</h2>
        <div class="grid three">
          <button onclick="App.downloadExport('/api/export/orders', 'orders.csv')">导出订单 Excel/CSV</button>
          <button onclick="App.downloadExport('/api/export/exhibitor', 'exhibitor.csv')">导出企业展务 CSV</button>
          <button onclick="App.downloadExport('/api/export/attachments', 'attachments.csv')">导出附件清单</button>
        </div>
        <p class="hint">无外部依赖版本先提供 CSV 和附件下载清单。生产版可替换为真正的 XLSX 与附件 ZIP 包。</p>
      </section>
    `;
  }

  function viewEnterprise() {
    const order = state.data.orders[0];
    const company = order ? getCompany(order.companyId) : {};
    const activeFurniture = state.data.settings.furniture.filter((item) => item.active);
    const profile = state.data.profiles.find((item) => item.orderId === order?.id) || {
      catalog: {},
      badges: [],
      fascia: { defaultName: company.name || "", requestedName: "", status: "default" },
      rentals: []
    };
    return `
      <section class="section">
        <h2>企业后台</h2>
        ${order ? `<div class="notice">${h(company.name)} · ${h(order.orderNo)} · ${h(orderBoothNos(order))}</div>` : `<div class="empty">暂无可填报订单</div>`}
      </section>
      <section class="section">
        <h2>会刊信息</h2>
        <div class="grid two">
          <label>企业介绍<textarea id="catalog-company">${h(profile.catalog.companyIntro || "")}</textarea></label>
          <label>产品介绍<textarea id="catalog-product">${h(profile.catalog.productIntro || "")}</textarea></label>
        </div>
        <div class="grid two" style="margin-top:14px">
          <label>宣传视频<input id="catalog-video" type="file" accept="video/*"></label>
          <label>产品图片<input id="catalog-image" type="file" accept="image/*"></label>
        </div>
        <div class="attachment-preview-list">
          ${profile.catalog?.videoAttachmentId ? `<div class="compact-item"><strong>已上传宣传视频</strong>${attachmentPreviewButton(profile.catalog.videoAttachmentId, "预览视频")}</div>` : `<div class="hint">暂未上传宣传视频</div>`}
          ${(profile.catalog?.productImageIds || []).map((id, index) => `<div class="compact-item"><strong>产品图片 ${index + 1}</strong>${attachmentPreviewButton(id, "预览图片")}</div>`).join("")}
        </div>
        <div class="split-actions" style="margin-top:14px"><button onclick="App.saveCatalog()">保存会刊信息</button></div>
      </section>
      <section class="section">
        <h2>参展证</h2>
        <div class="grid four">
          <label>姓名<input id="badge-name"></label>
          <label>手机号<input id="badge-phone"></label>
          <label>职务<input id="badge-title"></label>
          <label>证件号<input id="badge-idno"></label>
        </div>
        <div class="split-actions" style="margin-top:14px"><button onclick="App.addBadge()">添加参展证</button></div>
        <div class="compact-list" style="margin-top:14px">
          ${profile.badges.map((badge) => `
            <div class="compact-item">
              <div class="compact-item-head">
                <strong>${h(badge.name)}</strong>
                <button class="tiny danger" onclick="App.deleteBadge('${h(badge.id)}')">删除</button>
              </div>
              <div class="hint">${h(badge.phone)} · ${h(badge.title)} · ${h(badge.idNo)}</div>
            </div>
          `).join("") || `<div class="empty">暂无参展证</div>`}
        </div>
      </section>
      <section class="section">
        <h2>楣板</h2>
        <div class="grid two">
          <label>默认楣板<input value="${h(profile.fascia.defaultName)}" disabled></label>
          <label>申请修改<input id="fascia-name" value="${h(profile.fascia.requestedName || "")}"></label>
        </div>
        <div class="split-actions" style="margin-top:14px"><button onclick="App.submitFascia()">提交楣板修改</button>${statusBadge(profile.fascia.status)}</div>
      </section>
      <section class="section">
        <h2>展具增租</h2>
        <div class="grid four">
          <label>展具<select id="rental-furniture">${activeFurniture.map((item) => `<option value="${h(item.id)}">${h(item.name)} · ${h(item.size)} · ${money(item.price)}</option>`).join("")}</select></label>
          <label>数量<input id="rental-qty" type="number" value="1"></label>
        </div>
        <div class="furniture-choice-grid">
          ${activeFurniture.map((item) => `
            <button class="furniture-choice-card" onclick="App.selectRentalFurniture('${h(item.id)}')">
              ${furnitureThumbHtml(item)}
              <strong>${h(item.name)}</strong>
              <span>${h(item.size)} · ${money(item.price)}</span>
            </button>
          `).join("")}
        </div>
        <div class="split-actions" style="margin-top:14px"><button onclick="App.submitRental()">提交增租申请</button></div>
        <div class="compact-list" style="margin-top:14px">
          ${profile.rentals.map((rental) => `
            <div class="compact-item">
              <div class="compact-item-head">
                <strong>${h(rental.furnitureName)} x ${rental.qty}</strong>
                <button class="tiny danger" onclick="App.deleteRental('${h(rental.id)}')">删除</button>
              </div>
              <div class="hint">${statusText(rental.status)} ${h(rental.reviewRemark || "")}</div>
            </div>
          `).join("") || `<div class="empty">暂无展具申请</div>`}
        </div>
      </section>
    `;
  }

  function svgPoint(event) {
    const svg = byId("boothSvg");
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM().inverse();
    return point.matrixTransform(matrix);
  }

  function rectFromPoints(start, end) {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }

  function boothIntersectsRect(booth, rect) {
    const left = Number(booth.x || 0);
    const top = Number(booth.y || 0);
    const right = left + Number(booth.width || 0);
    const bottom = top + Number(booth.height || 0);
    return left < rect.x + rect.width && right > rect.x && top < rect.y + rect.height && bottom > rect.y;
  }

  function boothContainsRect(booth, rect) {
    const left = Number(booth.x || 0);
    const top = Number(booth.y || 0);
    const right = left + Number(booth.width || 0);
    const bottom = top + Number(booth.height || 0);
    return rect.x >= left && rect.y >= top && rect.x + rect.width <= right && rect.y + rect.height <= bottom;
  }

  function boothCenterX(booth) {
    return Number(booth.x || 0) + Number(booth.width || 0) / 2;
  }

  function boothCenterY(booth) {
    return Number(booth.y || 0) + Number(booth.height || 0) / 2;
  }

  function boothLeft(booth) {
    return Number(booth.x || 0);
  }

  function boothTop(booth) {
    return Number(booth.y || 0);
  }

  function boothRight(booth) {
    return boothLeft(booth) + Number(booth.width || 0);
  }

  function boothBottom(booth) {
    return boothTop(booth) + Number(booth.height || 0);
  }

  function boothAlignmentLabel(axis, edge) {
    if (axis === "x") return edge === "end" ? "下对齐" : "上对齐";
    return edge === "end" ? "右对齐" : "左对齐";
  }

  function selectedAvailableBooths() {
    return [...state.selectedBoothIds]
      .map((id) => state.data.booths.find((booth) => booth.id === id))
      .filter((booth) => booth && booth.status === "available" && !booth.locked);
  }

  function clampRectToMap(rect) {
    const map = state.data.map || {};
    const maxX = Math.max(0, Number(map.width || 0) - Number(rect.width || 0));
    const maxY = Math.max(0, Number(map.height || 0) - Number(rect.height || 0));
    return {
      ...rect,
      x: preciseCoord(Math.min(Math.max(Number(rect.x || 0), 0), maxX)),
      y: preciseCoord(Math.min(Math.max(Number(rect.y || 0), 0), maxY))
    };
  }

  function clampObstaclePosition(obstacle, x, y) {
    const map = state.data.map || {};
    const width = Number(obstacle?.width || 0);
    const height = Number(obstacle?.height || 0);
    let minX = 0;
    let minY = 0;
    let maxX = Math.max(0, Number(map.width || 0) - width);
    let maxY = Math.max(0, Number(map.height || 0) - height);
    if (obstacle?.type === "internal" && obstacle.boothId) {
      const booth = state.data.booths.find((item) => Number(item.id) === Number(obstacle.boothId));
      if (booth) {
        minX = Number(booth.x || 0);
        minY = Number(booth.y || 0);
        maxX = Math.max(minX, minX + Number(booth.width || 0) - width);
        maxY = Math.max(minY, minY + Number(booth.height || 0) - height);
      }
    }
    return {
      x: preciseCoord(Math.min(Math.max(Number(x || 0), minX), maxX)),
      y: preciseCoord(Math.min(Math.max(Number(y || 0), minY), maxY))
    };
  }

  function boothObstacleAreaFor(booth) {
    if (!booth) return 0;
    const total = (state.data.obstacles || [])
      .filter((obstacle) => obstacle.type === "internal" && Number(obstacle.boothId) === Number(booth.id))
      .reduce((sum, obstacle) => sum + obstaclePhysicalArea(obstacle), 0);
    return Number(Math.min(Number(booth.area || 0), total).toFixed(3));
  }

  function boothBillableAreaFor(booth) {
    if (!booth) return 0;
    return Number(Math.max(0, Number(booth.area || 0) - boothObstacleAreaFor(booth)).toFixed(3));
  }

  function boothPriceFor(booth) {
    if (!booth) return 0;
    const billableArea = boothBillableAreaFor(booth);
    if (booth.attr === "raw") return Math.round(billableArea * Number(state.data.settings?.rules?.rawPrice || 0));
    return Math.round(Number(state.data.settings?.rules?.standardPrice || 0) * (billableArea / 9));
  }

  function updateBoothBillingPreview(boothId) {
    const booth = (state.data.booths || []).find((item) => Number(item.id) === Number(boothId));
    if (!booth) return;
    const obstacleArea = boothObstacleAreaFor(booth);
    const billableArea = boothBillableAreaFor(booth);
    const price = boothPriceFor(booth);
    const obstacleInput = byId("booth-obstacle-area");
    const billableInput = byId("booth-billable-area");
    const priceInput = byId("booth-price");
    if (obstacleInput) obstacleInput.value = fixedDecimal(obstacleArea, 3);
    if (billableInput) billableInput.value = fixedDecimal(billableArea, 3);
    if (priceInput) priceInput.value = money(price);
  }

  function obstacleRectForSize(obstacle, width, height) {
    const rect = {
      x: Number(obstacle.x || 0),
      y: Number(obstacle.y || 0),
      width,
      height
    };
    if (obstacle.type !== "internal" || !obstacle.boothId) return { rect, fits: true };
    const booth = state.data.booths.find((item) => Number(item.id) === Number(obstacle.boothId));
    if (!booth) return { rect, fits: false };
    const boothWidth = Number(booth.width || 0);
    const boothHeight = Number(booth.height || 0);
    if (width > boothWidth || height > boothHeight) return { rect, booth, fits: false };
    const minX = Number(booth.x || 0);
    const minY = Number(booth.y || 0);
    const maxX = minX + boothWidth - width;
    const maxY = minY + boothHeight - height;
    rect.x = Math.min(Math.max(rect.x, minX), maxX);
    rect.y = Math.min(Math.max(rect.y, minY), maxY);
    return { rect, booth, fits: true };
  }

  function obstacleAreaText(obstacle) {
    return `${fixedDecimal(obstaclePhysicalArea(obstacle), 3)}㎡`;
  }

  function setShapeGeometry(element, rect, shape = "rect") {
    if (!element) return;
    if (shape === "circle") {
      element.setAttribute("cx", preciseCoord(Number(rect.x || 0) + Number(rect.width || 0) / 2));
      element.setAttribute("cy", preciseCoord(Number(rect.y || 0) + Number(rect.height || 0) / 2));
      element.setAttribute("rx", preciseCoord(Number(rect.width || 0) / 2));
      element.setAttribute("ry", preciseCoord(Number(rect.height || 0) / 2));
      ["x", "y", "width", "height"].forEach((key) => element.removeAttribute(key));
      return;
    }
    element.setAttribute("x", preciseCoord(rect.x));
    element.setAttribute("y", preciseCoord(rect.y));
    element.setAttribute("width", preciseCoord(rect.width));
    element.setAttribute("height", preciseCoord(rect.height));
    ["cx", "cy", "rx", "ry"].forEach((key) => element.removeAttribute(key));
  }

  function updatePreviewRect(id, rect, attrs, shape = "rect") {
    const svg = byId("boothSvg");
    if (!svg) return;
    const tagName = shape === "circle" ? "ellipse" : "rect";
    let preview = byId(id);
    if (preview && preview.tagName.toLowerCase() !== tagName) {
      preview.remove();
      preview = null;
    }
    if (!preview) {
      preview = document.createElementNS("http://www.w3.org/2000/svg", tagName);
      preview.setAttribute("id", id);
      svg.appendChild(preview);
    }
    Object.entries(attrs).forEach(([key, value]) => preview.setAttribute(key, value));
    setShapeGeometry(preview, rect, shape);
  }

  async function uploadFileFromInput(inputId, category, extra = {}) {
    const input = byId(inputId);
    const file = input?.files?.[0];
    if (!file) return null;
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
    if (category !== "map-background" && isImage && file.size > imageUploadLimit) {
      throw new Error("除展位图底图外，图片大小不能超过 3MB");
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await api("/api/uploads", {
      method: "POST",
      body: { fileName: file.name, mimeType: file.type, dataUrl, category, ...extra }
    });
    return result.attachment;
  }

  function imageDimensionsFromFile(file) {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith("image/")) {
        resolve(null);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
        URL.revokeObjectURL(objectUrl);
        resolve(dimensions.width && dimensions.height ? dimensions : null);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      image.src = objectUrl;
    });
  }

  function imageDimensionsFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("无法读取底图原始尺寸"));
      image.src = url;
    });
  }

  function loadCanvasImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("导出图片时无法读取底图"));
      image.src = url;
    });
  }

  function downloadBlob(filename, blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawContainImage(ctx, image, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }

  function applyFitMapZoom() {
    if (!state.data || state.mapZoom !== "fit") return;
    const map = state.data.map;
    const svgs = [...document.querySelectorAll(".booth-svg")];
    if (!svgs.length) return;
    svgs.forEach((svg) => {
      const box = svg.closest(".map-frame, .modal-map");
      if (!box) return;
      const width = Math.max(1, Number(map.width || 1));
      const height = Math.max(1, Number(map.height || 1));
      const availableWidth = Math.max(240, box.clientWidth - 18);
      const availableHeight = Math.max(220, box.clientHeight - 18);
      const zoom = Math.max(0.08, Math.min(2, availableWidth / width, availableHeight / height));
      state.fitMapZoom = zoom;
      svg.style.width = `${Math.round(width * zoom)}px`;
      svg.style.height = `${Math.round(height * zoom)}px`;
    });
  }

  function scheduleFitMapZoom() {
    if (state.mapZoom !== "fit") return;
    setTimeout(() => {
      applyFitMapZoom();
      updateDrawPresetPosition();
    }, 0);
  }

  function updateDrawPresetPosition() {
    const box = byId("admin-map-frame");
    const panel = box?.querySelector(".draw-preset-panel");
    if (!box || !panel) return;
    const margin = 12;
    const width = panel.offsetWidth || 230;
    const left = box.scrollLeft + Math.max(margin, box.clientWidth - width - margin);
    const top = box.scrollTop + margin;
    panel.style.left = `${preciseCoord(left)}px`;
    panel.style.top = `${preciseCoord(top)}px`;
  }

  async function buildSalesMapJpegBlob(booths) {
    const map = state.data.map;
    const width = Math.max(1, Math.round(Number(map.width || 1680)));
    const height = Math.max(1, Math.round(Number(map.height || 980)));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f9fc";
    ctx.fillRect(0, 0, width, height);
    if (map.backgroundAttachmentId) {
      const image = await loadCanvasImage(fileUrl(map.backgroundAttachmentId));
      drawContainImage(ctx, image, width, height);
    } else {
      ctx.fillStyle = "#eef3f9";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = "#536176";
    ctx.font = "18px Microsoft YaHei, PingFang SC, Arial, sans-serif";
    ctx.fillText(`销售展位图 · ${booths.length} 个展位`, 28, 34);
    booths.forEach((booth) => {
      const x = Number(booth.x || 0);
      const y = Number(booth.y || 0);
      const boothWidth = Number(booth.width || 0);
      const boothHeight = Number(booth.height || 0);
      const grayed = salesMapBoothDimmed(booth);
      drawRoundedRect(ctx, x, y, boothWidth, boothHeight, 2);
      ctx.fillStyle = grayed ? "#c9d1dc" : zoneColor(booth.zone);
      ctx.fill();
      ctx.lineWidth = state.salesMapFocusId === booth.id ? 5 : 1.4;
      ctx.strokeStyle = state.salesMapFocusId === booth.id ? "#ffcf33" : "#ffffff";
      ctx.stroke();
      if (boothWidth >= 32 && boothHeight >= 22) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "10px Microsoft YaHei, PingFang SC, Arial, sans-serif";
        ctx.fillText(String(booth.boothNo || ""), x + boothWidth / 2, y + boothHeight / 2);
      }
    });
    (state.data.activityAreas || []).forEach((area) => {
      const x = Number(area.x || 0);
      const y = Number(area.y || 0);
      const areaWidth = Number(area.width || 0);
      const areaHeight = Number(area.height || 0);
      drawRoundedRect(ctx, x, y, areaWidth, areaHeight, 2);
      ctx.fillStyle = "rgba(14, 165, 233, 0.22)";
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#0284c7";
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (areaWidth >= 36 && areaHeight >= 20) {
        ctx.fillStyle = "#075985";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "11px Microsoft YaHei, PingFang SC, Arial, sans-serif";
        ctx.fillText(String(area.name || "活动区"), x + areaWidth / 2, y + areaHeight / 2);
      }
    });
    (state.data.obstacles || []).forEach((obstacle) => {
      const x = Number(obstacle.x || 0);
      const y = Number(obstacle.y || 0);
      const obstacleWidth = Number(obstacle.width || 0);
      const obstacleHeight = Number(obstacle.height || 0);
      if (obstacleShape(obstacle) === "circle") {
        ctx.beginPath();
        ctx.ellipse(x + obstacleWidth / 2, y + obstacleHeight / 2, obstacleWidth / 2, obstacleHeight / 2, 0, 0, Math.PI * 2);
      } else {
        drawRoundedRect(ctx, x, y, obstacleWidth, obstacleHeight, 2);
      }
      ctx.fillStyle = obstacle.type === "internal" ? "rgba(194, 65, 65, 0.72)" : "rgba(71, 85, 105, 0.66)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = obstacle.type === "internal" ? "#7f1d1d" : "#1f2937";
      ctx.stroke();
      if (obstacleWidth >= 36 && obstacleHeight >= 20) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "10px Microsoft YaHei, PingFang SC, Arial, sans-serif";
        ctx.fillText("障碍", x + obstacleWidth / 2, y + obstacleHeight / 2);
      }
    });
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("JPG 生成失败"));
      }, "image/jpeg", 0.92);
    });
  }

  function reviewRemarkPayload(status, label) {
    if (status !== "rejected") return { status };
    const templates = state.data?.settings?.reviewRejectTemplates || ["合同未盖章", "金额不一致", "水单不清晰", "企业名称不一致"];
    const templateText = templates.map((item, index) => `${index + 1}. ${item}`).join("\n");
    const remark = window.prompt(`${label}不通过原因（必填）\n可输入编号套用模板，或直接输入原因：\n${templateText}`);
    if (remark === null) return null;
    const trimmed = remark.trim();
    const selectedTemplate = templates[Number(trimmed) - 1];
    const reviewRemark = selectedTemplate || trimmed;
    if (!reviewRemark) {
      state.error = "审核不通过时必须填写原因";
      render();
      return null;
    }
    return { status, reviewRemark };
  }

  return {
    async init() {
      const enterpriseToken = new URLSearchParams(window.location.search).get("enterpriseToken");
      if (enterpriseToken) {
        try {
          const result = await api("/api/auth/enterprise-link", {
            method: "POST",
            body: { token: enterpriseToken }
          });
          state.token = result.token;
          localStorage.setItem("expoToken", state.token);
          window.history.replaceState({}, "", window.location.pathname);
          await refresh();
          state.view = "enterprise";
          render();
          return;
        } catch (error) {
          state.error = error.message;
          await loadLoginEvents();
          renderLogin();
          return;
        }
      }
      if (!state.token) {
        await loadLoginEvents();
        renderLogin();
        return;
      }
      try {
        await refresh();
        render();
      } catch (error) {
        localStorage.removeItem("expoToken");
        state.token = "";
        state.error = "登录已过期，请重新登录";
        await loadLoginEvents();
        renderLogin();
      }
    },
    async login(event) {
      event.preventDefault();
      state.error = "";
      if (!byId("login-event-category")?.value || !byId("login-event")?.value) {
        state.error = "请先选择展会类别和展会";
        renderLogin();
        return;
      }
      try {
        const result = await api("/api/auth/login", {
          method: "POST",
          body: {
            username: byId("login-username").value.trim(),
            password: byId("login-password").value,
            eventCategory: byId("login-event-category")?.value || "",
            eventId: byId("login-event")?.value || ""
          }
        });
        state.token = result.token;
        localStorage.setItem("expoToken", state.token);
        await refresh();
        state.view = state.data.me.role === "enterprise" ? "enterprise" : "dashboard";
        render();
      } catch (error) {
        state.error = error.message;
        renderLogin();
      }
    },
    setLoginEventCategory(category) {
      state.loginEventCategory = category;
      renderLogin();
    },
    async logout() {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch (_) {
        // Ignore logout errors and clear local session.
      }
      localStorage.removeItem("expoToken");
      state.token = "";
      state.data = null;
      state.view = "dashboard";
      await loadLoginEvents();
      renderLogin();
    },
    setView(view) {
      const normalizedView = normalizeView(view);
      const group = menuGroupForView(normalizedView);
      if (group) state.openMenuGroups.add(group.key);
      state.view = normalizedView;
      state.error = "";
      state.message = "";
      state.boothPickerOpen = false;
      state.customerModalOpen = false;
      state.customerAttendLeadId = null;
      state.paymentModalOrderId = null;
      state.changePickerOpen = false;
      state.eventRoleModal = null;
      state.eventCreateModalOpen = false;
      state.globalSearchOpen = false;
      render();
    },
    openDashboardDrill(filter) {
      state.exhibitorFilter = filter || "";
      state.view = "exhibitor-list";
      state.openMenuGroups.add("customer-data");
      render();
    },
    clearExhibitorFilter() {
      state.exhibitorFilter = "";
      render();
    },
    setExhibitorFilter(value) {
      state.exhibitorFilter = value || "";
      render();
    },
    setCustomerFilter(key, value) {
      if (key === "oldCustomerFilter") state.oldCustomerFilter = value || "";
      else state.newCustomerFilter = value || "";
      render();
    },
    openTodoTarget(key) {
      const approvalTabs = {
        approval: "payments",
        "fascia-review": "fascia",
        "rental-review": "rentals"
      };
      if (key === "enterprise-profile") {
        state.view = "enterprise";
      } else if (approvalTabs[key]) {
        state.view = "approvals";
        state.approvalTab = approvalTabs[key];
      } else {
        const filterMap = {
          "pending-contract": "pending-contract",
          "pending-voucher": "pending-voucher",
          "soon-release": "soon-release",
          "profile-missing": "profile-missing"
        };
        state.exhibitorFilter = filterMap[key] || "";
        state.view = "exhibitor-list";
        state.openMenuGroups.add("customer-data");
      }
      render();
    },
    toggleMenuGroup(key) {
      if (state.openMenuGroups.has(key)) {
        state.openMenuGroups.delete(key);
      } else {
        state.openMenuGroups.add(key);
      }
      render();
    },
    setApprovalTab(tab) {
      state.approvalTab = tab;
      render();
    },
    setSettingsTab(tab) {
      state.settingsTab = tab;
      state.error = "";
      state.message = "";
      render();
    },
    setApprovalHistoryFilter(key, value) {
      state.approvalHistoryFilter = {
        ...state.approvalHistoryFilter,
        [key]: value
      };
      render();
    },
    async saveEventInfo() {
      await run(() => api("/api/event", {
        method: "PUT",
        body: {
          id: byId("event-id")?.value.trim(),
          name: byId("event-name")?.value.trim(),
          startDate: byId("event-start")?.value,
          endDate: byId("event-end")?.value,
          location: byId("event-location")?.value.trim(),
          category: byId("event-category")?.value.trim(),
          linkedEventId: byId("event-linked")?.value
        }
      }), "展会信息已保存");
    },
    async addEventCategory() {
      const name = byId("new-event-category")?.value.trim();
      if (!name) {
        state.error = "请填写展会类别名称";
        render();
        return;
      }
      await run(() => api("/api/event-categories", {
        method: "POST",
        body: { name }
      }), "展会类别已新增");
    },
    async deleteEventCategory(category) {
      if (!window.confirm(`确认删除展会类别“${category}”？`)) return;
      await run(() => api(`/api/event-categories/${encodeURIComponent(category)}`, { method: "DELETE" }), "展会类别已删除");
    },
    async deleteEvent(index) {
      const event = (state.data.settings.events || [])[index];
      if (!event) return;
      const orders = eventOrderCount(event.id);
      if (orders > 0) {
        state.error = `展会已有 ${orders} 个订单，不能删除`;
        render();
        return;
      }
      if (!window.confirm(`确认删除展会“${event.name || event.id}”？`)) return;
      await run(() => api("/api/events/delete", {
        method: "POST",
        body: { eventIds: [event.id] }
      }), "展会已删除");
    },
    openEventCreateModal() {
      state.eventCreateModalOpen = true;
      render();
    },
    closeEventCreateModal() {
      state.eventCreateModalOpen = false;
      render();
    },
    async createEvent(event) {
      if (event?.preventDefault) event.preventDefault();
      await run(async () => {
        const result = await api("/api/events", {
          method: "POST",
          body: {
            id: byId("create-event-id")?.value.trim(),
            name: byId("create-event-name")?.value.trim(),
            startDate: byId("create-event-start")?.value,
            endDate: byId("create-event-end")?.value,
            location: byId("create-event-location")?.value.trim(),
            category: byId("create-event-category")?.value.trim(),
            linkedEventId: byId("create-event-linked")?.value
          }
        });
        state.eventCreateModalOpen = false;
        state.view = "events-list";
        return result;
      }, "展会已新增，并已切换到新展会");
    },
    setWarehouseCategory(category) {
      state.warehouseCategory = category;
      render();
    },
    async saveEventRoles() {
      const eventId = state.data.settings.event.id;
      const assignments = [
        ...eventRoleIds(eventId, "manager").map((userId) => ({ userId, role: "manager" })),
        ...eventRoleIds(eventId, "sales").map((userId) => ({ userId, role: "sales" }))
      ];
      await run(() => api("/api/event-roles", {
        method: "PUT",
        body: { eventId, assignments }
      }), "展会权限已保存");
    },
    openEventRoleModal(index, role) {
      const event = (state.data.settings.events || [])[index];
      if (!event || !["manager", "sales"].includes(role)) return;
      state.eventRoleModal = { eventId: event.id, role };
      render();
    },
    closeEventRoleModal() {
      state.eventRoleModal = null;
      render();
    },
    async saveEventRoleModal() {
      const modal = state.eventRoleModal;
      if (!modal) return;
      const selectedIds = new Set(Array.from(document.querySelectorAll(".event-role-user-check:checked")).map((input) => Number(input.value)));
      const assignments = eventRoleAssignmentsAfterUpdate(modal.eventId, modal.role, selectedIds);
      await run(() => api("/api/event-roles", {
        method: "PUT",
        body: { eventId: modal.eventId, assignments }
      }), `${eventRoleLabel(modal.role)}权限已保存`);
      state.eventRoleModal = null;
      render();
    },
    async saveEventRolesForEvent(index) {
      const event = (state.data.settings.events || [])[index];
      if (!event) return;
      const assignments = [
        ...eventRoleIds(event.id, "manager").map((userId) => ({ userId, role: "manager" })),
        ...eventRoleIds(event.id, "sales").map((userId) => ({ userId, role: "sales" }))
      ];
      await run(() => api("/api/event-roles", {
        method: "PUT",
        body: { eventId: event.id, assignments }
      }), `${event.name || event.id} 权限已保存`);
    },
    openCustomerModal() {
      state.customerDraft = {
        name: "",
        shortName: "",
        contactName: "",
        phone: "",
        email: "",
        address: "",
        taxNo: "",
        locationType: "domestic",
        countryRegion: "",
        province: "广东省",
        city: "广州市",
        ownerSalesId: state.data.users.find((user) => user.role === "sales")?.id || ""
      };
      state.customerModalOpen = true;
      render();
    },
    closeCustomerModal() {
      state.customerModalOpen = false;
      render();
    },
    refreshCompanySimilarity(context = "cust") {
      const fieldPrefix = context === "order" ? "company" : "cust";
      const target = byId(`${context}-similar-hints`);
      if (!target) return;
      const payload = {
        name: byId(`${fieldPrefix}-name`)?.value || "",
        shortName: byId(`${fieldPrefix}-short-name`)?.value || "",
        contactName: byId(`${fieldPrefix}-contact`)?.value || "",
        phone: byId(`${fieldPrefix}-phone`)?.value || "",
        taxNo: byId(`${fieldPrefix}-tax`)?.value || ""
      };
      const excludeCompanyId = context === "order" ? state.orderDraft.companyId : null;
      target.innerHTML = similarCompanyWarningHtml(payload, excludeCompanyId);
    },
    openCompanyDetail(companyId) {
      state.companyDetailId = Number(companyId || 0);
      render();
    },
    closeCompanyDetail() {
      state.companyDetailId = null;
      state.companyEditId = null;
      render();
    },
    startCompanyEdit(companyId) {
      state.companyEditId = Number(companyId || 0);
      render();
    },
    cancelCompanyEdit() {
      state.companyEditId = null;
      render();
    },
    refreshCompanyEditLocation() {
      const locationType = byId("edit-company-location-type")?.value || "domestic";
      document.querySelectorAll("[data-edit-location='domestic']").forEach((item) => {
        item.style.display = locationType === "overseas" ? "none" : "";
      });
      document.querySelectorAll("[data-edit-location='overseas']").forEach((item) => {
        item.style.display = locationType === "overseas" ? "" : "none";
      });
    },
    refreshCompanyEditCities() {
      const province = byId("edit-company-province")?.value || "";
      const city = byId("edit-company-city");
      if (city) city.innerHTML = cityOptions(province, "");
    },
    async saveCompanyEdit(companyId) {
      const locationType = byId("edit-company-location-type")?.value || "domestic";
      const payload = {
        name: byId("edit-company-name")?.value.trim() || "",
        shortName: byId("edit-company-short-name")?.value.trim() || "",
        contactName: byId("edit-company-contact")?.value.trim() || "",
        phone: byId("edit-company-phone")?.value.trim() || "",
        email: byId("edit-company-email")?.value.trim() || "",
        taxNo: byId("edit-company-tax")?.value.trim() || "",
        address: byId("edit-company-address")?.value.trim() || "",
        locationType,
        countryRegion: locationType === "overseas" ? byId("edit-company-country-region")?.value || "" : "",
        province: locationType === "overseas" ? "" : byId("edit-company-province")?.value || "",
        city: locationType === "overseas" ? "" : byId("edit-company-city")?.value || ""
      };
      if (!payload.name) {
        state.error = "请填写企业名称";
        render();
        return;
      }
      const result = await run(() => api(`/api/companies/${companyId}`, { method: "PUT", body: payload }), "客户资料已保存");
      if (result) {
        state.companyEditId = null;
        render();
      }
    },
    openGlobalSearch() {
      if (state.globalSearchOpen) return;
      state.globalSearchOpen = true;
      render();
      setTimeout(() => {
        const input = byId("global-search-input");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    setGlobalSearch(value) {
      state.globalSearchQuery = value || "";
      state.globalSearchOpen = true;
      render();
      setTimeout(() => {
        const input = byId("global-search-input");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    clearGlobalSearch() {
      state.globalSearchQuery = "";
      state.globalSearchOpen = false;
      render();
    },
    openGlobalSearchResult(type, id) {
      state.globalSearchQuery = "";
      state.globalSearchOpen = false;
      state.error = "";
      state.message = "";
      if (type === "company") {
        state.companyDetailId = Number(id);
        render();
        return;
      }
      if (type === "order") {
        const order = (state.data.orders || []).find((item) => Number(item.id) === Number(id));
        if (order) {
          state.view = "exhibitor-list";
          state.openMenuGroups.add("customer-data");
          state.companyDetailId = Number(order.companyId);
        }
        render();
        return;
      }
      if (type === "booth") {
        const booth = (state.data.booths || []).find((item) => Number(item.id) === Number(id));
        if (booth) {
          state.view = "sales-map";
          state.salesMapSearch = booth.boothNo || "";
          state.salesMapZone = "";
          state.salesMapAttr = "";
          state.salesMapStatus = "";
          state.salesMapOnlyAvailable = false;
          state.salesMapFocusId = booth.id;
          state.companyDetailId = null;
          render();
          setTimeout(() => scrollModalMapToBooth("sales-map-frame", booth), 0);
          return;
        }
      }
      render();
    },
    updateCustomerDraft() {
      state.customerDraft = { ...state.customerDraft, ...customerDraftPayload() };
    },
    customerLocationTypeChanged() {
      this.updateCustomerDraft();
      if (state.customerDraft.locationType === "overseas" && !state.customerDraft.countryRegion) state.customerDraft.countryRegion = "中国香港";
      render();
    },
    customerProvinceChanged() {
      this.updateCustomerDraft();
      const cities = mainlandCityMap[state.customerDraft.province] || [];
      state.customerDraft.city = cities[0] || "";
      render();
    },
    async saveNewCustomer() {
      const payload = customerDraftPayload();
      if (!payload.name) {
        state.error = "请填写企业名称";
        render();
        return;
      }
      const result = await run(() => api("/api/companies", { method: "POST", body: payload }), "新客户已保存");
      if (result) {
        state.customerModalOpen = false;
        render();
      }
    },
    async claimCustomerLead(leadId) {
      await run(() => api(`/api/customer-leads/${leadId}/claim`, { method: "POST", body: {} }), "客户已认领并进入新客户列表");
    },
    async releaseCustomerLead(leadId) {
      if (!window.confirm("确认将这家企业下保并放入客户公海？")) return;
      state.companyDetailId = null;
      await run(() => api(`/api/customer-leads/${leadId}/release`, { method: "POST", body: {} }), "客户已下保并进入公海");
    },
    async uploadLeadAttachment(leadId, type, sourceInputId = "") {
      const inputId = sourceInputId || (type === "contract" ? `lead-contract-${leadId}` : `lead-voucher-${leadId}`);
      const file = byId(inputId)?.files?.[0];
      if (!file) return;
      const allowed = ["application/pdf", "image/jpeg", "image/png"].includes(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
      if (!allowed) {
        state.error = "合同和水单仅支持 PDF、JPG、PNG 文件";
        render();
        return;
      }
      const lead = state.data.customerLeads.find((item) => Number(item.id) === Number(leadId));
      if (!lead) {
        state.error = "客户不存在";
        render();
        return;
      }
      const category = type === "contract" ? "customer-contract" : "customer-voucher";
      const success = type === "contract" ? "合同已上传" : "水单已上传";
      await run(async () => {
        const attachment = await uploadFileFromInput(inputId, category, {
          leadId,
          companyId: lead.companyId
        });
        if (!attachment) throw new Error("请选择文件");
        return attachment;
      }, success);
    },
    customerAttend(companyId, leadId = 0) {
      const company = getCompany(companyId);
      if (!company.id) return;
      this.prefillOrderFromCompany(company);
      state.companyDetailId = null;
      state.customerAttendLeadId = leadId || null;
      state.pendingBoothIds = [...new Set(state.pendingBoothIds)]
        .filter((id) => state.data.booths.some((booth) => Number(booth.id) === Number(id) && booth.status === "available"));
      state.boothPickerOpen = true;
      state.boothPickerSearch = "";
      state.boothPickerFocusId = null;
      render();
    },
    prefillOrderFromCompany(company) {
      state.orderDraft = {
        ...state.orderDraft,
        type: "booth",
        title: "展位订单",
        companyId: String(company.id),
        companyName: company.name || "",
        companyShortName: company.shortName || "",
        companyContact: company.contactName || "",
        companyPhone: company.phone || "",
        companyEmail: company.email || "",
        companyAddress: company.address || "",
        companyTax: company.taxNo || "",
        companyLocationType: company.locationType || "domestic",
        companyCountryRegion: company.countryRegion || "",
        companyProvince: company.province || "广东省",
        companyCity: company.city || "广州市"
      };
    },
    oldCustomerAttend(companyId) {
      const company = getCompany(companyId);
      if (!company.id) return;
      const duplicateOrder = state.data.orders.find((order) => (
        order.eventId === state.data.settings.event.id
        && isActiveOrder(order)
        && companyNameKey(getCompany(order.companyId).name) === companyNameKey(company.name)
      ));
      if (duplicateOrder) {
        state.error = `当前展会中企业“${company.name}”已存在有效订单 ${duplicateOrder.orderNo}`;
        render();
        return;
      }
      this.customerAttend(companyId, 0);
    },
    setSalesMapFilter(key, value) {
      if (key === "zone") state.salesMapZone = value || "";
      if (key === "attr") state.salesMapAttr = value || "";
      if (key === "status") state.salesMapStatus = value || "";
      state.salesMapFocusId = null;
      render();
    },
    toggleSalesMapAvailable() {
      state.salesMapOnlyAvailable = !state.salesMapOnlyAvailable;
      render();
    },
    setSalesMapSearch(value) {
      state.salesMapSearch = value || "";
      state.salesMapFocusId = null;
      render();
      setTimeout(() => {
        const input = byId("sales-map-search");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    searchSalesMapBooth() {
      const value = byId("sales-map-search")?.value || state.salesMapSearch;
      const booth = findBoothByNo(value);
      if (!booth) {
        state.error = "未找到对应展位号";
        render();
        return;
      }
      state.error = "";
      state.salesMapSearch = String(value || "").trim();
      state.salesMapZone = "";
      state.salesMapAttr = "";
      state.salesMapStatus = "";
      state.salesMapFocusId = booth.id;
      render();
      setTimeout(() => scrollModalMapToBooth("sales-map-frame", booth), 0);
    },
    async exportSalesMap() {
      const booths = filteredSalesMapBooths();
      try {
        state.error = "";
        state.message = "";
        const statusName = state.salesMapStatus ? statusText(state.salesMapStatus) : "全部状态";
        const attrName = state.salesMapAttr ? attrText(state.salesMapAttr) : "全部类型";
        const zoneName = state.salesMapZone || "全部展区";
        const blob = await buildSalesMapJpegBlob(booths);
        downloadBlob(`销售展位图_${zoneName}_${attrName}_${statusName}.jpg`, blob);
        state.message = `已导出整张展位图 JPG，包含 ${booths.length} 个展位`;
        render();
      } catch (error) {
        state.error = error.message || "展位图导出失败";
        render();
      }
    },
    updateOrderDraft() {
      const draft = state.orderDraft;
      draft.type = byId("order-type")?.value || draft.type || "booth";
      draft.salespersonId = byId("order-sales")?.value || draft.salespersonId || "";
      draft.title = byId("order-title")?.value ?? draft.title;
      draft.companyName = byId("company-name")?.value ?? draft.companyName;
      draft.companyShortName = byId("company-short-name")?.value ?? draft.companyShortName;
      draft.companyContact = byId("company-contact")?.value ?? draft.companyContact;
      draft.companyPhone = byId("company-phone")?.value ?? draft.companyPhone;
      draft.companyEmail = byId("company-email")?.value ?? draft.companyEmail;
      draft.companyAddress = byId("company-address")?.value ?? draft.companyAddress;
      draft.companyTax = byId("company-tax")?.value ?? draft.companyTax;
      draft.companyLocationType = byId("company-location-type")?.value ?? draft.companyLocationType ?? "domestic";
      draft.companyCountryRegion = byId("company-country-region")?.value ?? draft.companyCountryRegion ?? "";
      draft.companyProvince = byId("company-province")?.value ?? draft.companyProvince ?? "广东省";
      draft.companyCity = byId("company-city")?.value ?? draft.companyCity ?? "";
      draft.customAmount = byId("custom-amount")?.value ?? draft.customAmount;
      draft.customDetail = byId("custom-detail")?.value ?? draft.customDetail;
      draft.hasDiscount = byId("order-has-discount")?.value ?? draft.hasDiscount ?? "no";
      draft.discountRuleId = byId("order-discount-id")?.value ?? draft.discountRuleId ?? "";
      draft.details = byId("order-detail")?.value ?? draft.details;
    },
    companyLocationTypeChanged() {
      this.updateOrderDraft();
      if (state.orderDraft.companyLocationType === "overseas" && !state.orderDraft.companyCountryRegion) {
        state.orderDraft.companyCountryRegion = "中国香港";
      }
      render();
    },
    companyProvinceChanged() {
      this.updateOrderDraft();
      const cities = mainlandCityMap[state.orderDraft.companyProvince] || [];
      state.orderDraft.companyCity = cities[0] || "";
      render();
    },
    async syncCountryRegions() {
      this.updateOrderDraft();
      await run(() => api("/api/country-regions/sync", { method: "POST" }), "国家或地区已同步");
    },
    orderDiscountChanged() {
      this.updateOrderDraft();
      render();
    },
    toggleDrawPresetPanel() {
      state.drawPresetCollapsed = !state.drawPresetCollapsed;
      render();
    },
    updateDrawPreset() {
      const previousNumberConfig = [
        state.drawBoothNoPrefix,
        state.drawBoothNoChars,
        state.drawBoothNoStart,
        state.drawBoothNoSkipEnabled,
        state.drawBoothNoStep
      ].join("\u0001");
      const width = byId("draw-preset-width")?.value ?? state.drawPresetWidthM;
      const depth = byId("draw-preset-depth")?.value ?? state.drawPresetDepthM;
      state.drawPresetWidthM = String(width || "3");
      state.drawPresetDepthM = String(depth || "3");
      state.drawPresetHall = byId("draw-preset-hall")?.value ?? currentDrawPresetHall();
      state.drawPresetZone = byId("draw-preset-zone")?.value ?? currentDrawPresetZone();
      state.drawBoothNoPrefix = byId("draw-booth-prefix")?.value ?? state.drawBoothNoPrefix;
      state.drawBoothNoChars = byId("draw-booth-chars")?.value ?? state.drawBoothNoChars;
      state.drawBoothNoStart = byId("draw-booth-start")?.value ?? state.drawBoothNoStart;
      const normalizedNo = normalizedDrawBoothNoConfig();
      if (normalizedNo.correctedFromNumber || String(state.drawBoothNoChars) !== String(normalizedNo.totalChars)) {
        state.drawBoothNoChars = String(normalizedNo.totalChars);
        state.drawBoothNoStart = String(normalizedNo.startNo);
        const charsInput = byId("draw-booth-chars");
        const startInput = byId("draw-booth-start");
        if (charsInput) charsInput.value = state.drawBoothNoChars;
        if (startInput) startInput.value = state.drawBoothNoStart;
      }
      const previousSkipEnabled = state.drawBoothNoSkipEnabled;
      state.drawBoothNoSkipEnabled = byId("draw-booth-skip-enabled")?.value ?? state.drawBoothNoSkipEnabled;
      state.drawBoothNoStep = byId("draw-booth-step")?.value ?? state.drawBoothNoStep;
      const nextNumberConfig = [
        state.drawBoothNoPrefix,
        state.drawBoothNoChars,
        state.drawBoothNoStart,
        state.drawBoothNoSkipEnabled,
        state.drawBoothNoStep
      ].join("\u0001");
      if (previousNumberConfig !== nextNumberConfig) state.drawBoothNoResetActive = false;
      const pixels = byId("draw-preset-pixels");
      const next = byId("draw-preset-next");
      if (pixels) pixels.textContent = `${meterToPx(state.drawPresetWidthM)} x ${meterToPx(state.drawPresetDepthM)} 像素`;
      if (next) next.textContent = `下一个：${nextBoothNo()}`;
      updateDrawPresetPosition();
      if (previousSkipEnabled !== state.drawBoothNoSkipEnabled) render();
    },
    resetDrawBoothNumber() {
      this.updateDrawPreset();
      state.drawBoothNoResetActive = true;
      state.message = `编号已重置，下一个展位号：${nextBoothNo()}`;
      render();
    },
    updateDrawPresetPosition,
    setMapZoom(value) {
      if (value === "fit") {
        state.mapZoom = "fit";
      } else {
        state.mapZoom = Math.max(0.25, Number(value || 1));
      }
      render();
      scheduleFitMapZoom();
    },
    fitMapToViewport() {
      scheduleFitMapZoom();
    },
    async undoMapEdit() {
      const snapshot = state.mapUndoStack.pop();
      if (!snapshot) return;
      state.mapRedoStack.push(cloneMapSnapshot());
      if (state.mapRedoStack.length > 30) state.mapRedoStack.shift();
      await restoreMapSnapshot(snapshot, "展位图已撤销");
    },
    async redoMapEdit() {
      const snapshot = state.mapRedoStack.pop();
      if (!snapshot) return;
      state.mapUndoStack.push(cloneMapSnapshot());
      if (state.mapUndoStack.length > 30) state.mapUndoStack.shift();
      await restoreMapSnapshot(snapshot, "展位图已重做");
    },
    async saveMapScale() {
      rememberMapState();
      await run(() => api("/api/map/settings", {
        method: "PUT",
        body: { scalePxPerMeter: Number(byId("map-scale").value || 16), resizeBoothsByScale: true }
      }), "比例尺已保存");
    },
    toggleDraw() {
      state.drawMode = !state.drawMode;
      if (state.drawMode) state.obstacleMode = "";
      if (state.drawMode) state.activityAreaMode = false;
      state.selecting = null;
      render();
    },
    toggleActivityAreaMode() {
      state.activityAreaMode = !state.activityAreaMode;
      if (state.activityAreaMode) {
        state.drawMode = false;
        state.obstacleMode = "";
      }
      state.drawing = null;
      state.selecting = null;
      render();
    },
    toggleObstacleMode(type) {
      state.obstacleMode = state.obstacleMode === type ? "" : type;
      if (state.obstacleMode) state.drawMode = false;
      if (state.obstacleMode) state.activityAreaMode = false;
      state.drawing = null;
      state.selecting = null;
      render();
    },
    setObstacleShape(shape) {
      state.obstacleShape = shape === "circle" ? "circle" : "rect";
    },
    changeObstacleShape() {
      const obstacle = (state.data.obstacles || []).find((item) => item.id === state.selectedObstacleId);
      if (!obstacle) return;
      if (state.obstacleSizePreviewHistoryId !== obstacle.id) {
        rememberMapState();
        state.obstacleSizePreviewHistoryId = obstacle.id;
      }
      obstacle.shape = byId("obstacle-shape")?.value === "circle" ? "circle" : "rect";
      const widthM = obstacleWidthM(obstacle);
      const depthM = obstacleDepthM(obstacle);
      obstacle.area = obstacleAreaFromSize(widthM, depthM, obstacle.shape);
      if (obstacle.boothId) updateBoothBillingPreview(obstacle.boothId);
      render();
    },
    async createBoothFromRect(rect, success = "展位已创建") {
      const normalized = clampRectToMap(rect);
      if (Number(normalized.width || 0) < 4 || Number(normalized.height || 0) < 4) {
        state.error = "展位尺寸太小";
        render();
        return null;
      }
      const widthM = pxToMeter(normalized.width, 3);
      const depthM = pxToMeter(normalized.height, 3);
      const boothNo = nextBoothNo();
      const boothNoError = boothNoValidationError(boothNo);
      if (boothNoError) {
        state.error = boothNoError;
        render();
        return null;
      }
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api("/api/booths", {
        method: "POST",
        body: {
          boothNo,
          x: preciseCoord(normalized.x),
          y: preciseCoord(normalized.y),
          width: preciseCoord(normalized.width),
          height: preciseCoord(normalized.height),
          area: Number((widthM * depthM).toFixed(3)),
          widthM,
          depthM,
          hall: currentDrawPresetHall(),
          zone: currentDrawPresetZone(),
          attr: "standard"
        }
      }), success, {
        refresh: false,
        apply: (result) => {
          if (!result?.booth) return;
          state.data.booths.push(result.booth);
          state.selectedBoothId = result.booth.id;
          state.selectedBoothIds.clear();
          state.selectedObstacleId = null;
          state.selectedActivityAreaId = null;
        }
      });
      restoreMapScroll(scroll);
      return result;
    },
    async createActivityAreaFromRect(rect, success = "活动区已创建") {
      const normalized = clampRectToMap(rect);
      if (Number(normalized.width || 0) < 12 || Number(normalized.height || 0) < 12) {
        state.error = "活动区尺寸太小";
        render();
        return null;
      }
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api("/api/activity-areas", {
        method: "POST",
        body: {
          name: `活动区${(state.data.activityAreas || []).length + 1}`,
          x: preciseCoord(normalized.x),
          y: preciseCoord(normalized.y),
          width: preciseCoord(normalized.width),
          height: preciseCoord(normalized.height)
        }
      }), success, {
        refresh: false,
        apply: (result) => {
          if (!result?.activityArea) return;
          state.data.activityAreas.push(result.activityArea);
          state.selectedActivityAreaId = result.activityArea.id;
          state.selectedBoothId = null;
          state.selectedBoothIds.clear();
          state.selectedObstacleId = null;
        }
      });
      restoreMapScroll(scroll);
      return result;
    },
    mapDown(event) {
      if (!isAdminLikeRole(state.data.me.role)) return;
      const group = event.target.closest("g[data-booth-id]");
      const obstacleGroup = event.target.closest("g[data-obstacle-id]");
      const activityAreaGroup = event.target.closest("g[data-activity-area-id]");
      if (state.obstacleMode) {
        event.preventDefault();
        state.obstacleDrawing = {
          start: svgPoint(event),
          type: state.obstacleMode
        };
        return;
      }
      if (state.activityAreaMode) {
        event.preventDefault();
        state.activityAreaDrawing = svgPoint(event);
        return;
      }
      if (activityAreaGroup) {
        if (state.drawMode) return;
        const areaId = Number(activityAreaGroup.dataset.activityAreaId);
        if (!(state.data.activityAreas || []).some((item) => item.id === areaId)) return;
        event.preventDefault();
        state.selectedActivityAreaId = areaId;
        state.selectedBoothId = null;
        state.selectedBoothIds.clear();
        state.selectedObstacleId = null;
        render();
        return;
      }
      if (obstacleGroup) {
        if (state.drawMode) return;
        const obstacleId = Number(obstacleGroup.dataset.obstacleId);
        const obstacle = (state.data.obstacles || []).find((item) => item.id === obstacleId);
        if (!obstacle) return;
        const start = svgPoint(event);
        event.preventDefault();
        state.selectedObstacleId = obstacleId;
        state.selectedActivityAreaId = null;
        if (obstacle.boothId) state.selectedBoothId = Number(obstacle.boothId);
        state.mapObstacleDragSnapshot = cloneMapSnapshot();
        state.obstacleDragging = {
          obstacleId,
          startX: start.x,
          startY: start.y,
          originalX: Number(obstacle.x || 0),
          originalY: Number(obstacle.y || 0),
          moved: false
        };
        return;
      }
      if (group && !state.drawMode) {
        const boothId = Number(group.dataset.boothId);
        const booth = state.data.booths.find((item) => item.id === boothId);
        if (!booth || booth.status === "sold" || booth.locked) return;
        const start = svgPoint(event);
        state.selectedBoothId = boothId;
        state.selectedActivityAreaId = null;
        state.mapDragSnapshot = cloneMapSnapshot();
        state.dragging = {
          boothId,
          startX: start.x,
          startY: start.y,
          originalX: booth.x,
          originalY: booth.y,
          moved: false
        };
        return;
      }
      if (!state.drawMode && !group) {
        event.preventDefault();
        state.selecting = {
          start: svgPoint(event),
          additive: event.shiftKey || event.ctrlKey || event.metaKey
        };
        return;
      }
      if (!state.drawMode || group) return;
      event.preventDefault();
      state.drawing = svgPoint(event);
    },
    mapMove(event) {
      if (state.obstacleDrawing) {
        const rect = rectFromPoints(state.obstacleDrawing.start, svgPoint(event));
        updatePreviewRect("obstacle-preview", rect, {
          fill: state.obstacleDrawing.type === "internal" ? "rgba(194, 65, 65, 0.22)" : "rgba(100, 116, 139, 0.22)",
          stroke: state.obstacleDrawing.type === "internal" ? "#c24141" : "#475569",
          "stroke-width": "2",
          "stroke-dasharray": "5 4"
        }, state.obstacleShape);
        return;
      }
      if (state.activityAreaDrawing) {
        const rect = rectFromPoints(state.activityAreaDrawing, svgPoint(event));
        updatePreviewRect("activity-area-preview", rect, {
          fill: "rgba(14, 165, 233, 0.18)",
          stroke: "#0284c7",
          "stroke-width": "2",
          "stroke-dasharray": "6 4"
        });
        return;
      }
      if (state.obstacleDragging) {
        const point = svgPoint(event);
        const dx = Math.round(point.x - state.obstacleDragging.startX);
        const dy = Math.round(point.y - state.obstacleDragging.startY);
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        const obstacle = (state.data.obstacles || []).find((item) => item.id === state.obstacleDragging.obstacleId);
        if (!obstacle) return;
        const next = clampObstaclePosition(
          obstacle,
          state.obstacleDragging.originalX + dx,
          state.obstacleDragging.originalY + dy
        );
        obstacle.x = next.x;
        obstacle.y = next.y;
        state.obstacleDragging.moved = true;
        const shapeElement = document.querySelector(`g[data-obstacle-id="${obstacle.id}"] .obstacle-shape`);
        const text = document.querySelector(`g[data-obstacle-id="${obstacle.id}"] text`);
        setShapeGeometry(shapeElement, obstacle, obstacleShape(obstacle));
        if (text) {
          text.setAttribute("x", Number(obstacle.x) + Number(obstacle.width || 0) / 2);
          text.setAttribute("y", Number(obstacle.y) + Number(obstacle.height || 0) / 2);
        }
        return;
      }
      if (state.selecting) {
        const rect = rectFromPoints(state.selecting.start, svgPoint(event));
        updatePreviewRect("selection-preview", rect, {
          fill: "rgba(24, 160, 88, 0.12)",
          stroke: "#18a058",
          "stroke-width": "2",
          "stroke-dasharray": "7 5"
        });
        return;
      }
      if (state.drawing) {
        const point = svgPoint(event);
        const rect = rectFromPoints(state.drawing, point);
        updatePreviewRect("drawing-preview", rect, {
          fill: "rgba(35, 100, 170, 0.18)",
          stroke: "#2364aa",
          "stroke-width": "2",
          "stroke-dasharray": "6 4"
        });
        return;
      }
      if (!state.dragging) return;
      const point = svgPoint(event);
      const dx = Math.round(point.x - state.dragging.startX);
      const dy = Math.round(point.y - state.dragging.startY);
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      const booth = state.data.booths.find((item) => item.id === state.dragging.boothId);
      if (!booth) return;
      booth.x = Math.max(0, state.dragging.originalX + dx);
      booth.y = Math.max(0, state.dragging.originalY + dy);
      state.dragging.moved = true;
      const rect = document.querySelector(`g[data-booth-id="${booth.id}"] rect`);
      const text = document.querySelector(`g[data-booth-id="${booth.id}"] text`);
      if (rect) {
        rect.setAttribute("x", booth.x);
        rect.setAttribute("y", booth.y);
      }
      if (text) {
        text.setAttribute("x", booth.x + booth.width / 2);
        text.setAttribute("y", booth.y + booth.height / 2);
      }
    },
    async mapUp(event) {
      if (state.obstacleDrawing) {
        const drawing = state.obstacleDrawing;
        state.obstacleDrawing = null;
        const preview = byId("obstacle-preview");
        if (preview) preview.remove();
        const rect = rectFromPoints(drawing.start, svgPoint(event));
        if (rect.width < 6 || rect.height < 6) return;
        let boothId = null;
        if (drawing.type === "internal") {
          const booth = state.data.booths.find((item) => boothContainsRect(item, rect));
          if (!booth) {
            state.error = "展位内障碍物必须完整绘制在某个展位内部";
            render();
            return;
          }
          boothId = booth.id;
        }
        const scroll = captureMapScroll();
        rememberMapState();
        await run(() => api("/api/obstacles", {
          method: "POST",
          body: {
            type: drawing.type,
            shape: state.obstacleShape,
            boothId,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        }), drawing.type === "internal" ? "展位内障碍物已创建，展位价格已重新计算" : "展位外障碍物已创建");
        restoreMapScroll(scroll);
        return;
      }
      if (state.activityAreaDrawing) {
        const start = state.activityAreaDrawing;
        state.activityAreaDrawing = null;
        const preview = byId("activity-area-preview");
        if (preview) preview.remove();
        const rect = rectFromPoints(start, svgPoint(event));
        if (rect.width < 12 || rect.height < 12) return;
        await this.createActivityAreaFromRect(rect, "活动区已创建");
        return;
      }
      if (state.obstacleDragging) {
        const drag = state.obstacleDragging;
        state.obstacleDragging = null;
        state.suppressObstacleClick = drag.moved;
        if (drag.moved) {
          setTimeout(() => {
            state.suppressObstacleClick = false;
          }, 150);
          const obstacle = (state.data.obstacles || []).find((item) => item.id === drag.obstacleId);
          if (obstacle) {
            const scroll = captureMapScroll();
            if (state.mapObstacleDragSnapshot) {
              state.mapUndoStack.push(state.mapObstacleDragSnapshot);
              if (state.mapUndoStack.length > 30) state.mapUndoStack.shift();
              state.mapRedoStack = [];
              state.mapObstacleDragSnapshot = null;
            }
            const result = await run(() => api(`/api/obstacles/${obstacle.id}`, {
              method: "PUT",
              body: { x: Math.round(obstacle.x), y: Math.round(obstacle.y) }
            }), "障碍物位置已保存");
            if (!result) {
              const current = (state.data.obstacles || []).find((item) => item.id === drag.obstacleId);
              if (current) {
                current.x = drag.originalX;
                current.y = drag.originalY;
                render();
              }
            }
            restoreMapScroll(scroll);
          }
        }
        if (!drag.moved) state.mapObstacleDragSnapshot = null;
        return;
      }
      if (state.selecting) {
        const selecting = state.selecting;
        state.selecting = null;
        const preview = byId("selection-preview");
        if (preview) preview.remove();
        const rect = rectFromPoints(selecting.start, svgPoint(event));
        if (rect.width < 8 || rect.height < 8) return;
        const hits = state.data.booths
          .filter((booth) => booth.status === "available" && !booth.locked && boothIntersectsRect(booth, rect))
          .sort((a, b) => (Number(a.y || 0) - Number(b.y || 0)) || (Number(a.x || 0) - Number(b.x || 0)));
        const selected = selecting.additive ? new Set(state.selectedBoothIds) : new Set();
        hits.forEach((booth) => selected.add(booth.id));
        state.selectedBoothIds = selected;
        if (!selecting.additive || !state.selectedBoothIds.has(state.selectedBoothId)) {
          state.selectedBoothId = hits[0]?.id || null;
        }
        state.selectedActivityAreaId = null;
        const baseBooth = state.data.booths.find((item) => item.id === state.selectedBoothId);
        state.message = hits.length ? `已框选 ${hits.length} 个空闲展位，基点为 ${baseBooth?.boothNo || "-"}，可在右侧批量更新或对齐` : "框选范围内没有空闲展位";
        render();
        return;
      }
      if (state.dragging) {
        const drag = state.dragging;
        state.dragging = null;
        if (drag.moved) {
          const booth = state.data.booths.find((item) => item.id === drag.boothId);
          if (booth) {
            const scroll = captureMapScroll();
            if (state.mapDragSnapshot) {
              state.mapUndoStack.push(state.mapDragSnapshot);
              if (state.mapUndoStack.length > 30) state.mapUndoStack.shift();
              state.mapRedoStack = [];
              state.mapDragSnapshot = null;
            }
            await run(() => api(`/api/booths/${booth.id}`, {
              method: "PUT",
              body: { x: booth.x, y: booth.y }
            }), "展位位置已保存");
            restoreMapScroll(scroll);
          }
        }
        if (!drag.moved) state.mapDragSnapshot = null;
        return;
      }
      if (!state.drawing || !isAdminLikeRole(state.data.me.role) || !state.drawMode) return;
      const end = svgPoint(event);
      const preview = byId("drawing-preview");
      if (preview) preview.remove();
      const x = Math.min(state.drawing.x, end.x);
      const y = Math.min(state.drawing.y, end.y);
      const width = Math.abs(end.x - state.drawing.x);
      const height = Math.abs(end.y - state.drawing.y);
      const start = state.drawing;
      state.drawing = null;
      if (width < 12 || height < 12) {
        const presetWidthM = Number(state.drawPresetWidthM || 0);
        const presetDepthM = Number(state.drawPresetDepthM || 0);
        if (presetWidthM <= 0 || presetDepthM <= 0) {
          state.error = "请填写大于 0 的新展位长和宽";
          render();
          return;
        }
        await this.createBoothFromRect({
          x: start.x,
          y: start.y,
          width: meterToPx(presetWidthM),
          height: meterToPx(presetDepthM)
        }, "已按预设尺寸创建展位");
        return;
      }
      await this.createBoothFromRect({ x, y, width, height }, "展位已创建");
    },
    boothClick(event, boothId) {
      event.stopPropagation();
      const booth = state.data.booths.find((item) => item.id === boothId);
      if (!booth) return;
      if (isAdminLikeRole(state.data.me.role)) {
        state.selectedBoothId = boothId;
        state.selectedObstacleId = null;
        state.selectedActivityAreaId = null;
      } else if (booth.status === "available") {
        if (state.selectedBoothIds.has(boothId)) state.selectedBoothIds.delete(boothId);
        else state.selectedBoothIds.add(boothId);
      }
      render();
    },
    obstacleClick(event, obstacleId) {
      event.stopPropagation();
      if (state.suppressObstacleClick) {
        state.suppressObstacleClick = false;
        return;
      }
      if (!isAdminLikeRole(state.data.me.role)) return;
      const obstacle = (state.data.obstacles || []).find((item) => item.id === obstacleId);
      if (!obstacle) return;
      state.selectedObstacleId = obstacleId;
      state.selectedActivityAreaId = null;
      if (obstacle.boothId) state.selectedBoothId = obstacle.boothId;
      render();
    },
    activityAreaClick(event, areaId) {
      event.stopPropagation();
      if (!isAdminLikeRole(state.data.me.role)) return;
      const area = (state.data.activityAreas || []).find((item) => item.id === areaId);
      if (!area) return;
      state.selectedActivityAreaId = areaId;
      state.selectedBoothId = null;
      state.selectedBoothIds.clear();
      state.selectedObstacleId = null;
      render();
    },
    clearObstacleSelection() {
      state.selectedObstacleId = null;
      render();
    },
    clearActivityAreaSelection() {
      state.selectedActivityAreaId = null;
      state.activityAreaSizePreviewHistoryId = null;
      render();
    },
    previewActivityAreaSize() {
      const area = (state.data.activityAreas || []).find((item) => item.id === state.selectedActivityAreaId);
      if (!area) return;
      if (state.activityAreaSizePreviewHistoryId !== area.id) {
        rememberMapState();
        state.activityAreaSizePreviewHistoryId = area.id;
      }
      const widthM = Number(byId("activity-area-width-m")?.value || 0);
      const depthM = Number(byId("activity-area-depth-m")?.value || 0);
      if (!Number.isFinite(widthM) || !Number.isFinite(depthM)) return;
      const map = state.data.map || {};
      const width = Math.min(Math.max(1, meterToPx(widthM)), Math.max(1, Number(map.width || meterToPx(widthM))));
      const height = Math.min(Math.max(1, meterToPx(depthM)), Math.max(1, Number(map.height || meterToPx(depthM))));
      const rect = clampRectToMap({ x: area.x, y: area.y, width, height });
      const shapeElement = document.querySelector(`g[data-activity-area-id="${area.id}"] rect`);
      const text = document.querySelector(`g[data-activity-area-id="${area.id}"] text`);
      const pixelInput = byId("activity-area-pixel-size");
      if (pixelInput) pixelInput.value = `${Math.round(width)} x ${Math.round(height)}`;
      if (shapeElement) {
        shapeElement.setAttribute("x", rect.x);
        shapeElement.setAttribute("y", rect.y);
        shapeElement.setAttribute("width", width);
        shapeElement.setAttribute("height", height);
      }
      if (text) {
        text.setAttribute("x", Number(rect.x) + width / 2);
        text.setAttribute("y", Number(rect.y) + height / 2);
      }
      area.x = rect.x;
      area.y = rect.y;
      area.width = width;
      area.height = height;
    },
    previewObstacleSize() {
      const obstacle = (state.data.obstacles || []).find((item) => item.id === state.selectedObstacleId);
      if (!obstacle) return;
      if (state.obstacleSizePreviewHistoryId !== obstacle.id) {
        rememberMapState();
        state.obstacleSizePreviewHistoryId = obstacle.id;
      }
      const widthM = Number(byId("obstacle-width-m")?.value || 0);
      const depthM = Number(byId("obstacle-depth-m")?.value || 0);
      if (!Number.isFinite(widthM) || !Number.isFinite(depthM)) return;
      const width = meterToPx(widthM);
      const height = meterToPx(depthM);
      const shape = byId("obstacle-shape")?.value === "circle" ? "circle" : "rect";
      const next = obstacleRectForSize(obstacle, width, height);
      const shapeElement = document.querySelector(`g[data-obstacle-id="${obstacle.id}"] .obstacle-shape`);
      const text = document.querySelector(`g[data-obstacle-id="${obstacle.id}"] text`);
      const areaInput = byId("obstacle-area");
      const pixelInput = byId("obstacle-pixel-size");
      const area = obstacleAreaFromSize(widthM, depthM, shape);
      if (areaInput) areaInput.value = fixedDecimal(area, 3);
      if (pixelInput) pixelInput.value = `${width} x ${height} / ${obstacleShapeText(shape)}${next.fits ? "" : " / 超出展位"}`;
      setShapeGeometry(shapeElement, next.rect, shape);
      if (text) {
        text.setAttribute("x", next.rect.x + next.rect.width / 2);
        text.setAttribute("y", next.rect.y + next.rect.height / 2);
      }
      obstacle.x = next.rect.x;
      obstacle.y = next.rect.y;
      obstacle.width = next.rect.width;
      obstacle.height = next.rect.height;
      obstacle.shape = shape;
      obstacle.widthM = Number(widthM.toFixed(3));
      obstacle.depthM = Number(depthM.toFixed(3));
      obstacle.area = area;
      if (obstacle.boothId && next.fits) updateBoothBillingPreview(obstacle.boothId);
    },
    async saveObstacle() {
      const obstacle = (state.data.obstacles || []).find((item) => item.id === state.selectedObstacleId);
      if (!obstacle) return;
      const widthM = Number(byId("obstacle-width-m")?.value || 0);
      const depthM = Number(byId("obstacle-depth-m")?.value || 0);
      if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) {
        state.error = "请填写大于 0 的障碍物长和宽";
        render();
        return;
      }
      const width = meterToPx(widthM);
      const height = meterToPx(depthM);
      const shape = byId("obstacle-shape")?.value === "circle" ? "circle" : "rect";
      const next = obstacleRectForSize(obstacle, width, height);
      if (!next.fits) {
        state.error = "展位内障碍物尺寸不能超过绑定展位，请调小长宽后再保存";
        render();
        return;
      }
      const scroll = captureMapScroll();
      if (state.obstacleSizePreviewHistoryId !== obstacle.id) rememberMapState();
      const result = await run(() => api(`/api/obstacles/${obstacle.id}`, {
        method: "PUT",
        body: {
          x: Math.round(next.rect.x),
          y: Math.round(next.rect.y),
          shape,
          widthM: Number(widthM.toFixed(3)),
          depthM: Number(depthM.toFixed(3)),
          width: Math.round(next.rect.width),
          height: Math.round(next.rect.height)
        }
      }), "障碍物尺寸已保存，相关展位价格已重新计算");
      if (result) {
        state.obstacleSizePreviewHistoryId = null;
        restoreMapScroll(scroll);
      }
    },
    async deleteObstacle(obstacleId) {
      const obstacle = (state.data.obstacles || []).find((item) => item.id === obstacleId);
      if (!obstacle) return;
      if (!window.confirm("确认删除这个障碍物？")) return;
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api(`/api/obstacles/${obstacleId}`, { method: "DELETE" }), "障碍物已删除，相关展位价格已重新计算");
      if (result) {
        state.selectedObstacleId = null;
        restoreMapScroll(scroll);
      }
    },
    async saveActivityArea() {
      const area = (state.data.activityAreas || []).find((item) => item.id === state.selectedActivityAreaId);
      if (!area) return;
      const name = String(byId("activity-area-name")?.value || "").trim();
      if (!name) {
        state.error = "请填写活动区名称";
        render();
        return;
      }
      const widthM = Number(byId("activity-area-width-m")?.value || 0);
      const depthM = Number(byId("activity-area-depth-m")?.value || 0);
      if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) {
        state.error = "请填写大于 0 的活动区长和宽";
        render();
        return;
      }
      const map = state.data.map || {};
      const width = Math.min(Math.max(1, meterToPx(widthM)), Math.max(1, Number(map.width || meterToPx(widthM))));
      const height = Math.min(Math.max(1, meterToPx(depthM)), Math.max(1, Number(map.height || meterToPx(depthM))));
      const rect = clampRectToMap({ x: area.x, y: area.y, width, height });
      const scroll = captureMapScroll();
      if (state.activityAreaSizePreviewHistoryId !== area.id) rememberMapState();
      const result = await run(() => api(`/api/activity-areas/${area.id}`, {
        method: "PUT",
        body: {
          name,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(width),
          height: Math.round(height)
        }
      }), "活动区已保存");
      if (result) {
        state.activityAreaSizePreviewHistoryId = null;
        restoreMapScroll(scroll);
      }
    },
    async deleteActivityArea(areaId) {
      const area = (state.data.activityAreas || []).find((item) => item.id === areaId);
      if (!area) return;
      if (!window.confirm(`确认删除活动区“${area.name || "活动区"}”？`)) return;
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api(`/api/activity-areas/${areaId}`, { method: "DELETE" }), "活动区已删除");
      if (result) {
        state.selectedActivityAreaId = null;
        state.activityAreaSizePreviewHistoryId = null;
        restoreMapScroll(scroll);
      }
    },
    toggleSelected(boothId) {
      if (state.selectedBoothIds.has(boothId)) {
        state.selectedBoothIds.delete(boothId);
        if (state.selectedBoothId === boothId) {
          state.selectedBoothId = [...state.selectedBoothIds][0] || null;
        }
      } else {
        state.selectedBoothIds.add(boothId);
        state.selectedBoothId = boothId;
      }
      render();
    },
    clearBoothSelection() {
      state.selectedBoothIds.clear();
      state.pendingBoothIds = [];
      state.selectedBoothId = null;
      state.selectedActivityAreaId = null;
      render();
    },
    useSelectedBooths() {
      const boothIds = selectedAvailableBooths().map((booth) => booth.id);
      state.pendingBoothIds = [...new Set(boothIds)];
      state.view = "new-customers";
      state.message = state.pendingBoothIds.length
        ? `已带入 ${state.pendingBoothIds.length} 个展位，请在客户列表选择企业后点击“参展”创建订单`
        : "请先选择空闲展位";
      render();
    },
    openBoothPicker() {
      this.updateOrderDraft();
      state.customerAttendLeadId = null;
      state.boothPickerOpen = true;
      state.boothPickerSearch = "";
      state.boothPickerFocusId = null;
      render();
      setTimeout(() => this.orderTypeChanged(), 0);
    },
    closeBoothPicker() {
      this.updateOrderDraft();
      state.boothPickerOpen = false;
      state.customerAttendLeadId = null;
      state.boothPickerFocusId = null;
      render();
      setTimeout(() => this.orderTypeChanged(), 0);
    },
    setBoothSearch(value) {
      this.updateOrderDraft();
      state.boothPickerSearch = value || "";
      state.boothPickerFocusId = null;
      render();
      setTimeout(() => {
        const input = byId("booth-search");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    searchBoothPicker() {
      this.updateOrderDraft();
      const value = byId("booth-search")?.value || state.boothPickerSearch;
      const booth = findBoothByNo(value);
      if (!booth) {
        state.error = "未找到对应展位号";
        render();
        return;
      }
      state.error = "";
      state.boothPickerSearch = String(value || "").trim();
      state.boothPickerFocusId = booth.id;
      render();
      setTimeout(() => {
        this.orderTypeChanged();
        scrollModalMapToBooth("booth-picker-map", booth);
      }, 0);
    },
    pickerBoothClick(event, boothId) {
      this.updateOrderDraft();
      event.stopPropagation();
      const booth = state.data.booths.find((item) => item.id === boothId);
      if (!booth || booth.status !== "available") return;
      if (state.pendingBoothIds.includes(boothId)) {
        state.pendingBoothIds = state.pendingBoothIds.filter((id) => id !== boothId);
      } else {
        state.pendingBoothIds = [...state.pendingBoothIds, boothId];
      }
      render();
      setTimeout(() => this.orderTypeChanged(), 0);
    },
    confirmBoothPicker() {
      this.updateOrderDraft();
      if (state.customerAttendLeadId) {
        this.createOrder();
        return;
      }
      state.boothPickerOpen = false;
      render();
      setTimeout(() => this.orderTypeChanged(), 0);
    },
    clearPickerSelection() {
      this.updateOrderDraft();
      state.pendingBoothIds = [];
      render();
      setTimeout(() => this.orderTypeChanged(), 0);
    },
    openPaymentModal(orderId) {
      state.paymentModalOrderId = orderId;
      render();
    },
    closePaymentModal() {
      state.paymentModalOrderId = null;
      render();
    },
    openChangeBoothPicker(orderId) {
      state.changePickerOpen = true;
      state.changePickerOrderId = orderId;
      state.changePickerSearch = "";
      state.changePickerBoothIds = [];
      state.changePickerFocusId = null;
      render();
    },
    closeChangeBoothPicker() {
      state.changePickerOpen = false;
      state.changePickerOrderId = null;
      state.changePickerSearch = "";
      state.changePickerBoothIds = [];
      state.changePickerFocusId = null;
      render();
    },
    setChangeBoothSearch(value) {
      state.changePickerSearch = value || "";
      state.changePickerFocusId = null;
      render();
      setTimeout(() => {
        const input = byId("change-booth-search");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    searchChangeBooth() {
      const value = byId("change-booth-search")?.value || state.changePickerSearch;
      const booth = findBoothByNo(value);
      if (!booth) {
        state.error = "未找到对应展位号";
        render();
        return;
      }
      state.error = "";
      state.changePickerSearch = String(value || "").trim();
      state.changePickerFocusId = booth.id;
      render();
      setTimeout(() => scrollModalMapToBooth("change-booth-map", booth), 0);
    },
    changeBoothClick(event, boothId) {
      event.stopPropagation();
      const booth = state.data.booths.find((item) => item.id === boothId);
      if (!booth || booth.status !== "available") return;
      state.changePickerBoothIds = state.changePickerBoothIds.includes(boothId)
        ? state.changePickerBoothIds.filter((id) => id !== boothId)
        : [...state.changePickerBoothIds, boothId];
      state.changePickerFocusId = boothId;
      render();
    },
    async submitChangeBooth() {
      const order = state.data.orders.find((item) => item.id === state.changePickerOrderId);
      if (!order || !state.changePickerBoothIds.length) {
        state.error = "请选择要更换的新展位";
        render();
        return;
      }
      const newBooths = state.changePickerBoothIds.map((id) => state.data.booths.find((item) => item.id === id)).filter(Boolean);
      const result = await run(() => api(`/api/orders/${order.id}/change-requests`, {
        method: "POST",
        body: {
          type: "更换展位",
          action: "change_booth",
          boothIds: state.changePickerBoothIds,
          detail: `更换展位：${orderBoothNos(order) || "-"} -> ${newBooths.map((booth) => booth.boothNo).join(" / ")}`
        }
      }), "更换展位申请已提交，等待管理员审核");
      if (result) {
        state.changePickerOpen = false;
        state.changePickerOrderId = null;
        state.changePickerBoothIds = [];
        state.changePickerSearch = "";
        render();
      }
    },
    async requestCancelOrder(orderId) {
      const order = state.data.orders.find((item) => item.id === orderId);
      if (!order) return;
      if (!window.confirm(`确认提交退订展位申请？\n订单：${order.orderNo}\n展位：${orderBoothNos(order) || "-"}`)) return;
      await run(() => api(`/api/orders/${orderId}/change-requests`, {
        method: "POST",
        body: {
          type: "退订展位",
          action: "cancel_order",
          detail: `退订展位：${orderBoothNos(order) || "-"}`
        }
      }), "退订申请已提交，等待管理员审核");
    },
    async requestSpecialOrder(orderId) {
      const order = state.data.orders.find((item) => item.id === orderId);
      if (!order) return;
      const reason = window.prompt(
        `请输入特殊订单申请原因\n订单：${order.orderNo}\n企业：${getCompany(order.companyId).name || "-"}`,
        "客户付款进度较慢，申请特殊成交"
      );
      if (reason === null) return;
      const result = await run(() => api(`/api/orders/${orderId}/change-requests`, {
        method: "POST",
        body: {
          type: "特殊订单申请",
          action: "special_order",
          detail: String(reason || "").trim() || "客户付款进度较慢，申请特殊成交"
        }
      }), "特殊订单申请已提交，等待管理员审核");
      if (result) {
        state.paymentModalOrderId = null;
        render();
      }
    },
    async uploadBackground() {
      await run(async () => {
        const input = byId("bg-file");
        const file = input?.files?.[0];
        const dimensions = await imageDimensionsFromFile(file);
        const attachment = await uploadFileFromInput("bg-file", "map-background");
        const backgroundWidth = dimensions?.width || attachment?.width;
        const backgroundHeight = dimensions?.height || attachment?.height;
        if (!attachment) throw new Error("请选择底图文件");
        return api("/api/map/background", {
          method: "POST",
          body: {
            attachmentId: attachment.id,
            width: backgroundWidth,
            height: backgroundHeight,
            scaleBooths: false
          }
        });
      }, "底图已上传，原展位已保留，请重新填写比例尺");
    },
    async fitBackgroundToImage() {
      await run(async () => {
        const map = state.data.map;
        if (!map.backgroundAttachmentId) throw new Error("请先上传底图");
        const dimensions = await imageDimensionsFromUrl(fileUrl(map.backgroundAttachmentId));
        if (!dimensions.width || !dimensions.height) throw new Error("无法读取底图原始尺寸");
        return api("/api/map/settings", {
          method: "PUT",
          body: { width: dimensions.width, height: dimensions.height, scaleBooths: true }
        });
      }, "底图已按原图比例校正");
    },
    async saveBooth() {
      const booth = state.data.booths.find((item) => item.id === state.selectedBoothId);
      if (!booth) return;
      if (booth.locked) {
        state.error = "展位已锁定，请先解锁再编辑";
        render();
        return;
      }
      const widthM = Number(byId("booth-width-m").value || booth.widthM || 0);
      const depthM = Number(byId("booth-depth-m").value || booth.depthM || 0);
      const boothNo = String(byId("booth-no").value || "").trim();
      const boothNoError = boothNoValidationError(boothNo, booth.id);
      if (boothNoError) {
        window.alert(boothNoError);
        state.error = boothNoError;
        render();
        return;
      }
      if (state.boothSizePreviewHistoryId !== booth.id) rememberMapState();
      const result = await run(() => api(`/api/booths/${booth.id}`, {
        method: "PUT",
        body: {
          boothNo,
          hall: byId("booth-hall").value,
          zone: byId("booth-zone").value,
          attr: byId("booth-attr").value,
          status: byId("booth-status").value,
          area: Number((widthM * depthM).toFixed(2)),
          widthM: widthM || booth.widthM,
          depthM: depthM || booth.depthM,
          width: meterToPx(widthM || booth.widthM),
          height: meterToPx(depthM || booth.depthM)
        }
      }), "展位已保存");
      if (result) state.boothSizePreviewHistoryId = null;
    },
    previewBoothSize() {
      const booth = state.data.booths.find((item) => item.id === state.selectedBoothId);
      if (!booth) return;
      if (booth.locked) return;
      if (state.boothSizePreviewHistoryId !== booth.id) {
        rememberMapState();
        state.boothSizePreviewHistoryId = booth.id;
      }
      const widthM = Number(byId("booth-width-m")?.value || booth.widthM || 0);
      const depthM = Number(byId("booth-depth-m")?.value || booth.depthM || 0);
      const width = meterToPx(widthM);
      const height = meterToPx(depthM);
      const rect = document.querySelector(`g[data-booth-id="${booth.id}"] rect`);
      const text = document.querySelector(`g[data-booth-id="${booth.id}"] text`);
      const areaInput = byId("booth-area");
      const pixelInput = byId("booth-pixel-size");
      if (areaInput) areaInput.value = Number((widthM * depthM).toFixed(2));
      if (pixelInput) pixelInput.value = `${width} x ${height}`;
      if (rect) {
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
      }
      if (text) {
        text.setAttribute("x", booth.x + width / 2);
        text.setAttribute("y", booth.y + height / 2);
      }
      booth.width = width;
      booth.height = height;
      booth.widthM = widthM;
      booth.depthM = depthM;
      booth.area = Number((widthM * depthM).toFixed(2));
    },
    async batchUpdateBooths() {
      const selected = selectedAvailableBooths();
      const ids = selected.map((booth) => booth.id);
      if (!ids.length) {
        state.error = "请先选择要批量更新的展位";
        render();
        return;
      }
      const patch = { hall: byId("batch-hall").value, zone: byId("batch-zone").value, attr: byId("batch-attr").value };
      const status = byId("batch-status").value;
      if (status) patch.status = status;
      rememberMapState();
      await run(() => api("/api/booths/batch", {
        method: "POST",
        body: { ids, patch }
      }), "批量更新完成");
    },
    async toggleBoothLock(boothId) {
      const booth = state.data.booths.find((item) => item.id === boothId);
      if (!booth) return;
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api(`/api/booths/${boothId}`, {
        method: "PUT",
        body: { locked: !booth.locked }
      }), booth.locked ? "展位已解锁" : "展位已锁定");
      if (result) restoreMapScroll(scroll);
    },
    async deleteBooth(boothId) {
      const booth = state.data.booths.find((item) => item.id === boothId);
      if (!booth) return;
      if (!window.confirm(`确认删除展位 ${booth.boothNo}？`)) return;
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api(`/api/booths/${boothId}`, { method: "DELETE" }), "展位已删除");
      if (result) {
        state.selectedBoothIds.delete(boothId);
        if (state.selectedBoothId === boothId) state.selectedBoothId = null;
        render();
        restoreMapScroll(scroll);
      }
    },
    async deleteSelectedBooths() {
      const booths = selectedAvailableBooths();
      const ids = booths.map((booth) => booth.id);
      if (!ids.length) {
        state.error = "请先框选要删除的空闲展位";
        render();
        return;
      }
      if (!window.confirm(`确认删除选中的 ${booths.length} 个展位？`)) return;
      if (booths.length >= 5 && window.prompt("批量删除后可用“误删恢复”恢复，请输入“删除”确认") !== "删除") return;
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api("/api/booths/delete", {
        method: "POST",
        body: { ids }
      }), `已删除 ${booths.length} 个展位`);
      if (result) {
        state.selectedBoothIds.clear();
        state.selectedBoothId = null;
        render();
        restoreMapScroll(scroll);
      }
    },
    async copySelectedBooths() {
      const selected = selectedAvailableBooths();
      if (!selected.length) {
        state.error = "请先框选要复制的空闲展位";
        render();
        return;
      }
      const offsetInput = window.prompt("复制后的偏移像素", "12");
      if (offsetInput === null) return;
      const offset = Math.max(1, Number(offsetInput || 12) || 12);
      const map = state.data.map || {};
      const existingNos = new Set((state.data.booths || []).map((booth) => String(booth.boothNo || "").trim()).filter(Boolean));
      const { prefix, numericWidth, startNo } = normalizedDrawBoothNoConfig();
      const step = state.drawBoothNoSkipEnabled === "yes" ? Math.max(1, Number(state.drawBoothNoStep || 0) || 1) : 1;
      const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
      const formatNo = (number) => `${prefix}${String(number).padStart(numericWidth, "0")}`;
      const numbers = [...existingNos]
        .map((value) => value.match(pattern))
        .filter(Boolean)
        .map((match) => Number(match[1]))
        .filter((number) => Number.isFinite(number));
      let candidate = state.drawBoothNoResetActive || !numbers.length ? startNo : Math.max(startNo - step, ...numbers) + step;
      const nextCopyNo = () => {
        for (let index = 0; index < 10000; index += 1) {
          const boothNo = formatNo(candidate);
          candidate += step;
          if (!existingNos.has(boothNo)) {
            existingNos.add(boothNo);
            return boothNo;
          }
        }
        const fallback = `复制${Date.now()}`;
        existingNos.add(fallback);
        return fallback;
      };
      const clones = selected.map((booth) => {
        const rect = clampRectToMap({
          x: Number(booth.x || 0) + offset,
          y: Number(booth.y || 0) + offset,
          width: Number(booth.width || 0),
          height: Number(booth.height || 0)
        });
        return {
          ...booth,
          id: 0,
          boothNo: nextCopyNo(),
          x: rect.x,
          y: rect.y,
          status: "available",
          orderId: null,
          reservedAt: null,
          reservedBy: null,
          locked: false,
          updatedAt: new Date().toISOString()
        };
      });
      const snapshot = cloneMapSnapshot();
      const scroll = captureMapScroll();
      rememberMapState();
      const result = await run(() => api("/api/map/snapshot", {
        method: "POST",
        body: {
          booths: snapshot.booths.concat(clones),
          obstacles: snapshot.obstacles,
          activityAreas: snapshot.activityAreas
        }
      }), `已复制 ${clones.length} 个展位`);
      if (result) {
        state.selectedBoothIds.clear();
        state.selectedBoothId = null;
        restoreMapScroll(scroll);
      }
    },
    async applyBoothAlignment(axis) {
      const mode = byId(axis === "x" ? "booth-align-x-mode" : "booth-align-y-mode")?.value || "align:start";
      const [action, edge] = mode.split(":");
      if (action === "attach") {
        await this.attachSelectedBooths(axis, edge);
      } else {
        await this.alignSelectedBooths(axis, edge);
      }
    },
    async alignSelectedBooths(axis, edge = "start") {
      const selected = selectedAvailableBooths();
      if (selected.length < 2) {
        state.error = "请至少框选 2 个空闲展位再对齐";
        render();
        return;
      }
      const base = selected.find((booth) => booth.id === state.selectedBoothId) || selected[0];
      state.selectedBoothId = base.id;
      const positions = selected.map((booth) => (
        axis === "x"
          ? {
              id: booth.id,
              y: preciseCoord(edge === "end" ? boothBottom(base) - Number(booth.height || 0) : boothTop(base))
            }
          : {
              id: booth.id,
              x: preciseCoord(edge === "end" ? boothRight(base) - Number(booth.width || 0) : boothLeft(base))
            }
      ));
      const label = boothAlignmentLabel(axis, edge);
      rememberMapState();
      await run(() => api("/api/booths/batch", {
        method: "POST",
        body: { ids: selected.map((booth) => booth.id), positions }
      }), `已沿 ${axis.toUpperCase()} 轴按基点 ${base.boothNo} ${label}`);
    },
    async attachSelectedBooths(axis, edge = "start") {
      const selected = selectedAvailableBooths();
      if (selected.length < 2) {
        state.error = "请至少框选 2 个空闲展位再贴合";
        render();
        return;
      }
      const base = selected.find((booth) => booth.id === state.selectedBoothId) || selected[0];
      state.selectedBoothId = base.id;
      const horizontal = axis === "x";
      const ordered = [...selected].sort((a, b) => (
        horizontal
          ? (boothLeft(a) - boothLeft(b)) || (boothTop(a) - boothTop(b))
          : (boothTop(a) - boothTop(b)) || (boothLeft(a) - boothLeft(b))
      ));
      const baseIndex = Math.max(0, ordered.findIndex((booth) => booth.id === base.id));
      const map = state.data.map || {};
      const positions = new Map();
      if (horizontal) {
        const alignY = (booth) => edge === "end" ? boothBottom(base) - Number(booth.height || 0) : boothTop(base);
        let left = Number(base.x || 0);
        let right = Number(base.x || 0) + Number(base.width || 0);
        positions.set(base.id, { id: base.id, x: Number(base.x || 0), y: alignY(base) });
        for (let index = baseIndex - 1; index >= 0; index -= 1) {
          const booth = ordered[index];
          left -= Number(booth.width || 0);
          positions.set(booth.id, { id: booth.id, x: left, y: alignY(booth) });
        }
        for (let index = baseIndex + 1; index < ordered.length; index += 1) {
          const booth = ordered[index];
          positions.set(booth.id, { id: booth.id, x: right, y: alignY(booth) });
          right += Number(booth.width || 0);
        }
        const values = [...positions.values()];
        const min = Math.min(...values.map((item) => item.x));
        const max = Math.max(...values.map((item) => item.x + Number(ordered.find((booth) => booth.id === item.id)?.width || 0)));
        const limit = Number(map.width || max);
        let shift = min < 0 ? -min : 0;
        if (max + shift > limit) {
          const fitShift = limit - max;
          if (min + fitShift >= 0) shift = fitShift;
        }
        values.forEach((item) => { item.x += shift; });
      } else {
        const alignX = (booth) => edge === "end" ? boothRight(base) - Number(booth.width || 0) : boothLeft(base);
        let top = Number(base.y || 0);
        let bottom = Number(base.y || 0) + Number(base.height || 0);
        positions.set(base.id, { id: base.id, x: alignX(base), y: Number(base.y || 0) });
        for (let index = baseIndex - 1; index >= 0; index -= 1) {
          const booth = ordered[index];
          top -= Number(booth.height || 0);
          positions.set(booth.id, { id: booth.id, x: alignX(booth), y: top });
        }
        for (let index = baseIndex + 1; index < ordered.length; index += 1) {
          const booth = ordered[index];
          positions.set(booth.id, { id: booth.id, x: alignX(booth), y: bottom });
          bottom += Number(booth.height || 0);
        }
        const values = [...positions.values()];
        const min = Math.min(...values.map((item) => item.y));
        const max = Math.max(...values.map((item) => item.y + Number(ordered.find((booth) => booth.id === item.id)?.height || 0)));
        const limit = Number(map.height || max);
        let shift = min < 0 ? -min : 0;
        if (max + shift > limit) {
          const fitShift = limit - max;
          if (min + fitShift >= 0) shift = fitShift;
        }
        values.forEach((item) => { item.y += shift; });
      }
      const label = boothAlignmentLabel(axis, edge);
      const finalPositions = [...positions.values()].map((item) => ({
        id: item.id,
        x: preciseCoord(item.x),
        y: preciseCoord(item.y)
      }));
      rememberMapState();
      await run(() => api("/api/booths/batch", {
        method: "POST",
        body: { ids: selected.map((booth) => booth.id), positions: finalPositions }
      }), `已沿 ${axis.toUpperCase()} 轴按基点 ${base.boothNo} ${label}并贴合`);
    },
    async clearAllBooths() {
      if (!window.confirm("确认清空全部展位？该操作只允许在没有未结束订单时执行。")) return;
      if (window.prompt("清空后可用“误删恢复”恢复，请输入“清空展位图”确认") !== "清空展位图") return;
      rememberMapState();
      await run(() => api("/api/booths/clear", { method: "POST" }), "展位图已清空，可以重新绘制");
      state.selectedBoothId = null;
      state.selectedBoothIds.clear();
      state.selectedObstacleId = null;
      state.selectedActivityAreaId = null;
    },
    async generateGrid(replace) {
      const confirmText = replace ? "确认重置现有展位为 520 个样例展位？" : "确认追加 520 个样例展位？";
      if (!window.confirm(confirmText)) return;
      rememberMapState();
      await run(() => api("/api/booths/generate-grid", {
        method: "POST",
        body: { rows: 20, cols: 26, startNo: replace ? 1001 : state.data.booths.length + 1001, replace }
      }), replace ? "已重置样例展位" : "已追加样例展位");
    },
    orderTypeChanged() {
      const type = byId("order-type")?.value || "booth";
      state.orderDraft.type = type;
      const boothSection = byId("booth-order-section");
      const customSection = byId("custom-order-section");
      if (boothSection) boothSection.style.display = type === "booth" ? "" : "none";
      if (customSection) customSection.style.display = type === "custom" ? "" : "none";
      render();
    },
    async createOrder() {
      await run(async () => {
        this.updateOrderDraft();
        const type = state.orderDraft.type;
        const body = {
          type,
          title: state.orderDraft.title.trim(),
          customerLeadId: state.customerAttendLeadId || undefined,
          companyId: state.orderDraft.companyId ? Number(state.orderDraft.companyId) : undefined,
          salespersonId: state.orderDraft.salespersonId ? Number(state.orderDraft.salespersonId) : undefined,
          company: {
            name: state.orderDraft.companyName.trim(),
            shortName: state.orderDraft.companyShortName.trim(),
            contactName: state.orderDraft.companyContact.trim(),
            phone: state.orderDraft.companyPhone.trim(),
            email: state.orderDraft.companyEmail.trim(),
            address: state.orderDraft.companyAddress.trim(),
            taxNo: state.orderDraft.companyTax.trim(),
            locationType: state.orderDraft.companyLocationType,
            countryRegion: state.orderDraft.companyLocationType === "overseas" ? state.orderDraft.companyCountryRegion : "",
            province: state.orderDraft.companyLocationType === "overseas" ? "" : state.orderDraft.companyProvince,
            city: state.orderDraft.companyLocationType === "overseas" ? "" : state.orderDraft.companyCity
          },
          details: state.orderDraft.details.trim()
        };
        if (state.orderDraft.hasDiscount === "yes") {
          if (!state.orderDraft.discountRuleId) throw new Error("请选择优惠规则");
          body.discountRuleId = state.orderDraft.discountRuleId;
        }
        if (!body.company.name) throw new Error("请填写企业名称");
        const duplicateOrder = state.data.orders.find((order) => (
          order.eventId === state.data.settings.event.id
          && isActiveOrder(order)
          && companyNameKey(getCompany(order.companyId).name) === companyNameKey(body.company.name)
        ));
        if (duplicateOrder) throw new Error(`当前展会中企业“${body.company.name}”已存在有效订单 ${duplicateOrder.orderNo}`);
        if (type === "booth") {
          body.boothIds = state.pendingBoothIds;
          if (!body.boothIds.length) throw new Error("请选择展位");
        } else {
          body.totalAmount = Number(state.orderDraft.customAmount || 0);
          body.details = `${body.details}\n${state.orderDraft.customDetail || ""}`.trim();
        }
        const result = await api("/api/orders", { method: "POST", body });
        state.pendingBoothIds = [];
        state.selectedBoothIds.clear();
        state.boothPickerOpen = false;
        state.customerAttendLeadId = null;
        state.orderDraft = {
          type: "booth",
          salespersonId: "",
          title: "展位订单",
          companyName: "",
          companyShortName: "",
          companyContact: "",
          companyPhone: "",
          companyEmail: "",
          companyAddress: "",
          companyTax: "",
          companyLocationType: "domestic",
          companyCountryRegion: "",
          companyProvince: "广东省",
          companyCity: "广州市",
          companyId: "",
          customAmount: "0",
          customDetail: "",
          hasDiscount: "no",
          discountRuleId: "",
          details: ""
        };
        state.view = "exhibitor-list";
        return result;
      }, "订单已创建，展位已预留");
    },
    async submitPayment(orderId) {
      const result = await run(async () => {
        const amount = Number(byId("payment-amount")?.value || 0);
        if (amount <= 0) throw new Error("请填写收款金额");
        const attachment = await uploadFileFromInput("payment-file", "payment-voucher", { orderId });
        if (!attachment) throw new Error("请选择水单文件");
        return api(`/api/orders/${orderId}/payments`, {
          method: "POST",
          body: { amount, voucherAttachmentId: attachment ? attachment.id : null }
        });
      }, "水单已提交，等待管理员审核");
      if (result) {
        state.paymentModalOrderId = null;
        render();
      }
    },
    openAttachmentPreview(id) {
      state.attachmentPreviewId = Number(id);
      render();
    },
    closeAttachmentPreview() {
      state.attachmentPreviewId = null;
      render();
    },
    async issueEnterpriseAccount(orderId) {
      const result = await run(() => api(`/api/orders/${orderId}/enterprise-account`, { method: "POST" }), "企业账号已生成");
      if (result) {
        window.alert(`企业账号：${result.username}\n临时密码：${result.password}`);
      }
    },
    async issueEnterpriseLink(orderId) {
      const days = enterpriseLinkDaysValue();
      const result = await run(() => api(`/api/orders/${orderId}/enterprise-link`, {
        method: "POST",
        body: { days }
      }), "企业免登录链接已生成");
      if (result) {
        try {
          await navigator.clipboard.writeText(result.link);
          window.prompt(`企业免登录链接已生成并复制，有效期至：${date(result.expiresAt)}`, result.link);
        } catch (_) {
          window.prompt(`企业免登录链接已生成，有效期至：${date(result.expiresAt)}`, result.link);
        }
      }
    },
    async submitChangeRequest(orderId) {
      const detail = byId(`change-${orderId}`).value.trim();
      if (!detail) {
        state.error = "请填写变更说明";
        render();
        return;
      }
      await run(() => api(`/api/orders/${orderId}/change-requests`, {
        method: "POST",
        body: { type: "订单变更", detail }
      }), "变更申请已提交");
    },
    async reviewPayment(paymentId, status) {
      const body = reviewRemarkPayload(status, "水单审核");
      if (!body) return;
      await run(() => api(`/api/payments/${paymentId}/review`, {
        method: "POST",
        body
      }), "水单审核已处理");
    },
    async reviewCustomerFile(leadId, type, status) {
      const body = reviewRemarkPayload(status, type === "contract" ? "客户合同审核" : "客户水单审核");
      if (!body) return;
      await run(() => api(`/api/customer-leads/${leadId}/${type}/review`, {
        method: "POST",
        body
      }), type === "contract" ? "客户合同审核已处理" : "客户水单审核已处理");
    },
    async reviewFascia(profileId, status) {
      const body = reviewRemarkPayload(status, "楣板审核");
      if (!body) return;
      await run(() => api(`/api/exhibitor/fascia/${profileId}/review`, {
        method: "POST",
        body
      }), "楣板审核已处理");
    },
    async reviewRental(profileId, rentalId, status) {
      const body = reviewRemarkPayload(status, "展具增租审核");
      if (!body) return;
      await run(() => api(`/api/exhibitor/rentals/${profileId}/${rentalId}/review`, {
        method: "POST",
        body
      }), "展具审核已处理");
    },
    async reviewChange(requestId, status) {
      const body = reviewRemarkPayload(status, "订单变更审核");
      if (!body) return;
      await run(() => api(`/api/change-requests/${requestId}/review`, {
        method: "POST",
        body
      }), "变更审核已处理");
    },
    async saveSettings() {
      await run(() => api("/api/settings", {
        method: "PUT",
        body: {
          rules: {
            standardPrice: Number(byId("rule-standard").value || 0),
            rawPrice: Number(byId("rule-raw").value || 0),
            depositRate: Number(byId("rule-deposit").value || 0),
            reserveWorkdays: Number(byId("rule-workdays").value || 0),
            deadlineDayMode: byId("rule-deadline-day-mode")?.value || "workday",
            noticeDaysBeforeRelease: Number(byId("rule-notice").value || 0),
            newCustomerProtectDays: Number(byId("rule-new-customer-days").value || 0),
            oldCustomerProtectDays: Number(byId("rule-old-customer-days").value || 0),
            adminContactMaskMode: byId("rule-admin-contact-mask-mode")?.value || "off",
            contractApprovedVoucherWorkdays: Number(byId("rule-contract-voucher-workdays")?.value ?? state.data.settings.rules.contractApprovedVoucherWorkdays ?? state.data.settings.rules.reserveWorkdays ?? 7),
            salesFlowMode: byId("rule-sales-flow")?.value || "voucher_direct",
            customerTargetMode: byId("rule-customer-target-mode")?.value || "sales",
            enterpriseLinkDays: clampEnterpriseLinkDaysValue(byId("rule-enterprise-link-days")?.value),
            enterpriseLinkDaysCustomized: clampEnterpriseLinkDaysValue(byId("rule-enterprise-link-days")?.value) < eventCountdownDaysValue()
          },
          salesTargets: this.collectSalesTargets(),
          departmentTargets: this.collectDepartmentTargets(),
          discountRules: this.collectDiscountRules(),
          reviewRejectTemplates: (byId("review-reject-templates")?.value || "").split(/\n+/).map((item) => item.trim()).filter(Boolean)
        }
      }), "销售规则已保存");
    },
    salesFlowRuleChanged() {
      const rules = state.data.settings.rules;
      rules.standardPrice = Number(byId("rule-standard")?.value ?? rules.standardPrice ?? 0);
      rules.rawPrice = Number(byId("rule-raw")?.value ?? rules.rawPrice ?? 0);
      rules.depositRate = Number(byId("rule-deposit")?.value ?? rules.depositRate ?? 0);
      rules.reserveWorkdays = Number(byId("rule-workdays")?.value ?? rules.reserveWorkdays ?? 7);
      rules.deadlineDayMode = byId("rule-deadline-day-mode")?.value || rules.deadlineDayMode || "workday";
      rules.noticeDaysBeforeRelease = Number(byId("rule-notice")?.value ?? rules.noticeDaysBeforeRelease ?? 0);
      rules.newCustomerProtectDays = Number(byId("rule-new-customer-days")?.value ?? rules.newCustomerProtectDays ?? 30);
      rules.oldCustomerProtectDays = Number(byId("rule-old-customer-days")?.value ?? rules.oldCustomerProtectDays ?? 30);
      rules.adminContactMaskMode = byId("rule-admin-contact-mask-mode")?.value || rules.adminContactMaskMode || "off";
      rules.contractApprovedVoucherWorkdays = Number(byId("rule-contract-voucher-workdays")?.value ?? rules.contractApprovedVoucherWorkdays ?? rules.reserveWorkdays ?? 7);
      rules.salesFlowMode = byId("rule-sales-flow")?.value || "voucher_direct";
      rules.customerTargetMode = byId("rule-customer-target-mode")?.value || rules.customerTargetMode || "sales";
      rules.enterpriseLinkDays = clampEnterpriseLinkDaysValue(byId("rule-enterprise-link-days")?.value ?? rules.enterpriseLinkDays);
      if (byId("review-reject-templates")) {
        state.data.settings.reviewRejectTemplates = byId("review-reject-templates").value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      }
      render();
    },
    collectSalesTargets() {
      if (!state.data.users.some((user) => user.role === "sales" && byId(`sales-task-${user.id}`))) {
        return state.data.settings.salesTargets || [];
      }
      return state.data.users.filter((user) => user.role === "sales").map((user) => ({
        userId: user.id,
        taskCount: Number(byId(`sales-task-${user.id}`)?.value || 0),
        protectionLimit: Number(byId(`sales-protect-${user.id}`)?.value || 0)
      }));
    },
    collectDepartmentTargets() {
      if (!departmentList().some((department) => byId(`department-task-${department.id}`))) {
        return state.data.settings.departmentTargets || [];
      }
      return departmentList().map((department) => ({
        departmentId: department.id,
        taskCount: Number(byId(`department-task-${department.id}`)?.value || 0),
        protectionLimit: Number(byId(`department-protect-${department.id}`)?.value || 0)
      }));
    },
    async saveSalesTargets() {
      await run(() => api("/api/settings", {
        method: "PUT",
        body: {
          rules: { customerTargetMode: byId("rule-customer-target-mode")?.value || "sales" },
          salesTargets: this.collectSalesTargets(),
          departmentTargets: this.collectDepartmentTargets()
        }
      }), "客户保护与销售任务已保存");
    },
    collectDiscountRules() {
      return discountRules().map((rule, index) => ({
        id: rule.id,
        reason: byId(`discount-rule-reason-${index}`)?.value.trim() || rule.reason,
        price: Number(byId(`discount-rule-price-${index}`)?.value || 0)
      })).filter((rule) => rule.reason);
    },
    async saveDiscountRules() {
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { discountRules: this.collectDiscountRules() }
      }), "优惠规则已保存");
    },
    async addDiscountRule() {
      const reason = byId("discount-reason")?.value.trim() || "";
      const price = Number(byId("discount-price")?.value || 0);
      if (!reason || price <= 0) {
        state.error = "请填写优惠事由和大于 0 的优惠价格";
        render();
        return;
      }
      const discountRules = [...this.collectDiscountRules(), { id: `discount-${Date.now()}`, reason, price }];
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { discountRules }
      }), "优惠规则已新增");
    },
    async deleteDiscountRule(index) {
      if (!window.confirm("确认删除这条优惠规则？")) return;
      const discountRules = this.collectDiscountRules().filter((_, idx) => idx !== index);
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { discountRules }
      }), "优惠规则已删除");
    },
    collectHalls() {
      return hallList().map((hall, index) => (byId(`hall-name-${index}`)?.value.trim() || hall)).filter(Boolean);
    },
    async saveHallTable() {
      const halls = this.collectHalls();
      if (!halls.length) {
        state.error = "至少保留一个展馆";
        render();
        return;
      }
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { halls }
      }), "展馆已保存");
    },
    async addHall() {
      const halls = this.collectHalls();
      halls.push(`展馆${halls.length + 1}`);
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { halls }
      }), "展馆已新增");
    },
    async deleteHall(index) {
      if (!window.confirm("确认删除这个展馆？已绘制展位的所在展馆名称不会自动修改。")) return;
      const halls = this.collectHalls().filter((_, idx) => idx !== index);
      if (!halls.length) {
        state.error = "至少保留一个展馆";
        render();
        return;
      }
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { halls }
      }), "展馆已删除");
    },
    collectZones() {
      return zoneList().map((zone, index) => ({
        name: byId(`zone-name-${index}`)?.value.trim() || zone.name,
        color: normalizeColor(byId(`zone-color-${index}`)?.value || zone.color, index)
      })).filter((zone) => zone.name);
    },
    async saveZoneTable() {
      const zones = this.collectZones();
      if (!zones.length) {
        state.error = "至少保留一个展区";
        render();
        return;
      }
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { zones }
      }), "展区已保存，销售展位图颜色已更新");
    },
    async addZone() {
      const zones = this.collectZones();
      const nextIndex = zones.length + 1;
      zones.push({
        name: `展区${nextIndex}`,
        color: defaultZoneColors[zones.length % defaultZoneColors.length]
      });
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { zones }
      }), "展区已新增");
    },
    async deleteZone(index) {
      if (!window.confirm("确认删除这个展区？已绘制展位的展区名称不会自动修改。")) return;
      const zones = this.collectZones().filter((_, idx) => idx !== index);
      if (!zones.length) {
        state.error = "至少保留一个展区";
        render();
        return;
      }
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { zones }
      }), "展区已删除");
    },
    collectFurniture() {
      return (state.data.settings.furniture || []).map((item, index) => ({
        id: item.id,
        name: byId(`furn-name-${index}`)?.value.trim() || item.name,
        size: byId(`furn-size-${index}`)?.value.trim() || "",
        price: Number(byId(`furn-price-${index}`)?.value || 0),
        active: byId(`furn-active-${index}`)?.value !== "false",
        image: item.image || ""
      })).filter((item) => item.name);
    },
    async saveFurnitureTable() {
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { furniture: this.collectFurniture() }
      }), "展具表已保存");
    },
    async uploadFurnitureImage(index) {
      await run(async () => {
        const attachment = await uploadFileFromInput(`furn-image-${index}`, "furniture-image");
        if (!attachment) throw new Error("请选择展具缩略图");
        const furniture = this.collectFurniture();
        if (!furniture[index]) throw new Error("展具不存在");
        furniture[index].image = attachment.id;
        return api("/api/settings", {
          method: "PUT",
          body: { furniture }
        });
      }, "展具缩略图已上传");
    },
    async addFurniture() {
      const item = {
        id: `furn-${Date.now()}`,
        name: byId("furniture-name").value.trim(),
        size: byId("furniture-size").value.trim(),
        price: Number(byId("furniture-price").value || 0),
        active: byId("furniture-active").value !== "false",
        image: ""
      };
      if (!item.name) {
        state.error = "请填写展具名称";
        render();
        return;
      }
      const furniture = [...this.collectFurniture(), item];
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { furniture }
      }), "展具已新增");
    },
    async deleteFurniture(index) {
      if (!window.confirm("确认删除这个展具？")) return;
      const furniture = this.collectFurniture().filter((_, idx) => idx !== index);
      await run(() => api("/api/settings", {
        method: "PUT",
        body: { furniture }
      }), "展具已删除");
    },
    async syncWorkdays() {
      const source = byId("sync-source").value.trim();
      if (source) state.data.settings.workdaySync = { ...(state.data.settings.workdaySync || {}), sourceUrl: source };
      await run(async () => {
        if (source) {
          await api("/api/settings", { method: "PUT", body: { workdaySync: { sourceUrl: source } } });
        }
        return api("/api/workdays/sync", {
          method: "POST",
          body: { year: Number(byId("sync-year").value || new Date().getFullYear()) }
        });
      }, "中国大陆工作日已同步");
    },
    async runReleaseJob() {
      await run(() => api("/api/jobs/release", { method: "POST" }), "释放检查已执行");
    },
    async markNotificationRead(notificationId) {
      await run(() => api(`/api/notifications/${notificationId}/read`, { method: "POST" }), "提醒已标记为已读");
    },
    async addDepartment() {
      const name = byId("new-department-name")?.value.trim();
      if (!name) {
        state.error = "请填写部门名称";
        render();
        return;
      }
      await run(() => api("/api/departments", {
        method: "POST",
        body: { name }
      }), "部门已新增");
    },
    async updateDepartment(id) {
      const name = byId(`department-name-${id}`)?.value.trim();
      if (!name) {
        state.error = "请填写部门名称";
        render();
        return;
      }
      await run(() => api(`/api/departments/${id}`, {
        method: "PUT",
        body: { name }
      }), "部门已保存");
    },
    async deleteDepartment(id) {
      if (!window.confirm("确认删除该部门？部门内账号会变为未分配部门。")) return;
      await run(() => api(`/api/departments/${id}`, { method: "DELETE" }), "部门已删除");
    },
    async assignUserDepartment(userId, departmentId) {
      await run(() => api(`/api/users/${userId}/department`, {
        method: "PUT",
        body: { departmentId: Number(departmentId || 0) || null }
      }), "账号部门已更新");
    },
    async changeMyPassword() {
      const currentPassword = byId("self-current-password")?.value || "";
      const newPassword = byId("self-new-password")?.value || "";
      const confirmPassword = byId("self-confirm-password")?.value || "";
      if (!currentPassword || !newPassword || !confirmPassword) {
        state.error = "请填写原密码、新密码和确认密码";
        render();
        return;
      }
      if (newPassword !== confirmPassword) {
        state.error = "两次输入的新密码不一致";
        render();
        return;
      }
      await run(() => api("/api/me/password", {
        method: "PUT",
        body: { currentPassword, newPassword }
      }), "密码已修改");
    },
    async createUser() {
      await run(() => api("/api/users", {
        method: "POST",
        body: {
          displayName: byId("new-display").value.trim(),
          username: byId("new-username").value.trim(),
          password: byId("new-password").value,
          role: byId("new-role").value,
          departmentId: Number(byId("new-department")?.value || 0) || null
        }
      }), "账号已创建");
    },
    async deleteUser(userId) {
      const target = state.data.users.find((user) => Number(user.id) === Number(userId));
      if (!target) return;
      const orders = userOrderCount(userId);
      if (orders > 0) {
        state.error = `账号已有 ${orders} 个订单，不能删除`;
        render();
        return;
      }
      if (!window.confirm(`确认删除账号“${target.displayName || target.username}”？`)) return;
      await run(() => api(`/api/users/${userId}`, { method: "DELETE" }), "账号已删除");
    },
    async saveCatalog() {
      await run(async () => {
        const profile = state.data.profiles.find((item) => item.orderId === state.data.me.orderId);
        const catalog = {
          companyIntro: byId("catalog-company").value.trim(),
          productIntro: byId("catalog-product").value.trim(),
          productImageIds: profile?.catalog?.productImageIds || []
        };
        const video = await uploadFileFromInput("catalog-video", "catalog-video", { orderId: state.data.me.orderId, companyId: state.data.me.companyId });
        const image = await uploadFileFromInput("catalog-image", "product-image", { orderId: state.data.me.orderId, companyId: state.data.me.companyId });
        if (video) catalog.videoAttachmentId = video.id;
        if (image) catalog.productImageIds = [...catalog.productImageIds, image.id];
        return api("/api/exhibitor/profile", { method: "PUT", body: { catalog } });
      }, "会刊资料已保存");
    },
    async addBadge() {
      await run(() => api("/api/exhibitor/badges", {
        method: "POST",
        body: {
          name: byId("badge-name").value.trim(),
          phone: byId("badge-phone").value.trim(),
          title: byId("badge-title").value.trim(),
          idNo: byId("badge-idno").value.trim()
        }
      }), "参展证已添加");
    },
    async deleteBadge(badgeId) {
      if (!window.confirm("确认删除这条参展证信息？")) return;
      await run(() => api(`/api/exhibitor/badges/${encodeURIComponent(badgeId)}`, { method: "DELETE" }), "参展证已删除");
    },
    async submitFascia() {
      await run(() => api("/api/exhibitor/fascia", {
        method: "POST",
        body: { requestedName: byId("fascia-name").value.trim() }
      }), "楣板修改已提交");
    },
    selectRentalFurniture(id) {
      const select = byId("rental-furniture");
      if (select) select.value = id;
    },
    async submitRental() {
      await run(() => api("/api/exhibitor/rentals", {
        method: "POST",
        body: { furnitureId: byId("rental-furniture").value, qty: Number(byId("rental-qty").value || 1) }
      }), "展具申请已提交");
    },
    async deleteRental(rentalId) {
      if (!window.confirm("确认删除这条展具增租申请？")) return;
      await run(() => api(`/api/exhibitor/rentals/${encodeURIComponent(rentalId)}`, { method: "DELETE" }), "展具增租申请已删除");
    },
    async downloadExport(path, filename) {
      try {
        const response = await api(path);
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (error) {
        state.error = error.message;
        render();
      }
    }
  };

  function render() {
    const mapScroll = captureMapScrolls();
    if (!state.data) renderLogin();
    else {
      renderShell();
      if (mapScroll.length) restoreMapScroll(mapScroll);
      else scheduleFitMapZoom();
      setTimeout(updateDrawPresetPosition, 0);
      setTimeout(setupCountdowns, 0);
    }
  }
})();

window.App = App;
window.addEventListener("resize", () => App.fitMapToViewport?.());
App.init();
