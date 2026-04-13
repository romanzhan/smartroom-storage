import { loadSiteConfig } from "./site-config/load-site-config.js";
import { saveSiteConfig } from "./site-config/save-site-config.js";
import { defaultSiteConfig } from "./site-config/defaults.js";
import { unitsData as defaultUnitsLegacy } from "./calculator/data.js";

// ── State ──────────────────────────────────────────────────
let config = null;
let isDirty = false;

// ── DOM refs ───────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const saveBtn = $("#saveBtn");
const resetBtn = $("#resetBtn");
const downloadBtn = $("#downloadBtn");
const saveStatus = $("#saveStatus");
const toast = $("#toast");
const sidebar = $("#sidebar");
const backdrop = $("#backdrop");
const burgerBtn = $("#burgerBtn");
const nav = $("#nav");

// ── Init ───────────────────────────────────────────────────
async function init() {
  config = await loadSiteConfig();
  if (!config.units) {
    config.units = (defaultSiteConfig.units || defaultUnitsLegacy).map((u) => ({ ...u }));
  }
  if (!config.durationDiscounts) {
    config.durationDiscounts = defaultSiteConfig.durationDiscounts.map((d) => ({ ...d }));
  }
  populateAll();
  bindEvents();
  updatePctLabels();
}

// ── Populate form from config ──────────────────────────────
function populateAll() {
  $$("[data-key]").forEach((el) => {
    const val = getNestedValue(config, el.dataset.key);
    if (val == null) return;
    if (el.type === "checkbox") {
      el.checked = Boolean(val);
    } else {
      el.value = val;
    }
  });

  renderItemsTable();
  renderUnitsTable();
  renderExtrasTable();
  renderDiscountsTable();
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== "object") {
      cur[keys[i]] = {};
    }
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// ── Discounts table ────────────────────────────────────────
function renderDiscountsTable() {
  const tbody = $("#discountsTable tbody");
  tbody.innerHTML = "";
  // Sort descending for display
  const sorted = [...(config.durationDiscounts || [])].sort((a, b) => b.minMonths - a.minMonths);
  config.durationDiscounts = sorted;
  sorted.forEach((tier, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" class="admin-input" value="${tier.minMonths}" data-didx="${i}" data-field="minMonths" min="1" step="1" /></td>
      <td><input type="number" class="admin-input" value="${tier.discount}" data-didx="${i}" data-field="discount" min="0" max="100" step="1" /></td>
      <td><button class="admin-btn admin-btn--danger" data-remove="discount" data-didx="${i}" title="Удалить">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Items table ────────────────────────────────────────────
function renderItemsTable() {
  const tbody = $("#itemsTable tbody");
  tbody.innerHTML = "";
  (config.items || []).forEach((item, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="admin-input" value="${esc(item.id)}" data-idx="${i}" data-field="id" /></td>
      <td><input type="text" class="admin-input" value="${esc(item.name)}" data-idx="${i}" data-field="name" /></td>
      <td><input type="text" class="admin-input" value="${esc(item.desc)}" data-idx="${i}" data-field="desc" style="min-width:180px" /></td>
      <td><input type="number" class="admin-input" value="${item.price}" data-idx="${i}" data-field="price" min="0" step="0.1" /></td>
      <td><input type="number" class="admin-input" value="${item.volume}" data-idx="${i}" data-field="volume" min="0" step="0.001" /></td>
      <td><button class="admin-btn admin-btn--danger" data-remove="item" data-idx="${i}" title="Удалить">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Units table ────────────────────────────────────────────
function renderUnitsTable() {
  const tbody = $("#unitsTable tbody");
  tbody.innerHTML = "";
  (config.units || []).forEach((unit, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="admin-input" value="${esc(unit.id)}" data-uidx="${i}" data-field="id" /></td>
      <td><input type="text" class="admin-input" value="${esc(unit.name)}" data-uidx="${i}" data-field="name" /></td>
      <td><input type="text" class="admin-input" value="${esc(unit.size)}" data-uidx="${i}" data-field="size" /></td>
      <td><input type="number" class="admin-input" value="${unit.price}" data-uidx="${i}" data-field="price" min="0" step="0.5" /></td>
      <td><input type="number" class="admin-input" value="${unit.volume}" data-uidx="${i}" data-field="volume" min="0" step="0.5" /></td>
      <td><button class="admin-btn admin-btn--danger" data-remove="unit" data-uidx="${i}" title="Удалить">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Extras table ───────────────────────────────────────────
function renderExtrasTable() {
  const tbody = $("#extrasTable tbody");
  tbody.innerHTML = "";
  (config.extras || []).forEach((extra, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="admin-input" value="${esc(extra.id)}" data-eidx="${i}" data-field="id" /></td>
      <td><input type="text" class="admin-input" value="${esc(extra.name)}" data-eidx="${i}" data-field="name" style="min-width:180px" /></td>
      <td><input type="number" class="admin-input" value="${extra.price}" data-eidx="${i}" data-field="price" min="0" step="1" /></td>
      <td style="text-align:center"><input type="checkbox" ${extra.perItem ? "checked" : ""} data-eidx="${i}" data-field="perItem" /></td>
      <td><button class="admin-btn admin-btn--danger" data-remove="extra" data-eidx="${i}" title="Удалить">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Collect all form values into config ────────────────────
function collectConfig() {
  // Simple fields
  $$("[data-key]").forEach((el) => {
    let val;
    if (el.type === "checkbox") {
      val = el.checked;
    } else if (el.type === "number") {
      val = el.value === "" ? 0 : Number(el.value);
    } else {
      val = el.value;
    }
    setNestedValue(config, el.dataset.key, val);
  });

  // Items
  config.items = collectTableRows("#itemsTable", "idx", ["id", "name", "desc", "price", "volume"]);
  config.items.forEach((item) => {
    item.price = Number(item.price) || 0;
    item.volume = Number(item.volume) || 0;
  });

  // Units
  config.units = collectTableRows("#unitsTable", "uidx", ["id", "name", "size", "price", "volume"]);
  config.units.forEach((unit) => {
    unit.price = Number(unit.price) || 0;
    unit.volume = Number(unit.volume) || 0;
  });

  // Extras
  config.extras = collectTableRows("#extrasTable", "eidx", ["id", "name", "price", "perItem"]);
  config.extras.forEach((extra) => {
    extra.price = Number(extra.price) || 0;
    extra.perItem = Boolean(extra.perItem);
  });

  // Duration discounts
  config.durationDiscounts = collectTableRows("#discountsTable", "didx", ["minMonths", "discount"]);
  config.durationDiscounts.forEach((tier) => {
    tier.minMonths = Number(tier.minMonths) || 0;
    tier.discount = Number(tier.discount) || 0;
  });
  config.durationDiscounts.sort((a, b) => b.minMonths - a.minMonths);

  return config;
}

function collectTableRows(tableSelector, idxAttr, fields) {
  const rows = [];
  const inputs = $$(`${tableSelector} tbody [data-${idxAttr}]`);
  inputs.forEach((input) => {
    const idx = parseInt(input.dataset[idxAttr]);
    if (!rows[idx]) rows[idx] = {};
    const field = input.dataset.field;
    if (input.type === "checkbox") {
      rows[idx][field] = input.checked;
    } else {
      rows[idx][field] = input.value;
    }
  });
  return rows.filter(Boolean);
}

// ── Bind events ────────────────────────────────────────────
function bindEvents() {
  document.addEventListener("input", () => markDirty());
  document.addEventListener("change", () => markDirty());

  $$("[data-pct]").forEach((span) => {
    const inputId = span.dataset.pct;
    const input = $(`#${inputId}`);
    if (input) {
      input.addEventListener("input", () => updatePctLabel(span, input));
    }
  });

  saveBtn.addEventListener("click", handleSave);
  resetBtn.addEventListener("click", handleReset);
  downloadBtn.addEventListener("click", handleDownload);

  // Add rows
  $("#addItemBtn").addEventListener("click", () => {
    config.items.push({ id: "", name: "", desc: "", price: 0, volume: 0 });
    renderItemsTable();
    markDirty();
  });
  $("#addUnitBtn").addEventListener("click", () => {
    config.units.push({ id: "", name: "", size: "", price: 0, volume: 0 });
    renderUnitsTable();
    markDirty();
  });
  $("#addExtraBtn").addEventListener("click", () => {
    config.extras.push({ id: "", name: "", price: 0, perItem: false });
    renderExtrasTable();
    markDirty();
  });
  $("#addDiscountBtn").addEventListener("click", () => {
    config.durationDiscounts.push({ minMonths: 1, discount: 0 });
    renderDiscountsTable();
    markDirty();
  });

  // Remove rows (delegated)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const type = btn.dataset.remove;
    if (type === "item") {
      config.items.splice(parseInt(btn.dataset.idx), 1);
      renderItemsTable();
    } else if (type === "unit") {
      config.units.splice(parseInt(btn.dataset.uidx), 1);
      renderUnitsTable();
    } else if (type === "extra") {
      config.extras.splice(parseInt(btn.dataset.eidx), 1);
      renderExtrasTable();
    } else if (type === "discount") {
      config.durationDiscounts.splice(parseInt(btn.dataset.didx), 1);
      renderDiscountsTable();
    }
    markDirty();
  });

  // Sidebar navigation
  nav.addEventListener("click", (e) => {
    const link = e.target.closest(".admin-nav__link[data-section]");
    if (!link) return;
    $$(".admin-nav__link").forEach((l) => l.classList.remove("is-active"));
    link.classList.add("is-active");
    closeMobileNav();
  });

  // Scroll spy
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          $$(".admin-nav__link").forEach((l) => {
            l.classList.toggle("is-active", l.dataset.section === id);
          });
        }
      });
    },
    { rootMargin: "-20% 0px -60% 0px" }
  );
  $$(".admin-section").forEach((s) => observer.observe(s));

  // Mobile nav
  burgerBtn.addEventListener("click", toggleMobileNav);
  backdrop.addEventListener("click", closeMobileNav);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileNav();
  });

  // Warn on unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

// ── Handlers ───────────────────────────────────────────────
function handleSave() {
  collectConfig();
  saveSiteConfig(config);
  isDirty = false;
  updateStatus();
  showToast("Настройки сохранены", "success");
}

function handleReset() {
  if (!confirm("Сбросить все настройки к значениям по умолчанию? Это действие нельзя отменить.")) return;
  config = JSON.parse(JSON.stringify(defaultSiteConfig));
  populateAll();
  markDirty();
  showToast("Сброшено — сохраните для применения", "success");
}

function handleDownload() {
  collectConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "calculator-config.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Конфиг экспортирован", "success");
}

// ── Helpers ────────────────────────────────────────────────
function markDirty() {
  isDirty = true;
  updateStatus();
}

function updateStatus() {
  saveStatus.textContent = isDirty ? "Есть несохранённые изменения" : "Все изменения сохранены";
  saveStatus.className = "admin-topbar__status " + (isDirty ? "is-dirty" : "is-saved");
}

function showToast(msg, type = "") {
  toast.textContent = msg;
  toast.className = "admin-toast is-visible" + (type ? ` is-${type}` : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = "admin-toast";
  }, 2500);
}

function updatePctLabels() {
  $$("[data-pct]").forEach((span) => {
    const input = $(`#${span.dataset.pct}`);
    if (input) updatePctLabel(span, input);
  });
}

function updatePctLabel(span, input) {
  const val = parseFloat(input.value) || 0;
  span.textContent = `${Math.round(val * 100)}%`;
}

function toggleMobileNav() {
  sidebar.classList.toggle("is-open");
  backdrop.classList.toggle("is-visible");
}

function closeMobileNav() {
  sidebar.classList.remove("is-open");
  backdrop.classList.remove("is-visible");
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// ── Go ─────────────────────────────────────────────────────
init();
