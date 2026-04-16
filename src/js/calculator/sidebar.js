function row(container, label, value) {
  const div = document.createElement("div");
  div.className = "summary-line summary-line--priced";
  const l = document.createElement("span");
  l.className = "summary-line__label";
  l.textContent = label;
  const r = document.createElement("span");
  r.className = "summary-line__amount";
  r.textContent = value;
  div.append(l, r);
  container.appendChild(div);
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
  if (!summaryItems) {
    console.error("[SmartRoom] initSidebar: summaryItems missing");
    return;
  }

  const monthlyBox = document.getElementById("futureMonthlyAmount");
  let renderCounter = 0;

  function renderSidebar(snapshot) {
    renderCounter++;
    console.log(
      "[SmartRoom] sidebar render #" + renderCounter,
      {
        step: snapshot.currentStep,
        tab: snapshot.currentTab,
        storage: +snapshot.storagePrice.toFixed(2),
        insurance: +snapshot.insurancePrice.toFixed(2),
        collection: +snapshot.collectionFee.toFixed(2),
        vat: +snapshot.vatAmount.toFixed(2),
        subtotal: +snapshot.subtotal.toFixed(2),
        monthly: +snapshot.monthlyPayment.toFixed(2),
        volume: +snapshot.totalVolume.toFixed(3),
        movers: snapshot.collMovers,
        totalMin: Math.round(snapshot.collTotalTimeMin),
      },
    );
    summaryItems.innerHTML = "";

    if (!snapshot.hasItems) {
      const empty =
        snapshot.currentTab === "boxes"
          ? "Please select items to store."
          : "Please select a storage unit.";
      summaryItems.innerHTML = `<div class="summary-empty">${empty}</div>`;
      return;
    }

    // First Month
    row(summaryItems, "First month", `£${snapshot.storagePrice.toFixed(2)}`);

    // Monthly insurance
    if (snapshot.insurancePrice > 0) {
      row(summaryItems, "Monthly insurance", `£${snapshot.insurancePrice.toFixed(2)}`);
    }

    // Length
    if (snapshot.duration != null) {
      const lenText = snapshot.isRolling ? "Rolling" : `${snapshot.duration} months`;
      row(summaryItems, "Length", lenText);
    }

    // Collection
    if (snapshot.collectionFee > 0) {
      row(summaryItems, "Collection", `£${snapshot.collectionFee.toFixed(2)}`);
    }

    // Date
    if (snapshot.dateStr) {
      row(summaryItems, "Date", snapshot.dateStr);
    }
  }

  function render(_event, snapshot) {
    if (!snapshot) return;

    renderSidebar(snapshot);

    const safeSubtotal =
      typeof snapshot.subtotal === "number" && Number.isFinite(snapshot.subtotal)
        ? snapshot.subtotal
        : 0;
    const priceText = `£${safeSubtotal.toFixed(2)}`;
    if (summarySubtotal) summarySubtotal.textContent = priceText;
    if (summaryTotal) summaryTotal.textContent = priceText;
    if (mobileSummaryTotal) mobileSummaryTotal.textContent = priceText;

    // Future monthly
    if (monthlyBox) {
      const mp = snapshot.monthlyPayment || 0;
      monthlyBox.textContent = `£${mp.toFixed(2)}`;
    }

    if (snapshot.currentStep < 4) {
      const disabled = !snapshot.hasItems;
      if (continueBtn) continueBtn.disabled = disabled;
      if (mobileContinueBtn) mobileContinueBtn.disabled = disabled;
    }

    // Render booking summary on step 4
    const checkoutBox = document.getElementById("checkoutSummaryBox");
    if (checkoutBox && snapshot.currentStep >= 4) {
      checkoutBox.innerHTML = "";
      for (const d of snapshot.bookingDetails) {
        const r = document.createElement("div");
        r.className = "checkout-summary-row";
        const labelSpan = document.createElement("span");
        labelSpan.className = "checkout-summary-row__label";
        labelSpan.textContent = d.label;
        const valueSpan = document.createElement("span");
        valueSpan.className = "checkout-summary-row__value";
        valueSpan.textContent = d.value;
        r.append(labelSpan, valueSpan);
        checkoutBox.appendChild(r);
      }
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

    // Store reference for cleanup
    if (typeof window !== "undefined") {
      window.__smartroomSidebarRo = ro;
    }
  }

  store.subscribe(render);

  render(null, store.getSnapshot());

  return {
    destroy() {
      if (typeof window !== "undefined" && window.__smartroomSidebarRo) {
        window.__smartroomSidebarRo.disconnect();
        delete window.__smartroomSidebarRo;
      }
    },
  };
}
