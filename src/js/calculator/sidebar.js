const SUMMARY_GROUP_HEADINGS = {
  storage: "Storage",
  service: "Collection & service",
  schedule: "Date & time",
};

function appendDivider(container) {
  const div = document.createElement("div");
  div.className = "summary-block-divider";
  div.setAttribute("aria-hidden", "true");
  container.appendChild(div);
}

function appendBlockHeader(container, group) {
  const head = document.createElement("div");
  head.className = "summary-block__heading";
  head.textContent = SUMMARY_GROUP_HEADINGS[group] || group;
  container.appendChild(head);
}

function appendPricedRow(body, label, price, suffix) {
  const row = document.createElement("div");
  row.className = "summary-line summary-line--priced";
  const lab = document.createElement("span");
  lab.className = "summary-line__label";
  lab.textContent = label;
  const amt = document.createElement("span");
  amt.className = "summary-line__amount";
  amt.textContent = `£${price.toFixed(2)}${suffix || ""}`;
  row.append(lab, amt);
  body.appendChild(row);
}

function appendScheduleRow(body, label, detail) {
  const row = document.createElement("div");
  row.className = "summary-line summary-line--schedule";
  const k = document.createElement("span");
  k.className = "summary-line__key";
  k.textContent = label;
  const v = document.createElement("span");
  v.className = "summary-line__val";
  v.textContent = detail;
  row.append(k, v);
  body.appendChild(row);
}

function appendNoteRow(body, label) {
  const row = document.createElement("div");
  row.className = "summary-line summary-line--note";
  const lab = document.createElement("span");
  lab.className = "summary-line__label";
  lab.textContent = label;
  row.appendChild(lab);
  body.appendChild(row);
}

function appendDropoffRow(body, label) {
  const row = document.createElement("div");
  row.className = "summary-line summary-line--dropoff";
  const lab = document.createElement("span");
  lab.className = "summary-line__label";
  lab.textContent = label;
  row.appendChild(lab);
  body.appendChild(row);
}

function appendLineRow(body, line) {
  const hasPrice =
    line.price != null && typeof line.price === "number" && !Number.isNaN(line.price);
  if (hasPrice) {
    appendPricedRow(body, line.label, line.price, line.suffix);
    return;
  }
  if (line.variant === "dropoff") {
    appendDropoffRow(body, line.label);
    return;
  }
  if (line.detail) {
    appendScheduleRow(body, line.label, line.detail);
    return;
  }
  appendNoteRow(body, line.label);
}

export function initSidebar({
  store,
  summaryItems,
  summarySubtotal,
  summaryTotal,
  continueBtn,
  mobileSummaryTotal,
  mobileContinueBtn,
  summaryCard,
  summaryMobileToggle,
}) {
  function renderLines(lines, hasItems, currentTab) {
    summaryItems.innerHTML = "";

    if (!hasItems) {
      const empty =
        currentTab === "boxes"
          ? "Please select items to store."
          : "Please select a storage unit.";
      summaryItems.innerHTML = `<div class="summary-empty">${empty}</div>`;
      return;
    }

    let currentGroup = null;

    for (const line of lines) {
      const group = line.group || "storage";
      if (group !== currentGroup) {
        if (currentGroup !== null) {
          appendDivider(summaryItems);
        }
        const block = document.createElement("div");
        block.className = `summary-block summary-block--${group}`;
        appendBlockHeader(block, group);
        const body = document.createElement("div");
        body.className = "summary-block__body";
        block.appendChild(body);
        summaryItems.appendChild(block);
        currentGroup = group;
        appendLineRow(body, line);
      } else {
        const block = summaryItems.lastElementChild;
        const body = block?.querySelector(".summary-block__body");
        if (body) appendLineRow(body, line);
      }
    }
  }

  function render(_event, snapshot) {
    if (!snapshot) return;
    const { currentTab, hasItems, subtotal, lines, currentStep } = snapshot;

    renderLines(lines, hasItems, currentTab);

    const priceText = `£${subtotal.toFixed(2)}`;
    if (summarySubtotal) summarySubtotal.textContent = priceText;
    if (summaryTotal) summaryTotal.textContent = priceText;
    if (mobileSummaryTotal) mobileSummaryTotal.textContent = priceText;

    if (currentStep < 4) {
      const disabled = !hasItems;
      if (continueBtn) continueBtn.disabled = disabled;
      if (mobileContinueBtn) mobileContinueBtn.disabled = disabled;
    }
  }

  if (summaryMobileToggle && summaryCard) {
    summaryMobileToggle.addEventListener("click", () =>
      summaryCard.classList.toggle("is-expanded"),
    );
  }

  const summaryCardInfo = document.getElementById("summaryCardInfo");
  const summaryCardInfoText = summaryCardInfo?.querySelector(
    ".summary-card__info-text",
  );
  if (summaryCardInfo && summaryCardInfoText) {
    function syncSummaryInfoTruncation() {
      if (summaryCardInfo.classList.contains("is-expanded")) {
        summaryCardInfo.classList.add("is-interactive");
        summaryCardInfo.tabIndex = 0;
        return;
      }
      const truncated =
        summaryCardInfoText.scrollWidth > summaryCardInfoText.clientWidth + 1;
      summaryCardInfo.classList.toggle("is-interactive", truncated);
      summaryCardInfo.tabIndex = truncated ? 0 : -1;
    }

    summaryCardInfo.addEventListener("click", () => {
      if (summaryCardInfo.classList.contains("is-expanded")) {
        summaryCardInfo.classList.remove("is-expanded");
        summaryCardInfo.setAttribute("aria-expanded", "false");
        requestAnimationFrame(syncSummaryInfoTruncation);
        return;
      }
      if (!summaryCardInfo.classList.contains("is-interactive")) return;
      summaryCardInfo.classList.add("is-expanded");
      summaryCardInfo.setAttribute("aria-expanded", "true");
    });

    summaryCardInfo.addEventListener("keydown", (e) => {
      if (!summaryCardInfo.classList.contains("is-interactive")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        summaryCardInfo.click();
      }
    });

    const ro = new ResizeObserver(() => syncSummaryInfoTruncation());
    ro.observe(summaryCardInfoText);
    ro.observe(summaryCardInfo);
    requestAnimationFrame(syncSummaryInfoTruncation);
  }

  store.subscribe(render);

  render(null, store.getSnapshot());
}
