import { escapeHTML } from "./escape-html.js";
import { loadSiteConfig } from "../site-config/load-site-config.js";
import {
  normalizeSiteConfigPayload,
  saveSiteConfig,
} from "../site-config/save-site-config.js";

function countPostcodes(text) {
  return text
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean).length;
}

function normalizePostcodeList(text) {
  return text
    .split("\n")
    .map((line) => line.trim().toUpperCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function initAdminApp() {
  const tableBody = document.getElementById("itemsTableBody");
  const addItemBtn = document.getElementById("addItemBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const exportConfigBtn = document.getElementById("exportConfigBtn");
  const toast = document.getElementById("toast");
  const postcodeField = document.getElementById("allowedPostcodes");
  const postcodeStat = document.getElementById("postcodeStat");
  const normalizeBtn = document.getElementById("normalizePostcodesBtn");
  const itemsCountPill = document.getElementById("itemsCountPill");
  const saveStatus = document.getElementById("adminSaveStatus");
  const saveStatusText = document.getElementById("adminSaveStatusText");
  const aside = document.getElementById("sr-admin-aside");
  const navToggle = document.getElementById("adminNavToggle");
  const backdrop = document.getElementById("adminNavBackdrop");
  const navLinks = document.querySelectorAll(".sr-admin__nav-link");

  if (
    !tableBody ||
    !addItemBtn ||
    !saveSettingsBtn ||
    !toast ||
    !postcodeField ||
    !postcodeStat ||
    !normalizeBtn ||
    !itemsCountPill ||
    !saveStatus ||
    !saveStatusText
  ) {
    return;
  }

  const initial = await loadSiteConfig();

  const adminConfigData = {
    items: structuredClone(initial.items),
  };

  document.getElementById("globalDiscount").value = String(initial.globalDiscount);
  document.getElementById("baseFeeBoxes").value = String(initial.baseFeeBoxes);
  document.getElementById("baseFeeFurniture").value = String(initial.baseFeeFurniture);
  postcodeField.value = initial.allowedPostcodes.join("\n");

  let dirty = false;

  function setDirty(value) {
    dirty = value;
    saveStatus.classList.toggle("is-dirty", value);
    saveStatusText.textContent = value ? "Unsaved changes" : "All changes saved";
  }

  function updatePostcodeStat() {
    const n = countPostcodes(postcodeField.value);
    postcodeStat.textContent = `${n} ${n === 1 ? "postcode" : "postcodes"}`;
  }

  function updateItemsPill() {
    const n = adminConfigData.items.length;
    itemsCountPill.textContent = `${n} ${n === 1 ? "item" : "items"}`;
  }

  function buildPayload() {
    return {
      globalDiscount: document.getElementById("globalDiscount").value,
      baseFeeBoxes: document.getElementById("baseFeeBoxes").value,
      baseFeeFurniture: document.getElementById("baseFeeFurniture").value,
      allowedPostcodes: postcodeField.value
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      items: structuredClone(adminConfigData.items),
      restrictToAllowedPostcodes: Boolean(initial.restrictToAllowedPostcodes),
      warehouseLatitude: initial.warehouseLatitude,
      warehouseLongitude: initial.warehouseLongitude,
      distancePricing: initial.distancePricing
        ? { ...initial.distancePricing }
        : undefined,
    };
  }

  function closeMobileNav() {
    aside?.classList.remove("is-open");
    backdrop?.classList.remove("is-visible");
    if (backdrop) backdrop.setAttribute("aria-hidden", "true");
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open section menu");
    }
  }

  function openMobileNav() {
    aside?.classList.add("is-open");
    backdrop?.classList.add("is-visible");
    if (backdrop) backdrop.setAttribute("aria-hidden", "false");
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", "Close section menu");
    }
  }

  if (navToggle && aside && backdrop) {
    navToggle.addEventListener("click", () => {
      if (aside.classList.contains("is-open")) closeMobileNav();
      else openMobileNav();
    });
    backdrop.addEventListener("click", closeMobileNav);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobileNav();
    });
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) closeMobileNav();
      });
    });
  }

  const sectionIds = ["section-general", "section-prices", "section-locations", "section-items"];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("data-nav") === id);
        });
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    sections.forEach((el) => obs.observe(el));
  }

  function renderTable() {
    tableBody.innerHTML = "";
    adminConfigData.items.forEach((item, index) => {
      const idSafe = escapeHTML(item.id);
      const nameSafe = escapeHTML(item.name);
      const descSafe = escapeHTML(item.desc);
      const priceSafe = escapeHTML(String(item.price));

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="sr-admin__row-num" data-label="#">${index + 1}</td>
        <td data-label="ID"><input type="text" class="sr-admin__inline-input" value="${idSafe}" data-index="${index}" data-field="id" autocomplete="off" /></td>
        <td data-label="Name"><input type="text" class="sr-admin__inline-input" value="${nameSafe}" data-index="${index}" data-field="name" autocomplete="off" /></td>
        <td data-label="Description"><input type="text" class="sr-admin__inline-input" value="${descSafe}" data-index="${index}" data-field="desc" autocomplete="off" /></td>
        <td data-label="Price (£)"><input type="number" class="sr-admin__inline-input" value="${priceSafe}" step="0.01" min="0" data-index="${index}" data-field="price" inputmode="decimal" /></td>
        <td class="sr-admin__td-actions">
          <button type="button" class="sr-admin__btn--icon-ghost delete-row-btn" data-index="${index}" aria-label="Remove item ${nameSafe}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    document.querySelectorAll(".sr-admin__inline-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const id = Number(e.target.getAttribute("data-index"));
        const field = e.target.getAttribute("data-field");
        let val = e.target.value;
        if (field === "price") val = parseFloat(val) || 0;
        adminConfigData.items[id][field] = val;
        setDirty(true);
      });
    });

    document.querySelectorAll(".delete-row-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        const name = adminConfigData.items[idx]?.name || "this item";
        if (!window.confirm(`Remove “${name}” from the catalogue?`)) return;
        adminConfigData.items.splice(idx, 1);
        setDirty(true);
        renderTable();
        updateItemsPill();
      });
    });

    updateItemsPill();
  }

  [
    document.getElementById("globalDiscount"),
    document.getElementById("baseFeeBoxes"),
    document.getElementById("baseFeeFurniture"),
  ].forEach((el) => {
    el?.addEventListener("input", () => setDirty(true));
  });

  postcodeField.addEventListener("input", () => {
    updatePostcodeStat();
    setDirty(true);
  });

  normalizeBtn.addEventListener("click", () => {
    postcodeField.value = normalizePostcodeList(postcodeField.value);
    updatePostcodeStat();
    setDirty(true);
  });

  addItemBtn.addEventListener("click", () => {
    adminConfigData.items.push({
      id: `item_${Date.now()}`,
      name: "New item",
      desc: "",
      price: 0,
    });
    setDirty(true);
    renderTable();
  });

  if (exportConfigBtn) {
    exportConfigBtn.addEventListener("click", () => {
      downloadJson(
        "calculator-config.json",
        normalizeSiteConfigPayload(buildPayload()),
      );
    });
  }

  saveSettingsBtn.addEventListener("click", () => {
    saveSettingsBtn.classList.add("is-loading");
    saveSettingsBtn.disabled = true;

    const payload = buildPayload();
    if (import.meta.env.DEV) {
      console.log("Saving to WP REST API:", payload);
    }

    window.setTimeout(() => {
      saveSiteConfig(payload);
      saveSettingsBtn.classList.remove("is-loading");
      saveSettingsBtn.disabled = false;
      setDirty(false);
      toast.classList.add("is-visible");
      window.setTimeout(() => toast.classList.remove("is-visible"), 4000);
    }, 600);
  });

  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  function syncNavFromHash() {
    const id = (window.location.hash || "#section-general").slice(1);
    const match = document.querySelector(`.sr-admin__nav-link[data-nav="${id}"]`);
    if (match) {
      navLinks.forEach((l) => l.classList.toggle("is-active", l === match));
    }
  }
  window.addEventListener("hashchange", syncNavFromHash);
  syncNavFromHash();

  updatePostcodeStat();
  renderTable();
  setDirty(false);
}
